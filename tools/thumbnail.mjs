// Thumbnail (user 2026-11-07): a 1080×1920 cover for every video, rendered from HTML like the video itself, with a hook
// headline, a sub headline, the episode of a series, and the channel logo. finish.mjs puts it in front of the video for
// thumbnail.json → seconds (default 1 s) so TikTok / Reels / Shorts take it as the cover, and keeps out/thumbnail.png.
//
//   node tools/thumbnail.mjs options <slug>   Gemini (Claude haiku as backup) writes 5 headline + sub headline pairs
//   node tools/thumbnail.mjs render <slug>    out/thumbnail.png from thumbnail.json (missing fields get defaults)
//   node tools/thumbnail.mjs sync <slug>      options again only when the script changed since the last options (after every script write)
//   node tools/thumbnail.mjs auto <slug>      options when there are none, pick the first, render (finish.mjs uses it)
//
// thumbnail.json: { options: [{ headline, sub }], headline, sub, episode, bg, cover, seconds, position: top|bottom, text, shade, bgTime }
//   text: false = the picture only (no headline, sub, episode, logo); shade: false = no dark gradient. Key-visual ad products
//   (advertisement/products.json "form": "kv", e.g. BRI) default to both off (user 2026-11-13).
//   bg may also be a frame picked from the video (assets/thumbs/frame.jpg, bgTime = its second) or the user's own upload
//   (assets/thumbs/upload-N.*): both are listed first among the backgrounds.
//   headline: one word may be wrapped in *stars* to take the accent colour; episode: "" = no badge;
//   bg: a path inside the video (default: first shot's key visual, a key visual, the product photo, or a frame of the render)
//   cover: false = no thumbnail in front of the video (out/thumbnail.png is still made)
//   accent / subColor: "#rrggbb" picked in the Thumbnail tab colour picker (user 2026-11-15): accent = the *word* colour and
//   the episode badge (its text turns black/white to stay readable), subColor = the sub headline; unset = brand/preset accent and white.
//   In a series the colour is shared: Studio writes it to every part (scope "series"), a part without the key inherits it, "" = this part default
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, cpSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ROOT, readJSON, writeJSON, die, videoDir, brandCss, loadBrand, isHex, onColor, presetOf } from "./lib.mjs";
import { gemini } from "./gemini-api.mjs";
import { channelLogo } from "./brandmark.mjs";

// 0.3 s was too short to read the headline (user 2026-11-14); per video in Studio (thumbnail.json → seconds)
const COVER_SECONDS = 1;
// key-visual ad product (BRI): plain picture thumbnail by default, the KV photo first
const kvProduct = (dir) => {
  const m = meta(dir), f = join(ROOT, "advertisement", "products.json");
  return m.type === "advertisement" && existsSync(f) && readJSON(f).some((p) => p.id === m.product && p.form === "kv");
};
const P = (dir) => join(dir, "thumbnail.json");
const meta = (dir) => (existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {});
export const loadThumb = (dir) => (existsSync(P(dir)) ? readJSON(P(dir)) : {});
export const thumbPng = (dir) => join(dir, "out", "thumbnail.png");
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && cmd === "npx", maxBuffer: 1 << 26 });

// the badge follows the earlier parts (user 2026-11-16): the nearest earlier part with its own label ("SOSRO EPS 1",
// "EPISODE 6") sets the wording and the count goes on from it; no earlier label = "EPISODE <part>"
export const episodeOf = (dir) => {
  const s = meta(dir).series;
  if (!s?.part) return "";
  for (let k = s.part - 1; k >= 1; k--) {
    const d = join(dir, "..", k === 1 ? s.id : `${s.id}-${k}`), f = P(d);
    if (!existsSync(f)) continue;
    const ep = readJSON(f).episode;
    if (typeof ep !== "string") continue;
    const m = ep.match(/^(.*?)(\d+)(\D*)$/);
    if (m) return `${m[1]}${+m[2] + s.part - k}${m[3]}`;
  }
  return `EPISODE ${s.part}`;
};

// background candidates, best first; every entry is a path inside the video folder
export function backgrounds(dir) {
  const has = (p) => existsSync(join(dir, p));
  const out = [];
  // the user's own picks first: a frame from the video, uploads (newest first)
  if (has("assets/thumbs")) for (const f of readdirSync(join(dir, "assets", "thumbs")).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort((a, b) => (a.startsWith("frame") ? -1 : b.startsWith("frame") ? 1 : b.localeCompare(a, undefined, { numeric: true })))) out.push(`assets/thumbs/${f}`);
  if (has("musafo.json")) for (const s of readJSON(join(dir, "musafo.json")).shots ?? []) if (has(`assets/frames/${s.id}.png`)) out.push(`assets/frames/${s.id}.png`);
  for (const sub of ["assets/keyvisuals", "assets/products", "assets/frames"])
    if (has(sub)) for (const f of readdirSync(join(dir, sub)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !/\.raw\.|\.end\./.test(f) && !/^(logo|cta)/.test(f))) if (!out.includes(`${sub}/${f}`)) out.push(`${sub}/${f}`);
  // BRI: the clean key visual photo before backdrops and the client's finished KVs
  if (kvProduct(dir)) out.sort((a, b) => (/^assets\/thumbs\//.test(b) - /^assets\/thumbs\//.test(a)) || (/kv-foto|\/kv-\d/.test(b) - /kv-foto|\/kv-\d/.test(a)));
  return out;
}

// a frame of the video at second t of the finished video (Studio player: scrub, "Pakai frame ini"): taken from
// out/raw.mp4 (no thumbnail cover in front, so the cover's seconds come off t), else from the finished video itself;
// saved as assets/thumbs/frame.jpg (one picked frame per video)
export function grabFrame(dir, t) {
  const raw = join(dir, "out", "raw.mp4"), fin = join(dir, "out", `${meta(dir).id ?? ""}.mp4`);
  const src = existsSync(raw) ? raw : existsSync(fin) ? fin : null;
  if (!src) throw new Error("belum ada render untuk diambil frame-nya");
  const s = loadThumb(dir);
  const at = Math.max(0, (+t || 0) - (src === raw && settings(dir).cover ? s.seconds ?? COVER_SECONDS : 0));
  mkdirSync(join(dir, "assets", "thumbs"), { recursive: true });
  const out = join(dir, "assets", "thumbs", "frame.jpg");
  const r = sh("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(3), "-i", src, "-frames:v", "1", "-q:v", "1", out]);
  if (r.status !== 0 || !existsSync(out)) throw new Error(`frame gagal: ${r.stderr}`);
  return "assets/thumbs/frame.jpg";
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
  // a headline the user typed (not one of the previous options) is kept; an earlier auto pick follows the new options
  const auto = !t.headline || (t.options ?? []).some((o) => o.headline === t.headline);
  writeJSON(P(dir), { ...t, options, optionsFor: materialKey(dir), ...(auto ? { headline: options[0].headline, sub: options[0].sub } : {}) });
  return options;
}

// headline + sub headline are written together with the script (user 2026-11-16): every time the script is built or edited,
// options are rewritten when what the video says changed since the last options. Projects whose options predate this
// rule are only stamped (their thumbnail may already be approved); the next script change rewrites them.
export const materialKey = (dir) => createHash("sha1").update(material(dir)).digest("hex").slice(0, 12);
export async function syncOptions(dir, log = console.log) {
  if (!existsSync(join(dir, "musafo.json")) && !existsSync(join(dir, "script.md"))) return false;
  if (settings(dir).text === false) return false;
  const t = loadThumb(dir), key = materialKey(dir);
  if (t.optionsFor === key && t.options?.length) return false;
  if (!t.optionsFor && t.options?.length) { writeJSON(P(dir), { ...t, optionsFor: key }); return false; }
  const o = await writeOptions(dir);
  log(`  thumbnail: ${o.length} opsi headline + sub headline dari naskah ("${loadThumb(dir).headline}")`);
  return true;
}

// the other parts of this video's series (folders that exist), empty when it is not a series
export function seriesDirs(dir) {
  const s = meta(dir).series;
  if (!s) return [];
  const out = [];
  for (let k = 1; k <= s.total; k++) {
    const d = join(dir, "..", k === 1 ? s.id : `${s.id}-${k}`);
    if (resolve(d) !== resolve(dir) && existsSync(d)) out.push(d);
  }
  return out;
}
// a series part without its own choice takes the one made in another part (position, colours)
function seriesPick(dir, key) {
  for (const d of seriesDirs(dir)) {
    const v = existsSync(P(d)) ? loadThumb(d)[key] : undefined;
    if (v !== undefined && v !== null) return v;
  }
  return null;
}
const seriesPosition = (dir) => seriesPick(dir, "position");
// colour: "#rrggbb" = picked, "" = this part on the default on purpose, missing = the series' colour (or the default)
const colorOf = (dir, t, key) => { const v = t[key] ?? seriesPick(dir, key); return isHex(v) ? v : null; };

// thumbnail.json with every field filled in
export function settings(dir) {
  const t = loadThumb(dir);
  const bgs = backgrounds(dir);
  return {
    headline: t.headline ?? t.options?.[0]?.headline ?? meta(dir).name ?? "",
    sub: t.sub ?? t.options?.[0]?.sub ?? "",
    episode: t.episode ?? episodeOf(dir),
    bg: t.bg && existsSync(join(dir, t.bg)) ? t.bg : bgs[0] ?? null,
    // thumbnail in front of the video is the default (user 2026-11-13, Eka Tjipta 4 went out without it): off only when the
    // user unticked "Di depan video" in Studio (coverOff) or for an ad, whose form saves cover: false on purpose
    cover: t.cover !== false || (!t.coverOff && meta(dir).type !== "advertisement"),
    // where the text block sits: "top" (under the logo) or "bottom" (ends at 1520 px, above the app buttons), so it can move off a face
    // a series part without its own choice takes the position chosen in another part (user 2026-11-08: bottom set on
    // Eka Tjipta 1, part 2 still came out on top)
    position: (t.position ?? seriesPosition(dir)) === "bottom" ? "bottom" : "top",
    seconds: t.seconds ?? COVER_SECONDS,
    options: t.options ?? [],
    text: t.text ?? !kvProduct(dir),
    shade: t.shade ?? t.text ?? !kvProduct(dir),
    bgTime: t.bgTime ?? null,
    kv: kvProduct(dir),
    // one colour for a whole series (user 2026-11-15, "Sosro merah terus"): Studio saves it to every part; a part without it inherits
    accent: colorOf(dir, t, "accent"),
    subColor: colorOf(dir, t, "subColor"),
    series: !!meta(dir).series,
    ...colorChoices(dir),
  };
}

// colour picker in the Thumbnail tab: the default accent (preset / project type / meta.json tone) and quick swatches
// (the preset's tones first, then a few that read on dark photos)
function colorChoices(dir) {
  const def = loadBrand(dir).colors.accent;
  const pf = join(ROOT, "presets", presetOf(dir), "preset.json");
  const tones = existsSync(pf) ? (readJSON(pf).tones ?? []).filter((x) => isHex(x.accent)).map((x) => ({ label: x.label, hex: x.accent })) : [];
  const base = [{ label: "Default", hex: def }, ...tones, { label: "Kuning", hex: "#FFD60A" }, { label: "Merah", hex: "#FF3B30" }, { label: "Hijau", hex: "#21A35A" }, { label: "Tosca", hex: "#2EC4B6" }, { label: "Putih", hex: "#FFFFFF" }];
  const seen = new Set();
  return { accentDefault: def, swatches: base.filter((x) => isHex(x.hex) && !seen.has(x.hex.toLowerCase()) && seen.add(x.hex.toLowerCase())) };
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
  // the picture only (BRI default): no HTML pass needed, cover-crop the background to the frame
  if (!s.text && !s.shade && bg) {
    const { w: FW, h: FH } = brand.frame;
    mkdirSync(join(dir, "out"), { recursive: true });
    const f = sh("ffmpeg", ["-y", "-v", "error", "-i", join(dir, bg), "-frames:v", "1", "-vf", `scale=${FW}:${FH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${FW}:${FH}`, thumbPng(dir)]);
    if (f.status !== 0) throw new Error(`thumbnail: ${f.stderr}`);
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(SIG(dir), signature(dir));
    return { file: thumbPng(dir), ...s, bg };
  }
  const work = join(dir, "build", "thumbnail");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "assets"), { recursive: true });
  if (bg) copyFileSync(join(dir, bg), join(work, "assets", `bg${extname(bg)}`));
  const logo = s.text ? channelLogo(dir) : null;
  if (logo) copyFileSync(logo, join(work, "assets", "logo.png"));
  if (existsSync(join(dir, "assets", "fonts"))) cpSync(join(dir, "assets", "fonts"), join(work, "assets", "fonts"), { recursive: true });
  // preset font files (fontFaces src "assets/fonts/<file>") a video built before the preset got them does not have yet
  // (BDP parts 1-2 fell back to a sans font, user 2026-11-14): take them from presets/<id>/fonts/ like cues.mjs does
  for (const ff of brand.fontFaces ?? []) {
    const m = /^assets\/fonts\/([^/]+)$/.exec(ff.src ?? "");
    const from = m && join(ROOT, "presets", brand.preset, "fonts", m[1]);
    if (!from || existsSync(join(work, ff.src)) || !existsSync(from)) continue;
    mkdirSync(join(work, "assets", "fonts"), { recursive: true });
    copyFileSync(from, join(work, ff.src));
  }
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
      #thumb-sub { font: 600 50px/1.22 var(--font-body); max-width: 900px; text-wrap: balance; color: ${s.subColor ?? "rgba(255,255,255,.94)"}; text-shadow: 0 3px 18px rgba(0,0,0,.7); }
      ${s.accent ? `#root { --accent: ${s.accent}; --on-accent: ${onColor(s.accent)}; }` : ""}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="${FW}" data-height="${FH}">
      ${bg ? `<img id="thumb-bg" src="assets/bg${extname(bg)}" alt="">` : ""}
      ${s.shade ? '<div id="thumb-shade"></div>' : ""}
      ${logo ? '<img id="thumb-logo" src="assets/logo.png" alt="">' : ""}
      ${s.text ? `<div id="thumb-text">
        ${s.episode ? `<div id="thumb-ep">${esc(s.episode)}</div>` : ""}
        <div id="thumb-head">${headlineHtml(titleCase(s.headline))}</div>
        ${s.sub ? `<div id="thumb-sub">${esc(titleCase(s.sub))}</div>` : ""}
      </div>` : ""}
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
  return JSON.stringify({ t: s.text, sh: s.shade, p: s.position, h: s.headline, s: s.sub, e: s.episode, bg: s.bg, bgf: m(s.bg && join(dir, s.bg)), logo: m(logo), c: b.colors, f: b.fonts, w: b.watermark ?? null, a: s.accent, sc: s.subColor });
}
export function stale(dir) {
  if (!existsSync(thumbPng(dir)) || !existsSync(SIG(dir))) return true;
  return readFileSync(SIG(dir), "utf8") !== signature(dir);
}

// finish.mjs: make sure there is a current thumbnail; options are only written when there are none yet
export async function auto(dir, log = console.log) {
  if (settings(dir).text && !settings(dir).options.length && !loadThumb(dir).headline) {
    try { await writeOptions(dir); log("  thumbnail: 5 opsi headline ditulis (pilih di Studio, tab Thumbnail)"); }
    catch (e) { log(`  ⚠ opsi headline gagal (${e.message}); thumbnail memakai judul proyek`); }
  }
  if (stale(dir)) { render(dir); log(`  ✔ out/thumbnail.png`); }
  return settings(dir);
}

if (process.argv[1]?.endsWith("thumbnail.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  if (!["options", "render", "auto", "sync"].includes(cmd)) die("Usage: node tools/thumbnail.mjs options|render|auto|sync <slug>");
  const dir = videoDir(slug);
  if (cmd === "options") for (const [i, o] of (await writeOptions(dir)).entries()) console.log(`${i + 1}. ${o.headline}\n   ${o.sub}`);
  else if (cmd === "render") { const r = render(dir); console.log(`✔ ${r.file}\n  ${r.episode ? r.episode + " · " : ""}${r.headline} / ${r.sub}\n  latar: ${r.bg ?? "(tidak ada)"}`); }
  else if (cmd === "sync") { if (!(await syncOptions(dir))) console.log("  thumbnail: opsi headline masih sesuai naskah"); }
  else { await auto(dir); console.log(`✔ ${thumbPng(dir)}`); }
}
