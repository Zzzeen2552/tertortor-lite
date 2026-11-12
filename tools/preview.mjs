// preview.mjs <slug> : persistent HyperFrames Studio preview (agent-safe), plus snapshots at every beat start.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { videoDir, readJSON } from "./lib.mjs";

const dir = videoDir(process.argv[2]);
const tl = readJSON(join(dir, "build", "timeline.json"));
const at = tl.beats.map((b) => (b.start + Math.min(1.2, b.duration * 0.6)).toFixed(2)).join(",");
spawnSync("npx", ["hyperframes", "snapshot", dir, "--at", at], { stdio: "inherit", shell: process.platform === "win32" });
spawnSync("npx", ["hyperframes", "preview", dir, "--background"], { stdio: "inherit", shell: process.platform === "win32" });
