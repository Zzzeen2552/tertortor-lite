// new.mjs <slug> ["Topic"] [--preset <id>] [--accent #rrggbb] [--format vertical|horizontal]  -> videos/<slug>/ ready for script.md + beats.json
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, die, brandCss, loadBrand, listPresets, isHex, FRAMES } from "./lib.mjs";

const argv = process.argv.slice(2);
const pi = argv.indexOf("--preset");
const preset = pi >= 0 ? argv.splice(pi, 2)[1] : null;
const ai = argv.indexOf("--accent");
const accent = ai >= 0 ? argv.splice(ai, 2)[1] : null;
if (accent && !isHex(accent)) die("--accent must be #rrggbb");
const fi = argv.indexOf("--format");
const format = fi >= 0 ? argv.splice(fi, 2)[1] : "vertical";
if (!FRAMES[format]) die("--format must be vertical or horizontal");
const presetFormats = (preset && listPresets().find((p) => p.id === preset)?.formats) || ["vertical"];
if (!presetFormats.includes(format)) die(`preset ${preset ?? "default"} has no ${format} format (formats: ${presetFormats.join(", ")}).`);
const [slug, ...rest] = argv;
const topic = rest.join(" ");
if (preset && !listPresets().some((p) => p.id === preset)) die(`unknown preset "${preset}". Available: ${listPresets().map((p) => p.id).join(", ")}`);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) die('Usage: npm run new -- <slug-kebab-case> "Topic"');
const dir = join(ROOT, "videos", slug);
if (existsSync(dir)) die(`videos/${slug} already exists.`);

for (const d of ["compositions", "assets/screens", "assets/footage", "assets/frames", "assets/sfx", "voice", "build", "out"]) mkdirSync(join(dir, d), { recursive: true });
// meta first: brandCss reads the preset from it
writeFileSync(join(dir, "meta.json"), JSON.stringify({ id: slug, name: topic || slug, ...(preset ? { preset } : {}), ...(accent ? { accent } : {}), ...(format !== "vertical" ? { format } : {}) }, null, 2));
const F = FRAMES[format];
const idx = readFileSync(join(ROOT, "templates", "vertical", "index.html"), "utf8").replace(/\/\*@brand\*\/[\s\S]*?\/\*@end\*\//, () => brandCss(loadBrand(dir)))
  .replace('data-resolution="portrait"', `data-resolution="${F.resolution}"`)
  .replaceAll("width=1080, height=1920", `width=${F.w}, height=${F.h}`)
  .replaceAll("width: 1080px; height: 1920px", `width: ${F.w}px; height: ${F.h}px`)
  .replaceAll('data-width="1080" data-height="1920"', `data-width="${F.w}" data-height="${F.h}"`);
writeFileSync(join(dir, "index.html"), idx);
cpSync(join(ROOT, "templates", "vertical", "brief.md"), join(dir, "brief.md"));
writeFileSync(join(dir, "brief.md"), readFileSync(join(dir, "brief.md"), "utf8").replace("__TOPIC__", topic));
cpSync(join(ROOT, "templates", "vertical", "script.md"), join(dir, "script.md"));
cpSync(join(ROOT, "templates", "vertical", "beats.json"), join(dir, "beats.json"));
writeFileSync(join(dir, "hyperframes.json"), JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }, null, 2));
writeFileSync(join(dir, "costs.md"), `# Biaya: ${slug}\n\n| Item | Detail | USD |\n| --- | --- | --- |\n`);
console.log(`✔ videos/${slug}/ created. Next: write brief.md, script.md, beats.json.`);
