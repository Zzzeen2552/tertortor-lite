// trim-logo.mjs <in> <out.png>: cut the white margin round a partner logo (400x300 canvases and the like), output at 2x.
// The grid cells place them with max-width 230 px and a per-logo max-height (tall marks 120-150, wide wordmarks 70-90).
import { spawnSync } from "node:child_process";
const [src, out] = process.argv.slice(2);
const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", src], { encoding: "utf8" }).stdout.trim().split(",").map(Number);
const [W, H] = pr;
const raw = spawnSync("ffmpeg", ["-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 }).stdout;
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, a = raw[i + 3];
  const ink = a > 40 && Math.min(raw[i], raw[i + 1], raw[i + 2]) < 225;
  if (ink) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
const pad = 3;
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
const w = x1 - x0 + 1, h = y1 - y0 + 1;
spawnSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `crop=${w}:${h}:${x0}:${y0},scale=iw*2:ih*2:flags=lanczos`, out]);
console.log(out, w, h);
