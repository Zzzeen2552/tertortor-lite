// formats.mjs: file conversions of the finished render (user 2026-11-13): ProRes for editors, WebM, a GIF preview, a small
// 720p MP4. Works from out/<slug>.mp4 with ffmpeg, $0, never re-renders. Results in out/formats/.
// Other aspect ratios are NOT made here: cropping or a blurred fill is not allowed (user 2026-11-13). A new ratio is a
// remake in HyperFrames: tools/variant.mjs + event format-new (CLAUDE.md § Ubah format).
//   node tools/formats.mjs <slug> [--only prores,webm,gif,720p]
//   node tools/formats.mjs list <slug>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

export const KINDS = {
  prores: { label: "ProRes 422 HQ (MOV, untuk editor)", ext: "mov" },
  webm: { label: "WebM (VP9)", ext: "webm" },
  gif: { label: "GIF pratinjau (6 detik pertama)", ext: "gif" },
  "720p": { label: "MP4 kecil 720p", ext: "mp4" },
};

const probe = (f) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", f], { encoding: "utf8" });
  const j = JSON.parse(r.stdout || "{}");
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, dur: +j.format?.duration || 0 };
};
const fileOf = (dir, slug, k) => join(dir, "out", "formats", `${slug}-${k}.${KINDS[k].ext}`);
export const sourceOf = (dir, slug) => join(dir, "out", `${slug}.mp4`);

function encode(dir, slug, k) {
  const inp = sourceOf(dir, slug), src = probe(inp), out = fileOf(dir, slug, k), tmp = out + ".part" + (KINDS[k].ext === "gif" ? ".gif" : "." + KINDS[k].ext);
  let args, note = "";
  if (k === "prores") args = ["-i", inp, "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", "-c:a", "pcm_s16le", tmp];
  else if (k === "webm") args = ["-i", inp, "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-c:a", "libopus", "-b:a", "128k", tmp];
  else if (k === "720p") args = ["-i", inp, "-vf", src.w >= src.h ? "scale=-2:720:flags=lanczos" : "scale=720:-2:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp];
  else if (k === "gif") {
    const w = src.w >= src.h ? 640 : 480;
    args = ["-t", "6", "-i", inp, "-vf", `fps=12,scale=${w}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", tmp];
  }
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${k}: ${(r.stderr || "").trim().slice(-400)}`);
  renameSync(tmp, out);
  return { file: out, note };
}

export function listFormats(dir, slug) {
  const d = join(dir, "out", "formats"), src = sourceOf(dir, slug);
  const srcTime = existsSync(src) ? statSync(src).mtimeMs : 0;
  return Object.entries(KINDS).map(([k, v]) => {
    const f = fileOf(dir, slug, k), has = existsSync(f);
    return { kind: k, label: v.label, file: has ? `out/formats/${slug}-${k}.${v.ext}` : null, bytes: has ? statSync(f).size : 0, stale: has && statSync(f).mtimeMs < srcTime };
  });
}

// CLI
if (process.argv[1] && process.argv[1].endsWith("formats.mjs")) {
  const argv = process.argv.slice(2);
  const list = argv[0] === "list" && argv.shift();
  const slug = argv[0], dir = slug && join(ROOT, "videos", slug);
  if (!slug || !existsSync(dir)) { console.error("pakai: node tools/formats.mjs <slug> [--only 4x5,1x1,16x9,9x16,prores,webm,gif,720p] | list <slug>"); process.exit(1); }
  if (list) { console.table(listFormats(dir, slug)); process.exit(0); }
  if (!existsSync(sourceOf(dir, slug))) { console.error(`belum ada render: videos/${slug}/out/${slug}.mp4`); process.exit(1); }
  const i = argv.indexOf("--only");
  const want = i >= 0 ? argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean) : Object.keys(KINDS);
  const bad = want.filter((k) => !KINDS[k]);
  if (bad.length) { console.error(`format tidak dikenal: ${bad.join(", ")}`); process.exit(1); }
  mkdirSync(join(dir, "out", "formats"), { recursive: true });
  const log = join(dir, "out", "formats", "job.json");
  const job = { started: new Date().toISOString(), kinds: want, done: [], errors: [], running: true };
  const save = () => writeFileSync(log, JSON.stringify(job, null, 1));
  save();
  let failed = 0;
  for (const k of want) {
    job.current = k; save();
    const t0 = Date.now();
    try {
      const r = encode(dir, slug, k);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (r.skipped) console.log(`${k}: dilewati (${r.skipped})`);
      else console.log(`${k}: ${r.file} (${(statSync(r.file).size / 1e6).toFixed(1)} MB, ${secs}s${r.note ? ", " + r.note : ""})`);
      job.done.push({ kind: k, skipped: r.skipped ?? null, note: r.note ?? "", secs: +secs });
    } catch (e) { failed++; console.error(e.message); job.errors.push({ kind: k, error: e.message }); }
    save();
  }
  job.running = false; job.current = null; job.finished = new Date().toISOString(); save();
  process.exit(failed ? 1 : 0);
}
