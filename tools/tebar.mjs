// Kirim ke Tebar (user 2026-11-14: "Pindah ke Tebar, buffer jadi cadangan saja"). Tebar (tebar.app, REST API
// https://api.tebar.app/v1, docs https://docs.tebar.app/api) schedules or publishes one post to the social accounts
// connected in a Tebar account (Instagram, TikTok, YouTube, Threads, Facebook Page, ...). Unlike Buffer it takes the video
// itself: the finished render (out/<slug>.mp4, max 300 MB, width ≤ 1920) is uploaded in parts, so no relay share link is
// involved and nothing breaks when a link is revoked. Buffer was removed on 2026-11-16 (user "hapus aja buffer").
//
// Keys work like Buffer's (user 2026-11-10/12): one per TERTORTOR channel / preset / product, pasted by the user in Studio
// (sub page, Tebar panel), stored in .tebar-keys.json (gitignored), .env TEBAR_API_KEY_<SUB> as fallback, the API only
// ever shows "••••1234". A Tebar key locked to one profile (workspace) only sees that workspace's accounts, which is the
// cleanest match for one sub; an owner key sees every account and the sub page picks which ones get its videos.
// Each sub's targets: <subDir>/tebar.json { accounts: [id], ai: true }. Every post sent: videos/<slug>/tebar.json.
// The caption is caption.md the agent writes (tools/caption.mjs writeCaption), credits appended.
//
//   node tools/tebar.mjs keys                        subs with a Tebar key (names + where, never the values)
//   node tools/tebar.mjs accounts <sub>              connected accounts of that sub's key (id, platform, name)
//   node tools/tebar.mjs send <slug> [--at ISO] [--text "…"]   upload the render and post (now unless --at)
//   node tools/tebar.mjs status <slug>               refresh the last post's per-account status (published / failed)
import { existsSync, readFileSync, writeFileSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ROOT, readJSON, writeJSON, die, videoDir, probeDuration } from "./lib.mjs";
import { placeOf, subDir } from "./categories.mjs";
import { settings as thumbSettings } from "./thumbnail.mjs";
import { defaultText, captionTitle } from "./caption.mjs";

const API = "https://api.tebar.app/v1";
export const keyName = (sub) => `TEBAR_API_KEY_${String(sub || "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
const envFile = () => { const f = join(ROOT, ".env"); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
const envKey = (sub) => { const n = keyName(sub); return envFile().match(new RegExp(`^\\s*${n}\\s*=\\s*(\\S+)\\s*$`, "m"))?.[1] || process.env[n] || ""; };
const STORE = join(ROOT, ".tebar-keys.json");
const stored = () => { try { return JSON.parse(readFileSync(STORE, "utf8")); } catch { return {}; } };
const key = (sub) => (sub ? stored()[sub]?.key || envKey(sub) : "");
export const hasKey = (sub) => !!key(sub);
export function keyInfo(sub) {
  const k = key(sub), s = stored()[sub];
  if (!k) return { key: false, keyName: keyName(sub), source: null, hint: null };
  return { key: true, keyName: keyName(sub), source: s?.key ? "studio" : "env", hint: `••••${k.slice(-4)}`, at: s?.at ?? null };
}
export function setKey(sub, value) {
  const v = String(value ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(sub || "")) throw new Error("channel tidak valid");
  if (!/^tb_[\x21-\x7e]{12,400}$/.test(v)) throw new Error("API key Tebar tidak terbaca (diawali tb_). Tempel utuh, tanpa spasi.");
  writeFileSync(STORE, JSON.stringify({ ...stored(), [sub]: { key: v, at: new Date().toISOString() } }, null, 2));
  return keyInfo(sub);
}
export function removeKey(sub) { const all = stored(); delete all[sub]; writeFileSync(STORE, JSON.stringify(all, null, 2)); return keyInfo(sub); }
export const keyedSubs = () => [...new Set([
  ...Object.keys(stored()).filter((s) => stored()[s]?.key),
  ...[...envFile().matchAll(/^\s*TEBAR_API_KEY_([A-Z0-9_]+)\s*=\s*\S+/gm)].map((m) => m[1].toLowerCase().replace(/_/g, "-")),
])];

// one REST call; Tebar errors are { error: { code, message, details } } (docs /api/error)
async function api(sub, method, path, { json, body, headers = {}, timeout = 120000 } = {}) {
  if (!key(sub)) throw new Error(`API key Tebar untuk channel ini belum diisi (tempel di halaman channel, panel Tebar; buat di tebar.app → menu akun → API key).`);
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + path, {
      method, signal: AbortSignal.timeout(timeout),
      headers: { authorization: `Bearer ${key(sub)}`, ...(json ? { "content-type": "application/json" } : {}), ...headers },
      body: json ? JSON.stringify(json) : body,
    });
    if (r.status === 429 && attempt < 3) { await new Promise((ok) => setTimeout(ok, Math.min(60, +r.headers.get("retry-after") || 5) * 1000)); continue; }
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error("Tebar menolak API key (401). Ganti key di halaman channel (panel Tebar).");
    if (!r.ok) { const e = new Error(`Tebar: ${j.error?.message || j.error?.code || j.message || `HTTP ${r.status}`}`); e.code = j.error?.code; e.status = r.status; throw e; }
    return j;
  }
}

// connected social accounts of the sub's key (field names normalised: the API returns snake_case)
export async function listAccounts(sub) {
  const j = await api(sub, "GET", "/accounts");
  return (j.data ?? j.accounts ?? (Array.isArray(j) ? j : [])).map((a) => ({
    id: a.id, platform: a.platform ?? a.provider ?? "?",
    name: a.display_name || a.name || a.username || a.handle || a.id,
    username: a.username ?? null, avatar: a.avatar_url ?? a.picture_url ?? a.avatar ?? null,
    status: a.status ?? null,
  }));
}

const confFile = (category, sub) => join(subDir(category, sub), "tebar.json");
// saved: false = never picked, so every account starts ticked (same as Buffer, user 2026-11-13); ai = AI-content label
export const subTebar = (category, sub) => (sub && existsSync(confFile(category, sub)) ? { ai: true, ...readJSON(confFile(category, sub)), saved: true } : { accounts: [], ai: true, saved: false });
export function saveSubTebar(category, sub, { accounts = [], ai = true }) {
  writeJSON(confFile(category, sub), { accounts: [...new Set(accounts.map(String))].slice(0, 50), ai: ai !== false });
  return subTebar(category, sub);
}
const logFile = (dir) => join(dir, "tebar.json");
export const sentLog = (dir) => (existsSync(logFile(dir)) ? readJSON(logFile(dir)) : []);

// upload one file: raw body under 90 MB, else the parted upload (POST /media/uploads → PUT parts → complete)
async function upload(sub, file, name, onProgress = () => {}) {
  const size = statSync(file).size;
  if (size > 300e6) throw new Error(`Render ${(size / 1e6).toFixed(0)} MB, batas Tebar 300 MB.`);
  if (size < 90e6) { onProgress(0.5); const m = await api(sub, "POST", `/media/upload?name=${encodeURIComponent(name)}`, { body: readFileSync(file), headers: { "content-type": "video/mp4" }, timeout: 600000 }); onProgress(1); return m; }
  const init = await api(sub, "POST", "/media/uploads", { json: { mime_type: "video/mp4", size_bytes: size, original_name: name } });
  const fd = openSync(file, "r");
  try {
    for (let i = 1; i <= init.part_count; i++) {
      const len = Math.min(init.part_size, size - (i - 1) * init.part_size), buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, (i - 1) * init.part_size);
      for (let t = 0; ; t++) {
        try { await api(sub, "PUT", `/media/${init.id}/parts/${i}`, { body: buf, headers: { "content-type": "application/octet-stream" }, timeout: 300000 }); break; }
        catch (e) { if (t >= 4 || e.status === 400) throw e; await new Promise((ok) => setTimeout(ok, 3000 * (t + 1))); }
      }
      onProgress(i / init.part_count);
    }
  } finally { closeSync(fd); }
  for (let t = 0; ; t++) { // complete is safe to repeat; 409 media_processing = still working
    try { return await api(sub, "POST", `/media/${init.id}/complete`, { timeout: 330000 }); }
    catch (e) { if (e.code !== "media_processing" || t >= 6) throw e; await new Promise((ok) => setTimeout(ok, 15000)); }
  }
}

// per-platform options (docs /api/posts § Opsi per platform; unknown keys are rejected, so only documented ones)
async function optionsFor(sub, acc, { title, ai, coverMs, madeForKids }) {
  if (acc.platform === "instagram") return { ...(ai ? { is_ai_generated: true } : {}), thumb_offset_ms: coverMs };
  if (acc.platform === "youtube") return { title: String(title).replace(/[<>]/g, "").slice(0, 100), made_for_kids: !!madeForKids, ...(ai ? { contains_synthetic_media: true } : {}) };
  if (acc.platform === "tiktok") {
    const o = { ...(ai ? { is_aigc: true } : {}), video_cover_timestamp_ms: coverMs };
    // personal accounts must name a privacy level from creator-info; business accounts are always public
    try {
      const ci = await api(sub, "GET", `/accounts/${acc.id}/tiktok/creator-info`);
      const opts = ci.privacy_level_options ?? ci.data?.privacy_level_options ?? [];
      if (!(ci.video_public_only ?? ci.data?.video_public_only) && opts.length) o.privacy_level = opts.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : opts[0];
    } catch {}
    return o;
  }
  return undefined;
}

// send one video. opts: { text, title, at (ISO, omit = now), accounts, ai, madeForKids, onProgress }
export async function forward(dir, slug, opts = {}) {
  const { category, sub } = placeOf(dir);
  const conf = subTebar(category, sub);
  const ids = (opts.accounts?.length ? opts.accounts : conf.accounts).map(String);
  if (!ids.length) throw new Error("Belum ada akun Tebar yang dicentang untuk channel ini.");
  if (opts.at && isNaN(Date.parse(opts.at))) throw new Error("Tanggal jadwal tidak terbaca.");
  if (opts.at && Date.parse(opts.at) < Date.now() + 60e3) throw new Error("Jadwal harus minimal 1 menit dari sekarang.");
  const file = join(dir, "out", `${slug}.mp4`);
  if (!existsSync(file)) throw new Error("Belum ada render (out/<slug>.mp4).");
  const accounts = await listAccounts(sub);
  const picked = ids.map((id) => accounts.find((a) => a.id === id) ?? { id, missing: true });
  const missing = picked.filter((a) => a.missing);
  if (missing.length === picked.length) throw new Error("Akun Tebar yang dipilih tidak ditemukan (dilepas, atau key lain?).");
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  const th = thumbSettings(dir);
  const title = opts.title || captionTitle(dir) || th.headline?.replace(/\*/g, "") || meta.name || slug;
  const text = String(opts.text ?? defaultText(dir));
  const ai = opts.ai ?? conf.ai;
  // the cover sits in the first second of the video (tools/thumbnail.mjs, thumbnail.json → seconds)
  const coverMs = th.cover ? 100 : 1000;
  const mtime = statSync(file).mtimeMs;
  // reuse the media of an earlier send of this same render (Tebar keeps a media library)
  const prev = [...sentLog(dir)].reverse().find((e) => e.mediaId && e.renderMtime === mtime);
  const media = prev ? { id: prev.mediaId } : await upload(sub, file, `${slug}.mp4`, opts.onProgress);
  const targets = [];
  for (const a of picked.filter((x) => !x.missing)) {
    const options = await optionsFor(sub, a, { title, ai, coverMs, madeForKids: opts.madeForKids });
    targets.push({ account_id: a.id, ...(options ? { options } : {}) });
  }
  const idem = randomUUID();
  let post, error = null;
  try { post = await api(sub, "POST", "/posts", { json: { content: text, media_ids: [media.id], targets, ...(opts.at ? { scheduled_at: new Date(opts.at).toISOString() } : {}) }, headers: { "idempotency-key": idem } }); }
  catch (e) { error = e.message; }
  const name = (id) => accounts.find((a) => a.id === id);
  const results = [
    ...(post?.targets ?? []).map((t) => ({ account: t.account_id, platform: t.platform ?? name(t.account_id)?.platform, name: name(t.account_id)?.name, ok: t.status !== "failed", status: t.status, permalink: t.permalink ?? null, error: t.error_code ?? null })),
    ...(post ? [] : targets.map((t) => ({ account: t.account_id, platform: name(t.account_id)?.platform, name: name(t.account_id)?.name, ok: false, error }))),
    ...missing.map((a) => ({ account: a.id, ok: false, error: "akun tidak ditemukan di Tebar" })),
  ];
  writeJSON(logFile(dir), [...sentLog(dir), { at: new Date().toISOString(), scheduledAt: opts.at ?? null, postId: post?.id ?? null, mediaId: media.id, renderMtime: mtime, title, text, ai, results }]);
  return { postId: post?.id ?? null, status: post?.status ?? null, results, error };
}

// refresh the last post's per-account status (publishing runs in the background at Tebar)
export async function refreshStatus(dir) {
  const { sub } = placeOf(dir);
  const log = sentLog(dir), last = [...log].reverse().find((e) => e.postId);
  if (!last) return null;
  const p = await api(sub, "GET", `/posts/${last.postId}`);
  const post = p.data ?? p;
  last.results = last.results.map((r) => {
    const t = (post.targets ?? []).find((x) => x.account_id === r.account);
    return t ? { ...r, status: t.status, ok: t.status !== "failed", permalink: t.permalink ?? r.permalink, error: t.error_code ?? t.error?.message ?? null } : r;
  });
  last.status = post.status;
  writeJSON(logFile(dir), log);
  return last;
}

if (process.argv[1]?.endsWith("tebar.mjs")) {
  const [cmd, arg] = process.argv.slice(2);
  const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (cmd === "keys") { const k = keyedSubs(); console.log(k.length ? k.map((x) => { const i = keyInfo(x); return `${keyName(x)}  (${x})  ${i.source === "studio" ? "Studio" : ".env"} ${i.hint}`; }).join("\n") : "Belum ada key Tebar (Studio atau .env)"); }
  else if (cmd === "accounts") for (const a of await listAccounts(arg ?? die("Usage: node tools/tebar.mjs accounts <sub>"))) console.log(`${a.id}  ${String(a.platform).padEnd(10)} ${a.name}${a.status && a.status !== "active" ? `  [${a.status}]` : ""}`);
  else if (cmd === "send") {
    const r = await forward(videoDir(arg), arg, { at: opt("--at"), text: opt("--text"), onProgress: (f) => process.stdout.write(`\rupload ${(f * 100).toFixed(0)}%`) });
    console.log("");
    for (const x of r.results) console.log(`${x.ok ? "✔" : "✖"} ${x.platform ?? ""} ${x.name ?? x.account} · ${x.ok ? x.status : x.error}`);
  } else if (cmd === "status") {
    const e = await refreshStatus(videoDir(arg ?? die("Usage: node tools/tebar.mjs status <slug>")));
    if (!e) console.log("Belum pernah dikirim ke Tebar");
    else for (const x of e.results) console.log(`${x.ok ? "✔" : "✖"} ${x.platform ?? ""} ${x.name ?? x.account} · ${x.status ?? ""}${x.permalink ? ` ${x.permalink}` : ""}${x.error ? ` ${x.error}` : ""}`);
  } else die("Usage: node tools/tebar.mjs keys | accounts <sub> | send <slug> [--at ISO] [--text \"…\"] | status <slug>");
}
