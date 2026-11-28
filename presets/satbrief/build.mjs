// Writes presets/satbrief/preset.css into preset.json -> css. Run after editing the CSS:
//   node presets/satbrief/build.mjs
import fs from "node:fs";
const dir = new URL(".", import.meta.url);
const css = fs.readFileSync(new URL("preset.css", dir), "utf8").replace(/^\/\*[^*]*\*\/\s*/, "").trim();
const file = new URL("preset.json", dir);
const p = JSON.parse(fs.readFileSync(file, "utf8"));
p.css = css;
fs.writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
console.log("preset.json css:", css.length, "chars");
