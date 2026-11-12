// finish.mjs <slug> [--skip-render]
// Render -> loudness to -14 LUFS / -1 dBTP -> contact sheet at 1 fps -> black-frame scan.
// A render that exits 0 proves nothing: read out/contact-sheet.png before anyone else sees the video.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { videoDir, run, probeDuration, loadBrand, die } from "./lib.mjs";
import { refreshWatermark } from "./brandmark.mjs";
import { auto as autoThumbnail, thumbPng } from "./thumbnail.mjs";

const slug = process.argv[2];
const dir = videoDir(slug);
const brand = loadBrand(dir);
const { w: FW, h: FH } = brand.frame; // 9:16 or 16:9 (meta.json "format")
const out = join(dir, "out");
mkdirSync(out, { recursive: true });
const raw = join(out, "raw.mp4");
const final = join(out, `${slug}.mp4`);

if (!process.argv.includes("--skip-render")) {
  // the channel logo (uploaded or switched off after the last build) is refreshed in index.html before every render
  if (refreshWatermark(dir)) console.log("  watermark: logo channel, kiri atas");
  console.log("Rendering (HyperFrames)...");
  run("npx", ["hyperframes", "render", dir, "-o", raw, "--fps", "30", "-q", "delivery"], { stdio: "inherit" });
}
if (!existsSync(raw)) die("out/raw.mp4 missing.");

// thumbnail (tools/thumbnail.mjs): out/thumbnail.png always; in front of the video for thumbnail.json → seconds unless
// cover is false, so the platforms take it as the cover. The render itself (raw.mp4) stays as HyperFrames made it.
let master = raw;
if (!process.argv.includes("--no-thumbnail")) {
  try {
    const t = await autoThumbnail(dir);
    if (t.cover && t.seconds > 0) {
      master = join(out, "raw.cover.mp4");
      const s = t.seconds.toFixed(3);
      // a render without an audio stream (silent ad) gets silence, so the concat always has both streams
      const hasAudio = !!run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", raw]).stdout.trim();
      run("ffmpeg", ["-y", "-v", "error", "-i", raw, "-loop", "1", "-framerate", "30", "-t", s, "-i", thumbPng(dir), "-f", "lavfi", "-t", s, "-i", "anullsrc=r=48000:cl=stereo", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-filter_complex", `[1:v]scale=${FW}:${FH},setsar=1,fps=30,format=yuv420p[c];[0:v]scale=${FW}:${FH},setsar=1,fps=30,format=yuv420p[v];${hasAudio ? "[0:a]" : "[3:a]"}aresample=48000,aformat=channel_layouts=stereo${hasAudio ? "" : `,atrim=0:${probeDuration(raw).toFixed(3)}`}[a];[c][2:a][v][a]concat=n=2:v=1:a=1[ov][oa]`,
        "-map", "[ov]", "-map", "[oa]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "aac", "-b:a", "256k", master]);
      console.log(`  thumbnail ${s} s di depan video`);
    }
  } catch (e) {
    console.log(`⚠ thumbnail gagal: ${e.message} (video dirender tanpa thumbnail di depan)`);
  }
}

// two-pass loudnorm
const { lufs, tp } = brand.loudness;
const m = run("ffmpeg", ["-hide_banner", "-i", master, "-af", `loudnorm=I=${lufs}:TP=${tp}:LRA=11:print_format=json`, "-f", "null", "-"]);
const stats = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1));
// A draft voice (estimate/system TTS) must not set the mix: normalising SFX alone to -14 LUFS would blast them.
const draft = existsSync(join(dir, "voice", "source.json")) && JSON.parse(readFileSync(join(dir, "voice", "source.json"), "utf8")).draft;
const silent = draft || !Number.isFinite(parseFloat(stats.input_i));
if (silent) console.log("⚠ draft or silent voice: skipping loudness normalisation (not a delivery master).");
const ln = `loudnorm=I=${lufs}:TP=${tp}:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
run("ffmpeg", ["-y", "-v", "error", "-i", master, "-c:v", "copy", "-af", `${silent ? "anull" : ln},aresample=48000`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);

// contact sheet: 1 frame per second, 6 columns (tile N = second N, read left to right)
const dur = probeDuration(final);
const rows = Math.ceil(dur / 6);
const sheet = join(out, "contact-sheet.png");
run("ffmpeg", ["-y", "-v", "error", "-i", final, "-vf", `fps=1,scale=${FW > FH ? 320 : 216}:-1,tile=6x${rows}:padding=4:color=0x222222`, "-frames:v", "1", sheet]);

// black-frame scan (a whole beat once came out pure black with clean logs)
const bd = run("ffmpeg", ["-hide_banner", "-i", final, "-vf", "blackdetect=d=0.3:pix_th=0.06", "-an", "-f", "null", "-"]);
const blacks = [...bd.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((x) => `${(+x[1]).toFixed(2)}-${(+x[2]).toFixed(2)}s`);

// visual dead air: frames with almost no edges (nothing hero-sized on screen). Measured on the RENDER, so it sees
// what the viewer sees: a stuck-hidden element, a scene that enters late, a black clip. Sampled at 4 fps.
const ed = run("ffmpeg", ["-hide_banner", "-i", final, "-vf", "fps=4,scale=270:-1,edgedetect=low=0.1:high=0.3,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"]);
const dens = [...ed.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
const holes = [];
for (let i = 0, from = null; i <= dens.length; i++) {
  const empty = i < dens.length && dens[i] < 1.5;
  if (empty && from == null) from = i;
  if (!empty && from != null) { holes.push([from / 4, i / 4]); from = null; }
}
const deadAir = holes.filter(([a, b]) => (a < 6 && b - a > 0.25) || b - a > brand.limits.maxDeadAir);

const after = run("ffmpeg", ["-hide_banner", "-i", final, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
const I = after.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1);
console.log(`\u2714 ${final}\n  ${dur.toFixed(1)}s, ${I ?? "loudness ?"}\n  contact sheet: ${sheet}`);
if (blacks.length) console.log(`\u26a0 black stretches: ${blacks.join(", ")} - check them on the contact sheet.`);
for (const [a, b] of deadAir) console.log(`\u2716 visual dead air ${a.toFixed(2)}-${b.toFixed(2)} s: nothing hero-sized on screen${a < 6 ? " in the hook" : ""}. That is where viewers skip.`);
if (deadAir.length) process.exitCode = 1;
