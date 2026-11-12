// cutouts.mjs <slug> [--until 2.8] [--y 240] [--h 370] [--cut 62]
// Per-frame cutouts of the people in front of a sky (heads, hats, a raised arm) so the opening kinetic type can sit
// BEHIND them: every pixel whose blue does not beat its red by --cut (= not sky) stays opaque, the sky goes
// transparent, alpha softened by 1.1 px. Reads assets/footage/family.mp4 (1080x1920, 30 fps), writes
// assets/cutout/f000.png … one per composition frame from 0 to --until, cropped to the band y .. y+h.
// Below about y 600 a light-blue shirt reads as sky: keep the type above that line (check a frame over red first:
// add --test to write one frame at 1 s over red to the scratch path printed).
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const args = process.argv.slice(2);
const slug = args[0];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? +args[i + 1] : d; };
if (!slug) { console.error("Usage: node advertisement/bri/scripts/cutouts.mjs <slug> [--until 2.8] [--y 240] [--h 370] [--cut 62] [--test]"); process.exit(1); }
const dir = join(ROOT, "videos", slug), clip = join(dir, "assets", "footage", "family.mp4");
if (!existsSync(clip)) { console.error(`missing ${clip}`); process.exit(1); }
const until = opt("until", 2.8), y = opt("y", 240), h = opt("h", 370), cut = opt("cut", 62);
const matte = `crop=1080:${h}:0:${y},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((${cut}-(b(X,Y)-r(X,Y)))*9,0,255)*clip((${h - 5}-Y)/12,0,1)'[c];[c]split[x][m];[m]alphaextract,gblur=sigma=1.1[a];[x][a]alphamerge`;
if (args.includes("--test")) {
  const out = join(dir, "out", "cutout-test.png");
  mkdirSync(dirname(out), { recursive: true });
  spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", clip, "-frames:v", "1", "-filter_complex", `[0]${matte}[o];color=c=red:s=1080x${h}[bg];[bg][o]overlay=format=auto`, out], { stdio: "inherit" });
  console.log(`✔ ${out} (red = sky removed)`);
} else {
  const od = join(dir, "assets", "cutout");
  mkdirSync(od, { recursive: true });
  for (const f of readdirSync(od)) rmSync(join(od, f));
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", clip, "-t", String(until), "-filter_complex", `[0]${matte}`, "-start_number", "0", join(od, "f%03d.png")], { stdio: "inherit" });
  console.log(`✔ ${readdirSync(od).length} cutouts in assets/cutout/ (band y ${y}..${y + h}); the composition needs one <img> per frame`);
}
