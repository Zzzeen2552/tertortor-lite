// check.mjs <slug> : cues -> retention lint -> HyperFrames check. One gate before any render.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, videoDir } from "./lib.mjs";

const slug = process.argv[2];
const dir = videoDir(slug);
const step = (label, cmd, args) => {
  console.log(`\n\u25b6 ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n\u2716 ${label} failed. Fix it before rendering.`);
    process.exit(1);
  }
};
step("cues (re-time from words)", "node", [join(ROOT, "tools", "cues.mjs"), slug]);
step("retention lint", "node", [join(ROOT, "tools", "lint-video.mjs"), slug]);
step("hyperframes check", "npx", ["hyperframes", "check", dir]);
console.log("\n\u2714 all gates passed");
