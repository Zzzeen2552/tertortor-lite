// library.mjs: reusable footage database (generated on Google Flow, free stock, or any other source).
// Every clip is generated once, reused in many videos, and exportable as stock-video metadata.
//
//   node tools/library.mjs add <file.mp4> --prompt "..." --tags "malam,hp,tangan" --source google-flow [--model veo-3] [--license "..."] [--for storytelling/musafo]
// TERTORTOR shows the library under each channel/preset/product: a clip belongs to its --for place (category/sub) plus the
// place of every project it was used in (tools/categories.mjs → clipPlaces). Clips added without --for get it from first use.
//   node tools/library.mjs search <kata kunci...>
//   node tools/library.mjs use <id> <slug> <beat> [--start s] [--dur s]  -> normalised cut in videos/<slug>/assets/footage/<beat>.mp4 + sources.txt
//   node tools/library.mjs export                        -> library/stock-export.csv (title, keywords, prompt, AI disclosure)
import { existsSync, mkdirSync, copyFileSync, writeFileSync, appendFileSync } from "node:fs";
import { prepFootage } from "./prep-footage.mjs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ROOT, readJSON, writeJSON, die, run, probeDuration } from "./lib.mjs";

export const LIB = join(ROOT, "library");
export const DB = join(LIB, "footage.json");
const loadDb = () => (existsSync(DB) ? readJSON(DB) : { clips: [] });

export function addClip(file, meta = {}) {
  if (!existsSync(file)) die(`file not found: ${file}`);
  mkdirSync(join(LIB, "footage"), { recursive: true });
  const db = loadDb();
  const hash = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10);
  const dup = db.clips.find((c) => c.hash === hash);
  if (dup) return dup;
  const id = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${hash.slice(0, 6)}`;
  const dest = join(LIB, "footage", `${id}${extname(file).toLowerCase() || ".mp4"}`);
  copyFileSync(file, dest);
  const probe = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", dest]).stdout.trim().split(",");
  const thumb = join(LIB, "footage", `${id}.jpg`);
  run("ffmpeg", ["-y", "-v", "error", "-ss", "0.5", "-i", dest, "-frames:v", "1", "-vf", "scale=360:-1", thumb], { allowFail: true });
  const clip = {
    id,
    hash,
    file: `footage/${id}${extname(dest)}`,
    thumb: `footage/${id}.jpg`,
    prompt: meta.prompt ?? "",
    tags: (meta.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    source: meta.source ?? "unknown",
    model: meta.model ?? "",
    license: meta.license ?? (meta.source === "google-flow" ? "AI-generated (Google Flow), own account" : ""),
    sourceUrl: meta.url ?? "",
    width: +probe[0] || null,
    height: +probe[1] || null,
    duration: +probeDuration(dest).toFixed(2),
    created: new Date().toISOString(),
    usedIn: [],
    ...(meta.for ? (([category, sub]) => ({ category, sub }))(String(meta.for).split("/")) : {}),
  };
  db.clips.push(clip);
  writeJSON(DB, db);
  return clip;
}

export function searchClips(q = "") {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return loadDb().clips.filter((c) => {
    const hay = `${c.prompt} ${c.tags.join(" ")} ${c.source}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// The library keeps the ORIGINAL; each use gets its own composition-ready cut (1080x1920, 30 fps, silent),
// trimmed so the action lands on the beat's cue word, and a provenance line in the video's sources.txt.
export function useClip(id, slug, beat, { start = 0, dur } = {}) {
  const db = loadDb();
  const c = db.clips.find((x) => x.id === id);
  if (!c) die(`clip ${id} not in library`);
  const vdir = join(ROOT, "videos", slug);
  const out = join(vdir, "assets", "footage", `${beat}.mp4`);
  const r = prepFootage(join(LIB, c.file), out, { start, dur });
  if (!c.usedIn.some((u) => u.slug === slug && u.beat === beat)) c.usedIn.push({ slug, beat });
  writeJSON(DB, db);
  const ai = /flow|wavespeed|fal|ai/i.test(c.source);
  const line = `${beat}.mp4 | library ${c.id} | ${c.source}${c.model ? " (" + c.model + ")" : ""} | ${ai ? "AI-generated dramatisation, not a real incident" : "stock: " + (c.license || "?") + " " + (c.sourceUrl || "")} | trim ${start}s+${dur ?? "all"}
`;
  appendFileSync(join(vdir, "sources.txt"), line);
  // stock under an attribution licence (CC BY from Freesound/Mixkit/...): the credit goes into the post caption
  if (!ai && /attribution|cc[ -]by/i.test(c.license) && !/no attribution|cc0|creative commons 0|public domain/i.test(c.license)) {
    const cp = join(vdir, "credits.md");
    if (!existsSync(cp)) writeFileSync(cp, "# Kredit (tempel ke caption/deskripsi posting)\n\n");
    if (!readFileSync(cp, "utf8").includes(c.sourceUrl || c.id)) appendFileSync(cp, `- ${c.prompt.split(/[.,]/)[0].slice(0, 70) || c.id}, ${c.license}, via ${c.source}. ${c.sourceUrl}\n`);
  }
  console.log(`✔ ${id} -> videos/${slug}/assets/footage/${beat}.mp4 (${r.duration.toFixed(2)}s, logged in sources.txt)`);
}

function exportCsv() {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["Filename", "Title", "Keywords", "Description", "Width", "Height", "Duration", "AI generated", "Source", "Model"].join(",")];
  for (const c of loadDb().clips) {
    if (!/google-flow|wavespeed|ai/i.test(c.source)) continue; // only own generations are sellable; never resell stock
    const title = c.prompt.split(/[.,]/)[0].slice(0, 70);
    rows.push([c.file, title, c.tags.join("; "), c.prompt, c.width, c.height, c.duration, "yes", c.source, c.model].map(q).join(","));
  }
  writeFileSync(join(LIB, "stock-export.csv"), rows.join("\n") + "\n");
  console.log(`✔ library/stock-export.csv (${rows.length - 1} clips)`);
}

if (process.argv[1]?.endsWith("library.mjs")) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (n) => {
    const i = rest.indexOf(`--${n}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === "add") {
    if (opt("for") && !/^(explainer|storytelling|advertisement)\/[a-z0-9-]+$/.test(opt("for"))) die("--for <explainer|storytelling|advertisement>/<preset|channel|product>, mis. storytelling/musafo");
    const c = addClip(rest[0], { prompt: opt("prompt"), tags: opt("tags"), source: opt("source"), model: opt("model"), license: opt("license"), url: opt("url"), for: opt("for") });
    console.log(`✔ ${c.id}  ${c.width}x${c.height}  ${c.duration}s  [${c.tags.join(", ")}]`);
  } else if (cmd === "search") {
    for (const c of searchClips(rest.join(" "))) console.log(`${c.id}  ${c.duration}s  ${c.source}  [${c.tags.join(", ")}]  ${c.prompt.slice(0, 80)}`);
  } else if (cmd === "use") useClip(...rest);
  else if (cmd === "export") exportCsv();
  else die("Usage: library.mjs add|search|use|export ...");
}
