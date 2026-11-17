// retime.mjs <slug> [--json]
// Beat durations for a BRI (form "kv") project: beats.json → every time in the composition and around it.
//   beats.json { "kv": true, "beats": [ { id, hero, job, dur } × 8 ] }   (written with defaults on the first run)
//   - compositions/kv.html: the /*@beats*/ block (durations) from which the composition derives T itself
//   - person cutouts (intro type behind the family) re-made when the intro gets longer or shorter
//   - frame-edge occluders re-measured for the window end frame 1 is on screen
//   - index.html: total length, SFX on the cuts, music length; score.mjs constants, music.wav re-made
//   - build/timeline.json: the beat list Studio's Beat tab shows
// The music grid is 100 BPM (beats at 0.55 + 0.6 n): every cut is snapped to a half beat (0.3 s), so a duration is
// 0.55 + 0.3 k for the first beat and 0.3 k after it; the closing beat is free (0.05 s).
// Geometry is read from each project's own kv.html, so the 1:1, 4:5 and 16:9 versions retime the same way.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const slug = process.argv[2];
const quiet = process.argv.includes("--json");
const die = (m) => { if (quiet) console.log(JSON.stringify({ ok: false, error: m })); else console.error(`✗ ${m}`); process.exit(1); };
if (!slug || !/^[a-z0-9-]+$/.test(slug)) die("Usage: node advertisement/bri/scripts/retime.mjs <slug>");
const dir = join(ROOT, "videos", slug);
const kvPath = join(dir, "compositions", "kv.html"), idxPath = join(dir, "index.html"), beatsPath = join(dir, "beats.json");
if (!existsSync(kvPath)) die(`${slug}: compositions/kv.html tidak ada (bukan proyek BRI)`);
const log = (m) => { if (!quiet) console.log(m); };

// ---------- the beats and the times derived from them (same function runs in the composition) ----------
const ORDER = [
  ["healing", "teks kinetik di belakang orang", 0.55, 0.55],
  ["tanpa", "teks kinetik di belakang orang", 0.6, 0.3],
  ["kantong", "teks kinetik di belakang orang", 0.6, 0.3],
  ["pakai", "teks kinetik nama produk", 0.9, 0.6],
  ["promo", "angka promo odometer + hentakan", 1.2, 0.9],
  ["end1", "end frame promo (bingkai, klip bergerak)", 3.6, 1.5],
  ["end2", "end frame mitra (logo partner)", 3.9, 1.8],
  ["close", "penutup logo + disclaimer", 1.65, 1.2],
];
const TIMES_FN = `(D) => { const b = D.healing, c = b + D.tanpa, d = c + D.kantong, g = d + D.pakai, fly = g + D.promo, toB = fly + D.end1, close = toB + D.end2, end = close + D.close;
      return { b, c, strike: c + Math.min(0.3, D.kantong - 0.15), d, g, k: g + 0.1, odo: g + 0.3, slam: fly - 0.3, fly, end1: fly + 0.1, shine: fly + Math.min(2.1, D.end1 - 0.6),
        toB, card: toB + 0.3, box: toB + 0.3, grid: toB + 0.9, hit: close - 0.6, close, end }; }`;
const times = new Function(`return ${TIMES_FN}`)();
const r2 = (x) => Math.round(x * 100) / 100;
const snap = (id, v, min) => {
  if (id === "close") return Math.max(min, Math.round(v * 20) / 20);
  const base = id === "healing" ? 0.55 : 0;
  return r2(Math.max(min, base + Math.round((v - base) / 0.3) * 0.3));
};

let kv = readFileSync(kvPath, "utf8");
const text = (id) => (kv.match(new RegExp(`<div id="${id}"[^>]*>([\\s\\S]*?)</div>\\s*(?=<div id="kt-|</div>)`))?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const heroes = { healing: text("kt-a"), tanpa: text("kt-b"), kantong: text("kt-c"), pakai: text("kt-d"), promo: "Angka promo", end1: "End frame promo", end2: "End frame mitra", close: "Penutup logo" };
const old = existsSync(beatsPath) ? JSON.parse(readFileSync(beatsPath, "utf8")) : {};
const prev = old.kv ? Object.fromEntries(old.beats.map((b) => [b.id, b.dur])) : {};
const D = Object.fromEntries(ORDER.map(([id, , def, min]) => [id, snap(id, prev[id] ?? def, min)]));
const T = times(D);
const beats = ORDER.map(([id, job]) => ({ id, hero: heroes[id] || id, job, dur: D[id] }));
writeFileSync(beatsPath, JSON.stringify({ kv: true, note: "Durasi per beat (detik). Ubah di tab Beat Studio atau di sini, lalu: node advertisement/bri/scripts/retime.mjs " + slug, beats }, null, 2) + "\n");

// ---------- composition: durations block + derived T, cutout cut-off ----------
const block = `const D = /*@beats*/${JSON.stringify(D)}/*@end*/; // beats.json (advertisement/bri/scripts/retime.mjs)
    const T = (${TIMES_FN})(D);`;
if (kv.includes("/*@beats*/")) kv = kv.replace(/const D = \/\*@beats\*\/[\s\S]*?\/\*@end\*\/;[^\n]*\n\s*const T = \([\s\S]*?\}\)\(D\);/, block);
else {
  const m = kv.match(/const T = \{[\s\S]*?\};/);
  if (!m) die("baris `const T = {…}` tidak ditemukan di kv.html");
  kv = kv.replace(m[0], block);
}
kv = kv.replace(/const i = t < [0-9.]+ \?/, "const i = t < T.g + 0.13 ?");

// ---------- geometry read from the composition ----------
const css = (sel) => kv.match(new RegExp(`${sel.replace(/[#-]/g, (c) => "\\" + c)} \\{([^}]*)\\}`))?.[1] ?? "";
const px = (s, k) => +(s.match(new RegExp(`(?:^|;|\\s)${k}:\\s*(-?[0-9.]+)px`))?.[1] ?? NaN);
const photo = css("#kv-photo");
const EW = px(photo, "width"), EH = px(photo, "height");
const vid = kv.match(/<video id="kv-vid" src="([^"]+)" data-start="([0-9.]+)"/);
if (!vid || !EW || !EH) die("#kv-photo atau <video id=\"kv-vid\"> tidak terbaca");
const clip = join(dir, vid[1]), vStart = +vid[2];
const [CW, CH] = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", clip], { encoding: "utf8" }).stdout.trim().split(",").map(Number);
const cover = Math.max(EW / CW, EH / CH), offX = (EW - CW * cover) / 2, offY = (EH - CH * cover) / 2;
const OX = 0.46 * EW, OY = 0.4 * EH; // #kv-photo transform-origin 46% 40%
const FPS = 30;

// ---------- cutouts: one per frame until the blue takeover covers the type ----------
const cutCss = css("#kv-cut");
const cutTop = px(cutCss, "top"), cutH = px(cutCss, "height");
const until = r2(T.g + 0.15), need = Math.round(until * FPS) + 1;
const cutDir = join(dir, "assets", "cutout");
const have = existsSync(cutDir) ? readdirSync(cutDir).filter((f) => /^f\d+\.png$/.test(f)).length : 0;
if (cutTop >= 0 && cutH > 0 && (have !== need || !kv.includes(`f${String(need - 1).padStart(3, "0")}.png`) || kv.includes(`f${String(need).padStart(3, "0")}.png`))) {
  mkdirSync(cutDir, { recursive: true });
  for (const f of readdirSync(cutDir)) rmSync(join(cutDir, f));
  const cx = Math.round(-offX / cover), cy = Math.round((cutTop - offY) / cover), cw = Math.round(EW / cover), ch = Math.round(cutH / cover);
  const hh = Math.round(cutH);
  const matte = `crop=${cw}:${ch}:${cx}:${cy},scale=${Math.round(EW)}:${hh},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((62-(b(X,Y)-r(X,Y)))*9,0,255)*clip((${hh - 5}-Y)/12,0,1)'[c];[c]split[x][m];[m]alphaextract,gblur=sigma=1.1[a];[x][a]alphamerge`;
  spawnSync("ffmpeg", ["-v", "error", "-y", ...(vStart > 0 ? [] : []), "-i", clip, "-t", String(until), "-filter_complex", `[0]${matte}`, "-start_number", "0", join(cutDir, "f%03d.png")]);
  const n = readdirSync(cutDir).length;
  const imgs = Array.from({ length: n }, (_, i) => `<img src="assets/cutout/f${String(i).padStart(3, "0")}.png" alt="" />`).join("");
  kv = kv.replace(/<div id="kv-cut">[\s\S]*?<\/div>/, `<div id="kv-cut">${imgs}</div>`);
  log(`  potongan orang: ${n} frame (0–${until} s)`);
}

// ---------- frame-edge occluders for the end-frame-1 window ----------
const rect = kv.match(/id="kv-frame-r" x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)" rx="([0-9.]+)"/);
const band = kv.match(/`<polygon points="\$\{a\},(\d+) \$\{b\},\d+ \$\{b\},(\d+)/);
if (rect && band) {
  const [x, y, w, , rx] = rect.slice(1).map(Number);
  const EDGE = y, X1 = Math.round(x + rx), X2 = Math.round(x + w - rx);
  const T0 = r2(T.fly - 0.05), T1 = r2(T.toB + 0.45);
  const scale = (t) => 1 + 0.04 * Math.max(0, Math.min(1, (t - T.fly) / (T.toB - T.fly)));
  const toClip = (X, Y, s) => [((OX + (X - OX) / s) - offX) / cover, ((OY + (Y - OY) / s) - offY) / cover];
  const [, yA] = toClip(X1, EDGE - 8, 1), [, yB] = toClip(X1, EDGE + 8, 1.05);
  const Y0 = Math.max(0, Math.floor(Math.min(yA, yB)) - 4), ROWS = Math.min(CH - Y0, Math.ceil(Math.abs(yB - yA)) + 12);
  const raw = spawnSync("ffmpeg", ["-v", "error", "-i", clip, "-vf", `crop=${CW}:${ROWS}:0:${Y0}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 }).stdout;
  const fsz = CW * ROWS * 3, nFrames = raw.length / fsz;
  const sky = (i) => raw[i + 2] > 170 && raw[i + 2] - raw[i] > 30 && raw[i + 1] > 120;
  const runs = [];
  for (let t = T0; t <= T1 + 1e-6; t += 1 / FPS) {
    const n = Math.min(nFrames - 1, Math.max(0, Math.round((t - vStart) * FPS))), s = scale(t);
    const out = [];
    let a = -1;
    for (let X = X1; X <= X2; X++) {
      let cov = 0;
      for (let dy = -4; dy <= 4; dy += 2) {
        const [cxp, cyp] = toClip(X, EDGE + dy, s);
        const xs = Math.round(cxp), ys = Math.round(cyp) - Y0;
        if (xs < 0 || xs >= CW || ys < 0 || ys >= ROWS) continue;
        if (!sky(n * fsz + (ys * CW + xs) * 3)) cov++;
      }
      const c = cov >= 3;
      if (c && a < 0) a = X;
      if ((!c || X === X2) && a >= 0) { if (X - a > 5) out.push([a - 3, X + 3]); a = -1; }
    }
    runs.push(out);
  }
  kv = kv.replace(/\/\*@dyn\*\/[\s\S]*?\/\*@end\*\//, `/*@dyn*/${JSON.stringify({ t0: T0, fps: FPS, runs })}/*@end*/`);
  log(`  celah bingkai: ${runs.length} frame (${T0}–${T1} s)`);
}
writeFileSync(kvPath, kv);

// ---------- index.html: length, SFX on the cuts, music ----------
const sfx = [["whoosh", T.b - 0.05, 0.08], ["whoosh", T.c - 0.05, 0.08], ["tick", T.strike - 0.02, 0.16], ["whoosh", T.d - 0.05, 0.08], ["whoosh", T.g - 0.05, 0.12],
  ["pop", T.slam - 0.02, 0.2], ["whoosh", T.fly - 0.05, 0.1], ["pop", T.fly + 0.48, 0.14], ["whoosh", T.toB - 0.07, 0.14], ["pop", T.box + 0.73, 0.2]];
const LEN = { whoosh: 0.42, pop: 0.18, tick: 0.08 };
let idx = readFileSync(idxPath, "utf8");
idx = idx.replace(/(<div id="root" data-composition-id="main" data-start="0" data-duration=")[0-9.]+/, `$1${r2(T.end)}`)
  .replace(/(<div id="kv"[^>]*data-duration=")[0-9.]+/, `$1${r2(T.end)}`)
  .replace(/<!--@sfx-->[\s\S]*?<!--@sfx-end-->/, `<!--@sfx-->\n${sfx.map(([f, t, v], i) => `      <audio id="sfx-${i}" src="assets/sfx/${f}.wav" data-start="${t.toFixed(3)}" data-duration="${LEN[f]}" data-volume="${v}" data-track-index="${11 + (i % 3)}"></audio>`).join("\n")}\n      <audio id="music" src="assets/music.wav" data-start="0" data-duration="${r2(T.end)}" data-volume="0.55" data-track-index="10"></audio>\n      <!--@sfx-end-->`);
writeFileSync(idxPath, idx);

// ---------- music (score.mjs in the project folder) ----------
const scorePath = join(dir, "score.mjs");
if (existsSync(scorePath)) {
  let sc = readFileSync(scorePath, "utf8");
  const list = (a) => `[${a.map(r2).join(", ")}]`;
  sc = sc.replace(/const SR = 44100, DUR = [0-9.]+,/, `const SR = 44100, DUR = ${r2(T.end)},`)
    .replace(/const CUTS = \[[^\]]*\];/, `const CUTS = ${list([T.b, T.c, T.d, T.g, T.fly, T.toB, T.card])};`)
    .replace(/const TICKS = \[[^\]]*\];/, `const TICKS = ${list([T.strike, T.odo, T.odo + 0.3, T.grid, T.grid + 0.3, T.hit])};`)
    .replace(/const DROPS = \[[^\]]*\];/, `const DROPS = ${list([T.slam])};`)
    .replace(/add\([0-9.]+, impact, 1\.6, 0\.6\);/, `add(${r2(T.toB)}, impact, 1.6, 0.6);`);
  writeFileSync(scorePath, sc);
  const r = spawnSync(process.execPath, [scorePath], { encoding: "utf8" });
  if (r.status !== 0) die(`musik gagal: ${r.stderr}`);
  log(`  musik: ${r2(T.end)} s`);
}

// ---------- build/timeline.json for the Beat tab ----------
let start = 0;
const tl = beats.map((b) => { const o = { id: b.id, start: r2(start), duration: b.dur, register: /end|close/.test(b.id) ? "screen" : "type", framing: "full-bleed", marks: {}, hero: b.hero, job: b.job }; start += b.dur; return o; });
mkdirSync(join(dir, "build"), { recursive: true });
writeFileSync(join(dir, "build", "timeline.json"), JSON.stringify({ duration: r2(T.end), kv: true, beats: tl }, null, 2) + "\n");

const warn = T.toB > vStart + 10 ? `klip Flow 10 s habis sebelum end frame mitra (${r2(T.toB)} s): frame terakhir ditahan` : null;
if (quiet) console.log(JSON.stringify({ ok: true, duration: r2(T.end), beats, warn }));
else console.log(`✔ ${slug}: ${r2(T.end)} s · ${beats.map((b) => `${b.id} ${b.dur}`).join(" · ")}${warn ? `\n⚠ ${warn}` : ""}`);
