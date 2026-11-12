// stock.mjs: free stock video, music and sound effects from outside sources, each with its licence on record.
// What each source allows (checked 2026-11-05, see .claude/skills/video-vertikal/footage.md § Stok gratis):
//   coverr     API (key by email to team@coverr.co -> COVERR_API_KEY in .env). Free for commercial work and ads, no credit
//              required; never re-upload the file as is; logos in the footage are not licensed.
//   mixkit     no API, and its terms forbid scripted/bot downloads: the user downloads the item on mixkit.co and `add`s it.
//              Only items marked "Free License" (Stock Video / Music / Sound Effects); "Restricted" = personal only.
//   freesound  the API is free only for non-commercial use, so no API here: the user downloads a CC0 or CC BY sound on
//              freesound.org and `add`s it. CC BY needs a credit (written to credits.md); "NonCommercial" is refused.
//   other      any file whose licence the user can name (their own recording, a licensed music track).
// Video goes into the footage library (library/footage.json, tools/library.mjs); music and sfx into library/audio.json.
// Every use writes a line to the video's sources.txt and, when the licence asks for one, credits.md.
//
//   npm run stock -- add <file> --kind video|music|sfx --source mixkit|freesound|pixabay|coverr|other --url <item page>
//                    --license "<licence name>" [--by "<creator>"] [--title "..."] [--tags "a,b"] [--for <kategori>/<sub>]
//   npm run stock -- search [kata...] [--kind music|sfx]          library/audio.json
//   npm run stock -- use <id> <slug>                               audio -> videos/<slug>/assets/audio/<id>.<ext>
//   npm run stock -- coverr search <query> [--page n]              needs COVERR_API_KEY
//   npm run stock -- coverr add <videoId> [--for <kategori>/<sub>] downloads into the footage library (then: library use)
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { ROOT, readJSON, writeJSON, die, probeDuration, videoDir } from "./lib.mjs";
import { addClip } from "./library.mjs";

const AUDIO = join(ROOT, "library", "audio");
const DB = join(ROOT, "library", "audio.json");
const loadDb = () => (existsSync(DB) ? readJSON(DB) : { items: [] });
export const SOURCES = ["mixkit", "freesound", "pixabay", "coverr", "other"];

// MOTION videos are public and often commercial (ads): personal-only, non-commercial and no-derivatives licences are out
export function licenseOk(license = "") {
  const l = license.toLowerCase();
  if (!l.trim()) return "isi --license (nama lisensi persis seperti di halaman item)";
  if (/non-?commercial|\bnc\b|-nc\b|restricted|personal|editorial|\bnd\b|-nd\b|no ?deriv/.test(l)) return `lisensi "${license}" tidak boleh untuk video publik/iklan`;
  return null;
}
// does this licence ask for a credit line?
const needsCredit = (license) => /attribution|cc[ -]by/i.test(license) && !/no attribution|cc0|creative commons 0|public domain/i.test(license);

export function addAudio(file, m) {
  if (!existsSync(file)) die(`file tidak ada: ${file}`);
  const bad = licenseOk(m.license);
  if (bad) die(bad);
  mkdirSync(AUDIO, { recursive: true });
  const db = loadDb();
  const hash = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10);
  const dup = db.items.find((x) => x.hash === hash);
  if (dup) return dup;
  const id = `${m.kind}-${m.source}-${hash.slice(0, 6)}`;
  const ext = extname(file).toLowerCase() || ".wav";
  copyFileSync(file, join(AUDIO, id + ext));
  const item = {
    id, hash, kind: m.kind, file: `audio/${id}${ext}`, title: m.title || basename(file, ext), tags: (m.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    source: m.source, url: m.url, license: m.license, by: m.by ?? "", duration: +probeDuration(join(AUDIO, id + ext)).toFixed(2),
    created: new Date().toISOString(), usedIn: [], ...(m.for ? (([category, sub]) => ({ category, sub }))(m.for.split("/")) : {}),
  };
  db.items.push(item);
  writeJSON(DB, db);
  return item;
}

export const searchAudio = (q = "", kind) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return loadDb().items.filter((x) => (!kind || x.kind === kind) && words.every((w) => `${x.title} ${x.tags.join(" ")} ${x.source}`.toLowerCase().includes(w)));
};

// provenance: one line per file in sources.txt, a credit in credits.md when the licence asks for it
export function logUse(dir, rel, { title, by, source, url, license }) {
  const sp = join(dir, "sources.txt");
  const keep = (existsSync(sp) ? readFileSync(sp, "utf8") : "").split(/\r?\n/).filter((l) => l && !l.startsWith(rel + "\t"));
  writeFileSync(sp, [...keep, `${rel}\t${source}: "${title}"${by ? ` by ${by}` : ""}, ${license}. ${url}`].join("\n") + "\n");
  if (!needsCredit(license)) return;
  const cp = join(dir, "credits.md");
  if (!existsSync(cp)) writeFileSync(cp, "# Kredit (tempel ke caption/deskripsi posting)\n\n");
  if (!readFileSync(cp, "utf8").includes(url)) appendFileSync(cp, `- "${title}"${by ? ` by ${by}` : ""}, ${license}, via ${source}. ${url}\n`);
}

export function useAudio(id, slug) {
  const dir = videoDir(slug);
  const db = loadDb();
  const x = db.items.find((i) => i.id === id);
  if (!x) die(`audio ${id} tidak ada di library/audio.json`);
  const rel = `assets/audio/${basename(x.file)}`;
  mkdirSync(join(dir, "assets", "audio"), { recursive: true });
  copyFileSync(join(ROOT, "library", x.file), join(dir, rel));
  if (!x.usedIn.includes(slug)) x.usedIn.push(slug);
  writeJSON(DB, db);
  logUse(dir, rel, x);
  return rel;
}

// ---------- Coverr API ----------
const coverr = async (path, init = {}) => {
  const key = process.env.COVERR_API_KEY;
  if (!key) die("COVERR_API_KEY belum ada di .env. Minta key gratis lewat email ke team@coverr.co (sebut: alat lokal untuk video vertikal).");
  const r = await fetch(`https://api.coverr.co${path}`, { ...init, headers: { "x-api-key": key, ...(init.headers ?? {}) } });
  if (!r.ok) die(`Coverr API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
};
// sponsored results (Shutterstock, iStock, PremiumBeat) and watermarked Premium previews are not under the Coverr licence
const coverrFree = (v) => !v.is_premium && !v.sponsored && !v.is_sponsored;

async function coverrSearch(q, page = 0) {
  const j = await coverr(`/videos?${new URLSearchParams({ query: q, page, page_size: 20, urls: "false" })}`);
  const hits = (j.hits ?? j.videos ?? []).filter(coverrFree);
  for (const v of hits) console.log(`${v.id}  ${(v.duration ?? 0).toFixed?.(1) ?? v.duration}s  ${v.is_vertical ? "vertikal" : "horizontal"}${v.is_ai_generated ? "  AI" : ""}  ${v.title}`);
  if (!hits.length) console.log("  (tidak ada hasil gratis)");
}

async function coverrAdd(id, forPlace) {
  const v = await coverr(`/videos/${id}`);
  if (!coverrFree(v)) die("item ini Premium/sponsor: tidak termasuk lisensi Coverr gratis.");
  const url = v.urls?.mp4_download ?? v.urls?.mp4;
  if (!url) die("Coverr tidak memberi URL unduhan untuk item ini.");
  const tmp = join(tmpdir(), `coverr-${id}.mp4`);
  writeFileSync(tmp, Buffer.from(await (await fetch(url)).arrayBuffer()));
  await coverr(`/videos/${id}/stats/downloads`, { method: "PATCH" }); // Coverr asks API users to report each download
  const clip = addClip(tmp, {
    prompt: v.description || v.title, tags: (v.tags ?? []).join(","), source: "coverr", license: "Coverr License (free for commercial use and ads, no attribution required)",
    url: `https://coverr.co/videos/${v.slug ?? id}`, for: forPlace,
  });
  console.log(`✔ ${clip.id} (Coverr "${v.title}"${v.is_ai_generated ? ", AI-generated: cek orang/merek nyata sebelum dipakai di iklan" : ""}). Pakai: npm run library -- use ${clip.id} <slug> <beat>`);
}

if (process.argv[1]?.endsWith("stock.mjs")) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const meta = { kind: opt("kind"), source: opt("source"), url: opt("url"), license: opt("license"), by: opt("by"), title: opt("title"), tags: opt("tags"), for: opt("for"), page: opt("page") };
  if (meta.for && !/^(explainer|storytelling|advertisement)\/[a-z0-9-]+$/.test(meta.for)) die("--for <explainer|storytelling|advertisement>/<preset|channel|product>");
  const [cmd, a, b, ...rest] = argv;
  if (cmd === "add") {
    if (!a) die('Usage: npm run stock -- add <file> --kind video|music|sfx --source mixkit|freesound|pixabay|coverr|other --url <halaman item> --license "<lisensi>"');
    if (!["video", "music", "sfx"].includes(meta.kind)) die("--kind video | music | sfx");
    if (!SOURCES.includes(meta.source)) die(`--source ${SOURCES.join(" | ")}`);
    if (meta.source !== "other" && !/^https?:\/\//.test(meta.url ?? "")) die("--url halaman item (untuk bukti lisensi dan kredit)");
    if (meta.kind === "video") {
      const bad = licenseOk(meta.license);
      if (bad) die(bad);
      const c = addClip(a, { prompt: meta.title ?? "", tags: meta.tags, source: meta.source, license: meta.license + (meta.by ? ` · by ${meta.by}` : ""), url: meta.url, for: meta.for });
      console.log(`✔ footage ${c.id} ${c.width}x${c.height} ${c.duration}s. Pakai: npm run library -- use ${c.id} <slug> <beat>`);
    } else {
      const x = addAudio(a, meta);
      console.log(`✔ ${x.id} ${x.duration}s (${x.license}). Pakai: npm run stock -- use ${x.id} <slug>`);
    }
  } else if (cmd === "search") {
    for (const x of searchAudio([a, b, ...rest].filter(Boolean).join(" "), meta.kind)) console.log(`${x.id}  ${x.duration}s  ${x.kind}  ${x.title}  [${x.tags.join(", ")}]  ${x.license}`);
  } else if (cmd === "use") {
    if (!a || !b) die("Usage: npm run stock -- use <id> <slug>");
    console.log(`✔ ${useAudio(a, b)} (dicatat di sources.txt${needsCredit(loadDb().items.find((x) => x.id === a).license) ? " + credits.md" : ""})`);
  } else if (cmd === "coverr" && a === "search" && b) await coverrSearch([b, ...rest].join(" "), +(meta.page ?? 0));
  else if (cmd === "coverr" && a === "add" && b) await coverrAdd(b, meta.for);
  else die("Usage: npm run stock -- add | search | use | coverr search|add  (lihat kepala file)");
}
