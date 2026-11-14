// voice.mjs <slug> [--provider elevenlabs|estimate|sapi|kokoro] [--audio take.wav [--source rekaman|gemini-tts] [--no-align]]
//           [--max-pause 0.24] [--force] [--from-take]
//
// Turns videos/<slug>/script.md into voice/voice.wav + voice/words.json (word timestamps = the timeline).
// - ONE continuous take for the whole script (one TTS call, or one recording). Never per-paragraph
//   stitching: separate calls give audible seams and a flat, list-like delivery.
//   The raw take is kept as voice/take.wav + voice/take.json; tools/swap.mjs edits ONE sentence inside it.
// - --audio <file>: your own recording; words come from local transcription (whisper.cpp).
// - Pauses are capped (0.24 s, 0.42 s before a numbered step so the step card keeps its beat)
//   instead of ever speeding the voice up.
// - --from-take: skip generation, just re-apply the pause cap to voice/take.* (used by swap.mjs).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { videoDir, readJSON, writeJSON, die, run, probeDuration, loadBrand, ROOT, norm, spokenText, takeKey } from "./lib.mjs";
import { makeTts, alignToScript } from "./tts.mjs";


const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const dir = videoDir(args[0]);
const brand = loadBrand(dir);
const vdir = join(dir, "voice");
const work = join(vdir, "work");
mkdirSync(work, { recursive: true });
const maxPause = parseFloat(opt("max-pause", brand.voice.maxPause ?? 0.24));
const stepPause = brand.voice.stepPause ?? 0.42;
const stepWords = (brand.voice.stepWords ?? ["langkah", "step"]).map(norm);
const force = args.includes("--force");
const SR = 44100; // matches tts.mjs
const TAKE = join(vdir, "take.wav");
const TAKE_WORDS = join(vdir, "take.json");

const { toWav, elevenlabs, estimate, sapi, kokoro, transcribe } = makeTts({ brand, work });


// ---------- 1. the raw take ----------
let source = existsSync(join(vdir, "source.json")) ? readJSON(join(vdir, "source.json")).provider : "rekaman";
if (args.includes("--from-take")) {
  if (!existsSync(TAKE)) die("voice/take.wav missing: generate the take first.");
} else if (opt("audio")) {
  // a recording (--source rekaman, default) or a take made elsewhere, e.g. Google AI Studio (--source gemini-tts)
  source = opt("source", "rekaman");
  toWav(opt("audio"), TAKE);
  const heard = transcribe(TAKE);
  // keep the script's words, take whisper's times (whisper mishears names and numbers); --no-align to keep raw
  writeJSON(TAKE_WORDS, args.includes("--no-align") ? heard : alignToScript(spokenText(join(dir, "script.md")), heard));
  writeFileSync(join(vdir, "take.key"), takeKey(source, brand.voice, spokenText(join(dir, "script.md"))));
} else {
  const text = spokenText(join(dir, "script.md"));
  if (!text) die("script.md has no spoken text.");
  const provider = (source = opt("provider", process.env.ELEVENLABS_API_KEY ? "elevenlabs" : process.platform === "win32" ? "sapi" : "kokoro"));
  const key = takeKey(provider, brand.voice, text);
  const keyFile = join(vdir, "take.key");
  if (!force && existsSync(TAKE) && existsSync(TAKE_WORDS) && existsSync(keyFile) && readFileSync(keyFile, "utf8") === key) {
    console.log("Take unchanged (cached). To change one sentence without a new take: npm run swap");
  } else {
    console.log(`Voice provider: ${provider}, one take, ${text.length} chars`);
    const words =
      provider === "elevenlabs" ? await elevenlabs(text, TAKE)
      : provider === "sapi" ? sapi(text, TAKE)
      : provider === "estimate" ? estimate(text, TAKE)
      : kokoro(text, TAKE);
    writeJSON(TAKE_WORDS, words);
    writeFileSync(keyFile, key);
  }
}

// ---------- 2. cap pauses (never speed the voice up) ----------
const raw = readJSON(TAKE_WORDS);
const lead = 0.12;
// user 2026-11-14 "eps 3 Vo seperti patah2": whisper's word times are not where the voice stops, so cutting every
// "gap" between them chopped 10-60 ms out of running speech. A pause is now only shortened where the take is really
// quiet (10 ms frames below SILENCE_DB), and every join gets a short fade so no cut clicks.
const SILENCE_DB = -42, FRAME = 0.01, FADE = 0.008;
const pcm = run("ffmpeg", ["-v", "error", "-i", TAKE, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { encoding: "buffer", maxBuffer: 1 << 30 }).stdout;
const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
const per = Math.round(16000 * FRAME);
const quiet = [];
for (let i = 0; i + per <= samples.length; i += per) {
  let s = 0;
  for (let j = i; j < i + per; j++) s += samples[j] * samples[j];
  quiet.push(10 * Math.log10(s / per / 32768 / 32768 + 1e-12) < SILENCE_DB);
}
// the longest quiet stretch inside [a, b] (take seconds), or null
const quietRun = (a, b) => {
  let best = null, start = null;
  const from = Math.max(0, Math.floor(a / FRAME)), to = Math.min(quiet.length, Math.ceil(b / FRAME));
  for (let f = from; f <= to; f++) {
    if (f < to && quiet[f]) { if (start === null) start = f; continue; }
    if (start !== null && (!best || f - start > best[1] - best[0])) best = [start, f];
    start = null;
  }
  return best && [best[0] * FRAME, best[1] * FRAME];
};
const keep = []; // [from, to] ranges in take time
let cursor = Math.max(0, raw[0].start - lead);
for (let i = 0; i < raw.length - 1; i++) {
  const cap = stepWords.includes(norm(raw[i + 1].text)) ? stepPause : maxPause;
  if (raw[i + 1].start - raw[i].end <= cap) continue;
  const q = quietRun(raw[i].end - 0.05, raw[i + 1].start + 0.05);
  if (!q || q[1] - q[0] <= cap + 0.02) continue; // the voice is still sounding: leave it whole
  keep.push([cursor, q[0] + cap / 2]);
  cursor = q[1] - cap / 2;
}
keep.push([cursor, raw.at(-1).end + 0.35]);
const shift = (t) => {
  let out = 0;
  for (const [a, b] of keep) {
    if (t >= b) out += b - a;
    else return out + Math.max(0, t - a);
  }
  return out;
};
const words = raw.map((w, i) => ({ id: `w${i}`, text: w.text, start: +shift(w.start).toFixed(3), end: +shift(w.end).toFixed(3) }));
const filter =
  keep.map(([a, b], i) => `[0:a]atrim=${a.toFixed(4)}:${b.toFixed(4)},asetpts=PTS-STARTPTS` +
    (i > 0 ? `,afade=t=in:d=${FADE}` : "") +
    (i < keep.length - 1 ? `,afade=t=out:st=${Math.max(0, b - a - FADE).toFixed(4)}:d=${FADE}` : "") + `[s${i}]`).join(";") +
  ";" + keep.map((_, i) => `[s${i}]`).join("") + `concat=n=${keep.length}:v=0:a=1[out]`;
const filterFile = join(work, "_filter.txt");
writeFileSync(filterFile, filter);
const out = join(vdir, "voice.wav");
run("ffmpeg", ["-y", "-v", "error", "-i", TAKE, "-/filter_complex", filterFile, "-map", "[out]", "-c:a", "pcm_s16le", out]);
writeJSON(join(vdir, "words.json"), words);
writeJSON(join(vdir, "source.json"), { provider: source, draft: ["estimate", "sapi", "kokoro"].includes(source) });
mkdirSync(join(dir, "assets"), { recursive: true });
copyFileSync(out, join(dir, "assets", "voice.wav"));

const dur = probeDuration(out);
console.log(`✔ voice.wav ${dur.toFixed(1)} s (take ${probeDuration(TAKE).toFixed(1)} s, pauses capped ${maxPause}/${stepPause}s), ${words.length} words`);
if (dur > brand.limits.maxSeconds) console.log(`⚠ Over ${brand.limits.maxSeconds}s: tighten holds, then rewrite. Never speed the voice up.`);

