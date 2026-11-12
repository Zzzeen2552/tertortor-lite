// prep-footage.mjs <in> <out.mp4> [--start s] [--dur s]
// Make a clip composition-ready: 1080x1920 (cover crop), 30 fps, silent, H.264, light sharpen when upscaled.
// Generators return odd sizes (720p 16:9, 768x1356…) at 24 fps with an audio track. Trim with --start/--dur so the
// ACTION lands on its cue word; a trim past the end of the source is refused (that is how a plate goes black mid-beat).
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { run, die, probeDuration } from "./lib.mjs";

export function prepFootage(src, out, { start = 0, dur } = {}) {
  if (!existsSync(src)) die(`not found: ${src}`);
  const len = probeDuration(src);
  if (start >= len) die(`--start ${start}s is past the end of the clip (${len.toFixed(2)}s).`);
  if (dur != null && start + dur > len + 0.01) die(`trim ${start}+${dur}s runs past the end of the clip (${len.toFixed(2)}s): the beat would go black.`);
  const h = +run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", src]).stdout.trim();
  const sharpen = h && h < 1920 ? ",unsharp=5:5:0.6" : "";
  mkdirSync(dirname(out), { recursive: true });
  const a = ["-y", "-v", "error", "-ss", String(start), "-i", src];
  if (dur != null) a.push("-t", String(dur));
  a.push("-vf", `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30${sharpen},format=yuv420p`, "-an", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", out);
  run("ffmpeg", a);
  return { out, duration: probeDuration(out) };
}

if (process.argv[1]?.endsWith("prep-footage.mjs")) {
  const [src, out, ...rest] = process.argv.slice(2);
  if (!src || !out) die("Usage: node tools/prep-footage.mjs <in> <out.mp4> [--start s] [--dur s]");
  const opt = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? +rest[i + 1] : undefined; };
  const r = prepFootage(src, out, { start: opt("start") ?? 0, dur: opt("dur") });
  console.log(`✔ ${r.out} 1080x1920 30fps silent, ${r.duration.toFixed(2)}s`);
}
