// music.mjs <slug> [--track <file.mp3|wav>] [--bpm <n>] [--off]
//
// Scores the edit so every cut and animation hit lands on a beat:
//   1. grid: without --track, picks the tempo + phase whose beat grid fits the cuts best (96-140 BPM);
//      with --track (a licensed song the user downloaded), detects its tempo and beat phase instead.
//   2. writes music.json and re-runs cues.mjs, which snaps every cut to the nearest beat and every mark to the nearest
//      half-beat (small moves only, see SNAP in cues.mjs).
//   3. renders assets/music.wav on the snapped timeline: generated = a house score composed to picture (impact on the
//      first frame, kick/clap/hats/bass/pad, a stab on every cut, riser + drop into every "drop" beat, ducked under the
//      voice); track = the song itself, ducked under the voice with a sidechain compressor.
//   4. re-runs cues.mjs, which places <audio id="music"> in index.html.
// --off removes the music (music.json "off") and puts the timeline back on the words.
// Generated music is pure math (seeded), like the SFX kit: free, deterministic, no licence question.
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { videoDir, readJSON, writeJSON, die, run, loadBrand, ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const slug = args[0];
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const dir = videoDir(slug);
const brand = loadBrand(dir);
const M = { volume: 0.32, duck: 0.45, ...(brand.music ?? {}) };
const musicJson = join(dir, "music.json");
const wavOut = join(dir, "assets", "music.wav");
const SR = 44100;

const cues = () => {
  const r = spawnSync("node", [join(ROOT, "tools", "cues.mjs"), slug], { encoding: "utf8" });
  if (r.status !== 0) die(r.stderr || r.stdout);
  return r.stdout;
};
const timeline = () => readJSON(join(dir, "build", "timeline.json"));

if (args.includes("--off")) {
  writeJSON(musicJson, { mode: "off" });
  if (existsSync(wavOut)) rmSync(wavOut);
  cues();
  console.log("✔ music off; cuts follow the words again");
  process.exit(0);
}

// ---------- 1. grid ----------
// start from the word-timed edit (no snapping) so the grid is fitted to where the cuts want to be
writeJSON(musicJson, { mode: "fit" });
cues();
let tl = timeline();
const cutsOf = (t) => t.beats.slice(1).map((b) => b.start);
const hitsOf = (t) => t.beats.flatMap((b) => Object.entries(b.marks).filter(([k]) => k !== "dur").map(([, v]) => b.start + v));

let grid;
const track = opt("track");
if (track) {
  if (!existsSync(track)) die(`track not found: ${track}`);
  grid = { mode: "track", ...detectBeats(track), track };
} else {
  const fixed = opt("bpm") ? +opt("bpm") : null;
  grid = { mode: "generate", ...fitGrid(cutsOf(tl), hitsOf(tl), fixed) };
}
writeJSON(musicJson, { ...grid, created: new Date().toISOString() });
console.log(`grid: ${grid.mode} ${grid.bpm.toFixed(1)} BPM, first beat at ${grid.offset.toFixed(3)} s`);

// ---------- 2. snap ----------
process.stdout.write(cues().split("\n").filter((l) => /snapped|✔/.test(l)).join("\n") + "\n");
tl = timeline();

// ---------- 3. render ----------
const words = readJSON(join(dir, "voice", "words.json"));
if (grid.mode === "track") renderTrack(grid, tl);
else renderScore(grid, tl, words);

// ---------- 4. place ----------
cues();
console.log(`✔ assets/music.wav (${grid.mode}, ${grid.bpm.toFixed(1)} BPM, ${tl.duration.toFixed(2)} s, volume ${M.volume})`);

// =====================================================================================================
// tempo + phase whose quarter-note grid fits the cuts (and half-beats fit the marks) with the least squared error;
// a mild pull toward 118-124 BPM keeps it in "social energy" territory
function fitGrid(cuts, hits, fixed) {
  let best = null;
  const bpms = fixed ? [fixed] : Array.from({ length: (140 - 96) * 4 + 1 }, (_, i) => 96 + i / 4);
  for (const bpm of bpms) {
    const p = 60 / bpm;
    for (let k = 0; k < 120; k++) {
      const off = (k / 120) * p;
      const d = (t, step) => { const x = (t - off) / step; return Math.abs(x - Math.round(x)) * step; };
      let e = 0;
      for (const c of cuts) e += Math.min(d(c, p), 0.25) ** 2;
      for (const h of hits) e += 0.5 * Math.min(d(h, p / 2), 0.2) ** 2;
      e *= 1 + Math.abs(bpm - 121) / 300;
      if (!best || e < best.e) best = { e, bpm, offset: off };
    }
  }
  return { bpm: best.bpm, offset: best.offset };
}

// onset envelope (energy flux) -> autocorrelation for the tempo -> phase with the strongest onsets on the beat
function detectBeats(file) {
  const sr = 11025, hop = 256;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) die("ffmpeg could not decode the track");
  const pcm = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const n = Math.floor(pcm.length / hop), env = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += pcm[i * hop + j] ** 2;
    e = Math.log1p(e * 100);
    env[i] = Math.max(0, e - prev);
    prev = e;
  }
  const fps = sr / hop;
  let bestLag = 0, bestV = -1;
  for (let bpm = 80; bpm <= 170; bpm += 0.25) {
    const lag = (60 / bpm) * fps;
    let v = 0;
    for (let i = 0; i + lag * 4 < n; i++) {
      const a = env[i];
      v += a * (interp(env, i + lag) + 0.5 * interp(env, i + 2 * lag) + 0.25 * interp(env, i + 4 * lag));
    }
    v *= 1 + 0.15 * Math.exp(-(((bpm - 120) / 30) ** 2));
    if (v > bestV) { bestV = v; bestLag = lag; }
  }
  const bpm = (60 * fps) / bestLag;
  let bestOff = 0, bestS = -1;
  for (let k = 0; k < 64; k++) {
    const off = (k / 64) * bestLag;
    let s = 0;
    for (let t = off; t < n; t += bestLag) s += interp(env, t);
    if (s > bestS) { bestS = s; bestOff = off; }
  }
  return { bpm, offset: bestOff / fps };
}
function interp(a, x) { const i = Math.floor(x); return i + 1 < a.length ? a[i] + (a[i + 1] - a[i]) * (x - i) : 0; }

function renderTrack(g, t) {
  // the song from its start, trimmed to the video, faded out, pumped down under the voice
  const dur = t.duration;
  const voice = join(dir, "assets", "voice.wav");
  run("ffmpeg", ["-y", "-v", "error", "-i", g.track, "-i", voice, "-filter_complex",
    `[0:a]atrim=0:${dur},asetpts=N/SR/TB,aformat=channel_layouts=stereo,afade=t=out:st=${Math.max(0, dur - 1.2)}:d=1.2[m];[1:a]aformat=channel_layouts=stereo[v];[m][v]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[out]`,
    "-map", "[out]", "-ar", String(SR), "-c:a", "pcm_s16le", wavOut]);
}

// ---------- the generated score ----------
function renderScore(g, t, words) {
  const dur = t.duration, N = Math.ceil(dur * SR) + SR;
  const L = new Float32Array(N), R = new Float32Array(N);
  const p = 60 / g.bpm;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const add = (t0, fn, len, gain = 1, pan = 0) => {
    const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
    const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
    for (let i = 0; i < n; i++) {
      const k = s0 + i;
      if (k < 0 || k >= N) continue;
      const v = fn(i / SR);
      L[k] += v * gl; R[k] += v * gr;
    }
  };
  // instruments
  const kick = (x) => Math.sin(2 * Math.PI * (45 * x + (110 / 32) * (1 - Math.exp(-x * 32)))) * Math.exp(-x * 7.5);
  const clap = (x) => rnd() * (Math.exp(-x * 38) + 0.5 * Math.exp(-Math.abs(x - 0.012) * 90)) * 0.7;
  const hat = (x) => rnd() * Math.exp(-x * 160) * 0.35;
  const ohat = (x) => rnd() * Math.exp(-x * 26) * 0.18;
  const impact = (x) => Math.sin(2 * Math.PI * (38 * x + (90 / 12) * (1 - Math.exp(-x * 12)))) * Math.exp(-x * 2.6) + rnd() * Math.exp(-x * 9) * 0.35;
  const tick = (x) => Math.sin(2 * Math.PI * 1800 * x) * Math.exp(-x * 120) * 0.5;
  const note = (f, x, d) => { // detuned saw, short decay
    let v = 0;
    for (const det of [-0.006, 0, 0.007]) { const ph = (f * (1 + det) * x) % 1; v += ph * 2 - 1; }
    return (v / 3) * Math.min(1, x * 200) * Math.exp(-x * d);
  };
  // A minor -> F -> C -> G, one chord per bar
  const ROOT = [110, 87.31, 130.81, 98];
  const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const cuts = t.beats.slice(1).map((b) => b.start);
  const drops = t.beats.filter((b, i) => i > 0 && b.drop).map((b) => b.start);
  if (!drops.length) { // no drop marked: the biggest change of register past one third of the video
    const cand = t.beats.find((b, i) => i > 0 && b.start > dur / 3 && t.beats[i - 1].register !== b.register);
    if (cand) drops.push(cand.start);
  }
  const breakdown = (x) => drops.some((d) => x >= d - 2 * p && x < d); // two beats of air before each drop
  const beatsTotal = Math.ceil((dur - g.offset) / p) + 1;
  for (let b = -1; b < beatsTotal; b++) {
    const x = g.offset + b * p;
    if (x < -p) continue;
    const bar = Math.floor((b + 4) / 4), pos = ((b % 4) + 4) % 4;
    const air = breakdown(x);
    if (!air) add(x, kick, 0.5, 0.95);
    if (!air && (pos === 1 || pos === 3)) add(x, clap, 0.25, 0.55, 0.05);
    add(x + p / 2, ohat, 0.2, air ? 0.4 : 1, 0.25);
    for (const q of [0, 0.25, 0.75]) add(x + q * p, hat, 0.05, air ? 0.3 : 0.8, -0.2);
    // bass on eighths, ducked by the kick (pump)
    const root = ROOT[((bar % 4) + 4) % 4];
    for (const e of [0, 0.5]) if (!air) add(x + e * p, (y) => note(root, y, 6) * (0.3 + 0.7 * Math.min(1, y / 0.09)), p / 2, 0.42);
    // pad: whole bar on beat 1, pumped
    if (pos === 0) for (const f of CH[((bar % 4) + 4) % 4]) add(x, (y) => note(f, y, 0.55) * (0.25 + 0.75 * Math.min(1, (y % p) / 0.18)), 4 * p, 0.09, f > 250 ? 0.3 : -0.3);
  }
  // picture hits: impact on frame one, a chord stab on every cut, ticks on marks, riser + impact into drops
  add(0, impact, 1.6, 0.9);
  for (const c of cuts) for (const f of CH[Math.floor((c - g.offset) / (4 * p) + 100) % 4]) add(c, (y) => note(f * 2, y, 9), 0.4, 0.06, f > 250 ? 0.35 : -0.35);
  for (const b of t.beats) for (const [k, v] of Object.entries(b.marks)) if (k !== "dur") add(b.start + v, tick, 0.08, 0.35);
  for (const d of drops) {
    add(d - 2 * p, (y) => rnd() * (y / (2 * p)) ** 2 * 0.5, 2 * p, 0.8); // noise riser
    add(d, impact, 1.6, 1);
  }
  // duck under the voice (smoothed gain from words.json), fade the tail
  const g8 = new Float32Array(N).fill(1);
  for (const w of words) for (let k = Math.max(0, Math.round((w.start - 0.05) * SR)); k < Math.min(N, Math.round((w.end + 0.12) * SR)); k++) g8[k] = M.duck;
  let s = 1;
  const a = 1 / (0.08 * SR);
  for (let k = 0; k < N; k++) {
    s += (g8[k] - s) * a;
    const fade = Math.min(1, Math.max(0, (dur - k / SR) / 1.0));
    L[k] *= s * fade; R[k] *= s * fade;
  }
  // soft clip + normalise to -3 dBFS
  let peak = 0;
  for (let k = 0; k < N; k++) { L[k] = Math.tanh(L[k] * 1.2); R[k] = Math.tanh(R[k] * 1.2); peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k])); }
  const norm = 0.707 / (peak || 1);
  const len = Math.round(dur * SR);
  const buf = Buffer.alloc(44 + len * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(len * 4, 40);
  for (let k = 0; k < len; k++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[k] * norm)) * 32767), 44 + k * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[k] * norm)) * 32767), 46 + k * 4);
  }
  writeFileSync(wavOut, buf);
}
