// ref.mjs: reference video -> measured facts Claude can plan from, then 2-3 concepts the user picks from.
//
//   node tools/ref.mjs <slug> [url|file] [--force]   download (yt-dlp) or copy the reference, then analyse every
//                                                    video in assets/reference/ (skips ones already analysed)
//   node tools/ref.mjs check  <slug>                 validate concepts.json (exit 1 on errors)
//   node tools/ref.mjs pick   <slug> <conceptId>     record the user's concept (request.json -> concept)
//   node tools/ref.mjs status <slug>
//
// Per reference <name>.<ext> it writes, next to the video:
//   <name>.sheet.png   1 tile = 1 second (rhythm at a glance)
//   <name>.shots.png   one keyframe per shot, in order (what each shot shows)
//   <name>.shots/      the keyframes themselves (sNN.jpg, mid-shot)
//   <name>.ref.json    shots (start/end/motion), speech (words, wpm, hook words, gaps), loudness
//   <name>.ref.md      the same as a readable table: Claude reads this + the two PNGs, then writes analysis.md
// Motion per shot is measured, not guessed: mean pixel change between frames 0.25 s apart inside the shot.
// The order the skill follows: analyse -> analysis.md (5 aspects) -> concepts.json -> user picks -> script.
import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { readJSON, writeJSON, videoDir, die, run, probeDuration, ROOT } from "./lib.mjs";

const VIDEO = /\.(mp4|mov|webm|mkv)$/i;
const SAMPLE_FPS = 4; // motion probe rate
const PW = 48, PH = 86; // motion probe frame size (gray)

// whisper.cpp shipped in tools/bin (same as tts.mjs)
const WHISPER = join(ROOT, "tools", "bin", "whisper", "Release", "whisper-cli.exe");
if (!process.env.HYPERFRAMES_WHISPER_PATH && existsSync(WHISPER)) process.env.HYPERFRAMES_WHISPER_PATH = WHISPER;

// winget puts yt-dlp on the user PATH, which an already-running Studio does not see yet
function ytdlp() {
  const la = process.env.LOCALAPPDATA || "";
  const pkgs = join(la, "Microsoft", "WinGet", "Packages");
  const cands = [join(la, "Microsoft", "WinGet", "Links", "yt-dlp.exe")];
  if (existsSync(pkgs)) for (const p of readdirSync(pkgs).filter((p) => p.startsWith("yt-dlp."))) cands.push(join(pkgs, p, "yt-dlp.exe"));
  return cands.find(existsSync) || "yt-dlp";
}

const status = (dir, state, msg = "") => writeJSON(join(dir, "assets", "reference", ".status.json"), { state, msg, at: new Date().toISOString() });

function fetchReference(dir, src) {
  const out = join(dir, "assets", "reference");
  mkdirSync(out, { recursive: true });
  if (!/^https?:\/\//i.test(src)) {
    if (!existsSync(src)) die(`${src} not found.`);
    const dest = join(out, basename(src));
    copyFileSync(src, dest);
    return dest;
  }
  status(dir, "running", "mengunduh video referensi");
  const before = new Set(readdirSync(out));
  const r = run(ytdlp(), ["--no-playlist", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4", "-o", join(out, "ref-%(id)s.%(ext)s"), "--no-progress", src], { allowFail: true });
  if (r.status !== 0) {
    status(dir, "error", `gagal mengunduh: ${(r.stderr || "").trim().split(/\r?\n/).pop()}`);
    die(`yt-dlp failed (private post, login wall, or bad link). Upload the file in TERTORTOR instead.\n${(r.stderr || "").slice(-800)}`);
  }
  const got = readdirSync(out).find((f) => VIDEO.test(f) && !before.has(f));
  if (!got) die("yt-dlp finished but no video file appeared.");
  return join(out, got);
}

// scene changes from ffmpeg's scene score; shots shorter than 0.2 s are flashes, merged into the previous shot
function detectShots(file, dur) {
  const r = run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-"], { allowFail: true });
  const cuts = [...(r.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]).filter((t) => t > 0.2 && t < dur - 0.2);
  const edges = [0];
  for (const c of cuts) if (c - edges.at(-1) >= 0.2) edges.push(c);
  edges.push(dur);
  return edges.slice(0, -1).map((s, i) => ({ start: +s.toFixed(2), end: +edges[i + 1].toFixed(2) }));
}

// mean absolute change per pixel (0-255) between probe frames inside each shot
function measureMotion(file, shots) {
  const r = run("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${SAMPLE_FPS},scale=${PW}:${PH},format=gray`, "-f", "rawvideo", "-"], { encoding: "buffer", maxBuffer: 1 << 30 });
  const buf = r.stdout, n = Math.floor(buf.length / (PW * PH));
  const frame = (i) => buf.subarray(i * PW * PH, (i + 1) * PW * PH);
  for (const s of shots) {
    const a = Math.ceil(s.start * SAMPLE_FPS + 0.5), b = Math.min(n - 1, Math.floor(s.end * SAMPLE_FPS - 0.5));
    const diffs = [];
    for (let i = a; i < b; i++) {
      const f0 = frame(i), f1 = frame(i + 1);
      let sum = 0;
      for (let k = 0; k < f0.length; k++) sum += Math.abs(f0[k] - f1[k]);
      diffs.push(sum / f0.length);
    }
    const m = diffs.length ? diffs.reduce((x, y) => x + y, 0) / diffs.length : 0;
    s.motion = +m.toFixed(2);
    s.motionType = !diffs.length ? "terlalu pendek" : m < 0.6 ? "diam" : m < 3 ? "gerak pelan" : "gerak";
  }
}

function keyframes(file, shots, base) {
  const dirK = `${base}.shots`;
  rmSync(dirK, { recursive: true, force: true });
  mkdirSync(dirK, { recursive: true });
  shots.forEach((s, i) => {
    s.frame = `${basename(dirK)}/s${String(i + 1).padStart(3, "0")}.jpg`;
    run("ffmpeg", ["-y", "-v", "error", "-ss", ((s.start + s.end) / 2).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", join(dirK, `s${String(i + 1).padStart(3, "0")}.jpg`)]);
  });
  const cols = 6, rows = Math.ceil(shots.length / cols);
  run("ffmpeg", ["-y", "-v", "error", "-framerate", "1", "-i", join(dirK, "s%03d.jpg"), "-vf", `scale=180:-2,tile=${cols}x${rows}:padding=3`, "-frames:v", "1", `${base}.shots.png`], { allowFail: true });
}

function transcribeRef(file, base) {
  // npx runs through the shell on Windows, so a reference name with spaces broke transcription: work in os temp
  base = join(tmpdir(), `ref-${process.pid}`);
  const wav = `${base}.tmp.wav`;
  run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", wav], { allowFail: true });
  if (!existsSync(wav)) return { words: [], note: "tidak ada trek audio" };
  const tmp = `${base}.tx`;
  mkdirSync(join(tmp, "assets"), { recursive: true });
  const r = run("npx", ["hyperframes", "transcribe", wav, "-d", tmp, "--model", "small", "--language", "auto", "--json"], { allowFail: true });
  let words = [], note = "";
  try {
    const res = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    if (!res.ok) throw new Error(res.reason);
    const t = readJSON(res.transcriptPath);
    const list = Array.isArray(t) ? t : t.words || t.segments?.flatMap((s) => s.words) || [];
    words = list.map((w) => ({ text: String(w.text ?? w.word).trim(), start: +(+w.start).toFixed(2), end: +(+w.end).toFixed(2) })).filter((w) => w.text);
  } catch (e) {
    note = `transkripsi gagal: ${e.message || "output tidak terbaca"}`;
  }
  rmSync(tmp, { recursive: true, force: true });
  rmSync(wav, { force: true });
  return { words, note };
}

function loudness(file) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { allowFail: true });
  const m = (r.stderr || "").match(/I:\s+(-?[\d.]+) LUFS/g);
  return m ? +m.at(-1).match(/-?[\d.]+/)[0] : null;
}

function speechStats(words, dur) {
  if (!words.length) return null;
  const span = words.at(-1).end - words[0].start;
  const gaps = [];
  for (let i = 1; i < words.length; i++) if (words[i].start - words[i - 1].end > 1) gaps.push({ at: words[i - 1].end, len: +(words[i].start - words[i - 1].end).toFixed(2) });
  const talk = words.reduce((s, w) => s + (w.end - w.start), 0);
  return {
    wordCount: words.length,
    wpm: Math.round((words.length / span) * 60),
    firstWordAt: words[0].start,
    hookWords: words.filter((w) => w.start < 2).map((w) => w.text).join(" "),
    first5s: words.filter((w) => w.start < 5).map((w) => w.text).join(" "),
    coverage: +(talk / dur).toFixed(2),
    gaps,
    text: words.map((w) => w.text).join(" "),
  };
}

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function analyse(file) {
  const base = file.replace(/\.[^.]+$/, "");
  const dur = probeDuration(file);
  const [w, h] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).stdout.trim().split(",").map(Number);
  run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "fps=1,scale=180:-1,tile=8x8:padding=3", "-frames:v", "1", `${base}.sheet.png`], { allowFail: true });
  const shots = detectShots(file, dur);
  measureMotion(file, shots);
  keyframes(file, shots, base);
  const { words, note } = transcribeRef(file, base);
  const speech = speechStats(words, dur);
  for (const s of shots) s.said = words.filter((x) => x.start >= s.start && x.start < s.end).map((x) => x.text).join(" ");
  const lens = shots.map((s) => s.end - s.start).sort((a, b) => a - b);
  const motionMix = shots.reduce((m, s) => ((m[s.motionType] = (m[s.motionType] || 0) + 1), m), {});
  const ref = {
    file: basename(file),
    duration: +dur.toFixed(2),
    size: `${w}x${h}`,
    aspect: w && h ? (h > w ? "vertikal" : h === w ? "persegi" : "horizontal") : null,
    shots,
    pacing: {
      shotCount: shots.length,
      avgShot: +(dur / shots.length).toFixed(2),
      medianShot: +lens[Math.floor(lens.length / 2)].toFixed(2),
      cutsFirst3s: shots.filter((s) => s.start > 0 && s.start < 3).length,
      shortest: +lens[0].toFixed(2),
      longest: +lens.at(-1).toFixed(2),
    },
    motionMix,
    speech,
    speechNote: note || (words.length ? "" : "tidak ada ucapan terdeteksi"),
    loudnessLufs: loudness(file),
    words,
  };
  writeJSON(`${base}.ref.json`, ref);
  writeFileSync(`${base}.ref.md`, refMarkdown(ref));
  return ref;
}

function refMarkdown(r) {
  const p = r.pacing, s = r.speech;
  const lines = [
    `# Data referensi: ${r.file}`,
    "",
    "> Diukur oleh `npm run ref`. Ini fakta, bukan tafsiran. Tafsiran (5 aspek + untuk video kita) ditulis Claude di `analysis.md`.",
    "",
    `- **Durasi:** ${r.duration} s, ${r.size} (${r.aspect})`,
    `- **Tempo:** ${p.shotCount} shot, rata-rata ${p.avgShot} s (median ${p.medianShot} s, terpendek ${p.shortest} s, terpanjang ${p.longest} s), ${p.cutsFirst3s} cut di 3 detik pertama`,
    `- **Gerak:** ${Object.entries(r.motionMix).map(([k, v]) => `${v} ${k}`).join(", ")} (diam = foto/kartu, gerak pelan = pan/zoom atau gerak kecil, gerak = klip video sungguhan)`,
    `- **Loudness:** ${r.loudnessLufs ?? "?"} LUFS`,
  ];
  if (s) {
    lines.push(
      `- **Bicara:** ${s.wordCount} kata, ${s.wpm} kata/menit, kata pertama di ${s.firstWordAt} s, bicara ${Math.round(s.coverage * 100)}% durasi`,
      `- **Hook (2 detik pertama):** "${s.hookWords}"`,
      `- **5 detik pertama:** "${s.first5s}"`,
      `- **Jeda > 1 s:** ${s.gaps.length ? s.gaps.map((g) => `${fmt(g.at)} (${g.len} s)`).join(", ") : "tidak ada"}`,
    );
  } else lines.push(`- **Bicara:** ${r.speechNote}`);
  lines.push("", "## Shot", "", "| # | Mulai | Durasi | Gerak | Ucapan |", "| --- | --- | --- | --- | --- |");
  r.shots.forEach((x, i) => lines.push(`| ${i + 1} | ${fmt(x.start)} | ${(x.end - x.start).toFixed(1)} s | ${x.motionType} (${x.motion}) | ${x.said.replace(/\|/g, "/") || "—"} |`));
  if (s) lines.push("", "## Transkrip", "", s.text);
  return lines.join("\n") + "\n";
}

// ---- concepts.json ---------------------------------------------------------
// { "concepts": [ { "id": "A", "title", "keeps", "changes", "hook", "visual", "audio", "duration",
//                   "cost": [ { "item", "usd" } ], "honest", "recommended": true } ] }
const FIELDS = ["id", "title", "keeps", "changes", "hook", "visual", "audio", "duration", "cost", "honest"];

export function checkConcepts(dir) {
  const p = join(dir, "concepts.json");
  const errors = [];
  if (!existsSync(p)) return { errors: ["concepts.json belum ada"], concepts: [] };
  let c;
  try {
    c = readJSON(p).concepts;
  } catch (e) {
    return { errors: [`concepts.json tidak valid: ${e.message}`], concepts: [] };
  }
  if (!Array.isArray(c) || c.length < 2 || c.length > 3) errors.push("tulis 2-3 konsep");
  else {
    const ids = new Set();
    for (const k of c) {
      for (const f of FIELDS) if (k[f] == null || k[f] === "" || (Array.isArray(k[f]) && !k[f].length)) errors.push(`${k.id ?? "?"}: ${f} kosong`);
      if (ids.has(k.id)) errors.push(`id ${k.id} dobel`);
      ids.add(k.id);
      if (k.duration > 179) errors.push(`${k.id}: durasi ${k.duration} s > 179 s`);
      if (Array.isArray(k.cost) && k.cost.some((x) => typeof x.usd !== "number")) errors.push(`${k.id}: setiap baris cost butuh usd (angka, 0 bila gratis)`);
    }
    if (c.filter((k) => k.recommended).length !== 1) errors.push("tandai tepat satu konsep recommended: true");
  }
  return { errors, concepts: Array.isArray(c) ? c.map((k) => ({ ...k, total: Array.isArray(k.cost) ? +k.cost.reduce((s, x) => s + (x.usd || 0), 0).toFixed(2) : 0 })) : [] };
}

export function pickConcept(dir, id, by = "user") {
  const { errors, concepts } = checkConcepts(dir);
  if (errors.length) throw new Error(errors.join("; "));
  if (!concepts.some((k) => k.id === id)) throw new Error(`konsep ${id} tidak ada`);
  const rp = join(dir, "request.json");
  const r = existsSync(rp) ? readJSON(rp) : {};
  r.concept = { id, at: new Date().toISOString(), by };
  r.status = "konsep dipilih";
  writeJSON(rp, r);
  return r.concept;
}

export const refFiles = (dir) => {
  const d = join(dir, "assets", "reference");
  return existsSync(d) ? readdirSync(d).filter((f) => VIDEO.test(f) && !f.endsWith(".tmp.wav")) : [];
};

// ---- cli -------------------------------------------------------------------
if (process.argv[1] && basename(process.argv[1]) === "ref.mjs") {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [cmd, a1, a2] = args.filter((x) => x !== "--force");
  if (cmd === "check") {
    const { errors, concepts } = checkConcepts(videoDir(a1));
    for (const k of concepts) console.log(`${k.recommended ? "★" : " "} ${k.id}: ${k.title} (${k.duration} s, $${k.total})`);
    if (errors.length) die(errors.join("\n✖ "));
    console.log("✔ concepts.json ok");
  } else if (cmd === "pick") {
    try {
      console.log("✔ konsep dipilih:", pickConcept(videoDir(a1), a2, "chat").id);
    } catch (e) {
      die(e.message);
    }
  } else if (cmd === "status") {
    const dir = videoDir(a1);
    const st = existsSync(join(dir, "assets/reference/.status.json")) ? readJSON(join(dir, "assets/reference/.status.json")) : null;
    const req = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {};
    console.log(`referensi: ${refFiles(dir).join(", ") || "-"}${st ? ` (${st.state} ${st.msg})` : ""}`);
    console.log(`analysis.md: ${existsSync(join(dir, "assets/reference/analysis.md")) ? "ada" : "belum"}`);
    const c = checkConcepts(dir);
    console.log(`konsep: ${c.errors.length ? c.errors.join("; ") : c.concepts.map((k) => k.id).join(", ")}; dipilih: ${req.concept?.id ?? "belum"}`);
  } else {
    const dir = videoDir(cmd);
    try {
      if (a1) fetchReference(dir, a1);
      const files = refFiles(dir).filter((f) => force || !existsSync(join(dir, "assets/reference", f.replace(/\.[^.]+$/, ".ref.json"))));
      if (!refFiles(dir).length) die("Belum ada video referensi. Beri link/file: npm run ref -- <slug> <url|file>");
      for (const f of files) {
        status(dir, "running", `menganalisis ${f}`);
        const r = analyse(join(dir, "assets", "reference", f));
        console.log(`✔ ${f}: ${r.duration} s, ${r.pacing.shotCount} shot (rata-rata ${r.pacing.avgShot} s), ${r.speech ? `${r.speech.wpm} kata/menit` : r.speechNote}`);
        console.log(`  → assets/reference/${f.replace(/\.[^.]+$/, "")}.ref.md, .shots.png, .sheet.png`);
      }
      if (!files.length) console.log("Semua referensi sudah dianalisis (pakai --force untuk ulang).");
      status(dir, "done", "");
    } catch (e) {
      status(dir, "error", e.message);
      throw e;
    }
  }
}
