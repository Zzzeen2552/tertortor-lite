// aws-drive.mjs: copy an AWS project's working files into a folder that Google Drive for desktop syncs (user 2026-11-18). The project itself stays in videos/<slug> (rendering from a syncing folder is
// slow and breaks); this only copies what changed since the last run, so run it again after every render or AE export.
//
//   node tools/aws-drive.mjs <slug> [<folder>]   folder is remembered in meta.json → drive
//
// <folder>/01_Preview        <slug>.mp4, .en.srt, contact sheet (+ 9:16 / 1:1 renders when they exist)
//          02_After_Effects  out/ae (plate.mov, graphics.mov, <slug>.jsx, audio stems, footage, logos)
//          03_Audio          VO (cut + full take), VO script, music
//          04_Project        the HyperFrames project (aws.json, compositions, assets) without caches and renders
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { ROOT, readJSON, writeJSON, die } from "./lib.mjs";

const [slug, arg] = process.argv.slice(2);
if (!slug) die("pakai: node tools/aws-drive.mjs <slug> [<folder Drive>]");
const dir = join(ROOT, "videos", slug);
const meta = readJSON(join(dir, "meta.json"));
const dest = arg ?? meta.drive;
if (!dest) die("folder tujuan belum ada: node tools/aws-drive.mjs <slug> <folder>");
if (arg && meta.drive !== arg) writeJSON(join(dir, "meta.json"), { ...meta, drive: arg });

let n = 0, bytes = 0;
const put = (src, dst) => {
  if (!existsSync(src)) return;
  const s = statSync(src);
  if (s.isDirectory()) { for (const f of readdirSync(src)) put(join(src, f), join(dst, f)); return; }
  if (existsSync(dst)) { const d = statSync(dst); if (d.size === s.size && d.mtimeMs >= s.mtimeMs) return; }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  n++; bytes += s.size;
};

// 01 preview: the master and any ratio versions made from it
const pv = join(dest, "01_Preview");
for (const v of [slug, `${slug}-9x16`, `${slug}-1x1`]) {
  const o = join(ROOT, "videos", v, "out");
  put(join(o, `${v}.mp4`), join(pv, `${v}.mp4`));
  put(join(o, `${v}.en.srt`), join(pv, `${v}.en.srt`));
  put(join(o, "contact-sheet.png"), join(pv, `${v}-contact-sheet.png`));
}
// 02 After Effects package
put(join(dir, "out", "ae"), join(dest, "02_After_Effects"));
// 03 audio
const au = join(dest, "03_Audio");
put(join(dir, "assets", "vo"), au);
for (const f of existsSync(join(dir, "voice")) ? readdirSync(join(dir, "voice")) : []) if (/^take-.*\.wav$|^script\.txt$/.test(f)) put(join(dir, "voice", f), join(au, f));
put(join(dir, "assets", "music"), join(au, "music"));
// 04 project, without caches, renders and transcription scratch
const skip = new Set([".hyperframes", "build", "out", ".preview", "node_modules"]);
const pj = join(dest, "04_Project");
for (const f of readdirSync(dir)) if (!skip.has(f)) put(join(dir, f), join(pj, f));

writeFileSync(join(dest, "README.txt"), `${slug}: working files (salinan dari TERTORTOR videos/${slug})

01_Preview        MP4 preview + subtitle Inggris (.srt) + contact sheet
02_After_Effects  buka ${slug}.jsx di After Effects (File > Scripts > Run Script File): semua teks dan angka jadi text layer
03_Audio          VO (vo.wav = sudah dipotong dan ditempatkan, take-*.wav = take utuh), naskah VO, musik
04_Project        proyek HyperFrames (aws.json = semua teks, angka, adegan); render ulang di laptop TERTORTOR

Diperbarui: ${new Date().toISOString().slice(0, 16).replace("T", " ")}
`);
console.log(`✔ ${n} file disalin (${(bytes / 1e6).toFixed(1)} MB) → ${dest}`);
