// cues.mjs <slug>
//
// Word cues, not stopwatch numbers. Reads beats.json + voice/words.json and:
//   1. resolves every beat's `cue` and every `marks` entry to seconds ("time after" chaining),
//   2. writes data-start / data-duration on each beat host in index.html (and the root, voice, captions),
//   3. injects each scene's local marks into its `/*@cues*/{...}/*@end*/` block,
//   4. regenerates compositions/captions.html from the words.
// One-take presets (preset.json "oneTake", Docucine): no host per beat. A single compositions/world.html spans the whole
// video and gets every beat's absolute start/end/marks in its /*@cues*/ block, so the camera never cuts.
// Change a word in the script -> re-run voice + cues -> the whole video re-times itself.
// A cue word that no longer exists fails the build: re-cue that beat.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { buildKit, SFX_DIR } from "./sfx.mjs";
import { isMusafo, musafoCaptions } from "./musafo.mjs";
import { applyWatermark } from "./brandmark.mjs";
import { join } from "node:path";
import { videoDir, readJSON, writeJSON, die, norm, loadBrand, ROOT, brandCss, sceneTemplate, enWords, idWords, probeDuration } from "./lib.mjs";

const slug = process.argv[2];
const dir = videoDir(slug);
const brand = loadBrand(dir);
const F = brand.frame; // 1080×1920 or 1920×1080 (meta.json "format")
const oneTake = brand.oneTake;
const plan = readJSON(join(dir, "beats.json"));
const wordsPath = join(dir, "voice", "words.json");
if (!existsSync(wordsPath)) die("voice/words.json missing. Run: npm run voice -- " + slug);
const words = readJSON(wordsPath);
const W = words.map((w) => norm(w.text));
const fps = 30;
const snap = (t) => Math.round(t * fps) / fps;

// ASR writes "Step 1", the script says "step one": treat digits and number words as the same token.
const same = (a, b) => {
  if (a === b) return true;
  const [d, w] = /^\d+$/.test(a) ? [a, b] : /^\d+$/.test(b) ? [b, a] : [];
  return d !== undefined && [enWords(+d), idWords(+d)].some((f) => norm(f) === w);
};

// "word", "two words", "word+0.37", "word-0.1", "word@end" (end of the word instead of its start)
function resolve(expr, after, label) {
  const m = String(expr).match(/^(.+?)(@end)?([+-]\d*\.?\d+)?$/);
  const phrase = m[1].trim().split(/\s+/).map(norm);
  for (let i = 0; i < W.length; i++) {
    if (words[i].start < after - 1e-6) continue;
    if (phrase.every((p, k) => W[i + k] !== undefined && same(W[i + k], p))) {
      const w = m[2] ? words[i + phrase.length - 1].end : words[i].start;
      return { t: w + (m[3] ? parseFloat(m[3]) : 0), at: words[i].start };
    }
  }
  die(`cue "${expr}" not found after ${after.toFixed(2)}s (${label}). The script changed: re-cue this beat in beats.json.`);
}

const lead = plan.cutLead ?? 0.07; // cut a couple of frames before the word lands
const voiceEnd = words.at(-1).end;
const total = snap(voiceEnd + (plan.tail ?? 0.6));
let chain = 0;
const beats = plan.beats.map((b, i) => {
  let start = 0;
  if (i > 0) {
    if (!b.cue) die(`beat "${b.id}" has no cue.`);
    const r = resolve(b.cue, chain, `beat ${b.id}`);
    chain = r.at;
    start = snap(Math.max(0, r.t - lead));
  }
  const marks = {};
  let mchain = chain;
  for (const [name, expr] of Object.entries(b.marks || {})) {
    const r = resolve(expr, mchain, `beat ${b.id} mark ${name}`);
    mchain = r.at;
    marks[name] = r.t;
  }
  return { ...b, start, marks };
});
// music grid (music.json, written by tools/music.mjs): a cut moves to the nearest beat (else half-beat) and a mark to the
// nearest half-beat, only when the move is small, so picture and score hit together without leaving the words behind
const mj = existsSync(join(dir, "music.json")) ? readJSON(join(dir, "music.json")) : null;
const grid = mj?.bpm && !["off", "fit"].includes(mj.mode) ? mj : null;
const SNAP = { cut: 0.22, mark: 0.14 };
if (grid) {
  const p = 60 / grid.bpm, near = (t, step) => grid.offset + Math.round((t - grid.offset) / step) * step;
  let moved = 0;
  beats.forEach((b, i) => {
    if (i > 0) for (const step of [p, p / 2]) {
      const s = near(b.start, step);
      if (Math.abs(s - b.start) <= SNAP.cut && s > beats[i - 1].start + 0.25) { b.start = snap(s); moved++; break; }
    }
    for (const k of Object.keys(b.marks)) { const h = near(b.marks[k], p / 2); if (Math.abs(h - b.marks[k]) <= SNAP.mark) b.marks[k] = h; }
  });
  console.log(`  snapped ${moved}/${beats.length - 1} cuts to the ${grid.bpm.toFixed(1)} BPM grid`);
}
beats.forEach((b, i) => {
  b.end = i < beats.length - 1 ? beats[i + 1].start : total;
  b.duration = snap(b.end - b.start);
  if (b.duration <= 0) die(`beat "${b.id}" has zero/negative length: its cue lands before the previous beat's.`);
  for (const k of Object.keys(b.marks)) b.marks[k] = +Math.max(0, b.marks[k] - b.start).toFixed(3);
  b.marks.dur = b.duration;
});

// ---------- patch index.html ----------
const idxPath = join(dir, "index.html");
// preset font files (fontFaces src "assets/fonts/<file>") come from presets/<id>/fonts/
for (const ff of brand.fontFaces ?? []) {
  const m = /^assets\/fonts\/([^/]+)$/.exec(ff.src ?? "");
  if (!m || existsSync(join(dir, ff.src))) continue;
  const from = join(ROOT, "presets", brand.preset, "fonts", m[1]);
  if (!existsSync(from)) die(`font ${ff.src}: ${from} tidak ada`);
  mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
  copyFileSync(from, join(dir, ff.src));
}
let html = readFileSync(idxPath, "utf8").replace(/\/\*@brand\*\/[\s\S]*?\/\*@end\*\//, () => brandCss(brand));
const setTiming = (id, start, duration) => {
  const re = new RegExp(`(<[^>]*\\bid="${id}"[^>]*>)`);
  const tag = html.match(re);
  if (!tag) return false;
  let t = tag[1]
    .replace(/\sdata-start="[^"]*"/, ` data-start="${start}"`)
    .replace(/\sdata-duration="[^"]*"/, ` data-duration="${duration}"`);
  if (!/data-start=/.test(t)) t = t.replace(/>$/, ` data-start="${start}">`);
  if (!/data-duration=/.test(t)) t = t.replace(/>$/, ` data-duration="${duration}">`);
  html = html.replace(tag[1], t);
  return true;
};
setTiming("root", 0, total);
setTiming("voice", 0, snap(Math.min(total, probeDuration(join(dir, "assets", "voice.wav")) - 0.01)));
setTiming("captions", 0, total);
// one take: a single "world" host from 0 to the end, its stub from the preset's scenes/world.html
if (oneTake) {
  if (!/\bid="world"/.test(html)) html = html.replace("<!--@beats-end-->", `<div id="world" class="clip" data-composition-id="world" data-composition-src="compositions/world.html" data-start="0" data-duration="1" data-track-index="0" data-track-kind="graphics" data-width="${F.w}" data-height="${F.h}"></div>\n      <!--@beats-end-->`);
  const scene = join(dir, "compositions", "world.html");
  if (!existsSync(scene)) {
    const stub = sceneTemplate(dir, "world");
    if (!stub) die(`preset ${brand.preset} is oneTake but has no scenes/world.html.`);
    writeFileSync(scene, readFileSync(stub, "utf8").replaceAll("__W__", String(F.w)).replaceAll("__H__", String(F.h)));
    console.log("  + compositions/world.html (one take)");
  }
}
if (!oneTake) beats.forEach((b, i) => {
  // New beat in beats.json -> add its host to index.html and a scene stub for its register.
  if (!new RegExp(`\\bid="${b.id}"`).test(html)) {
    const host = `<div id="${b.id}" class="clip" data-composition-id="${b.id}" data-composition-src="compositions/${b.id}.html" data-start="0" data-duration="1" data-track-index="${i % 2}" data-track-kind="graphics" data-width="${F.w}" data-height="${F.h}"></div>\n      `;
    html = html.replace("<!--@beats-end-->", host + "<!--@beats-end-->");
  }
  const scene = join(dir, "compositions", `${b.id}.html`);
  if (!existsSync(scene)) {
    // "stub": a preset's named variant of a register (VOX "layered" = parallax photo scene), else the register's own stub
    const stub = (b.stub && sceneTemplate(dir, b.stub)) || sceneTemplate(dir, b.register ?? "type");
    if (!stub) die(`no scene template for register "${b.register}" in preset ${brand.preset}.`);
    const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    writeFileSync(scene, readFileSync(stub, "utf8").replaceAll("__ID__", b.id).replaceAll("__HERO__", esc(b.heroText ?? b.hero)).replaceAll("__JOB__", esc(b.job)));
    console.log(`  + compositions/${b.id}.html (stub: ${b.stub ?? b.register})`);
  }
});
// beats removed from beats.json (e.g. a Musafo script regrouped into fewer shots): drop their generated hosts too
const keepIds = new Set(oneTake ? ["world"] : beats.map((b) => b.id));
html = html.replace(/<div id="([\w-]+)" class="clip" data-composition-id="\1" data-composition-src="compositions\/\1\.html"[^>]*><\/div>\s*/g, (m, id) => (keepIds.has(id) || id === "captions" ? m : (console.log(`  - host ${id} (tidak ada lagi di beats.json)`), "")));
if (oneTake) {
  setTiming("world", 0, total);
  const scene = join(dir, "compositions", "world.html");
  // absolute seconds: beats[id] = { start, end, dur, marks }, plus the order and the total
  const C = { total, order: beats.map((b) => b.id), beats: Object.fromEntries(beats.map((b) => [b.id, { start: b.start, end: b.end, dur: b.duration, marks: Object.fromEntries(Object.entries(b.marks).filter(([k]) => k !== "dur").map(([k, v]) => [k, +(b.start + v).toFixed(3)])) }])) };
  const s = readFileSync(scene, "utf8");
  if (!s.includes("/*@cues*/")) die("compositions/world.html has no /*@cues*/ block.");
  writeFileSync(scene, s.replace(/\/\*@cues\*\/[\s\S]*?\/\*@end\*\//, () => `/*@cues*/${JSON.stringify(C)}/*@end*/`));
}
if (!oneTake) for (const b of beats) {
  if (!setTiming(b.id, b.start, b.duration)) die(`index.html has no host with id="${b.id}" (beat in beats.json).`);
  const scene = join(dir, "compositions", `${b.id}.html`);
  let s = readFileSync(scene, "utf8");
  if (!s.includes("/*@cues*/")) console.warn(`⚠ compositions/${b.id}.html has no /*@cues*/ block; marks not injected.`);
  s = s.replace(/\/\*@cues\*\/[\s\S]*?\/\*@end\*\//, `/*@cues*/${JSON.stringify(b.marks)}/*@end*/`);
  writeFileSync(scene, s);
}
// ---------- sound design: whoosh on every cut, a hit on every word mark the brand maps (beat.sfx overrides) ----------
const S = brand.sfx ?? {};
const cues = [];
if (S.enabled !== false) {
  buildKit();
  beats.forEach((b, i) => {
    const own = b.sfx ?? {};
    const cut = own.cut ?? (i > 0 && !oneTake ? S.cut : null); // one take has no cuts to whoosh
    if (cut) cues.push({ name: cut, t: b.start - (S.lead ?? 0.08) - (cut === "whoosh" ? 0.18 : 0) });
    for (const [mark, local] of Object.entries(b.marks)) {
      if (mark === "dur") continue;
      const name = own[mark] ?? S.marks?.[mark];
      if (name) cues.push({ name, t: b.start + local - (S.lead ?? 0.08) - (name === "riser" ? 1.1 : 0) });
    }
  });
}
const sfxDir = join(dir, "assets", "sfx");
mkdirSync(sfxDir, { recursive: true });
const audioTags = cues
  .filter((c) => c.t >= 0 && c.t < total - 0.1)
  .sort((a, b) => a.t - b.t)
  .map((c, i) => {
    copyFileSync(join(SFX_DIR, `${c.name}.wav`), join(sfxDir, `${c.name}.wav`));
    const d = probeDuration(join(sfxDir, `${c.name}.wav`));
    const vol = S.volume?.[c.name] ?? 0.3;
    return `<audio id="sfx-${i}" src="assets/sfx/${c.name}.wav" data-start="${c.t.toFixed(3)}" data-duration="${Math.min(d, total - c.t).toFixed(3)}" data-volume="${vol}" data-track-index="${11 + (i % 2)}"></audio>`;
  });
// the score (tools/music.mjs) rides under everything, already ducked under the voice
const musicWav = join(dir, "assets", "music.wav");
if (grid && existsSync(musicWav)) audioTags.push(`<audio id="music" src="assets/music.wav" data-start="0" data-duration="${snap(Math.min(total, probeDuration(musicWav)) - 0.01)}" data-volume="${brand.music?.volume ?? 0.32}" data-track-index="13"></audio>`);
const block = `<!--@sfx-->\n      ${audioTags.join("\n      ")}\n      <!--@sfx-end-->`;
if (/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/.test(html)) html = html.replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, () => block);
else html = html.replace(/(\s*)<audio id="voice"/, (m, ws) => `${ws}${block}${ws}<audio id="voice"`);
// the channel's logo, top-left, the whole video (tools/brandmark.mjs)
html = applyWatermark(dir, html, total);

writeFileSync(idxPath, html);

// ---------- captions ----------
// Musafo: one line at a time with its English translation, from musafo.json
// captions "enabled": false (Docucine: a spoken phrase is on screen once, user 2026-11-09) -> an empty layer
writeFileSync(join(dir, "compositions", "captions.html"), brand.captions?.enabled === false ? noCaptions() : isMusafo(dir) ? musafoCaptions(dir, words, total, brand.captions) : captionsScene(words, total, brand.captions));

writeJSON(join(dir, "build", "timeline.json"), {
  duration: total,
  frame: F,
  ...(oneTake ? { oneTake: true } : {}),
  beats: beats.map(({ id, start, duration, register, framing, hero, job, character, marks, drop }) => ({ id, start, duration, register, framing, hero, job, character: !!character, marks, ...(drop ? { drop: true } : {}) })),
  ...(grid ? { music: { mode: grid.mode, bpm: grid.bpm, offset: grid.offset } } : {}),
});
console.log(`✔ ${beats.length} beats re-timed, total ${total.toFixed(2)} s, ${audioTags.length} sfx`);
for (const b of beats) console.log(`  ${b.start.toFixed(2).padStart(7)}  ${b.duration.toFixed(2).padStart(5)}s  ${b.id.padEnd(12)} ${b.register ?? ""} / ${b.framing ?? ""}`);

function noCaptions() {
  return `<template>
  <div id="root" data-composition-id="captions" data-width="${F.w}" data-height="${F.h}"></div>
  <script>
    // GENERATED by tools/cues.mjs: this preset has no burned-in captions (preset.json captions.enabled = false).
    window.__timelines["captions"] = gsap.timeline({ paused: true });
  </script>
</template>
`;
}

function captionsScene(words, total, c) {
  const groups = [];
  let g = [];
  words.forEach((w, i) => {
    g.push({ ...w, i });
    const next = words[i + 1];
    const brk = !next || g.length >= c.maxWords || /[.,!?;:]$/.test(w.text) || next.start - w.end >= 0.15;
    if (brk) {
      groups.push(g);
      g = [];
    }
  });
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const markup = groups
    .map((g, gi) => `    <div class="cap" id="cap-${gi}"><span class="pill">${g.map((w) => `<span id="cw-${w.i}">${esc(w.text.replace(/[.,;:]+$/, ""))}</span>`).join(" ")}</span></div>`)
    .join("\n");
  const opens = groups.map((g) => snap(Math.max(0.1, g[0].start - 0.05)));
  const timing = groups.map((g, gi) => [gi, opens[gi], snap(Math.min(total, opens[gi + 1] ?? total, g.at(-1).end + 0.12)), g.map((w) => [w.i, w.start])]);
  return `<template>
  <style>
    #root { position: absolute; inset: 0; pointer-events: none; }
    #captions-stage { position: absolute; left: 0; right: 0; top: ${c.y}px; }
    .cap {
      position: absolute; left: 90px; right: 90px; top: 0; text-align: center; opacity: 0;
      font-family: var(--font-caption, var(--font-display)); font-weight: ${c.weight}; font-size: ${c.size}px;
      line-height: 1.08; letter-spacing: -0.01em; color: ${c.color}; text-transform: ${c.uppercase ? "uppercase" : "none"};
      text-shadow: ${c.textShadow ?? "0 4px 18px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.9)"};
    }
    .cap .pill { display: inline; padding: 6px 22px 10px; border-radius: ${c.radius ?? 22}px; background: ${c.pill}; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .cap .pill span { display: inline-block; margin: 0 0.14em; }${c.activeBg ? `
    .cap .pill span { margin: 0 0.02em; padding: 0 0.12em; border-radius: 4px; background: rgba(0,0,0,0); }` : ""}
  </style>
  <div id="root" data-composition-id="captions" data-width="${F.w}" data-height="${F.h}">
    <div id="captions-stage" data-layout-allow-overlap>
${markup}
    </div>
  </div>
  <script>
    // GENERATED by tools/cues.mjs from voice/words.json. Edit the style in brand/brand.json, not here.
    const tl = gsap.timeline({ paused: true });
    const T = ${JSON.stringify(timing)};
    for (const [gi, a, b, ws] of T) {
      const el = "#cap-" + gi;
      tl.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.12, ease: "power3.out" }, a);
      for (const [wi, t] of ws) {
        ${c.activeBg
          ? `tl.fromTo("#cw-" + wi, { color: "${c.color}", backgroundColor: "rgba(0,0,0,0)" }, { color: "${c.activeColor}", backgroundColor: "${c.activeBg}", duration: 0.04, ease: "steps(1)" }, Math.max(a, t));
        if (ws[ws.findIndex((x) => x[0] === wi) + 1]) tl.to("#cw-" + wi, { color: "${c.color}", backgroundColor: "rgba(0,0,0,0)", duration: 0.04, ease: "steps(1)" }, ws[ws.findIndex((x) => x[0] === wi) + 1][1]);`
          : `tl.fromTo("#cw-" + wi, { color: "${c.color}", scale: 1 }, { color: "${c.activeColor}", scale: 1.06, duration: 0.08, ease: "power2.out" }, Math.max(a, t));`}
      }
      tl.to(el, { opacity: 0, duration: 0.1, ease: "power2.in" }, Math.max(a + 0.12, b - 0.1));
      tl.set(el, { opacity: 0, visibility: "hidden" }, b);
    }
    window.__timelines["captions"] = tl;
  </script>
</template>
`;
}
