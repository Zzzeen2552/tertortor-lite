// score.mjs: music for this silent ad, the same instruments and recipe as tools/music.mjs (generated from math,
// seeded, licence-free), but composed to this composition's own hit list instead of beats.json/words.json.
// 100 BPM, beats at 0.55 + 0.6 n. Run: node videos/bri-debit-virtual-visa/score.mjs  ->  assets/music.wav
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const SR = 44100, DUR = 13, BPM = 100, OFFSET = 0.55 - 0.6;
const CUTS = [0.55, 1.15, 1.75, 2.65, 3.85, 7.45, 7.75];   // word cuts, blue takeover, end frame 1, zoom-through, end frame 2
const TICKS = [1.45, 2.95, 3.25, 8.35, 8.65, 11.35];      // strike, odometer, grid lines, last box hit
const DROPS = [3.55];                                     // the 25% slam: two beats of air + riser before it

const N = Math.ceil(DUR * SR) + SR, L = new Float32Array(N), R = new Float32Array(N);
const p = 60 / BPM;
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const add = (t0, fn, len, gain = 1, pan = 0) => {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < n; i++) { const k = s0 + i; if (k < 0 || k >= N) continue; const v = fn(i / SR); L[k] += v * gl; R[k] += v * gr; }
};
const kick = (x) => Math.sin(2 * Math.PI * (45 * x + (110 / 32) * (1 - Math.exp(-x * 32)))) * Math.exp(-x * 7.5);
const clap = (x) => rnd() * (Math.exp(-x * 38) + 0.5 * Math.exp(-Math.abs(x - 0.012) * 90)) * 0.7;
const hat = (x) => rnd() * Math.exp(-x * 160) * 0.35;
const ohat = (x) => rnd() * Math.exp(-x * 26) * 0.18;
const impact = (x) => Math.sin(2 * Math.PI * (38 * x + (90 / 12) * (1 - Math.exp(-x * 12)))) * Math.exp(-x * 2.6) + rnd() * Math.exp(-x * 9) * 0.35;
const tick = (x) => Math.sin(2 * Math.PI * 1800 * x) * Math.exp(-x * 120) * 0.5;
const note = (f, x, d) => { let v = 0; for (const det of [-0.006, 0, 0.007]) { const ph = (f * (1 + det) * x) % 1; v += ph * 2 - 1; } return (v / 3) * Math.min(1, x * 200) * Math.exp(-x * d); };
// bright major loop for a holiday promo: C -> G -> A minor -> F
const ROOT = [130.81, 98, 110, 87.31];
const CH = [[261.63, 329.63, 392], [246.94, 293.66, 392], [220, 261.63, 329.63], [220, 261.63, 349.23]];
const air = (x) => DROPS.some((d) => x >= d - 2 * p && x < d);
const total = Math.ceil((DUR - OFFSET) / p) + 1;
for (let b = 0; b < total; b++) {
  const x = OFFSET + b * p;
  const bar = Math.floor(b / 4), pos = b % 4, a = air(x);
  if (!a) add(x, kick, 0.5, 0.95);
  if (!a && (pos === 1 || pos === 3)) add(x, clap, 0.25, 0.55, 0.05);
  add(x + p / 2, ohat, 0.2, a ? 0.4 : 1, 0.25);
  for (const q of [0, 0.25, 0.75]) add(x + q * p, hat, 0.05, a ? 0.3 : 0.8, -0.2);
  const root = ROOT[bar % 4];
  for (const e of [0, 0.5]) if (!a) add(x + e * p, (y) => note(root, y, 6) * (0.3 + 0.7 * Math.min(1, y / 0.09)), p / 2, 0.42);
  if (pos === 0) for (const f of CH[bar % 4]) add(x, (y) => note(f, y, 0.55) * (0.25 + 0.75 * Math.min(1, (y % p) / 0.18)), 4 * p, 0.09, f > 250 ? 0.3 : -0.3);
}
add(0, impact, 1.6, 0.9);
for (const c of CUTS) for (const f of CH[Math.floor((c - OFFSET) / (4 * p)) % 4]) add(c, (y) => note(f * 2, y, 9), 0.4, 0.07, f > 250 ? 0.35 : -0.35);
for (const t of TICKS) add(t, tick, 0.08, 0.35);
for (const d of DROPS) { add(d - 2 * p, (y) => rnd() * (y / (2 * p)) ** 2 * 0.5, 2 * p, 0.8); add(d, impact, 1.6, 1); }
add(7.45, impact, 1.6, 0.6);
// fade the tail, soft clip, -3 dBFS
let peak = 0;
for (let k = 0; k < N; k++) {
  const fade = Math.min(1, Math.max(0, (DUR - k / SR) / 1.2));
  L[k] = Math.tanh(L[k] * fade * 1.2); R[k] = Math.tanh(R[k] * fade * 1.2);
  peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
}
const norm = 0.707 / (peak || 1), len = Math.round(DUR * SR), buf = Buffer.alloc(44 + len * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(len * 4, 40);
for (let k = 0; k < len; k++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[k] * norm)) * 32767), 44 + k * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[k] * norm)) * 32767), 46 + k * 4);
}
writeFileSync(join(dir, "assets", "music.wav"), buf);
console.log(`✔ assets/music.wav (${BPM} BPM, ${DUR} s)`);
