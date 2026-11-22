// story-music.mjs <slug> [--off] [--mood <id>] [--vol 0.5]: the underscore of a Storytelling video (user 2026-11-14 "bisa
// tambahkan musik di semua video, mulai dari om liem?", BKH series first). Composed from math like the SFX kit and
// tools/anim-music.mjs: seeded, deterministic, free, no licence question, nothing to credit.
//
// Unlike tools/music.mjs (the explainer's house score) nothing is snapped: the cuts of a Storytelling video sit on the
// narration and stay there. The score follows the picture instead:
//   - a slow chord progression (pad of detuned, filtered saws + a low sine drone), one chord every two bars;
//   - a sparse felt-piano line on the chord tones, quieter while someone speaks;
//   - at every shot cut (build/timeline.json) a soft low swell lands on the cut, so each new image arrives with it;
//   - the last shot of a part that is not the series finale (cliffhanger) gets a held tension note into the end;
//   - ducked under the voice (voice/words.json), faded in and out.
// Mood per channel: brand.json → <type>.music (key, mode, bpm, prog, vol) over the MOODS below. Writes assets/music.wav
// and music.json { mode: "story" }; cues.mjs then adds <audio id="music"> to index.html. Re-run after the voice changes
// (musafo.mjs build runs cues, so the tag stays). Render as usual (Studio "Setujui & render video" or npm run finish).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, videoDir, probeDuration } from "./lib.mjs";

const SR = 44100;
const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10] };
const NOTE = { C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
// moods: berakitkehulu = nostalgic, warm, hopeful under the hardship; others fall back to "story"
export const MOODS = {
  story: { key: "D", mode: "minor", bpm: 70, prog: [1, 6, 3, 7], vol: 0.3, duck: 0.35 },
  berakitkehulu: { key: "A", mode: "minor", bpm: 72, prog: [1, 6, 3, 7], vol: 0.3, duck: 0.35 },
  musafo: { key: "D", mode: "dorian", bpm: 64, prog: [1, 7, 6, 7], vol: 0.45 },
  bumidipijak: { key: "E", mode: "minor", bpm: 60, prog: [1, 6, 4, 5], vol: 0.45 },
  miracleofhajj: { key: "F", mode: "major", bpm: 62, prog: [1, 5, 6, 4], vol: 0.45 },
  cinestory: { key: "C", mode: "aeolian", bpm: 84, prog: [1, 6, 3, 7], vol: 0.32, duck: 0.4 },
};
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function compose({ total, cuts, words, mood, seed = 7, cliff = false }) {
  const N = Math.ceil(total * SR), L = new Float32Array(N), R = new Float32Array(N);
  const rnd = mulberry(seed);
  const scale = MODES[mood.mode] ?? MODES.minor, root = 45 + (NOTE[mood.key] ?? 9) - 9; // around A2
  const deg = (d, oct = 0) => { const k = d - 1, n = scale.length; return root + 12 * (Math.floor(k / n) + oct) + scale[((k % n) + n) % n]; };
  const bar = (60 / mood.bpm) * 4, chordLen = 2 * bar;
  const chords = Math.ceil(total / chordLen) + 1;
  const add = (k, l, r) => { if (k >= 0 && k < N) { L[k] += l; R[k] += r; } };

  // pad: three detuned saws per chord tone through a one-pole low-pass, slow attack and release, crossfading chords
  for (let c = 0; c < chords; c++) {
    const d = mood.prog[c % mood.prog.length], tones = [deg(d, 1), deg(d + 2, 1), deg(d + 4, 1)];
    const t0 = c * chordLen - 1.2, len = chordLen + 2.4;
    for (const [ti, m] of tones.entries()) for (const det of [-0.006, 0, 0.005]) {
      const f = hz(m) * (1 + det), pan = (ti - 1) * 0.35 + det * 20;
      let ph = rnd(), lp = 0;
      const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
      for (let i = 0; i < n; i++) {
        const x = i / SR;
        ph = (ph + f / SR) % 1;
        lp += (ph * 2 - 1 - lp) * 0.035;
        const env = Math.min(1, x / 1.6) * Math.min(1, (len - x) / 1.6);
        const v = lp * env * 0.022;
        add(s0 + i, v * (1 - pan), v * (1 + pan));
      }
    }
    // drone: the chord root two octaves down, a plain sine
    const f = hz(deg(d, -1)), s0 = Math.round(t0 * SR), n = Math.round(len * SR);
    for (let i = 0; i < n; i++) { const x = i / SR, env = Math.min(1, x / 2) * Math.min(1, (len - x) / 2); const v = Math.sin(2 * Math.PI * f * x) * env * 0.07; add(s0 + i, v, v); }
  }

  // felt piano: chord tones on some half-bars, seeded, a 2-chord motif so it sounds like a line
  const motif = Array.from({ length: 8 }, () => (rnd() < 0.55 ? Math.floor(rnd() * 4) : null));
  for (let c = 0; c < chords; c++) {
    const d = mood.prog[c % mood.prog.length];
    for (let h = 0; h < 4; h++) {
      const v = motif[(c % 2) * 4 + h];
      if (v == null) continue;
      const t = c * chordLen + h * (bar / 2) + (rnd() - 0.5) * 0.03;
      const m = deg(d + [0, 2, 4, 7][v], 2), f = hz(m), s0 = Math.round(t * SR), n = Math.round(3.2 * SR), pan = (rnd() - 0.5) * 0.5;
      for (let i = 0; i < n; i++) {
        const x = i / SR;
        const env = Math.min(1, x / 0.004) * Math.exp(-x * 1.5);
        const s = Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x * 3) + 0.08 * Math.sin(6 * Math.PI * f * x) * Math.exp(-x * 6);
        const val = s * env * 0.05;
        add(s0 + i, val * (1 - pan), val * (1 + pan));
      }
    }
  }

  // a soft low swell into every cut: a rising sine (filtered noise breath on top) peaking on the cut, then a short tail
  for (const t of cuts) {
    const pre = 1.1, post = 1.4, s0 = Math.round((t - pre) * SR), n = Math.round((pre + post) * SR);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / SR - pre;
      const env = x < 0 ? (1 + x / pre) ** 2 : Math.exp(-x * 2.6);
      lp += ((rnd() * 2 - 1) - lp) * 0.02;
      const v = (Math.sin(2 * Math.PI * 55 * (i / SR)) * 0.09 + lp * 0.12) * env;
      add(s0 + i, v, v);
    }
  }

  // cliffhanger: a held high note rising in level over the last shot, cut at the very end
  if (cliff && cuts.length) {
    const t0 = cuts.at(-1), f = hz(deg(5, 3)), s0 = Math.round(t0 * SR), n = N - s0;
    for (let i = 0; i < n; i++) { const x = i / SR, g = (x / Math.max(1, n / SR)) ** 1.5; const v = Math.sin(2 * Math.PI * f * x) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * x)) * g * 0.03; add(s0 + i, v, v); }
  }

  // duck under the voice (smoothed), fade in/out, soft clip, normalise to -1 dBFS
  const g = new Float32Array(N).fill(1);
  for (const w of words) for (let k = Math.max(0, Math.round((w.start - 0.08) * SR)); k < Math.min(N, Math.round((w.end + 0.15) * SR)); k++) g[k] = mood.duck ?? 0.5;
  let sm = 1, peak = 0;
  for (let k = 0; k < N; k++) {
    sm += (g[k] - sm) * (g[k] < sm ? 0.0012 : 0.00025);
    const fade = Math.min(1, k / SR / 1.5, (total - k / SR) / 2.5);
    L[k] = Math.tanh(L[k] * sm * fade * 1.4); R[k] = Math.tanh(R[k] * sm * fade * 1.4);
    peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
  }
  return { L, R, N, norm: 0.89 / (peak || 1) };
}

function writeWav(out, { L, R, N, norm }) {
  const buf = Buffer.alloc(44 + N * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
  for (let k = 0; k < N; k++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[k] * norm)) * 32767), 44 + k * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[k] * norm)) * 32767), 46 + k * 4); }
  writeFileSync(out, buf);
}

export function storyMusic(slug, { off = false, moodId, vol, track } = {}) {
  const dir = videoDir(slug), mj = join(dir, "music.json");
  if (off) { writeJSON(mj, { mode: "off" }); return { off: true }; }
  // a song the user uploaded (Studio tab Musik, user 2026-11-22) stays the music on every rebuild until a mood is asked for
  const prev = existsSync(mj) ? readJSON(mj) : {};
  const song = track ?? (!moodId && prev.source === "upload" && prev.file && existsSync(join(dir, prev.file)) ? prev.file : null);
  if (song) return fitTrack(dir, slug, song, vol ?? prev.volume);
  const meta = readJSON(join(dir, "meta.json"));
  const tl = join(dir, "build", "timeline.json");
  if (!existsSync(tl) || !existsSync(join(dir, "voice", "words.json"))) die("Belum ada suara + build (voice/words.json, build/timeline.json).");
  const t = readJSON(tl), wj = readJSON(join(dir, "voice", "words.json"));
  const words = (wj.words ?? wj).map((w) => ({ start: w.start, end: w.end }));
  const total = t.duration;
  const cuts = t.beats.slice(1).map((b) => b.start);
  const brand = readJSON(join(ROOT, "brand", "brand.json"));
  const id = moodId || meta.type || "story";
  const mood = { ...MOODS.story, ...(MOODS[id] ?? {}), ...(brand[meta.type]?.music ?? {}), ...(vol ? { vol } : {}) };
  const cliff = !!meta.series && meta.series.part < meta.series.total;
  const seed = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  writeWav(join(dir, "assets", "music.wav"), compose({ total, cuts, words, mood, seed, cliff }));
  writeJSON(mj, { mode: "story", mood: id, key: mood.key, scale: mood.mode, bpm: mood.bpm, volume: mood.vol, cliff, at: new Date().toISOString() });
  // provenance line (CLAUDE.md: every media file has one)
  const src = join(dir, "sources.txt"), line = "assets/music.wav\tdikomposisi dari matematika oleh tools/story-music.mjs (seeded), bebas lisensi, $0";
  const cur = existsSync(src) ? readFileSync(src, "utf8") : "";
  if (!cur.includes("assets/music.wav")) writeFileSync(src, cur.replace(/\s*$/, "\n") + line + "\n");
  const c = spawnSync("node", [join(ROOT, "tools", "cues.mjs"), slug], { encoding: "utf8" });
  if (c.status) die(`cues: ${(c.stderr || c.stdout).trim().split("\n").at(-1)}`);
  return { total, cuts: cuts.length, mood: id, cliff, file: "assets/music.wav", seconds: probeDuration(join(dir, "assets", "music.wav")) };
}

// the user's song fitted to the video: cut at its length, faded in/out, 44.1 kHz stereo wav; ducking stays with the volume
function fitTrack(dir, slug, rel, vol) {
  const tl = join(dir, "build", "timeline.json");
  if (!existsSync(tl)) die("Belum ada build (build/timeline.json): lagu dipasang setelah suara dan shot.");
  const total = readJSON(tl).duration, src = join(dir, rel), out = join(dir, "assets", "music.wav");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-t", String(total), "-af", `afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2`, "-ar", String(SR), "-ac", "2", out], { encoding: "utf8" });
  if (r.status !== 0) die(`lagu tidak bisa dipakai: ${(r.stderr || "").trim().slice(-300)}`);
  writeJSON(join(dir, "music.json"), { mode: "story", source: "upload", file: rel, volume: vol ?? 0.3, at: new Date().toISOString() });
  const s = join(dir, "sources.txt"), line = `assets/music.wav\tlagu dari user (${rel}); lisensi menjadi tanggung jawab pemilik proyek`;
  const cur = existsSync(s) ? readFileSync(s, "utf8").split("\n").filter((l) => !l.startsWith("assets/music.wav\t")).join("\n") : "";
  writeFileSync(s, cur.replace(/\s*$/, "\n") + line + "\n");
  return { total, cuts: 0, mood: "upload", cliff: false, file: "assets/music.wav", seconds: probeDuration(out) };
}

if (process.argv[1]?.endsWith("story-music.mjs")) {
  const [slug] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (!slug) die("Usage: node tools/story-music.mjs <slug> [--off] [--mood berakitkehulu|musafo|bumidipijak|miracleofhajj|cinestory|story] [--track assets/music/<lagu>] [--vol 0.5]");
  const r = storyMusic(slug, { off: process.argv.includes("--off"), moodId: opt("--mood"), vol: opt("--vol") ? +opt("--vol") : undefined, track: opt("--track") });
  console.log(r.off ? "musik dimatikan" : `✔ ${r.file} ${r.seconds.toFixed(1)} s, mood ${r.mood}, ${r.cuts} cut${r.cliff ? ", cliffhanger" : ""}`);
}
