// anim-music.mjs: the score of an ANIMATION project, composed from math (seeded, deterministic, no licence question).
// One section per shot; each section plays in the style of its preset (presets/<id>/preset.json → "music"):
//   { bpm, key: "A" | "C#" ..., mode: major|minor|dorian|mixolydian|penta|minpenta|japanese, prog: [1,5,6,4] (scale
//     degrees, one chord per bar), lead, bass, pad (instrument names below or null), drums: swing|pop|four|chip|lofi|
//     taiko|brush|stomp|none, swing: 0-0.33 (eighth-note shuffle), density: 0-1 (lead notes per slot), octave: 0 (lead
//     shift), gain: 1 }
// Instruments: square, pulse, saw, tri, sine, pluck (Karplus-Strong), koto, marimba, epiano, brass, clarinet, bell,
//   flute, warmpad, glasspad, sub.
// A section starts on its own downbeat at the cut, so every cut lands on beat one. Sections cross with a short fade.
//
//   import { renderScore } from "./anim-music.mjs"; renderScore([{ start, dur, music, seed }], total, "assets/music.wav")
import { writeFileSync } from "node:fs";

const SR = 44100;
const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], japanese: [0, 1, 5, 7, 8], // in-sen-ish (miyako-bushi)
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- instruments: make(f, len, rnd) returns next() -> sample, one call per sample ----------
function osc(kind) {
  return (f, len, rnd, o = {}) => {
    let ph = rnd(), lp = 0, i = 0;
    const att = o.att ?? 0.005, dec = o.dec ?? 3, cut = o.cut ?? 0.35, duty = o.duty ?? 0.5;
    return () => {
      const x = i++ / SR;
      ph = (ph + f / SR) % 1;
      let v = kind === "square" ? (ph < duty ? 1 : -1) : kind === "saw" ? ph * 2 - 1 : kind === "tri" ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph);
      if (kind === "square" || kind === "saw") { lp += (v - lp) * cut; v = lp; }
      const env = Math.min(1, x / att) * Math.exp(-x * dec) * Math.min(1, (len - x) / 0.02 + 0.0001);
      return v * Math.max(0, env);
    };
  };
}
// Karplus-Strong: a plucked string (guitar, ukulele, koto)
function ks(bright = 0.5, decay = 0.996, bend = 0) {
  return (f, len, rnd) => {
    const n = Math.max(2, Math.round(SR / f));
    const buf = new Float32Array(n);
    for (let k = 0; k < n; k++) buf[k] = rnd() * 2 - 1;
    let p = 0, i = 0, prev = 0;
    return () => {
      const x = i++ / SR;
      const a = buf[p], b = buf[(p + 1) % n];
      const v = decay * ((1 - bright) * 0.5 * (a + b) + bright * a);
      buf[p] = v; p = (p + 1) % n;
      // koto: the player presses the string a semitone up just after the pluck
      const out = bend && x > 0.12 ? v * 0.9 + prev * 0.1 : v;
      prev = out;
      return out * Math.min(1, (len - x) / 0.03 + 0.0001);
    };
  };
}
const INSTR = {
  square: (f, l, r) => osc("square")(f, l, r, { dec: 4, cut: 0.5 }),
  pulse: (f, l, r) => osc("square")(f, l, r, { dec: 3, cut: 0.6, duty: 0.25 }),
  saw: (f, l, r) => osc("saw")(f, l, r, { dec: 3.5, cut: 0.18 }),
  tri: (f, l, r) => osc("tri")(f, l, r, { dec: 2.5 }),
  sine: (f, l, r) => osc("sine")(f, l, r, { dec: 2 }),
  sub: (f, l, r) => osc("sine")(f, l, r, { dec: 1.2, att: 0.01 }),
  pluck: (f, l, r) => ks(0.45, 0.996)(f, l, r),
  koto: (f, l, r) => ks(0.75, 0.9975, 1)(f, l, r),
  marimba: (f, l, r) => { const a = osc("sine")(f, l, r, { dec: 9 }), b = osc("sine")(f * 4, l, r, { dec: 26 }), c = osc("sine")(f * 10, l, r, { dec: 60 }); return () => a() + 0.35 * b() + 0.12 * c(); },
  bell: (f, l, r) => { const a = osc("sine")(f, l, r, { dec: 2.4 }), b = osc("sine")(f * 2.76, l, r, { dec: 5 }), c = osc("sine")(f * 5.4, l, r, { dec: 9 }); return () => 0.7 * a() + 0.3 * b() + 0.15 * c(); },
  epiano: (f, l, r) => { const a = osc("sine")(f, l, r, { dec: 1.6 }), b = osc("sine")(f * 2, l, r, { dec: 4 }), c = osc("sine")(f * 7, l, r, { dec: 30 }); return () => a() + 0.25 * b() + 0.1 * c(); },
  brass: (f, l, r) => { const a = osc("saw")(f, l, r, { dec: 1.4, cut: 0.12, att: 0.03 }), b = osc("saw")(f * 1.006, l, r, { dec: 1.4, cut: 0.12, att: 0.03 }); return () => 0.6 * (a() + b()); },
  clarinet: (f, l, r) => { const a = osc("square")(f, l, r, { dec: 1.2, cut: 0.14, att: 0.025 }); return () => 0.8 * a(); },
  flute: (f, l, r) => { const a = osc("sine")(f, l, r, { dec: 0.8, att: 0.06 }); let i = 0; return () => { const x = i++ / SR; return a() * (1 + 0.05 * Math.sin(2 * Math.PI * 5.5 * x)) + (r() - 0.5) * 0.02 * Math.exp(-x * 20); }; },
  warmpad: (f, l, r) => { const vs = [-0.007, 0, 0.006].map((d) => osc("saw")(f * (1 + d), l, r, { dec: 0.15, cut: 0.05, att: 0.35 })); return () => (vs[0]() + vs[1]() + vs[2]()) / 3; },
  glasspad: (f, l, r) => { const vs = [0, 0.004].map((d) => osc("tri")(f * (1 + d), l, r, { dec: 0.2, att: 0.4 })); const h = osc("sine")(f * 2, l, r, { dec: 0.4, att: 0.5 }); return () => (vs[0]() + vs[1]()) / 2 + 0.2 * h(); },
};

// ---------- drums ----------
function drum(kind, rnd) {
  const n = () => rnd() * 2 - 1;
  return {
    kick: (x) => Math.sin(2 * Math.PI * (48 * x + (100 / 30) * (1 - Math.exp(-x * 30)))) * Math.exp(-x * 8),
    chipkick: (x) => (Math.sin(2 * Math.PI * (60 * x + (240 / 40) * (1 - Math.exp(-x * 40)))) > 0 ? 1 : -1) * Math.exp(-x * 14) * 0.6,
    snare: (x) => (n() * 0.8 + 0.4 * Math.sin(2 * Math.PI * 190 * x)) * Math.exp(-x * 22),
    chipsnare: (x) => n() * Math.exp(-x * 30) * 0.6,
    clap: (x) => n() * (Math.exp(-x * 40) + 0.5 * Math.exp(-Math.abs(x - 0.012) * 90)) * 0.7,
    hat: (x) => n() * Math.exp(-x * 170) * 0.35,
    ohat: (x) => n() * Math.exp(-x * 22) * 0.16,
    brush: (x) => n() * Math.min(1, x / 0.02) * Math.exp(-x * 12) * 0.18,
    block: (x) => Math.sin(2 * Math.PI * 1150 * x) * Math.exp(-x * 70) * 0.55, // woodblock: cartoon tick
    taiko: (x) => (Math.sin(2 * Math.PI * (70 * x + (60 / 18) * (1 - Math.exp(-x * 18)))) + n() * 0.15 * Math.exp(-x * 40)) * Math.exp(-x * 4.5),
    rim: (x) => Math.sin(2 * Math.PI * 820 * x) * Math.exp(-x * 90) * 0.5 + n() * Math.exp(-x * 120) * 0.2,
    crash: (x) => n() * Math.exp(-x * 2.6) * 0.22,
    vinyl: (x) => n() * 0.012,
  }[kind];
}
// per kit: [instrument, positions in sixteenths of a 16-step bar, gain]
const KITS = {
  swing: [["kick", [0, 8], 0.8], ["snare", [4, 12], 0.35], ["block", [2, 6, 10, 14], 0.25], ["hat", [0, 4, 8, 12], 0.4]],
  pop: [["kick", [0, 6, 8], 0.9], ["clap", [4, 12], 0.55], ["hat", [0, 2, 4, 6, 8, 10, 12, 14], 0.7], ["ohat", [14], 0.8]],
  four: [["kick", [0, 4, 8, 12], 0.9], ["clap", [4, 12], 0.45], ["ohat", [2, 6, 10, 14], 0.9], ["hat", [1, 3, 5, 7, 9, 11, 13, 15], 0.5]],
  chip: [["chipkick", [0, 8, 10], 0.9], ["chipsnare", [4, 12], 0.8], ["chipsnare", [2, 6, 10, 14], 0.15]],
  lofi: [["kick", [0, 7, 10], 0.75], ["snare", [4, 12], 0.3], ["hat", [0, 2, 4, 6, 8, 10, 12, 14], 0.45], ["vinyl", [0], 0]],
  taiko: [["taiko", [0, 6, 8], 0.9], ["rim", [4, 12, 14], 0.35]],
  brush: [["kick", [0, 10], 0.55], ["brush", [0, 4, 8, 12], 0.9], ["rim", [12], 0.25]],
  stomp: [["kick", [0, 8], 0.9], ["clap", [4, 12], 0.6], ["block", [6, 14], 0.3]],
  none: [],
};

// ---------- one section ----------
function section(L, R, N, sec, gainAll) {
  const m = sec.music ?? {};
  const rnd = mulberry(sec.seed ?? 7);
  const bpm = m.bpm ?? 110, p = 60 / bpm, s16 = p / 4, swing = m.swing ?? 0;
  const scale = MODES[m.mode ?? "major"] ?? MODES.major;
  const root = 48 + (NOTE[m.key ?? "C"] ?? 0); // C3
  const prog = m.prog ?? [1, 5, 6, 4];
  const start = sec.start, end = sec.start + sec.dur;
  const fadeOut = Math.min(0.35, sec.dur / 6);
  const gain = (m.gain ?? 1) * gainAll;
  const add = (t0, gen, len, g, pan = 0) => {
    const len2 = Math.min(len, end + 0.25 - t0); // a tail of a quarter second runs into the next shot
    if (len2 <= 0) return;
    const s0 = Math.round(t0 * SR), n = Math.round(len2 * SR);
    const gl = g * Math.min(1, 1 - pan), gr = g * Math.min(1, 1 + pan);
    for (let i = 0; i < n; i++) {
      const k = s0 + i;
      if (k < 0 || k >= N) { gen(); continue; }
      const tt = k / SR;
      const env = tt > end - fadeOut ? Math.max(0, (end + 0.25 - tt) / (fadeOut + 0.25)) : 1;
      const v = gen() * env;
      L[k] += v * gl; R[k] += v * gr;
    }
  };
  const deg = (d, oct = 0) => { // scale degree (1-based, any integer) -> midi
    const k = d - 1, n = scale.length;
    return root + 12 * (Math.floor(k / n) + oct) + scale[((k % n) + n) % n];
  };
  const chordOf = (bar) => { const d = prog[((bar % prog.length) + prog.length) % prog.length]; return [d, d + 2, d + 4]; };
  const at16 = (bar, step) => start + bar * 16 * s16 + step * s16 + (step % 2 === 1 ? swing * s16 : 0);
  const bars = Math.ceil(sec.dur / (16 * s16));
  const kit = KITS[m.drums ?? "pop"] ?? [];
  // a 2-bar motif, repeated with a variation every other time: what makes it a tune and not a random walk
  const slots = 8; // eighth notes per bar
  const motif = Array.from({ length: 2 * slots }, (_, i) => (rnd() < (m.density ?? 0.6) || i % slots === 0 ? Math.floor(rnd() * 5) - 1 : null));
  const lead = m.lead && INSTR[m.lead], bass = m.bass && INSTR[m.bass], pad = m.pad && INSTR[m.pad];
  for (let bar = 0; bar < bars; bar++) {
    const ch = chordOf(bar);
    // drums (the intro bar is lighter so the cut breathes)
    for (const [kind, steps, g] of kit) {
      const fn = drum(kind, rnd);
      if (kind === "vinyl") { add(at16(bar, 0), ((i) => () => fn(i++ / SR))(0), 16 * s16, 1); continue; }
      for (const st of steps) add(at16(bar, st), ((i) => () => fn(i++ / SR))(0), kind === "crash" ? 2 : kind === "taiko" ? 0.9 : 0.4, g * 0.9, kind.includes("hat") ? 0.2 : 0);
    }
    // bass
    if (bass) {
      const pat = { swing: [[0, 0], [8, 2]], chip: [[0, 0], [4, 0, 1], [8, 0], [12, 0, 1]], taiko: [[0, 0]], lofi: [[0, 0], [10, 2]], brush: [[0, 0], [8, 2]] }[m.drums] ?? [[0, 0], [6, 0], [8, 0], [14, 2]];
      for (const [st, ci, oc = 0] of pat) add(at16(bar, st), bass(hz(deg(ch[ci], -1 + oc)), 4 * s16 * 1.8, rnd), 4 * s16 * 1.8, 0.42);
      // rubber hose oom-pah: the chord on the off beats
      if (m.drums === "swing") for (const st of [4, 12]) for (const d of ch) add(at16(bar, st), INSTR.brass(hz(deg(d, 0)), 2.2 * s16, rnd), 2.2 * s16, 0.07, d % 2 ? 0.3 : -0.3);
    }
    // pad: the whole bar
    if (pad) for (const d of ch) add(at16(bar, 0), pad(hz(deg(d, 1)), 16 * s16 + 0.1, rnd), 16 * s16 + 0.1, 0.07, d % 2 ? 0.35 : -0.35);
    // lead
    if (lead) for (let k = 0; k < slots; k++) {
      const v = motif[(bar % 2) * slots + k];
      if (v == null) continue;
      const strong = k % 4 === 0;
      const vary = bar % 4 === 3 && k >= slots - 3 ? 1 : 0;
      const d = strong ? ch[(v + 3) % 3] : ch[0] + v + vary;
      const len = (strong ? 3 : 1.8) * 2 * s16;
      add(at16(bar, 2 * k), lead(hz(deg(d, 1 + (m.octave ?? 0))), len, rnd), len, 0.2, k % 2 ? 0.12 : -0.12);
    }
  }
  // a crash or impact on the cut itself
  const imp = drum(m.drums === "chip" ? "chipkick" : m.drums === "taiko" ? "taiko" : "crash", rnd);
  if (m.drums !== "none") add(start, ((i) => () => imp(i++ / SR))(0), 1.5, 0.6);
}

export function renderScore(sections, total, out, { gain = 1 } = {}) {
  const N = Math.ceil(total * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  for (const s of sections) section(L, R, N, s, gain);
  // fade the tail, soft clip, normalise to -1 dBFS peak (finish.mjs sets the loudness)
  let peak = 0;
  for (let k = 0; k < N; k++) {
    const fade = Math.min(1, Math.max(0, (total - k / SR) / 1.2));
    L[k] = Math.tanh(L[k] * 1.1) * fade; R[k] = Math.tanh(R[k] * 1.1) * fade;
    peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
  }
  const norm = 0.89 / (peak || 1);
  const buf = Buffer.alloc(44 + N * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
  for (let k = 0; k < N; k++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[k] * norm)) * 32767), 44 + k * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[k] * norm)) * 32767), 46 + k * 4);
  }
  writeFileSync(out, buf);
}
