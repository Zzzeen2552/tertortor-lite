// Shared helpers for the MOTION vertical-video pipeline.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// API keys (GEMINI_API_KEY, ELEVENLABS_API_KEY) live in an untracked .env at the repo root
if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));

export function videoDir(slug) {
  if (!slug) die("Usage: <command> <slug>   (folder name under videos/)");
  const dir = join(ROOT, "videos", slug);
  if (!existsSync(dir)) die(`videos/${slug} not found. Create it with: npm run new -- ${slug}`);
  return dir;
}

// The text of each JSON file is kept in memory and read from disk again only when its mtime or size changes. Studio
// builds every project card from the same few files (brand.json, meta.json, preset.json, channels.json) thousands of
// times per request, and on Windows each read goes through the virus scanner: /api/videos took 6-9 s, mostly here.
// The text is parsed again on every call, so a caller that edits the returned object never touches the cache.
const jsonText = new Map();
export const readJSON = (p) => {
  const st = statSync(p), hit = jsonText.get(p);
  if (hit && hit.m === st.mtimeMs && hit.s === st.size) return JSON.parse(hit.t);
  const t = readFileSync(p, "utf8");
  jsonText.set(p, { m: st.mtimeMs, s: st.size, t });
  return JSON.parse(t);
};
export const writeJSON = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};

export function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && cmd === "npx", ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    die(`${cmd} ${args.join(" ")} failed:\n${(r.stderr || r.stdout || "").slice(-2000)}`);
  }
  return r;
}

export function probeDuration(file) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return parseFloat(r.stdout.trim());
}

// Look presets live in presets/<id>/ (preset.json = colors, fonts, captions, extra css; scenes/ = stub per register;
// style.md = the rules Claude designs scenes by). brand.json holds everything that is not look (voice, limits, sfx...).
// A preset with "draft": true is a placeholder (only style.md notes, no colours/fonts/scenes yet): shown in TERTORTOR as
// "belum didesain" but never usable, so listPresets() leaves it out unless asked.
export const PRESETS = join(ROOT, "presets");
export function listPresets({ drafts = false } = {}) {
  const all = existsSync(PRESETS) ? readdirSync(PRESETS).filter((d) => existsSync(join(PRESETS, d, "preset.json"))).map((d) => readJSON(join(PRESETS, d, "preset.json"))) : [];
  return drafts ? all : all.filter((p) => !p.draft);
}
export function presetOf(dir) {
  const base = readJSON(join(ROOT, "brand", "brand.json")).defaultPreset ?? "hyperframe";
  const meta = dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  const id = meta.preset ?? base;
  return existsSync(join(PRESETS, id, "preset.json")) && !readJSON(join(PRESETS, id, "preset.json")).draft ? id : base;
}
export const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
// near-black or white, whichever reads on top of `hex` (WCAG relative luminance)
export function onColor(hex) {
  if (!isHex(hex)) return "#0B0B0F";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? "#0B0B0F" : "#FFFFFF";
}
// brand.json + the look of the video's preset (or the default preset when no video dir is given)
export function loadBrand(dir) {
  const brand = readJSON(join(ROOT, "brand", "brand.json"));
  const id = presetOf(dir);
  const p = readJSON(join(PRESETS, id, "preset.json"));
  const merged = { ...brand, preset: id, colors: { ...p.colors }, fonts: p.fonts, captions: { ...p.captions }, presetCss: p.css ?? "", fontFaces: p.fontFaces ?? [] };
  // colour tone picked per video in TERTORTOR (meta.json "accent"): replaces the preset accent everywhere, captions included
  const meta0 = dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  // a project type may own its accent (brand.json → <type>.accent): Musafo = green of the Prophet's Mosque dome (user 2026-11-11),
  // Miracle of Hajj too (user 2026-11-12); Berakit ke Hulu on the same preset keeps the yellow. A tone picked per video still wins.
  const meta = { ...meta0, accent: meta0.accent ?? brand[meta0.type]?.accent };
  if (isHex(meta.accent) && meta.accent.toLowerCase() !== String(p.colors.accent).toLowerCase()) {
    for (const k of ["activeColor", "activeBg"]) if (String(merged.captions[k] ?? "").toLowerCase() === String(p.colors.accent).toLowerCase()) merged.captions[k] = meta.accent;
    // a box in the accent colour (snapcn) keeps its word readable on any tone
    if (merged.captions.activeBg === meta.accent) merged.captions.activeColor = onColor(meta.accent);
    merged.colors.accent = meta.accent;
  }
  merged.colors["on-accent"] ??= onColor(merged.colors.accent);
  // a preset may set its own master loudness (flashcut: SFX only, the music is added in the app at upload)
  // ...unless this ad carries its own music (ad.json "music"): then it is a finished master at the brand loudness
  const ad = dir && join(dir, "ad.json");
  if (p.loudness && !(ad && existsSync(ad) && readJSON(ad).music)) merged.loudness = { ...brand.loudness, ...p.loudness };
  // frame (9:16 / 16:9): horizontal swaps in its own safe band and watermark spot (brand.json "horizontal")
  merged.frame = frameOf(dir);
  if (merged.frame.format !== "vertical") {
    // feed 4:5 and square 1:1 (Ubah format, user 2026-11-13): a feed post has no app UI over it, so a plain margin band
    const own = brand[merged.frame.format] ?? {}, m = Math.round(merged.frame.h * 0.05);
    merged.safe = { ...brand.safe, ...(merged.frame.format === "horizontal" ? {} : { top: m, bottom: merged.frame.h - m, side: 72, rightRail: 0 }), ...(own.safe ?? {}) };
    merged.watermark = { ...(brand.watermark ?? {}), ...(merged.frame.format === "horizontal" ? {} : { top: m }), ...(own.watermark ?? {}) };
  }
  merged.formats = p.formats ?? ["vertical"];
  // one continuous camera over one world (Docucine): cues builds a single compositions/world.html, no cuts
  merged.oneTake = !!p.oneTake;
  if (p.sfx) merged.sfx = { ...brand.sfx, ...p.sfx, marks: { ...brand.sfx?.marks, ...p.sfx.marks }, volume: { ...brand.sfx?.volume, ...p.sfx.volume } };
  return merged;
}
// Frame of a video (user 2026-11-09): vertical 9:16 by default; horizontal 16:9 for presets that list it in
// preset.json "formats" (Docucine). meta.json "format" picks it per video. Safe band and watermark follow the frame.
export const FRAMES = {
  vertical: { format: "vertical", w: 1080, h: 1920, resolution: "portrait" },
  horizontal: { format: "horizontal", w: 1920, h: 1080, resolution: "landscape" },
  feed: { format: "feed", w: 1080, h: 1350, resolution: "portrait" },
  square: { format: "square", w: 1080, h: 1080, resolution: "square" },
};
// "Ubah format" kinds (Studio checkbox) → frame id
export const VARIANT_KINDS = { "4x5": "feed", "1x1": "square", "16x9": "horizontal", "9x16": "vertical" };
export function frameOf(dir) {
  const meta = dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  return FRAMES[meta.format] ?? FRAMES.vertical;
}

// scene stub for a register, from the preset (falls back to hyperframe)
export function sceneTemplate(dir, register = "type") {
  for (const id of [presetOf(dir), "hyperframe"]) {
    const f = join(PRESETS, id, "scenes", `${register}.html`);
    if (existsSync(f)) return f;
  }
  return null;
}

// Normalise a word for matching: lowercase, strip punctuation, keep letters/digits.
export const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}%]+/gu, "");

// ---------- numbers -> spoken words (id + en), used by the "every number is spoken" gate ----------
const ID_UNITS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
export function idWords(n) {
  n = Math.floor(n);
  if (n < 12) return ID_UNITS[n];
  if (n < 20) return `${ID_UNITS[n - 10]} belas`;
  if (n < 100) return `${ID_UNITS[Math.floor(n / 10)]} puluh${n % 10 ? " " + ID_UNITS[n % 10] : ""}`;
  if (n < 200) return `seratus${n % 100 ? " " + idWords(n % 100) : ""}`;
  if (n < 1000) return `${ID_UNITS[Math.floor(n / 100)]} ratus${n % 100 ? " " + idWords(n % 100) : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? " " + idWords(n % 1000) : ""}`;
  if (n < 1e6) return `${idWords(Math.floor(n / 1000))} ribu${n % 1000 ? " " + idWords(n % 1000) : ""}`;
  if (n < 1e9) return `${idWords(Math.floor(n / 1e6))} juta${n % 1e6 ? " " + idWords(n % 1e6) : ""}`;
  return `${idWords(Math.floor(n / 1e9))} miliar${n % 1e9 ? " " + idWords(n % 1e9) : ""}`;
}
const EN_UNITS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const EN_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
export function enWords(n) {
  n = Math.floor(n);
  if (n < 20) return EN_UNITS[n];
  if (n < 100) return `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? " " + EN_UNITS[n % 10] : ""}`;
  if (n < 1000) return `${EN_UNITS[Math.floor(n / 100)]} hundred${n % 100 ? " " + enWords(n % 100) : ""}`;
  if (n < 1e6) return `${enWords(Math.floor(n / 1000))} thousand${n % 1000 ? " " + enWords(n % 1000) : ""}`;
  return `${enWords(Math.floor(n / 1e6))} million${n % 1e6 ? " " + enWords(n % 1e6) : ""}`;
}

// Is the number `raw` (as written on screen, e.g. "15", "1.5", "2,5", "15GB") present in the spoken text?
export function numberIsSpoken(raw, spokenNorm, lang) {
  const digits = raw.replace(/[^\d.,]/g, "");
  const compact = norm(digits);
  if (spokenNorm.includes(` ${compact} `) || spokenNorm.includes(` ${compact}`)) return true;
  const n = parseFloat(digits.replace(/\./g, lang === "id" ? "" : ".").replace(",", "."));
  if (!Number.isFinite(n)) return true;
  const whole = Math.floor(n);
  const forms = [idWords(whole), enWords(whole)].map((f) => f.split(" ").map(norm).join(" "));
  return forms.some((f) => spokenNorm.includes(` ${f} `) || spokenNorm.includes(` ${f}`));
}

// brand.json -> the :root block injected into each video's index.html (/*@brand*/.../*@end*/)
export function brandCss(b = loadBrand()) {
  const c = b.colors;
  const f = b.fonts;
  // fontFaces: [{ family, src: "assets/fonts/x.woff2" | "local('Name')", weight, style }] for fonts HyperFrames does not bundle
  // (an assets/fonts/ file lives in presets/<id>/fonts/ and cues copies it into the video)
  const faces = (b.fontFaces ?? []).map((ff) => `@font-face { font-family: "${ff.family}"; src: ${/^local\(/.test(ff.src) ? ff.src : `url("${ff.src}")`}; font-weight: ${ff.weight ?? "normal"}; font-style: ${ff.style ?? "normal"}; }`).join(" ");
  const extra = Object.entries(c).filter(([k]) => !["ground", "ink", "muted", "accent", "alert", "card"].includes(k)).map(([k, v]) => `--${k}: ${v};`).join(" ");
  return `/*@brand*/${faces} :root { --ground: ${c.ground}; --ink: ${c.ink}; --muted: ${c.muted}; --accent: ${c.accent}; --alert: ${c.alert}; --card: ${c.card}; ${extra} --font-display: "${f.display}", sans-serif; --font-body: "${f.body}", sans-serif; --font-caption: "${f.caption}", sans-serif; --font-mono: "${f.mono}", monospace; } ${b.presetCss ?? ""}/*@end*/`;
}

// The spoken text of script.md: comment lines (#, >, <!--) dropped, paragraphs kept as breaths.
export function spokenText(scriptPath) {
  return readFileSync(scriptPath, "utf8")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.split(/\r?\n/).filter((l) => !/^\s*(#|>|<!--)/.test(l)).join(" ").trim())
    .filter(Boolean)
    .join("\n\n");
}

// Cache key of a take: provider + voice settings + exact text. swap.mjs rewrites it after a splice.
export const takeKey = (provider, voice, text) => createHash("sha1").update(JSON.stringify([provider, voice, text])).digest("hex").slice(0, 12);
