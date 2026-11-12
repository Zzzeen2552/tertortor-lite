// occluders.mjs <clip.mp4> <out.json>   (then paste out.json into the /*@dyn*/…/*@end*/ block of compositions/kv.html)
// Per-frame occluders for the white frame's top edge: along the row where the edge sits, find where the sky is covered
// (a raised arm, a head), so the edge passes BEHIND the people. One entry per composition frame from T0 to T1.
// Edit the constants to the composition: START = the video's data-start, T0..T1 = while the frame is on screen,
// EDGE = the frame's top y, X1..X2 = its straight part, scale(t) = the #kv-photo scale tween over that window.
import { spawnSync } from "node:child_process";
const [clip, outFile] = process.argv.slice(2);
const W = 1080, Y0 = 470, ROWS = 50;               // source rows read
const START = 0, T0 = 3.9, T1 = 7.95, FPS = 30;  // video data-start in the composition; window of interest
const OX = 496.8, OY = 768, EDGE = 492, X1 = 140, X2 = 872;
const scale = (t) => 1 + 0.04 * Math.max(0, Math.min(1, (t - 3.85) / (7.45 - 3.85)));
const r = spawnSync("ffmpeg", ["-v", "error", "-i", clip, "-vf", `crop=${W}:${ROWS}:0:${Y0}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
const buf = r.stdout, fsz = W * ROWS * 3, nFrames = buf.length / fsz;
const sky = (p) => p[2] > 170 && p[2] - p[0] > 30 && p[1] > 120;
const out = [];
for (let t = T0; t <= T1 + 1e-6; t += 1 / FPS) {
  const n = Math.min(nFrames - 1, Math.max(0, Math.round((t - START) * FPS)));
  const s = scale(t);
  const runs = [];
  let a = -1;
  for (let X = X1; X <= X2; X++) {
    // check the 8 px thick edge: covered if most of its rows are not sky
    let cov = 0;
    for (let dy = -4; dy <= 4; dy += 2) {
      const ys = Math.round(OY + (EDGE + dy - OY) / s) - Y0, xs = Math.round(OX + (X - OX) / s);
      const i = n * fsz + (ys * W + xs) * 3;
      if (!sky([buf[i], buf[i + 1], buf[i + 2]])) cov++;
    }
    const c = cov >= 3;
    if (c && a < 0) a = X;
    if ((!c || X === X2) && a >= 0) { if (X - a > 5) runs.push([a - 3, X + 3]); a = -1; }
  }
  out.push(runs);
}
const fs = await import("node:fs");
fs.writeFileSync(outFile, JSON.stringify({ t0: T0, fps: FPS, runs: out }));
console.log(out.length, "frames; sample", JSON.stringify(out[0]), JSON.stringify(out[Math.floor(out.length / 2)]), JSON.stringify(out.at(-1)));
