// gemini-take.mjs <slug> [--style "<cara baca>"] [--speaker <Nama>] [--dry-run]
// One Gemini TTS take of the whole script.md through the Gemini API (GEMINI_API_KEY), then `npm run voice` on it
// (user 2026-11-23). Before this, each session wrote its own one-off script, and Gemini sometimes reads the style
// instruction aloud ("Bacakan seperti pendongeng…" at the start of Bob 4 and Ciputra 1). Here the take is transcribed
// (whisper.cpp) and everything before the script's first words is cut at the pause in front of them.
// Speaker: --speaker, else request.json → voiceSpeaker, else brand.json → voice.gemini.speaker. Style the same way
// (request.json → voiceStyle, brand voice.gemini.style). The cost (tokens) goes to costs.md.
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { videoDir, loadBrand, readJSON, run, die, probeDuration, ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const slug = args[0], dir = videoDir(slug);
const brand = loadBrand(dir), g = brand.voice?.gemini ?? {};
const req = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {};
const speaker = opt("--speaker") || req.voiceSpeaker || g.speaker;
if (String(speaker).startsWith("clone:")) die(`speaker ${speaker} = clone suara ElevenLabs: pakai npm run voice -- ${slug} --force`);
const style = opt("--style") || req.voiceStyle || g.style || "hangat seperti pendongeng";
const model = g.model || "gemini-3.8-flash-tts";
const text = readFileSync(join(dir, "script.md"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).join(" ").replace(/\s+/g, " ").trim();
if (!text) die("script.md kosong");
console.log(`speaker ${speaker} · ${model} · ${text.split(" ").length} kata · gaya: ${style}`);
if (args.includes("--dry-run")) process.exit(0);
const key = process.env.GEMINI_API_KEY;
if (!key) die("GEMINI_API_KEY belum ada di .env (tab Suara → API Gemini)");

const vdir = join(dir, "voice"), work = join(vdir, "work");
mkdirSync(work, { recursive: true });
let r, j;
for (let i = 0; i < 5; i++) {
  r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Bacakan ${style}: ${text}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker } } } } }),
    signal: AbortSignal.timeout(300000),
  });
  j = await r.json();
  if (r.status !== 429) break;
  console.log("  batas per menit, tunggu 30 s");
  await new Promise((ok) => setTimeout(ok, 30000));
}
const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
if (!r.ok || !part) die(`Gemini TTS ${r.status}: ${(j.error?.message ?? "tanpa audio").slice(0, 200)}`);
const raw = join(work, "gemini-raw.bin"), full = join(work, "gemini-full.wav"), take = join(vdir, "gemini-take.wav");
writeFileSync(raw, Buffer.from(part.data, "base64"));
const pcm = /L16|pcm/i.test(part.mimeType), rate = part.mimeType.match(/rate=(\d+)/)?.[1] ?? "24000";
run("ffmpeg", ["-y", "-v", "error", ...(pcm ? ["-f", "s16le", "-ar", rate, "-ac", "1"] : []), "-i", raw, full]);
const tokens = j.usageMetadata?.totalTokenCount ?? 0;

// was the style instruction read aloud? find the script's first two words in the transcript
const norm = (w) => w.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const first = text.split(" ").slice(0, 2).map(norm);
const wh = join(ROOT, "tools", "bin", "whisper", "Release", "whisper-cli.exe");
const tx = spawnSync("npx", ["hyperframes", "transcribe", full, "--language", "id", "--json"], { cwd: work, encoding: "utf8", shell: process.platform === "win32", env: { ...process.env, ...(existsSync(wh) ? { HYPERFRAMES_WHISPER_PATH: wh } : {}) } });
let cut = 0;
try {
  const t = JSON.parse(readFileSync(join(work, "transcript.json"), "utf8"));
  const w = Array.isArray(t) ? t : t.words ?? [];
  // whisper writes spoken numbers as digits ("dua ratus enam puluh" → "260", Ponzi 2026-11-24), so the second word may be a
  // number; then match the first word alone
  let k = w.findIndex((x, i) => norm(x.text) === first[0] && norm(w[i + 1]?.text ?? "") === first[1]);
  if (k < 0) k = w.findIndex((x, i) => norm(x.text) === first[0] && /^\d/.test(norm(w[i + 1]?.text ?? "")));
  if (k > 0) {
    // cut inside the last pause before that word (whisper's start time is often early)
    const sil = run("ffmpeg", ["-hide_banner", "-t", String(w[k].start + 2), "-i", full, "-af", "silencedetect=noise=-40dB:d=0.15", "-f", "null", "-"], { allowFail: true }).stderr;
    const pauses = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [+m[1], +m[2]]).filter(([, e]) => e <= w[k].start + 1.2);
    const p = pauses.at(-1);
    cut = p ? Math.max(p[0], p[1] - 0.2) : Math.max(0, w[k].start - 0.15);
    console.log(`⚠ instruksi gaya ikut terbaca (${w.slice(0, k).map((x) => x.text).join(" ").slice(0, 80)}…): dipotong ${cut.toFixed(2)} s`);
  } else if (k < 0) console.log(`⚠ kata pertama naskah ("${first.join(" ")}") tidak ditemukan di transkrip: dengar awal take sebelum dipakai`);
} catch { console.log(`⚠ transkripsi gagal (${(tx.stderr || "").slice(-200)}): awal take tidak dicek`); }
run("ffmpeg", ["-y", "-v", "error", "-ss", cut.toFixed(3), "-i", full, take]);
console.log(`✔ voice/gemini-take.wav ${probeDuration(take).toFixed(1)} s`);

const cp = join(dir, "costs.md");
if (!existsSync(cp)) writeFileSync(cp, `# Biaya: ${slug}\n\n| Item | Detail | Kredit/USD |\n| --- | --- | --- |\n`);
appendFileSync(cp, `| Suara | Gemini API ${model}, speaker ${speaker}, satu take${cut ? ` (instruksi terbaca, dipotong ${cut.toFixed(1)} s)` : ""}, ${new Date().toISOString().slice(0, 10)} | ${tokens} token |\n`);
const v = spawnSync("npm", ["run", "voice", "--", slug, "--audio", take, "--source", "gemini-tts"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
process.exit(v.status ?? 1);
