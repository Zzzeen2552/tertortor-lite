// sfx.mjs: builds the house sound-effect kit in library/sfx/ from pure math (ffmpeg aevalsrc / seeded noise).
// Free, deterministic, no licence questions. cues.mjs places them on cuts and word marks automatically.
//   node tools/sfx.mjs            (re-run any time; existing files are kept unless --force)
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run } from "./lib.mjs";

export const SFX_DIR = join(ROOT, "library", "sfx");
const KIT = {
  // soft air on a cut
  whoosh: ["-f", "lavfi", "-i", "anoisesrc=color=pink:seed=7:amplitude=0.6:duration=0.42", "-af", "highpass=f=500,lowpass=f=5200,afade=t=in:d=0.24:curve=qsin,afade=t=out:st=0.24:d=0.18,volume=0.9"],
  // low body hit for a slam / reveal
  thump: ["-f", "lavfi", "-i", "aevalsrc='0.9*sin(2*PI*(48+90*exp(-t*28))*t)*exp(-t*8)':s=44100:d=0.55"],
  // heavier hit: thump plus a short noise transient
  hit: ["-f", "lavfi", "-i", "aevalsrc='0.85*sin(2*PI*(46+120*exp(-t*30))*t)*exp(-t*7)':s=44100:d=0.6", "-f", "lavfi", "-i", "anoisesrc=color=white:seed=3:amplitude=0.5:duration=0.6", "-filter_complex", "[1:a]lowpass=f=3000,afade=t=out:st=0:d=0.07[n];[0:a][n]amix=inputs=2:normalize=0"],
  // UI-ish tap, tick, toggle
  tick: ["-f", "lavfi", "-i", "aevalsrc='0.6*sin(2*PI*2300*t)*exp(-t*95)':s=44100:d=0.08"],
  // small positive pop for an element landing
  pop: ["-f", "lavfi", "-i", "aevalsrc='0.7*sin(2*PI*(520+900*exp(-t*38))*t)*exp(-t*22)':s=44100:d=0.18"],
  // rising tension into a reveal
  riser: ["-f", "lavfi", "-i", "anoisesrc=color=pink:seed=11:amplitude=0.5:duration=1.2", "-af", "highpass=f=300,lowpass=f=6000,afade=t=in:d=1.15:curve=exp,afade=t=out:st=1.12:d=0.08"],
};

export function buildKit(force = false) {
  mkdirSync(SFX_DIR, { recursive: true });
  for (const [name, a] of Object.entries(KIT)) {
    const out = join(SFX_DIR, `${name}.wav`);
    if (existsSync(out) && !force) continue;
    const tmp = out.replace(/\.wav$/, ".tmp.wav");
    run("ffmpeg", ["-y", "-v", "error", ...a, "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", tmp]);
    // every effect peaks at -3 dBFS, so per-sound volumes in brand.json mean the same thing for all of them
    const peak = +run("ffmpeg", ["-hide_banner", "-i", tmp, "-af", "volumedetect", "-f", "null", "-"]).stderr.match(/max_volume: (-?[\d.]+) dB/)[1];
    run("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${(-3 - peak).toFixed(2)}dB`, "-c:a", "pcm_s16le", out]);
    rmSync(tmp);
  }
  return Object.keys(KIT);
}

if (process.argv[1]?.endsWith("sfx.mjs")) console.log(`✔ library/sfx: ${buildKit(process.argv.includes("--force")).join(", ")}`);
