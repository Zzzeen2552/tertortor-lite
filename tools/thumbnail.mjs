// Thumbnail (user 2026-11-07): a 1080×1920 cover for every video, rendered from HTML like the video itself, with a hook
// headline, a sub headline, the episode of a series, and the channel logo. finish.mjs puts it in front of the video for
// thumbnail.json → seconds (default 0.3 s) so TikTok / Reels / Shorts take it as the cover, and keeps out/thumbnail.png.
//
//   node tools/thumbnail.mjs options <slug>   Gemini (Claude haiku as backup) writes 5 headline + sub headline pairs
//   node tools/thumbnail.mjs render <slug>    out/thumbnail.png from thumbnail.json (missing fields get defaults)
//   node tools/thumbnail.mjs auto <slug>      options when there are none, pick the first, render (finish.mjs uses it)
//
// thumbnail.json: { options: [{ headline, sub }], headline, sub, episode, bg, cover, seconds, position: top|bottom }
//   headline: one word may be wrapped in *stars* to take the accent colour; episode: "" = no badge;
//   bg: a path inside the video (default: first shot's key visual, a key visual, the product photo, or a frame of the render)
//   cover: false = no thumbnail in front of the video (out/thumbnail.png is still made)
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, cpSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, videoDir, brandCss, loadBrand } from "./lib.mjs";
import { gemini } from "./gemini-api.mjs";
import { channelLogo } from "./brandmark.mjs";

const COVER_SECONDS = 0.3;
const P = (dir) => join(dir, "thumbnail.json");
const meta = (dir) => (existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {});
export const loadThumb = (dir) => (existsSync(P(dir)) ? readJSON(P(dir)) : {});
export const thumbPng = (dir) => join(dir, "out", "thumbnail.png");
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && cmd === "npx", maxBuffer: 1 << 26 });

export const episodeOf = (dir) => {
  const s = meta(dir).series;
  return s?.part ? `EPISODE ${s.part}` : "";
};

// background candidates, best first; every entry is a path inside the video folder
export function backgrounds(dir) {
  const has = (p) => existsSync(join(dir, p));
  const out = [];
  if (has("musafo.json")) for (const s of readJSON(join(dir, "musafo.json")).shots ?? []) if (has(`assets/frames/${s.id}.png`)) out.push(`assets/frames/${s.id}.png`);
  for (const sub of ["assets/keyvisuals", "assets/products", "assets/frames"])
    if (has(sub)) for (const f of readdirSync(join(dir, sub)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !/\.raw\.|\.end\./.test(f) && !/^(logo|cta)/.test(f))) if (!out.includes(`${sub}/${f}`)) out.push(`${sub}/${f}`);
  return out;
}

// a frame of the render as the last resort (explainers have no key visual): 1.5 s in, past the first cut's motion
function renderFrame(dir) {
  const src = ["out/raw.mp4", `out/${meta(dir).id ?? ""}.mp4`].map((p) => join(dir, p)).find((p) => existsSync(p) && statSync(p).isFile());
  if (!src) return null;
  const f = join(dir, "build", "thumbnail-bg.jpg");
  mkdirSync(join(dir, "build"), { recursive: true });
  sh("ffmpeg", ["-y", "-v", "error", "-ss", "1.5", "-i", src, "-frames:v", "1", "-q:v", "2", f]);
  return existsSync(f) ? "build/thumbnail-bg.jpg" : null;
}

// what the video says: the material the headline options are written from
export function material(dir) {
  const has = (p) => existsSync(join(dir, p));
  const parts = [`Judul proyek: ${meta(dir).name ?? ""}`];
  const s = meta(dir).series;
  if (s) parts.push(`Series: bagian ${s.part} dari ${s.total}`);
  if (has("hooks.json")) {
    const h = readJSON(join(dir, "hooks.json"));
    const chosen = h.options?.find((o) => o.id === h.chosen) ?? h.options?.[0];
    if (chosen) parts.push(`Hook pembuka video: ${chosen.line}${chosen.loop ? `\nPertanyaan yang membuat penonton bertahan: ${chosen.loop}` : ""}`);
  }
  if (has("musafo.json")) parts.push(`Naskah:\n${readJSON(join(dir, "musafo.json")).shots.flatMap((x) => x.lines.map((l) => l.text)).join("\n")}`);
  else if (has("script.md")) parts.push(`Naskah:\n${readFileSync(join(dir, "script.md"), "utf8").split("\n").filter((l) => l.trim() && !/^[#>]|^<!--/.test(l)).join("\n")}`);
  else if (has("ad.json")) parts.push(`Iklan produk: ${JSON.stringify(readJSON(join(dir, "ad.json"))).slice(0, 1500)}`);
  if (has("request.json")) { const r = readJSON(join(dir, "request.json")); if (r.idea) parts.push(`Ide dari user: ${r.idea}`); }
  return parts.join("\n\n").slice(0, 9000);
}

const SYSTEM = `Kamu menulis teks thumbnail (cover) untuk video vertikal pendek berbahasa Indonesia (TikTok, Reels, Shorts).
Thumbnail dilihat sekilas di grid, kurang dari satu detik, di antara puluhan video lain. Tugasnya membuat orang berhenti dan
mengetuk: celah rasa ingin tahu yang hanya dijawab videonya, taruhan yang terasa, atau hal konkret yang janggal.
Aturan:
- headline: 2-6 kata, maks 30 karakter, bahasa lisan, format judul: huruf pertama tiap kata kapital (bukan kapital semua). Satu kata paling kuat boleh diberi
  tanda *bintang* supaya diwarnai aksen. Jangan mengulang kalimat hook video persis; thumbnail dan hook saling melengkapi.
- sub: 4-10 kata, format judul juga, menambah konteks atau taruhan, bukan mengulang headline.
- Hanya fakta yang ada di naskah. Jangan mengarang angka, tahun, nama, atau kejadian. Jangan janji yang tidak dibayar video.
- Tanpa emoji, tanpa tanda seru beruntun, tanpa "di video ini", tanpa "wajib tonton", tanpa tanda pisah panjang (—),
  tanpa pola "bukan X, tapi Y". Tulis seperti orang bicara, bukan seperti iklan.
- Lima pasangan dengan sudut berbeda: pertanyaan, kejadian janggal, taruhan, kontras sebelum-sesudah, kutipan pendek tokoh
  (hanya kutipan yang ada di naskah).`;

export async function writeOptions(dir) {
  const out = await gemini({ json: true, system: SYSTEM, text: `${material(dir)}\n\nJawab JSON: {"options":[{"headline":"...","sub":"..."}]} dengan tepat 5 pasangan.` });
  const options = (out?.options ?? []).map((o) => ({ headline: String(o.headline ?? "").trim(), sub: String(o.sub ?? "").trim() })).filter((o) => o.headline).slice(0, 5);
  if (!options.length) throw new Error("Opsi headline tidak terbaca dari Gemini/Claude; coba lagi.");
  const t = loadThumb(dir);
  writeJSON(P(dir), { ...t, options, ...(t.headline ? {} : { headline: options[0].headline, sub: options[0].sub }) });
  return options;
}

function seriesPosition(dir) {
  const s = meta(dir).series;
  if (!s) return null;
  for (let k = 1; k <= s.total; k++) {
    const d = join(dir, "..", k === 1 ? s.id : `${s.id}-${k}`);
    if (d === dir || !existsSync(P(d))) continue;
    const p = loadThumb(d).position;
    if (p) return p;
  }
  return null;
}

// thumbnail.json with every field filled in
export function settings(dir) {
  const t = loadThumb(dir);
  const bgs = backgrounds(dir);
  return {
    headline: t.headline ?? t.options?.[0]?.headline ?? meta(dir).name ?? "",
    sub: t.sub ?? t.options?.[0]?.sub ?? "",
    episode: t.episode ?? episodeOf(dir),
    bg: t.bg && existsSync(join(dir, t.bg)) ? t.bg : bgs[0] ?? null,
    cover: t.cover !== false,
    // where the text block sits: "top" (under the logo) or "bottom" (ends at 1520 px, above the app buttons), so it can move off a face
    // a series part without its own choice takes the position chosen in another part (user 2026-11-08: bottom set on
    // Eka Tjipta 1, part 2 still came out on top)
    position: (t.position ?? seriesPosition(dir)) === "bottom" ? "bottom" : "top",
    seconds: t.seconds ?? COVER_SECONDS,
    options: t.options ?? [],
  };
}

// format judul (user 2026-11-11, semua channel): huruf pertama tiap kata kapital, juga setelah tanda hubung; huruf lain
// dibiarkan (singkatan seperti BRI, VISA tetap utuh). Diterapkan saat render, teks pilihan user di thumbnail.json tidak diubah.
export const titleCase = (s = "") => String(s).replace(/(^|[\s\-/(])([*"'“‘]*)(\p{Ll})/gu, (m, a, q, c) => a + q + c.toLocaleUpperCase("id"));
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// *word* -> accent span; the size follows the length so a short hook hits hard and a long one still fits in 3 lines
const headlineHtml = (h) => esc(h).replace(/\*([^*]+)\*/g, '<span class="acc">$1</span>');
const headlineSize = (h) => { const n = h.replace(/\*/g, "").length; return n <= 12 ? 150 : n <= 18 ? 132 : n <= 26 ? 116 : n <= 34 ? 100 : 88; };

export function render(dir) {
  const s = settings(dir);
  const bg = s.bg ?? renderFrame(dir);
  const brand = loadBrand(dir);
  const work = join(dir, "build", "thumbnail");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "assets"), { recursive: true });
  if (bg) copyFileSync(join(dir, bg), join(work, "assets", `bg${extname(bg)}`));
  const logo = channelLogo(dir);
  if (logo) copyFileSync(logo, join(work, "assets", "logo.png"));
  if (existsSync(join(dir, "assets", "fonts"))) cpSync(join(dir, "assets", "fonts"), join(work, "assets", "fonts"), { recursive: true });
  if (existsSync(join(dir, "hyperframes.json"))) copyFileSync(join(dir, "hyperframes.json"), join(work, "hyperframes.json"));
  const w = { left: 56, top: 184, width: 150, maxHeight: 150, opacity: 0.9, ...(brand.watermark ?? {}) };
  const { w: FW, h: FH, resolution } = brand.frame; // 16:9 thumbnail for a horizontal video (Docucine)
  const wide = FW > FH;
  const size = Math.round(headlineSize(s.headline) * (wide ? 0.8 : 1));
  writeFileSync(join(work, "index.html"), `<!doctype html>
<html lang="id" data-resolution="${resolution}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${FW}, height=${FH}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      ${brandCss(brand)}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${FW}px; height: ${FH}px; overflow: hidden; background: var(--ground); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: var(--font-body); color: #fff; }
      #thumb-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #thumb-shade { position: absolute; inset: 0; background: ${s.position === "bottom"
        ? "linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 40%, rgba(0,0,0,.6) 56%, rgba(0,0,0,.82) 72%, rgba(0,0,0,.6) 100%)"
        : "linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.55) 30%, rgba(0,0,0,0) 56%, rgba(0,0,0,0) 80%, rgba(0,0,0,.35) 100%)"}; }
      #thumb-logo { position: absolute; left: ${w.left}px; top: ${w.top}px; width: ${w.width}px; height: ${w.maxHeight}px; object-fit: contain; object-position: left top; opacity: ${w.opacity}; filter: drop-shadow(0 2px 8px rgba(0,0,0,.55)); }
      #thumb-text { position: absolute; left: 72px; right: ${wide ? 760 : 72}px; ${wide ? (s.position === "bottom" ? "bottom: 90px" : `top: ${logo ? 220 : 110}px`) : s.position === "bottom" ? "bottom: 400px" : `top: ${logo ? 400 : 300}px`}; display: flex; flex-direction: column; align-items: flex-start; gap: 28px; }
      #thumb-ep { font: 800 40px/1 var(--font-display); letter-spacing: .08em; text-transform: uppercase; color: var(--on-accent); background: var(--accent); padding: 16px 26px 14px; border-radius: 10px; }
      #thumb-head { font: 800 ${size}px/1.02 var(--font-display); letter-spacing: -0.01em; text-wrap: balance; text-shadow: 0 6px 30px rgba(0,0,0,.65), 0 2px 4px rgba(0,0,0,.6); }
      #thumb-head .acc { color: var(--accent); }
      #thumb-sub { font: 600 50px/1.22 var(--font-body); max-width: 900px; text-wrap: balance; color: rgba(255,255,255,.94); text-shadow: 0 3px 18px rgba(0,0,0,.7); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="${FW}" data-height="${FH}">
      ${bg ? `<img id="thumb-bg" src="assets/bg${extname(bg)}" alt="">` : ""}
      <div id="thumb-shade"></div>
      ${logo ? '<img id="thumb-logo" src="assets/logo.png" alt="">' : ""}
      <div id="thumb-text">
        ${s.episode ? `<div id="thumb-ep">${esc(s.episode)}</div>` : ""}
        <div id="thumb-head">${headlineHtml(titleCase(s.headline))}</div>
        ${s.sub ? `<div id="thumb-sub">${esc(titleCase(s.sub))}</div>` : ""}
      </div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);
  const shots = join(work, "shots");
  const r = sh("npx", ["hyperframes", "snapshot", work, "--at", "0.5", "--no-end", "--keep", "-o", shots]);
  const png = existsSync(shots) ? readdirSync(shots).find((f) => f.endsWith(".png")) : null;
  if (!png) throw new Error(`snapshot thumbnail gagal: ${(r.stderr || r.stdout || "").trim().slice(-400)}`);
  mkdirSync(join(dir, "out"), { recursive: true });
  // the snapshot may come at device scale: always deliver exactly 1080×1920
  const f = sh("ffmpeg", ["-y", "-v", "error", "-i", join(shots, png), "-vf", `scale=${FW}:${FH}:flags=lanczos`, thumbPng(dir)]);
  if (f.status !== 0) throw new Error(`thumbnail: ${f.stderr}`);
  writeFileSync(SIG(dir), signature(dir));
  return { file: thumbPng(dir), ...s, bg };
}

// stale = anything that goes into the picture changed since the last render: text, episode, background (its file too),
// the logo (uploaded, replaced, deleted, or switched off for this video), the preset colours/fonts
const SIG = (dir) => join(dir, "build", "thumbnail.sig");
function signature(dir) {
  const s = settings(dir), logo = channelLogo(dir), b = loadBrand(dir);
  const m = (f) => (f && existsSync(f) ? `${statSync(f).size}:${Math.round(statSync(f).mtimeMs)}` : null);
  return JSON.stringify({ p: s.position, h: s.headline, s: s.sub, e: s.episode, bg: s.bg, bgf: m(s.bg && join(dir, s.bg)), logo: m(logo), c: b.colors, f: b.fonts, w: b.watermark ?? null });
}
export function stale(dir) {
  if (!existsSync(thumbPng(dir)) || !existsSync(SIG(dir))) return true;
  return readFileSync(SIG(dir), "utf8") !== signature(dir);
}

// finish.mjs: make sure there is a current thumbnail; options are only written when there are none yet
export async function auto(dir, log = console.log) {
  if (!settings(dir).options.length && !loadThumb(dir).headline) {
    try { await writeOptions(dir); log("  thumbnail: 5 opsi headline ditulis (pilih di Studio, tab Thumbnail)"); }
    catch (e) { log(`  ⚠ opsi headline gagal (${e.message}); thumbnail memakai judul proyek`); }
  }
  if (stale(dir)) { render(dir); log(`  ✔ out/thumbnail.png`); }
  return settings(dir);
}

if (process.argv[1]?.endsWith("thumbnail.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  if (!["options", "render", "auto"].includes(cmd)) die("Usage: node tools/thumbnail.mjs options|render|auto <slug>");
  const dir = videoDir(slug);
  if (cmd === "options") for (const [i, o] of (await writeOptions(dir)).entries()) console.log(`${i + 1}. ${o.headline}\n   ${o.sub}`);
  else if (cmd === "render") { const r = render(dir); console.log(`✔ ${r.file}\n  ${r.episode ? r.episode + " · " : ""}${r.headline} / ${r.sub}\n  latar: ${r.bg ?? "(tidak ada)"}`); }
  else { await auto(dir); console.log(`✔ ${thumbPng(dir)}`); }
}
