// ad.mjs: Advertisement projects (meta.json type "advertisement", product = the style, e.g. "flashcut").
// No narration: timing is not cued from words but written per shot in seconds (snapped to 30 fps frames) in ad.json.
// Each shot's scene is generated from the product preset's stub (presets/<product>/scenes/<register>.html) and the shot's
// parameters, so the edit lives in one file; "custom": true keeps a hand-edited scene.
//
//   node tools/ad.mjs new <slug> "Judul" --product flashcut --from <folder foto produk>   videos/<slug>/ + ad.json
//   node tools/ad.mjs build <slug>      scenes + index.html timing + SFX (trimmed at their onset) + build/timeline.json
//   node tools/ad.mjs check <slug>      build -> ad rules -> hyperframes check
//   then: npm run finish -- <slug>      render, loudness (preset: -20 LUFS, music is added in the app), contact sheet
//
// ad.json: { "product": "flashcut", "name": "...", "cta": "...", "shots": [ { id, dur, register: photo|endcard, src,
//   fx, fy, sy, z0, z1, jumps: [[t, z]], blur, dof, mode: color|threshold|invert, feather, mark: { src: logo.png, layout: stack|orbit, y, size, n, rx, ry } (logo produk), tri (segitiga, topi Tripple Triangle), labels: [{ text, x, y,
//   dark }], sfx: [{ id: <library/audio id> | file: assets/audio/user-sfx-N.wav, t, from, len, vol }] } ],
//   music: { file: assets/audio/user-music-N.wav, from, vol } (opsional: musik dari user, master jadi -14 LUFS) }
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, run, videoDir, brandCss, loadBrand, probeDuration } from "./lib.mjs";
import { applyWatermark } from "./brandmark.mjs";
import { useAudio } from "./stock.mjs";

const FPS = 30;
const snap = (t) => Math.round(t * FPS) / FPS;
const PRESETS = join(ROOT, "presets");
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export const isAd = (dir) => existsSync(join(dir, "meta.json")) && readJSON(join(dir, "meta.json")).type === "advertisement";
export const loadAd = (dir) => (existsSync(join(dir, "ad.json")) ? readJSON(join(dir, "ad.json")) : null);

// ---------- new ----------
// marketplace photos often carry a white pad strip on an edge; it shows as a bright line once the photo is feathered
// onto the grey backdrop, so it is cropped off (cropdetect on the negated image finds the non-white box)
export function importPhoto(src, out) {
  const d = run("ffmpeg", ["-hide_banner", "-i", src, "-vf", "negate,cropdetect=limit=12:round=2:skip=0", "-frames:v", "3", "-f", "null", "-"]).stderr.match(/crop=(\d+:\d+:\d+:\d+)/g)?.at(-1);
  run("ffmpeg", ["-y", "-v", "error", "-i", src, ...(d ? ["-vf", d] : []), "-frames:v", "1", out]);
}
export function create(slug, title, { product = "flashcut", from, name = "", cta = "" } = {}) {
  if (!existsSync(join(PRESETS, product, "preset.json"))) die(`product "${product}" belum punya preset (presets/${product}/).`);
  const r = spawnSync("node", [join(ROOT, "tools", "new.mjs"), slug, title, "--preset", product], { encoding: "utf8" });
  if (r.status !== 0) die(r.stderr || r.stdout);
  const dir = join(ROOT, "videos", slug);
  const meta = readJSON(join(dir, "meta.json"));
  writeJSON(join(dir, "meta.json"), { ...meta, type: "advertisement", product });
  // no voice, no captions: the tool owns the beat and sfx blocks
  const idx = join(dir, "index.html");
  writeFileSync(idx, readFileSync(idx, "utf8").replace(/\s*<div id="captions"[\s\S]*?<\/div>/, "").replace(/\s*<audio id="voice"[^>]*><\/audio>/, "").replace("<!--@beats-end-->", "<!--@beats-end-->\n      <!--@sfx-->\n      <!--@sfx-end-->"));
  const pdir = join(dir, "assets", "products");
  mkdirSync(pdir, { recursive: true });
  const lines = [];
  if (from) {
    // a cleaned copy (clean/<name>.png, watermark removed) wins over the original
    const clean = join(from, "clean");
    for (const f of readdirSync(from).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
      const c = existsSync(clean) && readdirSync(clean).find((x) => basename(x, extname(x)) === basename(f, extname(f)));
      const src = c ? join(clean, c) : join(from, f);
      const out = `${basename(f, extname(f))}.png`;
      importPhoto(src, join(pdir, out));
      lines.push(`assets/products/${out}\taset dari pemilik produk (user, izin pakai termasuk wajah model)${c ? ", watermark marketplace dihapus" : ""}. ${f}`);
    }
  }
  writeFileSync(join(dir, "sources.txt"), lines.join("\n") + (lines.length ? "\n" : ""));
  for (const f of ["beats.json", "script.md"]) rmSync(join(dir, f), { force: true }); // explainer files, not used here
  writeJSON(join(dir, "ad.json"), { product, name, cta, shots: [] });
  writeFileSync(join(dir, "brief.md"), `# Brief iklan: ${title}\n\n> Advertisement · ${product}. Claude: tulis ad.json (shot, label, SFX) dari foto di assets/products/, lalu node tools/ad.mjs check ${slug}.\n`);
  return dir;
}

// Studio upload (formulir Flashcut): product angles, logo, optional model photos, optional CTA artwork, each named by
// its kind so ad.json can point at them (angle-1.png, logo.png, model-1.png, cta-1.png). A logo without transparency
// gets its white background keyed out, since it is drawn as a silhouette over the flash frames.
// Key-visual products (products.json "form": "kv", e.g. BRI, advertisement/bri/style.md) upload the client's own artwork
// instead: a clean key visual photo, finished KVs as layout reference, an empty backdrop, footer artwork, partner logos.
// Those are copied as they are (alpha kept, no white-strip crop): kv-1.png, endframe-N.png, bg-1.png, footer-1.png, partner-N.png.
export const KV_KINDS = { kv: "key visual foto", endframe: "key visual end frame (acuan tata letak)", bg: "latar end frame", footer: "artwork footer", partner: "logo partner" };
// App Demo (products.json "form": "appdemo", advertisement/appdemo/style.md): the app's own UI screenshots, in order, and
// its icon, also copied as they are (ui-N.png, icon-1.png); every UI piece in the film is a crop of these, never redrawn.
export const APP_KINDS = { ui: "screenshot UI aplikasi", icon: "ikon aplikasi" };
export const ASSET_KINDS = { angle: "foto produk", logo: "logo", model: "foto model", art: "grafis CTA", ...KV_KINDS, ...APP_KINDS };
export function importAsset(dir, kind, src, original) {
  if (!ASSET_KINDS[kind]) die(`jenis aset "${kind}" tidak dikenal.`);
  const pdir = join(dir, "assets", "products");
  mkdirSync(pdir, { recursive: true });
  const prefix = { angle: "angle", model: "model", art: "cta", kv: "kv", endframe: "endframe", bg: "bg", footer: "footer", partner: "partner", ui: "ui", icon: "icon" }[kind];
  const n = prefix ? readdirSync(pdir).filter((x) => x.startsWith(prefix + "-")).length + 1 : 0;
  const out = kind === "logo" ? "logo.png" : `${prefix}-${n}.png`;
  if (KV_KINDS[kind] || APP_KINDS[kind]) {
    run("ffmpeg", ["-y", "-v", "error", "-i", src, "-frames:v", "1", join(pdir, out)]);
  } else if (kind === "logo") {
    const fmt = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", src]).stdout.trim();
    const alpha = /a/.test(fmt.replace(/^gray/, ""));
    run("ffmpeg", ["-y", "-v", "error", "-i", src, ...(alpha ? [] : ["-vf", "format=rgba,colorkey=white:0.25:0.08"]), "-frames:v", "1", join(pdir, out)]);
  } else importPhoto(src, join(pdir, out));
  const line = `assets/products/${out}\t${ASSET_KINDS[kind]} dari pemilik produk (user, diunggah lewat Studio${kind === "model" ? ", izin pakai termasuk wajah model" : ""}). ${original}`;
  const srcFile = join(dir, "sources.txt");
  writeFileSync(srcFile, (existsSync(srcFile) ? readFileSync(srcFile, "utf8") : "") + line + "\n");
  return out;
}
// the user's own music / SFX (Studio form): kept in the video as 48 kHz WAV with the licence the user gave, and
// pointed at from ad.json ("music": { file }, sfx: [{ file }]) instead of a library id
export const AUDIO_KINDS = { music: "musik", sfx: "SFX" };
export function importAudio(dir, kind, src, original, license = "") {
  if (!AUDIO_KINDS[kind]) die(`jenis audio "${kind}" tidak dikenal.`);
  const adir = join(dir, "assets", "audio");
  mkdirSync(adir, { recursive: true });
  const n = readdirSync(adir).filter((x) => x.startsWith(`user-${kind}-`)).length + 1;
  const out = `user-${kind}-${n}.wav`;
  run("ffmpeg", ["-y", "-v", "error", "-i", src, "-vn", "-ar", "48000", "-ac", "2", join(adir, out)]);
  const line = `assets/audio/${out}\t${AUDIO_KINDS[kind]} dari user (diunggah lewat Studio), lisensi: ${license || "milik user / belum disebut"}. ${original}`;
  const srcFile = join(dir, "sources.txt");
  writeFileSync(srcFile, (existsSync(srcFile) ? readFileSync(srcFile, "utf8") : "") + line + "\n");
  return out;
}

// ---------- scene generation ----------
const imgSize = (file) => run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).stdout.trim().split(",").map(Number);

// geometry from the product's own logo (never the reference's): hollow triangles, as on the Tripple Triangle cap.
// "stack" = the logo itself, big, one triangle per frame; "orbit" = small triangles on an ellipse round the product.
function triPath(cx, cy, h, hole = 0.38) {
  const w = h * 0.9, pt = (k) => [[cx, cy - (2 * h * k) / 3], [cx - (w * k) / 2, cy + (h * k) / 3], [cx + (w * k) / 2, cy + (h * k) / 3]].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
  return `M ${pt(1).join(" L ")} Z M ${pt(hole).reverse().join(" L ")} Z`;
}
function triSvg(id, t) {
  const color = t.color ?? "#fff", cx = t.x ?? 540, cy = t.y ?? 860;
  let paths;
  if ((t.layout ?? "stack") === "stack") {
    const h = t.size ?? 260, n = t.n ?? 3, gap = h * 1.18;
    paths = Array.from({ length: n }, (_, i) => `<path id="${id}-t${i}" fill-rule="evenodd" fill="${color}" d="${triPath(cx, cy + (i - (n - 1) / 2) * gap, h)}"/>`);
  } else {
    const h = t.size ?? 70, n = t.n ?? 14, rx = t.rx ?? 440, ry = t.ry ?? 150;
    paths = [`<path fill-rule="evenodd" fill="${color}" d="${Array.from({ length: n }, (_, i) => triPath(cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n), h)).join(" ")}"/>`];
  }
  return `<svg id="${id}-tri" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:visible;mix-blend-mode:difference;transform-origin:${cx}px ${cy}px" data-layout-allow-overflow>${paths.join("")}</svg>`;
}

// the product's own logo as flash geometry: a white silhouette in Difference mode (reads over a white product and a
// black ground alike). "stack" = big copies in a column, one more each frame; "orbit" = small copies round the product.
function markHtml(dir, id, m) {
  const file = join(dir, "assets", "products", m.src ?? "logo.png");
  if (!existsSync(file)) die(`shot ${id}: ${m.src ?? "logo.png"} tidak ada di assets/products/.`);
  const [w, h] = imgSize(file), cx = m.x ?? 540, cy = m.y ?? 860;
  const one = (i, x, y, size) => { const ww = (size * w) / h; return `<div id="${id}-m${i}" style="position:absolute;left:${(x - ww / 2).toFixed(1)}px;top:${(y - size / 2).toFixed(1)}px;width:${ww.toFixed(1)}px;height:${size}px;background:url(assets/products/${m.src ?? "logo.png"}) center / contain no-repeat"></div>`; }; // a background, not <img>: n copies of one file are not n media nodes
  let imgs;
  if ((m.layout ?? "stack") === "stack") {
    const size = m.size ?? 260, n = m.n ?? 3, gap = size * 1.18;
    imgs = Array.from({ length: n }, (_, i) => one(i, cx, cy + (i - (n - 1) / 2) * gap, size));
  } else {
    const size = m.size ?? 70, n = m.n ?? 14, rx = m.rx ?? 440, ry = m.ry ?? 150;
    imgs = Array.from({ length: n }, (_, i) => one(i, cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n), size));
  }
  return `<div id="${id}-mark" style="position:absolute;inset:0;filter:brightness(0) invert(1);mix-blend-mode:difference;transform-origin:${cx}px ${cy}px" data-layout-allow-overflow>${imgs.join("")}</div>`;
}

function photoScene(dir, s, stub) {
  const file = join(dir, "assets", "products", s.src);
  if (!existsSync(file)) die(`shot ${s.id}: assets/products/${s.src} tidak ada.`);
  const [w, h] = imgSize(file);
  const fx = s.fx ?? w / 2, fy = s.fy ?? h / 2, dof = s.dof ?? 0;
  const mask = dof ? `radial-gradient(circle ${dof}px at ${fx}px ${fy}px, #000 55%, transparent 100%)` : s.feather ? "radial-gradient(ellipse 60% 58% at 50% 50%, #000 78%, transparent 100%)" : "none";
  // a feathered product photo sits on a backdrop that follows the photo's own studio light (lighter middle, shadow below)
  const bg = s.bg ?? (s.feather ? `linear-gradient(180deg, #D6D6D6 0px, #D9D9D9 ${Math.round((s.sy ?? 960) - fy * (s.z0 ?? 1))}px, #E1E1E1 ${s.sy ?? 960}px, #CACACA ${Math.round((s.sy ?? 960) + (h - fy) * (s.z0 ?? 1))}px, #C4C4C4 1920px)` : "var(--ground)");
  const filter = { threshold: "filter: grayscale(1) contrast(9) brightness(1.12);", invert: "filter: grayscale(1) invert(1) contrast(1.5);" }[s.mode] ?? "";
  const labels = (s.labels ?? []).map((l, i) => `<div id="${s.id}-l${i}" class="fc-label${l.dark ? " on-dark" : ""}" data-safe="text" style="position:absolute;left:${l.x}px;top:${l.y}px${l.size ? `;font-size:${l.size}px` : ""}">${esc(l.text)}</div>`).join("\n    ");
  const tweens = [];
  if (s.tri && (s.tri.layout ?? "stack") === "stack") {
    // the logo builds one triangle per frame
    for (let i = 0; i < (s.tri.n ?? 3); i++) tweens.push(`tl.set("#${s.id}-t${i}", { opacity: 0 }, 0); tl.set("#${s.id}-t${i}", { opacity: 1 }, ${i} / 30);`);
  } else if (s.tri) {
    // three hold states, one frame apart: the orbit snaps outwards instead of growing smoothly
    tweens.push(`[[0, 0.82], [1 / 30, 1], [2 / 30, 1.12]].forEach(([t, k]) => tl.set("#${s.id}-tri", { scale: k }, t));`);
  }
  if (s.mark && (s.mark.layout ?? "stack") === "stack") {
    for (let i = 0; i < (s.mark.n ?? 3); i++) tweens.push(`tl.set("#${s.id}-m${i}", { opacity: 0 }, 0); tl.set("#${s.id}-m${i}", { opacity: 1 }, ${i} / 30);`);
  } else if (s.mark) tweens.push(`[[0, 0.82], [1 / 30, 1], [2 / 30, 1.12]].forEach(([t, k]) => tl.set("#${s.id}-mark", { scale: k }, t));`);
  for (const [i, l] of (s.labels ?? []).entries()) if (l.at) tweens.push(`tl.fromTo("#${s.id}-l${i}", { opacity: 0 }, { opacity: 1, duration: 1 / 30, ease: "steps(1)" }, ${l.at});`);
  const shot = { fx, fy, sy: s.sy ?? 960, z0: s.z0 ?? 1, z1: s.z1 ?? s.z0 ?? 1, jumps: s.jumps ?? [] };
  return readFileSync(stub, "utf8")
    .replaceAll("__ID__", s.id).replaceAll("__JOB__", esc(s.job ?? s.id)).replaceAll("__SRC__", `assets/products/${s.src}`)
    .replaceAll("__W__", w).replaceAll("__H__", h).replaceAll("__BLUR__", s.blur ?? 12).replaceAll("__MASK__", mask).replaceAll("__CAMFILTER__", filter).replaceAll("__BG__", bg)
    .replace("__SOFT__", dof ? `<img id="${s.id}-soft" src="assets/products/${s.src}" alt="" />` : "")
    .replace("__OVERLAY__", s.tri ? triSvg(s.id, s.tri) : s.mark ? markHtml(dir, s.id, s.mark) : "").replace("__LABELS__", labels).replace("__TWEENS__", tweens.join("\n    "))
    .replace("/*@shot*/{}/*@end*/", `/*@shot*/${JSON.stringify(shot)}/*@end*/`);
}

function endScene(dir, s, ad, stub) {
  const file = join(dir, "assets", "products", s.src);
  if (!existsSync(file)) die(`shot ${s.id}: assets/products/${s.src} tidak ada.`);
  const artW = s.artW ?? 900;
  return readFileSync(stub, "utf8")
    .replaceAll("__ID__", s.id).replaceAll("__JOB__", esc(s.job ?? s.id)).replaceAll("__SRC__", `assets/products/${s.src}`)
    .replaceAll("__BG__", s.bg ?? "var(--accent)").replaceAll("__FG__", s.fg ?? "#fff").replaceAll("__ARTW__", artW).replaceAll("__ARTX__", (1080 - artW) / 2).replaceAll("__ARTY__", s.artY ?? 260)
    .replaceAll("__NAMEY__", s.nameY ?? 1060).replaceAll("__CTAY__", s.ctaY ?? 1200).replaceAll("__NAME__", esc(s.name ?? ad.name).replace(/\n/g, "<br />")).replaceAll("__CTA__", esc(s.cta ?? ad.cta));
}

// ---------- build ----------
export function build(slug) {
  const dir = videoDir(slug);
  if (!isAd(dir)) die(`videos/${slug} bukan proyek Advertisement.`);
  const ad = loadAd(dir);
  if (!ad?.shots?.length) die("ad.json belum punya shot.");
  const stubs = join(PRESETS, ad.product, "scenes");
  let t = 0;
  const shots = ad.shots.map((s) => {
    const start = snap(t), duration = snap(Math.max(1 / FPS, s.dur));
    t = start + duration;
    return { ...s, start, duration };
  });
  const total = snap(t);
  mkdirSync(join(dir, "compositions"), { recursive: true });
  for (const s of shots) {
    const scene = join(dir, "compositions", `${s.id}.html`);
    if (!s.custom || !existsSync(scene)) {
      const stub = join(stubs, `${s.register}.html`);
      if (!existsSync(stub)) die(`shot ${s.id}: register "${s.register}" tidak ada di presets/${ad.product}/scenes/.`);
      writeFileSync(scene, s.register === "endcard" ? endScene(dir, s, ad, stub) : photoScene(dir, s, stub));
    }
    const marks = { ...(s.marks ?? {}), dur: s.duration };
    writeFileSync(scene, readFileSync(scene, "utf8").replace(/\/\*@cues\*\/[\s\S]*?\/\*@end\*\//, `/*@cues*/${JSON.stringify(marks)}/*@end*/`));
  }
  // index.html: the tool owns everything between the beat markers and between the sfx markers
  const idxPath = join(dir, "index.html");
  let html = readFileSync(idxPath, "utf8").replace(/\/\*@brand\*\/[\s\S]*?\/\*@end\*\//, () => brandCss(loadBrand(dir)));
  const hosts = shots.map((s, i) => `<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${i % 2}" data-track-kind="graphics" data-width="1080" data-height="1920"></div>`);
  html = html.replace(/<!--@beats-->[\s\S]*?<!--@beats-end-->/, () => `<!--@beats-->\n      ${hosts.join("\n      ")}\n      <!--@beats-end-->`);
  html = html.replace(/(<div id="root"[^>]*\bdata-duration=")[^"]*"/, (_, a) => `${a}${total}"`);
  // SFX: library item -> provenance via stock.useAudio, then a trim from its onset with a short fade
  const sfxDir = join(dir, "assets", "sfx");
  mkdirSync(sfxDir, { recursive: true });
  const tags = [];
  let n = 0;
  for (const s of shots) for (const x of s.sfx ?? []) {
    const rel = x.file ?? useAudio(x.id, slug);
    const len = x.len ?? 0.6, from = x.from ?? 0, at = snap(s.start + (x.t ?? 0)) - (x.lead ?? 0.02);
    const out = `assets/sfx/${s.id}-${n}.wav`;
    run("ffmpeg", ["-y", "-v", "error", "-ss", String(from), "-t", String(len), "-i", join(dir, rel), "-af", `afade=t=out:st=${Math.max(0, len - 0.06)}:d=0.06,aresample=48000`, "-ac", "2", join(dir, out)]);
    const d = Math.min(probeDuration(join(dir, out)), total - Math.max(0, at));
    if (d > 0.01) tags.push(`<audio id="sfx-${n}" src="${out}" data-start="${Math.max(0, at).toFixed(3)}" data-duration="${d.toFixed(3)}" data-volume="${x.vol ?? 0.6}" data-track-index="${11 + (n % 3)}"></audio>`);
    n++;
  }
  // music the user supplied runs under the whole ad, faded out over the last half second (master is then -14 LUFS:
  // lib.loadBrand drops the preset's -20 when ad.json has music)
  if (ad.music?.file) {
    const from = ad.music.from ?? 0, fade = Math.min(0.5, total / 4);
    run("ffmpeg", ["-y", "-v", "error", "-ss", String(from), "-t", String(total), "-i", join(dir, ad.music.file), "-af", `afade=t=out:st=${total - fade}:d=${fade},aresample=48000`, "-ac", "2", join(sfxDir, "music.wav")]);
    tags.unshift(`<audio id="music" src="assets/sfx/music.wav" data-start="0" data-duration="${Math.min(probeDuration(join(sfxDir, "music.wav")), total).toFixed(3)}" data-volume="${ad.music.vol ?? 0.5}" data-track-index="10"></audio>`);
  }
  html = html.replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, () => `<!--@sfx-->\n      ${tags.join("\n      ")}\n      <!--@sfx-end-->`);
  html = applyWatermark(dir, html, total); // the product's logo watermark, top-left (tools/brandmark.mjs)
  writeFileSync(idxPath, html);
  writeJSON(join(dir, "build", "timeline.json"), { duration: total, beats: shots.map(({ id, start, duration, register, src, mode, job }) => ({ id, start, duration, register, hero: src, framing: mode ?? "color", job: job ?? id, character: false, marks: {} })) });
  console.log(`✔ ${shots.length} shot, total ${total.toFixed(2)} s, ${tags.length} sfx`);
  for (const s of shots) console.log(`  ${s.start.toFixed(2).padStart(6)}  ${s.duration.toFixed(2).padStart(5)}s  ${s.id.padEnd(8)} ${s.register} ${s.src}${s.mode && s.mode !== "color" ? " · " + s.mode : ""}${s.tri ? " · tri" : s.mark ? " · logo" : ""}`);
  return { dir, ad, shots, total };
}

// ---------- rules (what the explainer lint checks that still applies, plus what an ad needs) ----------
export function lint(slug) {
  const { dir, ad, shots, total } = build(slug);
  const errors = [], warns = [];
  const max = ad.maxSeconds ?? 15;
  if (total > max) errors.push(`durasi ${total.toFixed(2)} s > ${max} s`);
  const end = shots.at(-1);
  if (end.register !== "endcard") errors.push("shot terakhir harus endcard (nama produk + CTA)");
  if (end.duration < 1.8) errors.push(`end card ${end.duration.toFixed(2)} s: terlalu pendek untuk dibaca (≥ 1,8 s)`);
  if (!ad.name?.trim() || !ad.cta?.trim()) errors.push("ad.json: name dan cta wajib (teks end card)");
  const firstHero = shots.find((s) => s.feather || (s.z0 ?? 1) <= 1.2);
  if (!firstHero || firstHero.start > 2) errors.push("produk utuh harus terlihat sebelum detik 2 (hook)");
  shots.forEach((s, i) => {
    if (!s.job) warns.push(`${s.id}: tanpa job (fungsi shot)`);
    const p = shots[i - 1];
    if (p && p.src === s.src && (p.mode ?? "color") === (s.mode ?? "color") && Math.abs((p.fx ?? 0) - (s.fx ?? 0)) < 60 && Math.abs((p.z0 ?? 1) - (s.z0 ?? 1)) < 0.3) errors.push(`${s.id}: gambar sama dengan ${p.id} (cut ke gambar identik bukan cut)`);
    for (const l of s.labels ?? []) {
      if (l.y < 168 || l.y > 1330) errors.push(`${s.id}: label "${l.text}" di y=${l.y} di luar pita aman 168-1330`);
      if ((l.size ?? 30) < 28) errors.push(`${s.id}: label "${l.text}" < 28 px`);
    }
  });
  const src = existsSync(join(dir, "sources.txt")) ? readFileSync(join(dir, "sources.txt"), "utf8") : "";
  for (const f of readdirSync(join(dir, "assets", "products"))) if (!src.includes(`assets/products/${f}`)) errors.push(`assets/products/${f} tanpa baris di sources.txt`);
  for (const f of existsSync(join(dir, "assets", "audio")) ? readdirSync(join(dir, "assets", "audio")) : []) if (!src.includes(`assets/audio/${f}`)) errors.push(`assets/audio/${f} tanpa baris di sources.txt`);
  for (const w of warns) console.log(`⚠ ${w}`);
  for (const e of errors) console.log(`✖ ${e}`);
  return { errors, warns };
}

if (process.argv[1]?.endsWith("ad.mjs")) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const product = opt("product"), from = opt("from");
  const [cmd, slug, ...rest] = argv;
  if (cmd === "new") {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) die('Usage: node tools/ad.mjs new <slug> "Judul" --product flashcut --from <folder foto>');
    create(slug, rest.join(" ") || slug, { product, from });
    console.log(`✔ videos/${slug}/ (Advertisement · ${product ?? "flashcut"}). Tulis ad.json, lalu: node tools/ad.mjs check ${slug}`);
  } else if (cmd === "build") build(slug);
  else if (cmd === "check") {
    const { errors } = lint(slug);
    if (errors.length) process.exit(1);
    const r = spawnSync("npx", ["hyperframes", "check", videoDir(slug)], { stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) process.exit(1);
    console.log("\n✔ all gates passed");
  } else die("Usage: node tools/ad.mjs new|build|check <slug>");
}
