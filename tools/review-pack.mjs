// review-pack.mjs: the pack a FRESH reviewer reads (user 2026-11-23, idea and pack layout from the Take One skill,
// github.com/talsiach/take-one, MIT, scripts/review-pack.sh + references/reviewer-brief.md; own Node implementation).
//
// The session that made a video is anchored to it: it remembers what each shot was meant to say. A new agent that saw
// none of the work stands in for a stranger who sees the video once, on a phone, often muted. This tool gives that
// agent only what a viewer gets: frames, the spoken words with their times, and the sound as numbers (it cannot hear).
//
//   node tools/review-pack.mjs <slug> [--mp4 <file>]   → videos/<slug>/out/fresh-review/round-N/ (N = next round)
//   node tools/review-pack.mjs <slug> --result         → reads the newest REVIEW.md, writes fresh-review/latest.json
//
// Then hand the round folder to the `video-reviewer` agent (.claude/agents/video-reviewer.md): a new agent every round,
// three rounds at most (CLAUDE.md § Reviewer mata segar).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, videoDir, run, probeDuration, readJSON, die } from "./lib.mjs";
import { placeOf } from "./categories.mjs";

const slug = process.argv[2];
const dir = videoDir(slug);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const base = join(dir, "out", "fresh-review");
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

if (process.argv.includes("--result")) { result(); process.exit(0); }

const mp4 = arg("--mp4") ?? join(dir, "out", `${slug}.mp4`);
if (!existsSync(mp4)) die(`${rel(mp4)} belum ada: render dulu (npm run finish -- ${slug}).`);
const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
const dur = probeDuration(mp4);
const [W, H] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", mp4]).stdout.trim().split(",").map(Number);
const tall = H > W;

// the thumbnail cover finish.mjs puts in front: everything the voice says is shifted by it
const raw = join(dir, "out", "raw.mp4");
let cover = existsSync(raw) ? Math.max(0, dur - probeDuration(raw)) : 0;
if (cover < 0.2) cover = 0;

const rounds = existsSync(base) ? readdirSync(base).filter((d) => /^round-\d+$/.test(d)).map((d) => +d.slice(6)) : [];
const round = (rounds.length ? Math.max(...rounds) : 0) + 1;
const P = join(base, `round-${round}`);
mkdirSync(P, { recursive: true });
const T = join(P, ".tmp");
mkdirSync(T, { recursive: true });
const ff = (...a) => run("ffmpeg", ["-v", "error", "-y", ...a], { allowFail: true });
const grab = (t, file, scale) => ff("-ss", t.toFixed(3), "-i", mp4, "-frames:v", "1", ...(scale ? ["-vf", `scale=${scale}:-2`] : []), file);

// 1. one frame per second, 40 per sheet
const sw = tall ? 216 : 384, cols = tall ? 10 : 8;
for (let s = 0, k = 1; s < dur; s += 40, k++)
  ff("-ss", String(s), "-t", "39.9", "-i", mp4, "-vf", `fps=1,scale=${sw}:-2,tile=${cols}x${40 / cols}:padding=4:color=gray`, "-frames:v", "1", join(P, `sheet_1fps_part${k}.png`));

// 2. cuts, measured from the picture (a stranger does not know the shot list)
const sc = run("ffmpeg", ["-hide_banner", "-i", mp4, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], { allowFail: true });
let cuts = [...sc.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.4);
// beats = the start of the video, every cut, and fill-ins so no stretch longer than 6 s goes without a frame
let beats = [0, ...cuts];
for (let i = 0; i < beats.length; i++) { const nx = beats[i + 1] ?? dur; if (nx - beats[i] > 6) beats.splice(i + 1, 0, beats[i] + (nx - beats[i]) / Math.ceil((nx - beats[i]) / 6)); }
if (beats.length > 36) beats = Array.from({ length: 36 }, (_, i) => beats[Math.round((i * (beats.length - 1)) / 35)]);
const at = beats.map((b, i) => Math.min(dur - 0.05, b + (i ? 0.4 : 0))); // just after each cut: the new shot, settled

// 3. beat grids (9 each, 480 px) and every 5th beat at full size
at.forEach((t, i) => { grab(t, join(T, `b${String(i).padStart(3, "0")}.png`), 480); if (i % 5 === 0) grab(t, join(P, `full_t${f1(t)}.png`)); });
for (let j = 0, g = 1; j < at.length; j += 9, g++)
  ff("-start_number", String(j), "-i", join(T, "b%03d.png"), "-frames:v", "1", "-vf", `tile=3x3:padding=4:color=gray`, join(P, `beats_grid${g}.png`));

// 4. 12-frame strips across the first 8 cuts (pops, doubled text, a flash that is only one frame)
const strips = cuts.slice(0, 8).map((c) => [Math.max(0, c - 0.25), Math.min(dur, c + 0.35)]);
for (const [a, b] of strips)
  ff("-ss", a.toFixed(3), "-t", (b - a).toFixed(3), "-i", mp4, "-vf", `fps=${(12 / (b - a)).toFixed(3)},scale=240:-2,tile=6x2:padding=3:color=gray`, "-frames:v", "1", join(P, `strip_${f1(a)}-${f1(b)}.png`));

// 5. phone width: 20 frames at 360 px, the size the viewer really reads
const ph = at.length <= 20 ? at : Array.from({ length: 20 }, (_, i) => at[Math.round((i * (at.length - 1)) / 19)]);
ph.forEach((t, i) => grab(Math.min(dur - 0.05, t + 0.5), join(T, `p${String(i).padStart(3, "0")}.png`), 360));
ff("-i", join(T, "p%03d.png"), "-vf", `tile=5x${Math.ceil(ph.length / 5)}:padding=4:color=gray`, "-frames:v", "1", join(P, "phone_360px.png"));
rmSync(T, { recursive: true, force: true });

// 6. the words, with film times (cover included), grouped into phrases at pauses and sentence ends
const wf = [join(dir, "voice", "words.json"), join(dir, "words.json")].find(existsSync);
let words = "(tanpa narasi)";
if (wf) {
  const ws = readJSON(wf), out = [];
  let cur = null;
  for (const w of ws) {
    if (!cur || w.start - cur.end > 0.45) { cur && out.push(cur); cur = { start: w.start, end: w.end, text: w.text }; }
    else { cur.text += " " + w.text; cur.end = w.end; }
    if (/[.!?]$/.test(w.text)) { out.push(cur); cur = null; }
  }
  cur && out.push(cur);
  words = out.map((p) => `${mmss(p.start + cover)}  ${p.text}`).join("\n");
}

// 7. the sound as numbers: loudness, true peak, silences, loudest and quietest seconds, a 5-second map
const eb = run("ffmpeg", ["-hide_banner", "-i", mp4, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { allowFail: true }).stderr;
const sum = eb.slice(eb.lastIndexOf("Summary:"));
const I = sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1], LRA = sum.match(/LRA:\s+(-?[\d.]+) LU/)?.[1], TP = sum.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1];
const sil = run("ffmpeg", ["-hide_banner", "-i", mp4, "-vn", "-af", "silencedetect=noise=-45dB:d=0.6", "-f", "null", "-"], { allowFail: true }).stderr;
const silences = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => `${mmss(+m[1])}–${mmss(+m[2])}`);
const rm = run("ffmpeg", ["-hide_banner", "-i", mp4, "-vn", "-af", "aresample=48000,asetnsamples=n=48000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"], { allowFail: true, maxBuffer: 64e6 }).stdout;
const rms = [...rm.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -99 : +m[1]));
const bySec = rms.map((v, s) => ({ s, v }));
const loud = [...bySec].sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${mmss(x.s)} (${x.v.toFixed(1)} dB)`);
const quiet = [...bySec].filter((x) => x.s >= cover && x.s < dur - 1).sort((a, b) => a.v - b.v).slice(0, 3).map((x) => `${mmss(x.s)} (${x.v.toFixed(1)} dB)`);
const map5 = [];
for (let s = 0; s < rms.length; s += 5) { const sl = rms.slice(s, s + 5); map5.push(`${mmss(s)} ${(sl.reduce((a, b) => a + b, 0) / sl.length).toFixed(0)}`); }
const music = existsSync(join(dir, "assets", "music.wav")) || existsSync(join(dir, "music.json")) || existsSync(join(dir, "assets", "music.mp3"));

// 8. what is locked: the reviewer must not spend its three problems on what this channel decided on purpose
const place = placeOf(dir);
const LOCKED = {
  all: [
    tall ? "Format 9:16 (1080×1920) untuk Reels/TikTok/Shorts. Teks dan subjek penting di pita aman y 168-1330 px; di bawahnya UI platform." : "Format 16:9 (1920×1080).",
    cover ? `0:00-${mmss(cover)} = thumbnail diam di depan video, sengaja (platform mengambilnya sebagai cover). Hook dinilai mulai ${mmss(cover)}.` : null,
    "Watermark logo channel di kiri atas: sengaja.",
  ],
  musafo: ["Gaya: ilustrasi 3D golden hour, wajah tidak tampak (sahabat tidak pernah digambar; Rasulullah hanya orb cahaya). Subtitle Indonesia + Inggris gaya film di bawah.", "Gambar dan klip dibuat model AI (Meta Muse / Flow / RunningHub); nilai hasil yang terlihat."],
  miracleofhajj: ["Gaya sama dengan Musafo (3D golden hour, wajah tidak tampak). Ditutup \"Wallahu a'lam bishawab\". Dalil Al-Qur'an dikutip persis terjemahan Kemenag."],
  berakitkehulu: [`Gaya ${meta.look === "preset1" ? "3D sinematik ala Pixar" : "3D cerah ala tanah liat"}, wajah tokoh terlihat, Indonesia tempo dulu. Subtitle Indonesia + Inggris. Logo merek asli hanya di shot penutup.`, "Gambar dibuat di ChatGPT, klip di Meta Muse (AI): nilai hasil yang terlihat. Baju tokoh boleh berganti antar shot."],
  bumidipijak: ["Gaya: lukisan minyak gelap berkabut, sejarah/legenda Jawa. Subtitle Merriweather, Inggris italic terakota."],
  advertisement: ["Iklan tanpa narasi. Foto produk asli (tidak digambar ulang AI); klaim hanya dari foto atau klien."],
  animation: ["Animasi tanpa narasi, semua digambar dari kode. Teks layar sengaja hanya judul (bahasa Inggris). Musik disintesis dari kode."],
  cinematic: [meta.look === "aws" ? "Rekap klien + visualisasi data, Thai + Inggris. Angka di kotak TBC = belum dari klien, sengaja." : "Film sinematik tanpa narator; dialog dari klip."],
  cinemaclone: ["Struktur (jumlah shot, panjang, kamera) sengaja meniru video acuan; isinya baru."],
  explainer: ["Layar aplikasi hanya screenshot asli; caption terbakar maks. 3 kata per grup dengan kata aktif berwarna aksen."],
};
const locked = [...LOCKED.all, ...(LOCKED[meta.type] ?? LOCKED[place.category] ?? [])].filter(Boolean);
const AUD = { storytelling: "penonton media sosial Indonesia, menonton sekali di HP, sering tanpa suara (subtitle wajib terbaca)", explainer: "penonton Indonesia yang punya masalah yang dibahas", advertisement: "calon pembeli yang sedang scroll", animation: "penonton umum, tanpa narasi", cinematic: "penonton film pendek / klien", cinemaclone: "penonton umum" };

writeFileSync(join(P, "WORDS-AND-SOUND.md"), `# Video: ${meta.name ?? slug}

${f1(dur)} s, ${W}×${H}, ${place.category}${place.sub ? " / " + place.sub : ""}. Diposting ke Instagram Reels, TikTok, YouTube Shorts.
Penonton: ${AUD[place.category] ?? "penonton media sosial"}.${meta.series ? `\nBagian ${meta.series.part} dari ${meta.series.total} sebuah series.` : ""}

## Yang sengaja dikunci (jangan dijadikan masalah)
${locked.map((l) => "- " + l).join("\n")}

## Kata yang diucapkan, dengan waktu di video
${words}

## Suara (reviewer tidak bisa mendengar)
- Loudness terintegrasi ${I ?? "?"} LUFS (target -14), LRA ${LRA ?? "?"} LU, true peak ${TP ?? "?"} dBFS (batas -1).
- Musik: ${music ? "ada, diredam di bawah suara" : "tidak terdeteksi file musik proyek"}.
- Paling keras: ${loud.join(", ") || "?"}.
- Paling sepi (setelah cover): ${quiet.join(", ") || "?"}.
- Hening > 0,6 s (< -45 dB): ${silences.join(", ") || "tidak ada"}.
- Rata-rata RMS per 5 s (dB): ${map5.join(" · ")}

## Cut yang terukur dari gambar
${cuts.length ? cuts.map(mmss).join(", ") : "tidak ada cut keras (satu kamera atau transisi halus)"}

## File di folder ini
- sheet_1fps_part*.png: satu frame per detik, ${cols} kolom, dibaca kiri ke kanan (tile N = detik N, mulai 0).
- beats_grid*.png: 9 frame per grid, tepat setelah tiap cut, waktunya: ${at.map(f1).join(", ")}.
- full_t*.png: frame ukuran penuh (waktu di nama file).
- strip_<a>-<b>.png: 12 frame berurutan melintasi cut (rentang di nama file).
- phone_360px.png: 20 frame selebar layar HP (360 px).
- Videonya sendiri: ${rel(mp4)} (boleh ambil frame tambahan dengan ffmpeg).
`);

console.log(`✔ paket review ronde ${round}: ${rel(P)}  (${readdirSync(P).length} file, ${cuts.length} cut, cover ${f1(cover)} s)`);
if (round > 3) console.log("⚠ sudah lebih dari 3 ronde: berhenti, serahkan ke user dengan skor dan masalah yang tersisa.");
console.log(`Lanjut: agen video-reviewer BARU dengan folder ${rel(P)}`);

// --result: the newest REVIEW.md → latest.json (scores, verdict, problems) for Studio and the session
function result() {
  if (!existsSync(base)) die("belum ada ronde review.");
  const r = readdirSync(base).filter((d) => /^round-\d+$/.test(d)).map((d) => +d.slice(6)).sort((a, b) => b - a).find((n) => existsSync(join(base, `round-${n}`, "REVIEW.md")));
  if (!r) die("belum ada REVIEW.md dari reviewer.");
  const md = readFileSync(join(base, `round-${r}`, "REVIEW.md"), "utf8");
  const j = md.match(/```json\s*([\s\S]*?)```/);
  if (!j) die(`REVIEW.md ronde ${r} tidak punya blok json.`);
  const data = { round: r, at: new Date().toISOString(), ...JSON.parse(j[1]) };
  writeFileSync(join(base, "latest.json"), JSON.stringify(data, null, 2) + "\n");
  const low = Object.entries(data.scores ?? {}).filter(([, v]) => v < 8).map(([k, v]) => `${k} ${v}`);
  console.log(`ronde ${r}: ${data.verdict} · keseluruhan ${data.scores?.overall ?? "?"}${low.length ? " · di bawah 8: " + low.join(", ") : ""}`);
  for (const p of data.problems ?? []) console.log(`  ${p.t}  ${p.what}`);
}
