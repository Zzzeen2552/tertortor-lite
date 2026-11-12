// cutout.mjs: green-screen still → transparent PNG cut-out, trimmed to the subject. For the VOX layered scene
// (presets/vox/style.md § Adegan berlapis): every person and object is generated on flat chroma green (#00FF00), then keyed
// here, so the edges come out clean instead of the "papery" look of cutting one finished collage apart.
//   node tools/cutout.mjs <in.png|jpg> [out.png] [--sim 0.16] [--blend 0.06] [--pad 8] [--no-trim]
// Defaults: out = <in>.cut.png next to the input. Prints the trimmed size and offset.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : (argv.splice(i, 2)[1]); };
const flag = (k) => { const i = argv.indexOf(k); return i < 0 ? false : (argv.splice(i, 1), true); };
const sim = Number(opt("--sim", 0.16)), blend = Number(opt("--blend", 0.06)), pad = Number(opt("--pad", 8)), noTrim = flag("--no-trim");
const [src, dstArg] = argv;
if (!src || !existsSync(src)) { console.error("pakai: node tools/cutout.mjs <gambar berlatar hijau> [out.png] [--sim 0.16] [--blend 0.06] [--pad 8] [--no-trim]"); process.exit(1); }
const dst = dstArg || src.replace(/\.[^.\\/]+$/, "") + ".cut.png";

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr.slice(-600)); process.exit(1); }
  return r.stderr;
};
// key + remove the green fringe on hair and edges
const KEY = `format=rgba,chromakey=0x00FF00:${sim}:${blend},despill=type=green:mix=0.6:expand=0.1:alpha=0`;
const tmp = mkdtempSync(join(tmpdir(), "cut-"));
const keyed = join(tmp, "k.png");
ff(["-i", src, "-vf", KEY, "-frames:v", "1", keyed]);

if (noTrim) { ff(["-i", keyed, "-frames:v", "1", dst]); }
else {
  // bounding box of the alpha: cropdetect on the alpha plane (subject white, background black)
  const log = ff(["-i", keyed, "-vf", "alphaextract,cropdetect=limit=24:round=2:reset=0:skip=0", "-f", "null", "-"]);
  const m = [...log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
  if (!m) { console.error("cutout: tidak ada subjek (semua hijau?) — coba --sim lebih kecil"); process.exit(1); }
  let [w, h, x, y] = m.slice(1).map(Number);
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", keyed], { encoding: "utf8" }).stdout.trim().split(",").map(Number);
  x = Math.max(0, x - pad); y = Math.max(0, y - pad); w = Math.min(probe[0] - x, w + 2 * pad); h = Math.min(probe[1] - y, h + 2 * pad);
  ff(["-i", keyed, "-vf", `crop=${w}:${h}:${x}:${y}`, "-frames:v", "1", dst]);
  console.log(`cutout: ${dst}  ${w}×${h} (dari ${probe[0]}×${probe[1]}, offset ${x},${y})`);
}
rmSync(tmp, { recursive: true, force: true });
if (noTrim) console.log(`cutout: ${dst}`);
