// Forward to Buffer per channel (user 2026-11-07). Each TERTORTOR channel / preset / product picks the Buffer channels
// (TikTok, Instagram, YouTube, ...) its videos go to: <subDir>/buffer.json { channels: [id], mode }. "Kirim ke Buffer" in
// the editor then makes one Buffer post per channel with the finished video.
//
// Buffer's API (GraphQL, https://api.buffer.com, Bearer key from publish.buffer.com/settings/api) has no upload: the video
// must sit at a public, direct HTTPS URL that stays up until the post is published. That is the share link the relay
// already keeps (tools/share.mjs → <share url>/video.mp4, also while the laptop is off), so forwarding makes or refreshes
// the share link first. Revoking the share link before Buffer publishes breaks the queued post.
//
// Every channel / preset / product has its own Buffer account (user 2026-11-10), so the key is per sub: .env
// BUFFER_API_KEY_<SUB> (sub id in capitals, "-" → "_", e.g. BUFFER_API_KEY_BERAKITKEHULU). There is deliberately no shared
// fallback key: a sub without its own key cannot post, so a video never lands on another channel's account.
// Since 2026-11-12 the user can also paste the key in Studio (sub page, Buffer panel; also from the web app through the
// relay): it is stored in .buffer-keys.json at the repo root (gitignored, never committed) and wins over .env. The API only
// ever returns "tersimpan ••••1234", never the key. Keys never go through chat.
// Every post sent is logged in videos/<slug>/buffer.json.
//
//   node tools/buffer.mjs keys                           which subs have a key (names + where, never the values)
//   node tools/buffer.mjs channels <sub>                 Buffer channels of that sub's account (id, service, name)
//   node tools/buffer.mjs send <slug> [--now] [--text "…"]  forward with the sub's settings (queue unless --now)
//   node tools/buffer.mjs caption <slug>                 the agent writes caption.md (posting caption + YouTube title)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJSON, writeJSON, die, videoDir } from "./lib.mjs";
import { placeOf, subDir } from "./categories.mjs";
import { share, shareInfo } from "./share.mjs";
import { settings as thumbSettings, material } from "./thumbnail.mjs";
import { gemini } from "./gemini-api.mjs";

const API = "https://api.buffer.com";
export const MODES = { addToQueue: "Masuk antrean Buffer", shareNow: "Terbitkan sekarang", customScheduled: "Jadwalkan" };
export const keyName = (sub) => `BUFFER_API_KEY_${String(sub || "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
// read .env on every call: Studio keeps running while the user adds a key, and lib.mjs only loads .env at start
const envFile = () => { const f = join(ROOT, ".env"); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
const envKey = (sub) => {
  const n = keyName(sub);
  return envFile().match(new RegExp(`^\\s*${n}\\s*=\\s*(\\S+)\\s*$`, "m"))?.[1] || process.env[n] || "";
};
// keys pasted in Studio: { "<sub>": { key, at } } in a gitignored file beside .env; they win over .env
const STORE = join(ROOT, ".buffer-keys.json");
const stored = () => { try { return JSON.parse(readFileSync(STORE, "utf8")); } catch { return {}; } };
const key = (sub) => (sub ? stored()[sub]?.key || envKey(sub) : "");
export const hasKey = (sub) => !!key(sub);
// what the UI may show: where the key comes from and its last 4 characters, never the key itself
export function keyInfo(sub) {
  const k = key(sub), s = stored()[sub];
  if (!k) return { key: false, keyName: keyName(sub), source: null, hint: null };
  return { key: true, keyName: keyName(sub), source: s?.key ? "studio" : "env", hint: `••••${k.slice(-4)}`, at: s?.at ?? null, envToo: !!s?.key && !!envKey(sub) };
}
export function setKey(sub, value) {
  const v = String(value ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(sub || "")) throw new Error("channel tidak valid");
  if (!/^[\x21-\x7e]{16,400}$/.test(v)) throw new Error("API key tidak terbaca. Tempel utuh, tanpa spasi.");
  writeFileSync(STORE, JSON.stringify({ ...stored(), [sub]: { key: v, at: new Date().toISOString() } }, null, 2));
  return keyInfo(sub);
}
export function removeKey(sub) {
  const all = stored();
  delete all[sub];
  writeFileSync(STORE, JSON.stringify(all, null, 2));
  return keyInfo(sub);
}
// subs that have a key (names only, never the values)
export const keyedSubs = () => [...new Set([
  ...Object.keys(stored()).filter((s) => stored()[s]?.key),
  ...[...envFile().matchAll(/^\s*BUFFER_API_KEY_([A-Z0-9_]+)\s*=\s*\S+/gm)].map((m) => m[1].toLowerCase().replace(/_/g, "-")),
])];

async function gql(sub, query, variables = {}) {
  const n = keyName(sub);
  if (!key(sub)) throw new Error(`${n} belum diisi (tempel di halaman channel, panel Buffer; buat di publish.buffer.com/settings/api, login ke akun Buffer channel ini).`);
  const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key(sub)}` }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error(`Buffer menolak API key (401). Ganti key di halaman channel (panel Buffer).`);
  if (!r.ok || j.errors?.length) throw new Error(`Buffer: ${j.errors?.map((e) => e.message).join("; ") || `HTTP ${r.status}`}`);
  return j.data;
}

// every channel of every organization the sub's key can reach
export async function listBufferChannels(sub) {
  const { account } = await gql(sub, "query { account { organizations { id name } } }");
  const out = [];
  for (const o of account?.organizations ?? []) {
    const d = await gql(sub, "query Ch($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name displayName service avatar isQueuePaused } }", { org: o.id });
    for (const c of d.channels ?? []) out.push({ ...c, organization: o.name });
  }
  return out;
}

// per TERTORTOR sub: which Buffer channels, and the default mode
const confFile = (category, sub) => join(subDir(category, sub), "buffer.json");
export const subBuffer = (category, sub) => (sub && existsSync(confFile(category, sub)) ? readJSON(confFile(category, sub)) : { channels: [], mode: "addToQueue" });
export function saveSubBuffer(category, sub, { channels = [], mode = "addToQueue" }) {
  const f = confFile(category, sub);
  writeJSON(f, { channels: [...new Set(channels.map(String))].slice(0, 30), mode: MODES[mode] ? mode : "addToQueue" });
  return subBuffer(category, sub);
}

const logFile = (dir) => join(dir, "buffer.json");
export const sentLog = (dir) => (existsSync(logFile(dir)) ? readJSON(logFile(dir)) : []);

// the caption the user starts from: caption.md if Claude wrote one, else the title; credits.md is always appended
// (CLAUDE.md: credits of Commons / stock media must go with the post)
// (only "# heading" lines are dropped: hashtags have no space after #)
const heading = /^#+\s.*(\r?\n|$)/gm;
const captionFile = (dir) => join(dir, "caption.md");
export const hasCaption = (dir) => existsSync(captionFile(dir));
export function defaultText(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  const own = hasCaption(dir) ? readFileSync(captionFile(dir), "utf8").replace(heading, "").trim() : "";
  const credits = existsSync(join(dir, "credits.md")) ? readFileSync(join(dir, "credits.md"), "utf8").replace(heading, "").trim() : "";
  return [own || meta.name || "", credits].filter(Boolean).join("\n\n");
}
// the YouTube title the agent wrote (first "# " line of caption.md), else null
export const captionTitle = (dir) => (hasCaption(dir) ? readFileSync(captionFile(dir), "utf8").match(/^#\s+(.+)$/m)?.[1].trim() || null : null);

// "Kirim ke Buffer" (user 2026-11-12): the agent writes the posting caption + YouTube title from what the video says
// (tools/thumbnail.mjs material: hook, script, idea), Gemini with Claude haiku as backup; the user edits it in the dialog
// before anything is sent. Written to caption.md (# title, then the caption); credits.md is appended by defaultText.
const CAPTION_SYSTEM = `Kamu menulis caption posting untuk video vertikal pendek berbahasa Indonesia (TikTok, Instagram Reels, YouTube Shorts,
Facebook Reels), plus judul YouTube. Caption dibaca setelah orang menonton atau saat video baru mulai: tugasnya membuat orang
menonton sampai habis, berkomentar, atau menyimpan.
Aturan:
- Bahasa lisan sehari-hari, seperti orang bercerita ke teman. Kalimat pendek, satu ide per kalimat. Campur kalimat 3 kata dan 15 kata.
- Baris pertama berdiri sendiri (terlihat sebelum "lainnya"): situasi konkret atau pertanyaan yang membuat penasaran.
  Jangan mengulang kalimat pembuka video persis.
- Lalu 2-4 kalimat konteks atau taruhan, lalu satu ajakan yang wajar (pertanyaan untuk komentar, atau simpan/bagikan). Satu ajakan saja.
- Total 300-700 karakter sebelum hashtag. Baris kosong di antara paragraf.
- Akhiri dengan 3-6 hashtag relevan dalam satu baris (huruf kecil, tanpa spasi).
- Hanya fakta yang ada di bahan. Jangan mengarang angka, tahun, nama, kutipan, ayat, atau hadis. Jangan janji yang tidak dibayar video.
- Dilarang: tanda pisah panjang (— atau –), pola "bukan X, tapi Y", "di video ini", "simak sampai habis", "wajib tonton",
  "yuk", tanda seru beruntun, emoji lebih dari satu, kata pengisi khas AI (menyelami, mengungkap, perjalanan luar biasa,
  tak terlupakan, sungguh, betapa, inilah, rahasia di balik), tiga kata sifat berderet, kalimat penutup bijak satu baris.
- title: judul YouTube 40-90 karakter, huruf pertama tiap kata kapital, tanpa emoji, tanpa hashtag, tanpa tanda pisah panjang.`;
const clean = (s) => String(s ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
export async function writeCaption(dir) {
  const has = (p) => existsSync(join(dir, p));
  const extra = [];
  if (has("storyline.md")) extra.push(`Storyline:\n${readFileSync(join(dir, "storyline.md"), "utf8").slice(0, 3000)}`);
  const ai = has("sources.txt") && /AI-generated/i.test(readFileSync(join(dir, "sources.txt"), "utf8"));
  const out = await gemini({ json: true, soft: true, system: CAPTION_SYSTEM, text: `${material(dir)}\n\n${extra.join("\n\n")}\n\nJawab JSON: {"caption":"...","title":"..."}` });
  const caption = clean(out?.caption), title = clean(out?.title).replace(/^#+\s*/, "").slice(0, 100);
  if (!caption) throw new Error("Caption tidak terbaca dari Gemini/Claude; coba lagi.");
  // AI imagery is disclosed in one plain line the user can delete (sources.txt says what was generated)
  const tags = caption.match(/\n*((?:#[^\s#]+[ \t]*)+)$/);
  const note = "Visual dibuat dengan bantuan AI.";
  const body = !ai || /\bAI\b/.test(caption) ? caption : tags ? `${caption.slice(0, tags.index).trim()}\n\n${note}\n\n${tags[1].trim()}` : `${caption}\n\n${note}`;
  writeFileSync(captionFile(dir), `${title ? `# ${title}\n\n` : ""}${body}\n`);
  return { text: defaultText(dir), title: title || captionTitle(dir) || "" };
}

// metadata Buffer needs per network for a vertical video
function metadataFor(service, { title }) {
  const t = String(title || "").slice(0, 100);
  if (service === "instagram") return { instagram: { type: "reel", shouldShareToFeed: true } };
  if (service === "facebook") return { facebook: { type: "reel" } };
  if (service === "youtube") return { youtube: { title: t, categoryId: "22", privacy: "public", madeForKids: false, notifySubscribers: true } };
  return null;
}

// forward one video. opts: { text, mode, dueAt, title, channels } (channels defaults to the sub's choice)
export async function forward(dir, slug, opts = {}) {
  const { category, sub } = placeOf(dir);
  const conf = subBuffer(category, sub);
  const ids = (opts.channels?.length ? opts.channels : conf.channels).map(String);
  if (!ids.length) throw new Error("Belum ada channel Buffer untuk channel ini. Pilih di halaman channel (panel Buffer).");
  const mode = MODES[opts.mode] ? opts.mode : conf.mode || "addToQueue";
  if (mode === "customScheduled" && !(opts.dueAt && !isNaN(Date.parse(opts.dueAt)))) throw new Error("Isi tanggal dan jam jadwal.");
  if (!existsSync(join(dir, "out", `${slug}.mp4`))) throw new Error("Belum ada render (out/<slug>.mp4).");
  // the public video URL: the share link, refreshed when the render is newer than what the relay holds
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  const s0 = shareInfo(dir, slug);
  if (!s0 || s0.stale) await share(dir, slug, meta.name ?? slug);
  const sh = shareInfo(dir, slug);
  const url = `${sh.url.replace(/\/$/, "")}/video.mp4`;
  const head = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (!head?.ok) throw new Error(`Video di link berbagi tidak bisa dibuka (${head?.status ?? "jaringan"}): ${url}`);
  const channels = await listBufferChannels(sub);
  const th = thumbSettings(dir);
  const title = opts.title || captionTitle(dir) || th.headline.replace(/\*/g, "") || meta.name || slug;
  const text = String(opts.text ?? defaultText(dir));
  const results = [];
  for (const id of ids) {
    const ch = channels.find((c) => c.id === id);
    if (!ch) { results.push({ channel: id, ok: false, error: "channel Buffer tidak ditemukan (dihapus atau key lain?)" }); continue; }
    const input = {
      channelId: id, text, mode, schedulingType: "automatic", needsApproval: false, source: "TERTORTOR",
      ...(mode === "customScheduled" ? { dueAt: new Date(opts.dueAt).toISOString() } : {}),
      // the thumbnail sits in the first 0.3 s of the video (tools/thumbnail.mjs): point the cover there
      assets: [{ video: { url, metadata: { thumbnailOffset: th.cover ? 100 : 1000, title } } }],
      ...(metadataFor(ch.service, { title }) ? { metadata: metadataFor(ch.service, { title }) } : {}),
    };
    try {
      const d = await gql(sub, `mutation Create($input: CreatePostInput!) { createPost(input: $input) {
        ... on PostActionSuccess { post { id dueAt } }
        ... on MutationError { message } } }`, { input });
      const r = d.createPost ?? {};
      results.push(r.post ? { channel: id, service: ch.service, name: ch.displayName || ch.name, ok: true, postId: r.post.id, dueAt: r.post.dueAt ?? null } : { channel: id, service: ch.service, name: ch.displayName || ch.name, ok: false, error: r.message || "ditolak Buffer" });
    } catch (e) {
      results.push({ channel: id, service: ch.service, name: ch.displayName || ch.name, ok: false, error: e.message });
    }
  }
  writeJSON(logFile(dir), [...sentLog(dir), { at: new Date().toISOString(), mode, dueAt: opts.dueAt ?? null, url, title, text, results }]);
  return { url, mode, results };
}

if (process.argv[1]?.endsWith("buffer.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (cmd === "keys") { const k = keyedSubs(); console.log(k.length ? k.map((x) => { const i = keyInfo(x); return `${keyName(x)}  (${x})  ${i.source === "studio" ? "Studio" : ".env"} ${i.hint}`; }).join("\n") : "Belum ada key Buffer (Studio atau .env)"); }
  else if (cmd === "caption") { const c = await writeCaption(videoDir(slug ?? die("Usage: node tools/buffer.mjs caption <slug>"))); console.log(`# ${c.title}\n\n${c.text}`); }
  else if (cmd === "channels") for (const c of await listBufferChannels(slug ?? die("Usage: node tools/buffer.mjs channels <sub>, mis. berakitkehulu"))) console.log(`${c.id}  ${c.service.padEnd(10)} ${c.displayName || c.name}  (${c.organization})${c.isQueuePaused ? "  [antrean dijeda]" : ""}`);
  else if (cmd === "send") {
    const dir = videoDir(slug);
    const r = await forward(dir, slug, { mode: process.argv.includes("--now") ? "shareNow" : undefined, text: opt("--text") });
    for (const x of r.results) console.log(`${x.ok ? "✔" : "✖"} ${x.service ?? ""} ${x.name ?? x.channel}${x.ok ? ` · post ${x.postId}` : ` · ${x.error}`}`);
  } else die("Usage: node tools/buffer.mjs keys | channels <sub> | caption <slug> | send <slug> [--now] [--text \"…\"]");
}
