// relay.mjs: TERTORTOR on the web. Runs on the VPS (or locally for testing); never spawns anything and imports nothing
// from tools/. The real Studio keeps running on the laptop (npm run studio, 127.0.0.1:4331); tools/worker.mjs on the
// laptop long-polls this relay over HTTPS, replays each browser request against the local Studio and posts the answer
// back. So every write still lands in the laptop's videos/ and .events.jsonl, and wait-event + the skills don't change.
//   node tools/relay.mjs                 serve (env below)
//   node tools/relay.mjs hash <password> print a STUDIO_PASSWORD_HASH value
// env: PORT (4330), HOST (127.0.0.1), DATA_DIR (./.relay), STUDIO_PASSWORD_HASH, RELAY_WORKER_TOKEN,
//      TRUST_PROXY=1 (behind Cloudflare Tunnel: read cf-connecting-ip / x-forwarded-for/-proto), CACHE_MAX_MB (3000), MAX_UPLOAD_MB (500)
// Laptop online: every allowed request is relayed live; GET answers are cached. Laptop offline: GETs come from that
// cache, small decisions (approve, concept, preset, …) are queued and replayed when the worker is back, the rest 503.
import { createServer } from "node:http";
import { scryptSync, randomBytes, timingSafeEqual, createHash, generateKeyPairSync, createPrivateKey, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync, truncateSync, unlinkSync, readdirSync, rmdirSync, createReadStream, createWriteStream, utimesSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const [cmd, arg, arg2] = process.argv.slice(2);
// "scrypt:<salt>:<hash>" (":" not "$": docker compose would expand $salt in env_file); the old "$" form still works
const hashOf = (pw) => { const salt = randomBytes(16).toString("hex"); return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString("hex")}`; };
if (cmd === "hash") {
  if (!arg) { console.error("pakai: node tools/relay.mjs hash <password>"); process.exit(1); }
  console.log(hashOf(arg));
  process.exit(0);
}
// setup <password> [url]: writes deploy/studio/.env (for the VPS: password hash + a fresh worker token) and puts
// RELAY_URL + the same token into the laptop's .env, so neither the password nor the token passes through chat
if (cmd === "setup") {
  if (!arg || arg.length < 10) { console.error("pakai: node tools/relay.mjs setup '<password minimal 10 karakter>' [https://…]"); process.exit(1); }
  const root = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
  const token = randomBytes(32).toString("hex"), url = arg2 || "https://tertortor.redactor.my.id";
  writeFileSync(join(root, "deploy", "studio", ".env"), `STUDIO_PASSWORD_HASH=${hashOf(arg)}\nRELAY_WORKER_TOKEN=${token}\nCACHE_MAX_MB=3000\nMAX_UPLOAD_MB=500\n`);
  const le = join(root, ".env");
  const keep = existsSync(le) ? readFileSync(le, "utf8").split(/\r?\n/).filter((l) => l && !/^(RELAY_URL|RELAY_WORKER_TOKEN)=/.test(l)) : [];
  writeFileSync(le, [...keep, `RELAY_URL=${url}`, `RELAY_WORKER_TOKEN=${token}`].join("\n") + "\n");
  console.log(`siap: deploy/studio/.env (untuk VPS) dan .env laptop (RELAY_URL=${url}). Password tidak disimpan di mana pun.`);
  process.exit(0);
}

// vapid: adds a Web Push key pair to deploy/studio/.env once (user 2026-11-07: push notifications when work is done)
const b64u = (b) => Buffer.from(b).toString("base64url");
if (cmd === "vapid") {
  const root = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
  const f = join(root, "deploy", "studio", ".env"), cur = existsSync(f) ? readFileSync(f, "utf8") : "";
  if (/^VAPID_PRIVATE=/m.test(cur)) { console.log("VAPID sudah ada di deploy/studio/.env"); process.exit(0); }
  const jwk = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ format: "jwk" });
  const pub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));
  writeFileSync(f, cur.replace(/\n*$/, "\n") + `VAPID_PUBLIC=${pub}\nVAPID_PRIVATE=${jwk.d}\nVAPID_SUBJECT=${arg || "https://tertortor.redactor.my.id"}\n`);
  console.log("siap: VAPID_PUBLIC/VAPID_PRIVATE/VAPID_SUBJECT ditambahkan ke deploy/studio/.env");
  process.exit(0);
}

const PORT = +(process.env.PORT || 4330), HOST = process.env.HOST || "127.0.0.1";
const DATA = resolve(process.env.DATA_DIR || ".relay");
const PASS = process.env.STUDIO_PASSWORD_HASH || "", TOKEN = process.env.RELAY_WORKER_TOKEN || "";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const CACHE_MAX = +(process.env.CACHE_MAX_MB || 3000) * 1e6, MAX_UPLOAD = +(process.env.MAX_UPLOAD_MB || 500) * 1e6;
if (!/^scrypt[:$][0-9a-f]+[:$][0-9a-f]+$/.test(PASS) || TOKEN.length < 24) {
  console.error("relay: STUDIO_PASSWORD_HASH (node tools/relay.mjs hash …) dan RELAY_WORKER_TOKEN (≥ 24 karakter) wajib diisi");
  process.exit(1);
}
for (const d of ["inbox", "cache/api", "cache/files", "shares"]) mkdirSync(join(DATA, d), { recursive: true });

// ---------- allowlist: exactly the routes tools/studio/index.html uses; anything else is 404 ----------
const SLUG = "[a-z0-9-]+";
const R = (s) => new RegExp(`^${s}$`);
const ROUTES = {
  GET: [R("/"), R("/favicon\\.ico"), R("/api/(videos|structure|presets|voices|looks|library|audio|stories|working)"), R(`/api/videos/${SLUG}`),
    R(`/api/videos/${SLUG}/thumb/${SLUG}\\.jpg`), R("/files/(videos|library)/[^\\\\]+"), R(`/api/subs/(explainer|storytelling|advertisement)/${SLUG}/(logo|buffer|cover)`), R("/api/buffer/channels"), R("/api/users"), R("/api/trash"), R("/api/chat"), R(`/api/videos/${SLUG}/formats`)],
  // /api/users*: answered by the relay itself (accounts live here), never relayed to the laptop; admin only
  POST: [R("/api/chat(/stop|/new)?"), R("/api/users/invite"), R("/api/users/[^/]+/(role|revoke|restore)"), R("/api/videos"), R("/api/subs"), R("/api/stories/(channel|source|scan|use)"),
    R(`/api/videos/${SLUG}/share`), R(`/api/videos/${SLUG}/thumbnail(/options|/video)?`), R(`/api/videos/${SLUG}/(buffer|buffer-caption|delete|formats)`), R(`/api/trash/${SLUG}/restore`), R(`/api/subs/(explainer|storytelling|advertisement)/${SLUG}/(buffer|buffer-key)`), R(`/api/videos/${SLUG}/(approve|beats-approve|clone-approve|storyline|storyline-approve|draft|draft-approve|production|concept|ref|preset|look|voice|ready|script|flow/[\\w-]+)`)],
  DELETE: [R("/api/users/invite/[0-9a-f]{64}"), R("/api/users/[^/]+"), R(`/api/videos/${SLUG}/(approve|beats-approve|clone-approve)`), R(`/api/videos/${SLUG}/share`), R(`/api/subs/(explainer|storytelling|advertisement)/${SLUG}/(logo|buffer-key)`)],
  PUT: [R(`/api/videos/${SLUG}/upload`), R("/api/stories/upload"), R(`/api/subs/(explainer|storytelling|advertisement)/${SLUG}/upload`), R(`/api/subs/(explainer|storytelling|advertisement)/${SLUG}/logo`)],
};
// decisions that make sense to replay later; creating projects/uploading needs the laptop's answer right away
const QUEUEABLE = [R(`POST /api/videos/${SLUG}/(approve|beats-approve|clone-approve|storyline|storyline-approve|draft|draft-approve|production|concept|ref|preset|voice|script|flow/[\\w-]+)`), R(`DELETE /api/videos/${SLUG}/(approve|beats-approve|clone-approve)`)];
const allowed = (m, p) => !p.includes("..") && (ROUTES[m] || []).some((r) => r.test(p));
const isFile = (p) => p.startsWith("/files/") || /\/thumb\/[^/]+\.jpg$/.test(p) || p === "/favicon.ico";

// ---------- small JSON stores ----------
const store = (name, init) => {
  const f = join(DATA, name);
  let v = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : init;
  return { get: () => v, set: (n) => { v = n; writeFileSync(f + ".tmp", JSON.stringify(v)); renameSync(f + ".tmp", f); } };
};
const sessions = store("sessions.json", {}); // sha256(token) -> { exp }
const queued = store("queue.json", []); // offline decisions, oldest first
const failed = store("failed.json", []); // queued jobs the laptop refused (shown in /api/relay/status)

// ---------- Web Push (user 2026-11-07) ----------
// Payload-free pushes signed with VAPID (ES256 JWT): no message encryption needed. The service worker (sw.js) then
// fetches /api/relay/notices with the user's cookie and shows the newest notice. Notices come from the laptop's Studio
// (POST /worker/notify) when a process finishes, so the relay never needs to know project state.
const subs = store("push.json", []); // [{ endpoint, keys, at }]
const notices = store("notices.json", []); // newest first, max 20
const VAPID_PUB = process.env.VAPID_PUBLIC || "", VAPID_PRIV = process.env.VAPID_PRIVATE || "", VAPID_SUB = process.env.VAPID_SUBJECT || "https://tertortor.redactor.my.id";
const vapidKey = VAPID_PUB && VAPID_PRIV ? (() => {
  const raw = Buffer.from(VAPID_PUB, "base64url");
  return createPrivateKey({ key: { kty: "EC", crv: "P-256", d: VAPID_PRIV, x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33, 65)) }, format: "jwk" });
})() : null;
async function pushTo(sub) {
  const aud = new URL(sub.endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" })), claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB }));
  const jwt = `${head}.${claims}.${b64u(sign("sha256", Buffer.from(`${head}.${claims}`), { key: vapidKey, dsaEncoding: "ieee-p1363" }))}`;
  const r = await fetch(sub.endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "high", Authorization: `vapid t=${jwt}, k=${VAPID_PUB}`, "Content-Length": "0" }, signal: AbortSignal.timeout(15e3) });
  return r.status;
}
async function pushAll(n) {
  const url = String(n.url || "/");
  notices.set([{ id: randomBytes(6).toString("hex"), at: new Date().toISOString(), title: String(n.title || "TERTORTOR").slice(0, 120), body: String(n.body || "").slice(0, 300), url: url.startsWith("/") ? url : "/" }, ...notices.get()].slice(0, 20));
  if (!vapidKey) return { sent: 0, note: "VAPID belum diisi" };
  let sent = 0;
  const keep = [];
  for (const s of subs.get()) {
    try {
      const st = await pushTo(s);
      if (st === 404 || st === 410) continue; // the browser dropped this subscription
      if (st < 300) sent++; else console.log("push", st, new URL(s.endpoint).host);
    } catch (e) { console.log("push", e.message); }
    keep.push(s);
  }
  subs.set(keep);
  return { sent, subscribers: keep.length };
}
// ---------- users by invitation (user 2026-11-09) ----------
// The owner keeps the old password (STUDIO_PASSWORD_HASH) and logs in with ADMIN_EMAIL or an empty email. Everyone
// else gets an email with a one-time link (/join/<token>, INVITE_HOURS valid) and picks their own password there.
// Roles: admin (everything + users), editor (everything but users), viewer (GET only). Accounts exist only here on the
// relay: Studio on the laptop stays without login (127.0.0.1) and proxies its "User" page to /worker/users.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const PUBLIC_URL = (process.env.PUBLIC_URL || VAPID_SUB).replace(/\/$/, "");
const INVITE_HOURS = +(process.env.INVITE_HOURS || 72);
const RESEND_KEY = process.env.RESEND_API_KEY || "", MAIL_FROM = process.env.MAIL_FROM || "";
const RESEND_URL = process.env.RESEND_API_URL || "https://api.resend.com/emails"; // overridable only for local tests
const users = store("users.json", {}); // email -> { name, role, hash, status: active|revoked, at, invitedBy, lastLogin }
const invites = store("invites.json", {}); // sha256(token) -> { email, role, exp, at, invitedBy, sent }
const ROLES = ["admin", "editor", "viewer"];
const ROLE_ID = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const EMAIL_RE = /^[^\s@<>"'/\\]{1,64}@[^\s@<>"'/\\]{1,190}\.[a-z]{2,}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

async function mailInvite(to, link, role, exp) {
  const subject = "Undangan ke TERTORTOR";
  const until = new Date(exp).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const text = `Kamu diundang ke TERTORTOR (studio video MOTION) sebagai ${ROLE_ID[role]}.\n\nBuat akunmu di link ini (sekali pakai, berlaku sampai ${until} WIB):\n${link}\n\nKalau kamu tidak merasa diundang, abaikan email ini.`;
  const html = `<div style="font:15px/1.5 system-ui,sans-serif;color:#222;max-width:480px"><p>Kamu diundang ke <b>TERTORTOR</b> (studio video MOTION) sebagai <b>${ROLE_ID[role]}</b>.</p>
<p><a href="${escHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Buat akun</a></p>
<p style="color:#666;font-size:13px">Link ini sekali pakai dan berlaku sampai ${until} WIB. Kalau tombolnya tidak jalan, salin alamat ini:<br>${escHtml(link)}</p>
<p style="color:#666;font-size:13px">Kalau kamu tidak merasa diundang, abaikan email ini.</p></div>`;
  if (!RESEND_KEY || !MAIL_FROM || process.env.MAIL_DRY === "1") {
    // no mail service yet (or a dry run): keep the email on disk so the admin can still pass the link on by hand
    mkdirSync(join(DATA, "outbox"), { recursive: true });
    writeFileSync(join(DATA, "outbox", `${Date.now()}-${to.replace(/[^\w.@-]/g, "_")}.html`), `<!-- to: ${to} | ${subject} -->\n${html}`);
    return { sent: false, note: RESEND_KEY && MAIL_FROM ? "MAIL_DRY=1: email tidak dikirim" : "Email belum diatur (RESEND_API_KEY dan MAIL_FROM di deploy/studio/.env). Bagikan link ini sendiri." };
  }
  try {
    const r = await fetch(RESEND_URL, { method: "POST", headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }), signal: AbortSignal.timeout(15e3) });
    if (r.ok) return { sent: true };
    const e = await r.json().catch(() => ({}));
    return { sent: false, note: `Resend menolak (${r.status}): ${String(e.message || e.error || "").slice(0, 200)}` };
  } catch (e) { return { sent: false, note: `Email gagal: ${e.message}` }; }
}
const killSessions = (email) => sessions.set(Object.fromEntries(Object.entries(sessions.get()).filter(([, s]) => s.email !== email)));
const inviteList = () => Object.entries(invites.get()).map(([id, v]) => ({ id, email: v.email, role: v.role, at: v.at, exp: new Date(v.exp).toISOString(), expired: v.exp < Date.now(), invitedBy: v.invitedBy, sent: v.sent }));
// GET /users, POST /users/invite, DELETE /users/invite/<id>, POST /users/<email>/(role|revoke|restore), DELETE /users/<email>
// `sub` is the path after /api or /worker; `by` is who asks (an admin's email, or "laptop" for Studio on the laptop)
async function usersApi(m, sub, req, by) {
  const body = m === "POST" ? JSON.parse((await readBody(req, 8192)).toString() || "{}") : {};
  const all = { ...users.get() };
  if (sub === "/users" && m === "GET") {
    const now = Date.now(); // expired invites stay visible for a week, then go
    invites.set(Object.fromEntries(Object.entries(invites.get()).filter(([, v]) => v.exp > now - 7 * 864e5)));
    return { owner: ADMIN_EMAIL || null, me: by, mail: !!(RESEND_KEY && MAIL_FROM), hours: INVITE_HOURS, roles: ROLES,
      users: Object.entries(all).map(([email, u]) => ({ email, name: u.name, role: u.role, status: u.status, at: u.at, invitedBy: u.invitedBy, lastLogin: u.lastLogin || null })).sort((a, b) => a.at.localeCompare(b.at)),
      invites: inviteList().sort((a, b) => b.at.localeCompare(a.at)) };
  }
  if (sub === "/users/invite" && m === "POST") {
    const email = String(body.email || "").trim().toLowerCase(), role = ROLES.includes(body.role) ? body.role : "editor";
    if (!EMAIL_RE.test(email)) return [400, { error: "Alamat email tidak valid." }];
    if (email === ADMIN_EMAIL) return [409, { error: "Itu email pemilik." }];
    if (all[email]) return [409, { error: all[email].status === "revoked" ? "User ini sudah ada tapi dicabut: pulihkan saja." : "User ini sudah punya akun." }];
    const token = randomBytes(32).toString("base64url"), exp = Date.now() + INVITE_HOURS * 3600e3, link = `${PUBLIC_URL}/join/${token}`;
    const mail = await mailInvite(email, link, role, exp);
    // one open invitation per email: sending again replaces the old link
    invites.set({ ...Object.fromEntries(Object.entries(invites.get()).filter(([, v]) => v.email !== email)), [sha(token)]: { email, role, exp, at: new Date().toISOString(), invitedBy: by, sent: mail.sent } });
    return { ok: true, email, role, sent: mail.sent, note: mail.note || null, link, exp: new Date(exp).toISOString() };
  }
  const inv = sub.match(/^\/users\/invite\/([0-9a-f]{64})$/);
  if (inv && m === "DELETE") {
    const left = { ...invites.get() }; delete left[inv[1]]; invites.set(left);
    return { ok: true };
  }
  const u = sub.match(/^\/users\/([^/]+?)(?:\/(role|revoke|restore))?$/);
  const email = u && u[1].toLowerCase();
  if (!u || !all[email]) return [404, { error: "User tidak ada." }];
  if (email === by) return [400, { error: "Akunmu sendiri tidak bisa diubah dari sini." }];
  if (u[2] === "role" && m === "POST") {
    if (!ROLES.includes(body.role)) return [400, { error: "Peran tidak dikenal." }];
    users.set({ ...all, [email]: { ...all[email], role: body.role } });
    return { ok: true };
  }
  if ((u[2] === "revoke" || u[2] === "restore") && m === "POST") {
    users.set({ ...all, [email]: { ...all[email], status: u[2] === "revoke" ? "revoked" : "active" } });
    if (u[2] === "revoke") killSessions(email);
    return { ok: true };
  }
  if (!u[2] && m === "DELETE") {
    delete all[email]; users.set(all); killSessions(email);
    return { ok: true };
  }
  return [404, { error: "not found" }];
}
const answer = (res, r) => (Array.isArray(r) ? send(res, r[0], r[1]) : send(res, 200, r));

// PWA files are public (browsers fetch the manifest and icons without cookies); the same files as tools/studio/pwa
const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PWA_DIR = [join(HERE, "pwa"), join(HERE, "studio", "pwa")].find((d) => existsSync(d));
const PWA = { "/sw.js": ["sw.js", "text/javascript; charset=utf-8"], "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json"], "/pwa/icon-192.png": ["icon-192.png", "image/png"], "/pwa/icon-512.png": ["icon-512.png", "image/png"], "/pwa/apple-touch-icon.png": ["apple-touch-icon.png", "image/png"] };

// ---------- auth ----------
const sha = (s) => createHash("sha256").update(s).digest("hex");
const eq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const checkPassword = (pw) => {
  const [, salt, hash] = PASS.split(/[:$]/);
  return eq(scryptSync(String(pw), salt, 64).toString("hex"), hash);
};
const cookies = (req) => Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const checkUser = (email, pw) => {
  const u = users.get()[email];
  if (!u) { scryptSync(String(pw), "x".repeat(32), 64); return false; } // same work for an unknown email
  const [, salt, hash] = u.hash.split(":");
  return u.status === "active" && eq(scryptSync(String(pw), salt, 64).toString("hex"), hash);
};
// who is logged in: { email, role, name } or null. Sessions from before accounts (no email) are the owner's. A user's
// role and status are read on every request, so revoking or changing a role works at once.
const session = (req) => {
  const t = cookies(req).tt_session;
  const s = t && sessions.get()[sha(t)];
  if (!s || s.exp <= Date.now()) return null;
  if (!s.email || s.email === ADMIN_EMAIL) return { email: ADMIN_EMAIL || "pemilik", role: "admin", name: "Pemilik", owner: true };
  const u = users.get()[s.email];
  return u && u.status === "active" ? { email: s.email, role: u.role, name: u.name, owner: false } : null;
};
const newSession = (req, email) => {
  const t = randomBytes(32).toString("hex"), now = Date.now();
  sessions.set({ ...Object.fromEntries(Object.entries(sessions.get()).filter(([, s]) => s.exp > now)), [sha(t)]: { exp: now + 30 * 864e5, ...(email ? { email } : {}) } });
  return `tt_session=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}${secure(req) ? "; Secure" : ""}`;
};
const tooMany = (who) => (fails.get(who) || []).filter((t) => Date.now() - t < LOGIN_WINDOW).length >= LOGIN_MAX;
const failed1 = (who) => fails.set(who, [...(fails.get(who) || []).filter((t) => Date.now() - t < LOGIN_WINDOW), Date.now()]);
// behind Cloudflare Tunnel the visitor is cf-connecting-ip (the only way in is the tunnel, so the header is Cloudflare's)
const ip = (req) => (TRUST_PROXY && (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]?.split(",")[0].trim())) || req.socket.remoteAddress;
const secure = (req) => (TRUST_PROXY ? req.headers["x-forwarded-proto"] === "https" : false);
const fails = new Map(); // ip -> [timestamps]
const LOGIN_WINDOW = 15 * 60e3, LOGIN_MAX = 5;

// ---------- responses ----------
const HDR = { "x-frame-options": "DENY", "x-content-type-options": "nosniff", "referrer-policy": "same-origin", "cache-control": "no-store" };
const send = (res, code, body, type = "application/json", extra = {}) => {
  if (res.headersSent) return res.end();
  res.writeHead(code, { ...HDR, "content-type": type, ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".ico": "image/x-icon" };
function serveFile(req, res, abs, type) {
  const size = statSync(abs).size;
  type ||= MIME[extname(abs).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range && size) {
    const start = range[1] ? +range[1] : Math.max(0, size - +range[2]);
    const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    if (start >= size || start > end) return send(res, 416, "", "text/plain", { "content-range": `bytes */${size}` });
    res.writeHead(206, { ...HDR, "cache-control": "private, max-age=60", "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    return createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...HDR, "cache-control": "private, max-age=60", "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  createReadStream(abs).pipe(res);
}
const readBody = (req, max) => new Promise((ok, bad) => {
  const b = []; let n = 0;
  req.on("data", (d) => { n += d.length; if (n > max) { bad(new Error("too large")); req.destroy(); } else b.push(d); });
  req.on("end", () => ok(Buffer.concat(b))).on("error", bad);
});

// ---------- cache: last good answer per GET, so Studio still opens with the laptop off ----------
const apiCache = (key) => join(DATA, "cache/api", sha(key) + ".json");
const fileCache = (p) => join(DATA, "cache/files", sha(p) + (extname(p).toLowerCase() || ".bin"));
const fetchedAt = new Map(); // cached file -> when the laptop last confirmed it
const FILE_TTL = 60e3;
function pruneCache() {
  const dir = join(DATA, "cache/files");
  const all = readdirSync(dir).map((f) => { const s = statSync(join(dir, f)); return { f, size: s.size, at: s.atimeMs }; }).sort((a, b) => a.at - b.at);
  let total = all.reduce((n, x) => n + x.size, 0);
  for (const x of all) { if (total <= CACHE_MAX) break; unlinkSync(join(dir, x.f)); total -= x.size; }
}

// ---------- jobs ----------
// live job: { id, method, path, type, body (base64) | blob (inbox file), at }; waiters resolve the browser's request
const live = []; const waiters = new Map(); const pollers = [];
let lastSeen = 0, taken = new Map(); // id -> job (handed to the worker, waiting for its result)
// a live worker always has a long-poll open, except for the moment between two polls or while all its loops are busy
const online = () => pollers.length > 0 || Date.now() - lastSeen < 5e3 || (taken.size > 0 && Date.now() - lastSeen < 60e3);
const newId = () => randomBytes(9).toString("hex");
function dispatch() {
  while (pollers.length) {
    const job = queued.get()[0] || live.shift();
    if (!job) return;
    if (job === queued.get()[0]) queued.set(queued.get().slice(1));
    taken.set(job.id, { ...job, takenAt: Date.now() });
    const { res, timer } = pollers.shift();
    clearTimeout(timer);
    send(res, 200, { id: job.id, method: job.method, path: job.path, type: job.type, body: job.body || null, blob: !!job.blob, ...(job.ifMtime ? { ifMtime: job.ifMtime } : {}) });
  }
}
function relay(job, wait) {
  return new Promise((resolveJob) => {
    const timer = setTimeout(() => {
      waiters.delete(job.id);
      const i = live.indexOf(job); if (i >= 0) live.splice(i, 1);
      resolveJob({ status: 504, type: "application/json", body: Buffer.from(JSON.stringify({ error: "Laptop tidak menjawab. Coba lagi sebentar." })) });
    }, wait);
    waiters.set(job.id, (r) => { clearTimeout(timer); resolveJob(r); });
    live.push(job);
    dispatch();
  });
}
// a worker that died mid-job: its job goes back for live ones still waited on, queued ones go back to the queue
setInterval(() => {
  for (const [id, j] of taken) if (Date.now() - j.takenAt > 10 * 60e3) {
    taken.delete(id);
    if (j.queuedAt) queued.set([j, ...queued.get()]);
    else waiters.get(id)?.({ status: 504, type: "application/json", body: Buffer.from(JSON.stringify({ error: "Laptop berhenti di tengah jalan." })) });
  }
}, 30e3).unref();

// ---------- shared videos (tools/share.mjs, user 2026-11-07) ----------
// Studio uploads a compressed copy here; anyone with /v/<token> can watch it without login, also while the laptop is
// off. Nothing lists the tokens, the page is noindex, and DELETE from Studio ("Cabut link") removes the files.
const SHARES = join(DATA, "shares");
const TOK = /^[A-Za-z0-9_-]{22}$/;
const shareDir = (t) => join(SHARES, t);
const shareMeta = (t) => { try { return JSON.parse(readFileSync(join(shareDir(t), "meta.json"), "utf8")); } catch { return null; } };
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SHARE_PAGE = (t, m) => `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${escHtml(m.title)}</title>
<style>html,body{margin:0;height:100%;background:#0b0d0e;color:#e9e6df;font:15px/1.4 system-ui,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box}
video{max-width:100%;max-height:calc(100vh - 90px);aspect-ratio:9/16;background:#000;border-radius:10px}
h1{font-size:15px;font-weight:600;margin:0;text-align:center;opacity:.85}</style>
<main><video src="/v/${t}/video.mp4" ${existsSync(join(shareDir(t), "poster.jpg")) ? `poster="/v/${t}/poster.jpg" ` : ""}controls playsinline preload="metadata"></video><h1>${escHtml(m.title)}</h1></main></html>`;

const LOGIN = (msg = "") => `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TERTORTOR</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font:16px system-ui,sans-serif}
form{display:grid;gap:12px;width:min(320px,90vw)}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #333;background:#1b1b1b;color:#eee}
button{background:#eee;color:#111;border:0;font-weight:600}p{color:#f77;margin:0;min-height:1.2em}</style>
<form method="post" action="/login"><b style="font-size:20px">TERTORTOR</b><input type="email" name="email" placeholder="Email" autofocus autocomplete="username"><input type="password" name="password" placeholder="Password" required autocomplete="current-password"><button>Masuk</button><p>${msg}</p></form></html>`;
// /join/<token>: the invited person picks a name and their own password; the link works once
const JOIN = (inv, msg = "") => `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>TERTORTOR · buat akun</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font:16px system-ui,sans-serif}
form,div{display:grid;gap:12px;width:min(340px,90vw)}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #333;background:#1b1b1b;color:#eee}
input[readonly]{opacity:.7}button{background:#eee;color:#111;border:0;font-weight:600}p{color:#f77;margin:0;min-height:1.2em}small{color:#999}a{color:#eee}</style>
${inv ? `<form method="post"><b style="font-size:20px">Buat akun TERTORTOR</b><small>Diundang sebagai ${ROLE_ID[inv.role]}. Link ini sekali pakai.</small>
<input type="email" value="${escHtml(inv.email)}" readonly autocomplete="username"><input name="name" placeholder="Nama" required maxlength="60" autofocus>
<input type="password" name="password" placeholder="Password (minimal 10 karakter)" required minlength="10" autocomplete="new-password"><input type="password" name="password2" placeholder="Ulangi password" required minlength="10" autocomplete="new-password">
<button>Buat akun</button><p>${msg}</p></form>` : `<div><b style="font-size:20px">Link tidak berlaku</b><small>Undangan ini sudah dipakai, dibatalkan, atau kedaluwarsa. Minta undangan baru ke admin.</small><a href="/login">Ke halaman login</a></div>`}</html>`;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    const m = req.method;

    // ---------- worker side (Bearer token) ----------
    if (p.startsWith("/worker/")) {
      if (!eq((req.headers.authorization || "").replace(/^Bearer /, ""), TOKEN)) return send(res, 401, { error: "token" });
      lastSeen = Date.now();
      if (p === "/worker/next" && m === "GET") {
        const wait = Math.min(+(url.searchParams.get("wait") || 25), 30) * 1000;
        const poller = { res, timer: setTimeout(() => { pollers.splice(pollers.indexOf(poller), 1); lastSeen = Date.now(); send(res, 204, ""); }, wait) };
        req.on("close", () => { const i = pollers.indexOf(poller); if (i >= 0) { clearTimeout(poller.timer); pollers.splice(i, 1); } });
        pollers.push(poller);
        return dispatch();
      }
      const blob = p.match(/^\/worker\/blob\/([0-9a-f]+)$/);
      if (blob && m === "GET") {
        const f = join(DATA, "inbox", blob[1]);
        return existsSync(f) ? serveFile(req, res, f, "application/octet-stream") : send(res, 404, { error: "blob" });
      }
      const result = p.match(/^\/worker\/result\/([0-9a-f]+)$/);
      if (result && m === "POST") {
        const job = taken.get(result[1]);
        taken.delete(result[1]);
        const status = +req.headers["x-status"] || 502, type = req.headers["x-type"] || "application/octet-stream";
        if (!job) { req.resume(); return send(res, 200, { ok: false, late: true }); } // the browser already got a 504
        if (isFile(job.path) && status === 200) {
          // stream big files straight into the cache, then serve from there (range requests for <video>)
          const f = fileCache(job.path);
          await pipeline(req, createWriteStream(f + ".part"));
          renameSync(f + ".part", f);
          const mt = +req.headers["x-mtime"]; if (mt) utimesSync(f, new Date(), new Date(mt));
          fetchedAt.set(f, Date.now());
          pruneCache();
          waiters.get(job.id)?.({ status, type, file: f });
        } else {
          const body = await readBody(req, 20e6);
          if (status === 200 && job.method === "GET" && !isFile(job.path)) writeFileSync(apiCache(job.path), body);
          if (status === 304) { const f = fileCache(job.path); fetchedAt.set(f, Date.now()); waiters.get(job.id)?.({ status: 200, type, file: f }); }
          else if (job.queuedAt && status >= 400) failed.set([...failed.get().slice(-19), { method: job.method, path: job.path, at: new Date().toISOString(), status, error: body.toString().slice(0, 300) }]);
          else waiters.get(job.id)?.({ status, type, body });
        }
        if (job.blob) try { unlinkSync(join(DATA, "inbox", job.id)); } catch {}
        waiters.delete(result[1]);
        return send(res, 200, { ok: true });
      }
      if (p === "/worker/share" && m === "POST") {
        const b = JSON.parse((await readBody(req, 8192)).toString() || "{}");
        const t = TOK.test(b.token || "") && shareMeta(b.token) ? b.token : randomBytes(16).toString("base64url");
        mkdirSync(shareDir(t), { recursive: true });
        writeFileSync(join(shareDir(t), "meta.json"), JSON.stringify({ title: String(b.title || "TERTORTOR").slice(0, 200), at: new Date().toISOString() }));
        return send(res, 200, { token: t });
      }
      const sh = p.match(/^\/worker\/share\/([A-Za-z0-9_-]{22})(?:\/(video|poster))?$/);
      if (sh && !shareMeta(sh[1])) { req.resume(); return send(res, 404, { error: "share" }); }
      if (sh && sh[2] && m === "PUT") {
        // ?part=N&of=M: the laptop sends the video in pieces, because Cloudflare cuts a request off after ±100 s and a
        // slow home upload (±150 KB/s) needs minutes for 40-80 MB. Part 0 starts the file, the last part publishes it.
        const f = join(shareDir(sh[1]), sh[2] === "video" ? "video.mp4" : "poster.jpg");
        const part = +(url.searchParams.get("part") ?? 0), of = +(url.searchParams.get("of") ?? 1);
        if (!(part >= 0 && part < of && of <= 200)) { req.resume(); return send(res, 400, { error: "part" }); }
        // ?at=<byte offset>: a piece sent again after a broken attempt overwrites its half-written tail instead of doubling it
        const at = +(url.searchParams.get("at") ?? 0);
        if (part > 0 && !(existsSync(f + ".part") && statSync(f + ".part").size >= at)) { req.resume(); return send(res, 409, { error: "earlier part missing" }); }
        if (part > 0) truncateSync(f + ".part", at);
        let n = part > 0 ? at : 0;
        req.on("data", (d) => { n += d.length; if (n > MAX_UPLOAD) req.destroy(new Error("too large")); });
        await pipeline(req, createWriteStream(f + ".part", { flags: part > 0 ? "a" : "w" }));
        if (part === of - 1) renameSync(f + ".part", f);
        return send(res, 200, { ok: true, size: n });
      }
      if (sh && !sh[2] && m === "DELETE") {
        for (const f of readdirSync(shareDir(sh[1]))) unlinkSync(join(shareDir(sh[1]), f));
        rmdirSync(shareDir(sh[1]));
        return send(res, 200, { ok: true });
      }
      if (p === "/worker/notify" && m === "POST") {
        const n = JSON.parse((await readBody(req, 8192)).toString() || "{}");
        return send(res, 200, await pushAll(n));
      }
      // Studio on the laptop (no login, 127.0.0.1) manages users through here as the owner
      if (/^\/worker\/users(\/|$)/.test(p)) return answer(res, await usersApi(m, p.slice(7), req, "laptop"));
      return send(res, 404, { error: "not found" });
    }

    // ---------- shared video (public, by token) ----------
    const pv = p.match(/^\/v\/([A-Za-z0-9_-]{22})(\/video\.mp4|\/poster\.jpg)?$/);
    if (pv && m === "GET") {
      const meta = shareMeta(pv[1]), f = pv[2] && join(shareDir(pv[1]), pv[2].slice(1));
      if (!meta || (f && !existsSync(f))) return send(res, 404, "Link ini tidak ada atau sudah dicabut.", "text/plain; charset=utf-8", { "x-robots-tag": "noindex" });
      if (!f) return send(res, 200, SHARE_PAGE(pv[1], meta), MIME[".html"], { "x-robots-tag": "noindex", "referrer-policy": "no-referrer" });
      return serveFile(req, res, f);
    }

    // ---------- PWA (public) ----------
    if (PWA[p] && m === "GET" && PWA_DIR) return send(res, 200, readFileSync(join(PWA_DIR, PWA[p][0])), PWA[p][1], { "cache-control": "no-cache" });

    // ---------- login ----------
    if (p === "/login" && m === "GET") return send(res, 200, LOGIN(), MIME[".html"]);
    if (p === "/login" && m === "POST") {
      const who = ip(req);
      if (tooMany(who)) return send(res, 429, LOGIN("Terlalu banyak percobaan. Tunggu 15 menit."), MIME[".html"]);
      const f = new URLSearchParams((await readBody(req, 4096)).toString());
      const email = (f.get("email") || "").trim().toLowerCase(), pw = f.get("password") || "";
      // the owner: the old password with ADMIN_EMAIL or no email; everyone else: their own account
      const owner = (!email || email === ADMIN_EMAIL) && checkPassword(pw);
      if (!owner && !(email && checkUser(email, pw))) { failed1(who); return send(res, 401, LOGIN(email ? "Email atau password salah." : "Password salah."), MIME[".html"]); }
      fails.delete(who);
      if (!owner) users.set({ ...users.get(), [email]: { ...users.get()[email], lastLogin: new Date().toISOString() } });
      return send(res, 303, "", "text/plain", { location: "/", "set-cookie": newSession(req, owner ? null : email) });
    }
    const jn = p.match(/^\/join\/([A-Za-z0-9_-]+)$/);
    if (jn) {
      const extra = { "referrer-policy": "no-referrer", "x-robots-tag": "noindex" };
      const key = TOKEN_RE.test(jn[1]) ? sha(jn[1]) : "", inv = key && invites.get()[key];
      const valid = inv && inv.exp > Date.now() && !users.get()[inv.email];
      if (m === "GET") return send(res, valid ? 200 : 410, JOIN(valid ? inv : null), MIME[".html"], extra);
      if (m !== "POST") return send(res, 405, "", "text/plain");
      const who = ip(req);
      if (tooMany(who)) return send(res, 429, JOIN(valid ? inv : null, "Terlalu banyak percobaan. Tunggu 15 menit."), MIME[".html"], extra);
      if (!valid) { failed1(who); return send(res, 410, JOIN(null), MIME[".html"], extra); }
      const f = new URLSearchParams((await readBody(req, 4096)).toString());
      const name = (f.get("name") || "").trim().slice(0, 60), pw = f.get("password") || "";
      const bad = !name ? "Isi nama." : pw.length < 10 ? "Password minimal 10 karakter." : pw !== f.get("password2") ? "Kedua password tidak sama." : "";
      if (bad) return send(res, 400, JOIN(inv, bad), MIME[".html"], extra);
      const left = { ...invites.get() }; delete left[key]; invites.set(left); // used once
      users.set({ ...users.get(), [inv.email]: { name, role: inv.role, hash: hashOf(pw), status: "active", at: new Date().toISOString(), invitedBy: inv.invitedBy, lastLogin: new Date().toISOString() } });
      return send(res, 303, "", "text/plain", { ...extra, location: "/", "set-cookie": newSession(req, inv.email) });
    }
    if (p === "/logout" && m === "POST") {
      const t = cookies(req).tt_session;
      if (t) { const s = { ...sessions.get() }; delete s[sha(t)]; sessions.set(s); }
      return send(res, 303, "", "text/plain", { location: "/login", "set-cookie": "tt_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" });
    }
    const me = session(req);
    if (!me) return m === "GET" && (p === "/" || !p.startsWith("/api/")) && !isFile(p) ? send(res, 303, "", "text/plain", { location: "/login" }) : send(res, 401, { error: "Belum login" });
    // same-origin writes only (SameSite=Strict already blocks most CSRF; this closes the rest)
    if (m !== "GET" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: "origin" });
    if (p === "/api/relay/me" && m === "GET") return send(res, 200, me);
    // viewer: looks only (push subscription is just this device's bell)
    if (me.role === "viewer" && m !== "GET" && !/^\/api\/relay\/push-(subscribe|test)$/.test(p)) return send(res, 403, { error: "Akun viewer hanya bisa melihat." });

    if (p === "/api/relay/status") return send(res, 200, { online: online(), lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null, queued: queued.get().map((j) => ({ method: j.method, path: j.path, at: j.queuedAt })), failed: failed.get() });
    if (p === "/api/relay/vapid" && m === "GET") return send(res, 200, { key: VAPID_PUB || null });
    if (p === "/api/relay/notices" && m === "GET") return send(res, 200, { notices: notices.get().slice(0, 5) });
    if (p === "/api/relay/push-subscribe" && m === "POST") {
      const sub = JSON.parse((await readBody(req, 8192)).toString() || "{}");
      if (!/^https:\/\//.test(sub.endpoint || "") || !sub.keys?.p256dh) return send(res, 400, { error: "langganan tidak valid" });
      subs.set([...subs.get().filter((x) => x.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: sub.keys, at: new Date().toISOString() }].slice(-20));
      return send(res, 200, { ok: true, subscribers: subs.get().length });
    }
    if (p === "/api/relay/push-test" && m === "POST") return send(res, 200, await pushAll({ title: "TERTORTOR", body: "Tes notifikasi: kalau ini muncul, notifikasi proses selesai juga akan muncul.", url: "/" }));
    if (!allowed(m, p)) return send(res, 404, { error: "not found" });
    // accounts live here, not on the laptop: answered by the relay itself (also with the laptop off), admins only
    // Chat panel = Claude Code running on the laptop: admins only (user 2026-11-13)
    if (/^\/api\/chat(\/|$)/.test(p) && me.role !== "admin") return send(res, 403, { error: "Chat Claude hanya untuk admin." });
    if (p.startsWith("/api/users")) return me.role === "admin" ? answer(res, await usersApi(m, p.slice(4), req, me.email)) : send(res, 403, { error: "Hanya admin yang bisa mengelola user." });

    const path = p + url.search;
    // ---------- GET ----------
    if (m === "GET") {
      if (isFile(p)) {
        const f = fileCache(path);
        const has = existsSync(f);
        if (has && (Date.now() - (fetchedAt.get(f) || 0) < FILE_TTL || !online())) { utimesSync(f, new Date(), statSync(f).mtime); return serveFile(req, res, f); }
        if (!online()) return send(res, 503, { error: "Laptop offline dan file ini belum pernah dibuka." });
        const r = await relay({ id: newId(), method: "GET", path, at: Date.now(), ...(has ? { ifMtime: statSync(f).mtimeMs } : {}) }, 5 * 60e3);
        if (r.file && existsSync(r.file)) return serveFile(req, res, r.file);
        return send(res, r.status, r.body, r.type);
      }
      if (!online()) {
        const c = apiCache(path);
        if (existsSync(c)) return send(res, 200, readFileSync(c), p === "/" ? MIME[".html"] : "application/json", { "x-relay-cache": statSync(c).mtime.toISOString() });
        return send(res, 503, { error: "Laptop offline dan halaman ini belum pernah dibuka." });
      }
      const r = await relay({ id: newId(), method: "GET", path, at: Date.now() }, 30e3);
      return send(res, r.status, r.body, r.type);
    }

    // ---------- writes ----------
    const type = req.headers["content-type"] || "";
    if (m === "PUT") {
      if (!online()) return send(res, 503, { error: "Laptop offline: unggahan butuh laptop menyala." });
      if (+(req.headers["content-length"] || 0) > MAX_UPLOAD) return send(res, 413, { error: "File terlalu besar." });
      const id = newId(), f = join(DATA, "inbox", id);
      let n = 0;
      req.on("data", (d) => { n += d.length; if (n > MAX_UPLOAD) req.destroy(new Error("too large")); });
      await pipeline(req, createWriteStream(f));
      const r = await relay({ id, method: m, path, type, blob: true, at: Date.now() }, 10 * 60e3);
      if (r.status === 504) try { unlinkSync(f); } catch {}
      return send(res, r.status, r.body, r.type);
    }
    const body = (await readBody(req, 2e6)).toString("base64");
    if (!online()) {
      if (!QUEUEABLE.some((r) => r.test(`${m} ${p}`))) return send(res, 503, { error: "Laptop offline. Membuat proyek dan membaca sumber butuh laptop menyala." });
      queued.set([...queued.get(), { id: newId(), method: m, path, type, body, queuedAt: new Date().toISOString() }]);
      return send(res, 202, { ok: true, queued: true });
    }
    const r = await relay({ id: newId(), method: m, path, type, body, at: Date.now() }, /\/(script|buffer-caption)$/.test(p) ? 6 * 60e3 : /\/(share|buffer)$/.test(p) ? 15 * 60e3 : 60e3); // saving a script / writing a Buffer caption may need Gemini, then Claude; sending to Buffer may upload the share link first
    return send(res, r.status, r.body, r.type);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "relay error" });
  }
}).listen(PORT, HOST, () => console.log(`TERTORTOR relay: http://${HOST}:${PORT} (data ${DATA})`));
