// swap.mjs <slug> --find "<exact phrase in the take>" --replace "<new text>" [--audio new-line.wav] [--dry-run]
//
// Replace ONE spoken line inside an approved take without re-recording the rest.
//   1. finds the phrase's word span in voice/take.json
//   2. gets ONLY the new line: ElevenLabs with the neighbouring sentences as context (same voice/settings/seed),
//      or --audio for a line you recorded yourself (same mic, same room)
//   3. splices it into take.wav at the silence either side, level-matched to the speech around it
//   4. re-times every later word by the ACTUAL inserted length, then re-applies the pause cap (voice.mjs --from-take)
//   5. updates script.md, so the next full take says the same thing
// Always --dry-run first: it shows the span and context and spends nothing. voice/ is backed up first.
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { videoDir, readJSON, writeJSON, die, run, probeDuration, loadBrand, ROOT, norm, spokenText, takeKey } from "./lib.mjs";
import { makeTts, SR, alignToScript } from "./tts.mjs";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const dir = videoDir(args[0]);
const FIND = opt("find"), REPL = opt("replace"), OWN = opt("audio"), DRY = args.includes("--dry-run");
if (!FIND || (!REPL && !OWN)) die('Usage: npm run swap -- <slug> --find "kalimat lama" --replace "kalimat baru" [--audio baris-baru.wav] [--dry-run]');

const brand = loadBrand(dir);
const vdir = join(dir, "voice");
const work = join(vdir, "work");
const tts = makeTts({ brand, work });
const TAKE = join(vdir, "take.wav"), TAKE_WORDS = join(vdir, "take.json");
if (!existsSync(TAKE) || !existsSync(TAKE_WORDS)) die("voice/take.wav missing: run `npm run voice` first.");
const words = readJSON(TAKE_WORDS);
const W = words.map((w) => norm(w.text));
const source = existsSync(join(vdir, "source.json")) ? readJSON(join(vdir, "source.json")).provider : "rekaman";

// ---------- 1. find the span ----------
const phrase = FIND.split(/\s+/).map(norm).filter(Boolean);
const hits = [];
for (let i = 0; i + phrase.length <= W.length; i++) if (phrase.every((p, k) => W[i + k] === p)) hits.push(i);
if (!hits.length) die(`"${FIND}" not found in the take. Copy the phrase exactly as spoken (see voice/take.json).`);
if (hits.length > 1) die(`"${FIND}" occurs ${hits.length}x: add a word or two so it is unique.`);
const a = hits[0], b = a + phrase.length - 1;
const ctx = (i, j) => words.slice(Math.max(0, i), Math.max(0, j)).map((w) => w.text).join(" ");
const sentenceBefore = ctx(a - 25, a).split(/(?<=[.!?])\s+/).pop();
const sentenceAfter = ctx(b + 1, b + 26).split(/(?<=[.!?])\s+/)[0];
const cutA = a === 0 ? Math.max(0, words[0].start - 0.05) : (words[a - 1].end + words[a].start) / 2;
const cutB = b === words.length - 1 ? words[b].end + 0.3 : (words[b].end + words[b + 1].start) / 2;
console.log(`span   ${cutA.toFixed(2)}–${cutB.toFixed(2)} s  (${phrase.length} words)`);
console.log(`before …${sentenceBefore}`);
console.log(`old    [${ctx(a, b + 1)}]`);
console.log(`new    [${REPL ?? "(from " + OWN + ")"}]`);
console.log(`after  ${sentenceAfter}…`);
if (DRY) { console.log("dry run: nothing generated, nothing written."); process.exit(0); }

// ---------- 2. backup ----------
const n = readdirSync(vdir).filter((f) => f.startsWith("backup-")).length + 1;
const bak = join(vdir, `backup-${n}`);
mkdirSync(bak);
for (const f of ["take.wav", "take.json", "take.key", "words.json", "voice.wav", "source.json"]) if (existsSync(join(vdir, f))) cpSync(join(vdir, f), join(bak, f));
cpSync(join(dir, "script.md"), join(bak, "script.md"));

// ---------- 3. the new line ----------
const lineRaw = join(work, "swap-line.wav");
let lineWords;
if (OWN) { tts.toWav(OWN, lineRaw); const heard = tts.transcribe(lineRaw); lineWords = REPL ? alignToScript(REPL, heard) : heard; }
else if (source === "elevenlabs") lineWords = await tts.elevenlabs(REPL, lineRaw, { prev: sentenceBefore, next: sentenceAfter });
else if (source === "estimate") lineWords = tts.estimate(REPL, lineRaw);
else die(`The take came from "${source}". Make the new line the same way (same voice: record it, or generate it in AI Studio with the same speaker and style) and pass --audio.`);
if (!lineWords.length) die("the new line has no recognisable words.");
const inA = Math.max(0, lineWords[0].start - 0.04), inB = Math.min(probeDuration(lineRaw), lineWords.at(-1).end + 0.08);

// level match: RMS of the speech either side vs the new line
const rms = (file, from, to) => {
  const r = run("ffmpeg", ["-hide_banner", "-ss", Math.max(0, from).toFixed(3), "-to", to.toFixed(3), "-i", file, "-af", "astats=metadata=0:reset=0", "-f", "null", "-"], { allowFail: true });
  const m = [...(r.stderr || "").matchAll(/RMS level dB:\s*(-?[\d.]+|-inf)/g)].pop();
  return m && m[1] !== "-inf" ? parseFloat(m[1]) : null;
};
const ref = [rms(TAKE, cutA - 2.5, cutA), rms(TAKE, cutB, cutB + 2.5)].filter((x) => x != null);
const mine = rms(lineRaw, inA, inB);
const gain = ref.length && mine != null ? Math.max(-12, Math.min(12, ref.reduce((s, x) => s + x, 0) / ref.length - mine)) : 0;

// ---------- 4. splice (sample-exact, short fades at the joins) ----------
const pad = 0.06;
const out = join(work, "take.swapped.wav");
const fc = [
  `[0:a]atrim=0:${cutA.toFixed(5)},asetpts=PTS-STARTPTS[a]`,
  `[1:a]atrim=${inA.toFixed(5)}:${inB.toFixed(5)},asetpts=PTS-STARTPTS,volume=${gain.toFixed(2)}dB,afade=t=in:d=0.01,areverse,afade=t=in:d=0.02,areverse,apad=pad_dur=${pad},adelay=${Math.round(pad * 1000)}:all=1[n]`,
  `[0:a]atrim=start=${cutB.toFixed(5)},asetpts=PTS-STARTPTS[b]`,
  `[a][n][b]concat=n=3:v=0:a=1,aformat=sample_rates=${SR}:channel_layouts=mono[out]`,
].join(";");
writeFileSync(join(work, "_swap.txt"), fc);
run("ffmpeg", ["-y", "-v", "error", "-i", TAKE, "-i", lineRaw, "-/filter_complex", join(work, "_swap.txt"), "-map", "[out]", "-c:a", "pcm_s16le", out]);

// re-time from what was ACTUALLY inserted (frame rounding and fades make it differ from the request)
const inserted = probeDuration(out) - (probeDuration(TAKE) - (cutB - cutA));
const delta = inserted - (cutB - cutA);
const newWords = [
  ...words.slice(0, a),
  ...lineWords.map((w) => ({ text: w.text, start: +(cutA + pad + w.start - inA).toFixed(3), end: +(cutA + pad + w.end - inA).toFixed(3) })),
  ...words.slice(b + 1).map((w) => ({ ...w, start: +(w.start + delta).toFixed(3), end: +(w.end + delta).toFixed(3) })),
];
cpSync(out, TAKE);
writeJSON(TAKE_WORDS, newWords);
console.log(`✔ spliced: ${inserted.toFixed(2)} s in place of ${(cutB - cutA).toFixed(2)} s (${delta >= 0 ? "+" : ""}${delta.toFixed(2)} s), gain ${gain.toFixed(1)} dB. Backup: voice/backup-${n}/`);

// ---------- 5. script.md + pause cap ----------
const sp = join(dir, "script.md");
const script = readFileSync(sp, "utf8");
if (REPL && script.includes(FIND)) {
  writeFileSync(sp, script.replace(FIND, REPL));
  // the take now says what the script says: keep its cache key valid so `voice` does not re-generate it
  writeFileSync(join(vdir, "take.key"), takeKey(source, brand.voice, spokenText(sp)));
} else console.log("⚠ script.md not updated automatically (phrase not found verbatim). Update it by hand.");
spawnSync("node", [join(ROOT, "tools", "voice.mjs"), args[0], "--from-take"], { stdio: "inherit" });
console.log("Next: npm run cues (re-cue any beat whose cue word was in the old line), then check and finish.");
