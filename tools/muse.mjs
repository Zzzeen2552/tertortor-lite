// Meta Muse lewat muse4ai (REST lokal 127.0.0.1:47821). Kunci = header MCP muse4ai di ~/.claude.json (tidak dicetak).
// Prasyarat: Muse4AI terbuka, satu akun siap, `node tools/local-proxy.mjs` hidup.
//   node tools/muse.mjs image|video <out> --prompt-file <txt> [--ref <img>]... [--id <request_id>]
//   node tools/muse.mjs status
// Gambar: Muse mengikuti "vertical 9:16" di prompt (1152×2048). Video: ±10 s, 704×1248 24 fps dari gambar ref pertama.
// Job needs_review/running tidak pernah dikirim ulang; request_id yang sama = job yang sama (aman di-retry).
import fs from "node:fs";
import path from "node:path";

const API = process.env.MUSE4AI_URL || "http://127.0.0.1:47821";
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function authHeader() {
  const cfg = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, ".claude.json"), "utf8"));
  for (const [k, p] of Object.entries(cfg.projects || {})) {
    const h = /MOTION$/i.test(k) && p.mcpServers?.muse4ai?.headers?.Authorization;
    if (h) return h;
  }
  throw new Error("Kunci muse4ai tidak ditemukan: daftarkan MCP muse4ai dengan header Authorization dulu");
}
const AUTH = authHeader();

async function call(url, opts = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...opts, headers: { Authorization: AUTH, ...(opts.headers || {}) } });
    if (r.status === 429 && i < 60) { await sleep(2000); continue; }
    return r;
  }
}

const [cmd, out, ...rest] = process.argv.slice(2);
if (cmd === "status") {
  const j = await (await call(`${API}/v1/status`)).json();
  console.log(JSON.stringify({ accounts: j.accounts?.items?.map((a) => ({ alias: a.alias, group: a.group, quota: a.quota })), capabilities: j.capabilities }, null, 1));
  process.exit(0);
}
if (!["image", "video"].includes(cmd) || !out) {
  console.log("pakai: node tools/muse.mjs image|video <out> --prompt-file <txt> [--ref <img>]... [--id <request_id>] | status");
  process.exit(1);
}
const refs = [];
let promptFile, requestId;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--ref") refs.push(rest[++i]);
  else if (rest[i] === "--prompt-file") promptFile = rest[++i];
  else if (rest[i] === "--id") requestId = rest[++i];
}
if (!promptFile) throw new Error("--prompt-file wajib");
requestId ||= `${cmd}-${path.basename(out, path.extname(out))}-${new Date().toISOString().slice(0, 10)}`;
if (cmd === "video" && !refs.length) throw new Error("video butuh --ref gambar awal");

const ids = [];
for (const f of refs) {
  const type = /\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg";
  const r = await call(`${API}/v1/references`, { method: "POST", headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(path.basename(f)) }, body: fs.readFileSync(f) });
  const j = await r.json();
  if (!r.ok) throw new Error(`upload ${f}: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  ids.push(j.id ?? j.reference_id);
}
const prompt = fs.readFileSync(promptFile, "utf8").trim();
const body = { kind: cmd, prompt, request_id: requestId, ...(ids.length ? { reference_ids: ids } : {}) };
const r = await call(`${API}/v1/jobs`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId }, body: JSON.stringify(body) });
const created = await r.json();
const id = created.jobs?.[0]?.id;
if (!id) throw new Error(`submit ${r.status}: ${JSON.stringify(created).slice(0, 400)}`);
console.log(`job ${id} (${cmd}, request_id ${requestId})`);
const t0 = Date.now();
let j;
for (;;) {
  j = await (await call(`${API}/v1/jobs/${id}`)).json();
  if (["succeeded", "failed", "cancelled", "needs_review"].includes(j.status)) break;
  if (Date.now() - t0 > 30 * 60e3) { console.log(`masih ${j.status} setelah 30 menit; jalankan lagi dengan --id ${requestId}`); process.exit(2); }
  await sleep(8000);
}
const secs = Math.round((Date.now() - t0) / 1000);
if (j.status !== "succeeded") {
  console.log(`${j.status} setelah ${secs}s: ${JSON.stringify(j.error ?? {}).slice(0, 400)}`);
  if (j.status === "needs_review") console.log("needs_review: jangan kirim ulang, buka Muse4AI");
  process.exit(3);
}
const o = j.outputs[0];
const b = Buffer.from(await (await call(o.download_url)).arrayBuffer());
if (b.length !== o.bytes) throw new Error("ukuran unduhan tidak cocok");
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, b);
console.log(`ok ${secs}s → ${out} ${o.width}x${o.height} ${o.mime}`);
