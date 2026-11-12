// tts.mjs: voice providers shared by voice.mjs (whole take) and swap.mjs (one sentence).
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readJSON, die, run, ROOT } from "./lib.mjs";

// Local whisper.cpp (official ggml-org release) for non-English transcription on Windows.
const WHISPER = join(ROOT, "tools", "bin", "whisper", "Release", "whisper-cli.exe");
if (!process.env.HYPERFRAMES_WHISPER_PATH && existsSync(WHISPER)) process.env.HYPERFRAMES_WHISPER_PATH = WHISPER;

export const SR = 44100;

export function makeTts({ brand, work }) {
  mkdirSync(work, { recursive: true });
  const toWav = (src, dst) => run("ffmpeg", ["-y", "-v", "error", "-i", src, "-ac", "1", "-ar", String(SR), "-c:a", "pcm_s16le", dst]);

  async function elevenlabs(text, wavOut, ctx = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) die("ELEVENLABS_API_KEY is not set.");
  if (text.length > 4800) die(`Script is ${text.length} chars; one take is limited to ~5000. Shorten it (179 s is ~2500 chars anyway).`);
  const v = brand.voice;
  const body = { text, model_id: v.elevenlabsModel, voice_settings: v.voiceSettings };
  if (v.seed != null) body.seed = v.seed;
  if (!/v3/.test(v.elevenlabsModel)) Object.assign(body, ctx.prev ? { previous_text: ctx.prev } : {}, ctx.next ? { next_text: ctx.next } : {});
  if (v.languageCode) body.language_code = v.languageCode;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.elevenlabsVoiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) die(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const j = await res.json();
  const mp3 = wavOut.replace(/\.wav$/, ".mp3");
  writeFileSync(mp3, Buffer.from(j.audio_base64, "base64"));
  toWav(mp3, wavOut);
  const a = j.normalized_alignment || j.alignment;
  return charsToWords(a.characters, a.character_start_times_seconds, a.character_end_times_seconds);
}

  function charsToWords(chars, starts, ends) {
  const words = [];
  let cur = null;
  let inTag = false;
  chars.forEach((c, i) => {
    if (c === "[") inTag = true; // eleven_v3 audio tags like [whispers] are not words
    if (inTag) {
      if (c === "]") inTag = false;
      return;
    }
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: "", start: starts[i], end: ends[i] };
    cur.text += c;
    cur.end = ends[i];
  });
  if (cur) words.push(cur);
  return words.filter((w) => /[\p{L}\p{N}]/u.test(w.text));
}

// No voice yet: silent track + word timings estimated from text (~14 chars/s, pauses at punctuation).
// Lets beats, scenes and gates be built before the real take; the real take re-times everything.
  function estimate(text, wavOut) {
  const words = [];
  let t = 0.05;
  for (const rawW of text.split(/\s+/).filter(Boolean)) {
    if (/^\[.*\]$/.test(rawW)) continue;
    const len = rawW.replace(/[^\p{L}\p{N}]/gu, "").length;
    const d = 0.09 + len * 0.058;
    words.push({ text: rawW, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d + (/[.!?]$/.test(rawW) ? 0.5 : /[,;:]$/.test(rawW) ? 0.16 : 0.03);
  }
  run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `anullsrc=r=${SR}:cl=mono`, "-t", (t + 0.1).toFixed(3), "-c:a", "pcm_s16le", wavOut]);
  return words;
}

// Windows built-in voice: zero-install DRAFT voice for timing tests only (English). Never ship it.
  function sapi(text, wavOut) {
  const rawWav = join(work, "sapi.raw.wav");
  const txt = join(work, "sapi.txt");
  writeFileSync(txt, text);
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.SetOutputToWaveFile('${rawWav}'); $s.Speak([IO.File]::ReadAllText('${txt}')); $s.Dispose()`;
  run("powershell", ["-NoProfile", "-Command", ps]);
  toWav(rawWav, wavOut);
  return transcribe(wavOut, "en");
}

  function kokoro(text, wavOut) {
  const rawWav = join(work, "kokoro.raw.wav");
  run("npx", ["hyperframes", "tts", JSON.stringify(text), "-o", rawWav, "-v", brand.voice.kokoroVoice]);
  toWav(rawWav, wavOut);
  return transcribe(wavOut, "en");
}

  function transcribe(wav, lang = brand.voice.languageCode || "en") {
  const tmp = join(work, "_tx");
  mkdirSync(join(tmp, "assets"), { recursive: true });
  const model = lang === "en" ? "small.en" : "small";
  const a = ["hyperframes", "transcribe", wav, "-d", tmp, "--model", model, "--json"];
  if (lang !== "en") a.push("--language", lang);
  const r = run("npx", a);
  const res = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  if (!res.ok) die(`transcribe: ${res.reason}.`);
  const t = readJSON(res.transcriptPath);
  const list = Array.isArray(t) ? t : t.words || t.segments?.flatMap((s) => s.words) || [];
  return list.map((w) => ({ text: (w.text ?? w.word).trim(), start: w.start, end: w.end })).filter((w) => w.text);
}

  return { toWav, elevenlabs, estimate, sapi, kokoro, transcribe };
}

// Whisper hears "rekeningmu nol" as "rekening Munno". When we know the exact text, keep the SCRIPT's words and take
// only the TIMES from the transcript: a global alignment (edit distance on normalised words, substitutions allowed),
// then script words with no partner get times interpolated between their neighbours by length.
export function alignToScript(text, heard) {
  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
  const script = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w) && !/^\[.*\]$/.test(w));
  const A = script.map(norm), B = heard.map((w) => norm(w.text));
  const lev = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const sub = (i, j) => { const m = Math.max(A[i].length, B[j].length) || 1; return Math.min(1.2, lev(A[i], B[j]) / m); };
  const GAP = 0.8, n = A.length, m = B.length;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) D[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) D[0][j] = j * GAP;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + sub(i - 1, j - 1), D[i - 1][j] + GAP, D[i][j - 1] + GAP);
  const time = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + sub(i - 1, j - 1))) < 1e-9) { time[i - 1] = { start: heard[j - 1].start, end: heard[j - 1].end }; i--; j--; }
    else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + GAP)) < 1e-9) i--;
    else j--;
  }
  // interpolate unmatched script words between the nearest timed neighbours
  for (let i = 0; i < n; i++) {
    if (time[i]) continue;
    let k = i; while (k < n && !time[k]) k++;
    const from = i ? time[i - 1].end : (time[k]?.start ?? 0), to = k < n ? time[k].start : from + 0.4 * (k - i);
    const lens = A.slice(i, k).map((a) => a.length + 1), tot = lens.reduce((s, x) => s + x, 0);
    let t = from;
    for (let x = i; x < k; x++) { const d = ((to - from) * lens[x - i]) / tot; time[x] = { start: +t.toFixed(3), end: +(t + d).toFixed(3) }; t += d; }
  }
  return script.map((w, i) => ({ text: w, start: time[i].start, end: time[i].end }));
}
