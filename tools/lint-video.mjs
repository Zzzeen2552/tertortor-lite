// lint-video.mjs <slug>
// Retention gates. Exits non-zero on any error: a failed lint costs seconds, a flop costs a day of reach.
// Runs after `cues` (needs build/timeline.json) and before `npx hyperframes check`.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { videoDir, readJSON, norm, numberIsSpoken, loadBrand } from "./lib.mjs";

const slug = process.argv[2];
const dir = videoDir(slug);
const brand = loadBrand(dir);
const L = brand.limits;
const errors = [];
const warns = [];
const err = (code, msg) => errors.push(`${code}: ${msg}`);
const warn = (code, msg) => warns.push(`${code}: ${msg}`);

const tlPath = join(dir, "build", "timeline.json");
if (!existsSync(tlPath)) {
  console.error("build/timeline.json missing: run `npm run cues -- " + slug + "` first.");
  process.exit(1);
}
const tl = readJSON(tlPath);
const words = readJSON(join(dir, "voice", "words.json"));
const plan = readJSON(join(dir, "beats.json"));
const beats = tl.beats;

// 1. length
// Musafo: 90 s per video; a longer story becomes a series (tools/musafo.mjs series)
const storyKind = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")).type : null;
const isMusafoVideo = ["musafo", "berakitkehulu", "bumidipijak", "miracleofhajj"].includes(storyKind); // story types (tools/musafo.mjs)
const ownMax = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")).maxSeconds : null; // long Musafo the user asked for (user 2026-11-07)
const maxSeconds = isMusafoVideo ? Math.min(ownMax ?? (storyKind === "miracleofhajj" ? brand.miracleofhajj?.maxSeconds : null) ?? brand.musafo?.maxSeconds ?? 90, L.maxSeconds) : L.maxSeconds;
if (tl.duration > maxSeconds) err("too-long", `${tl.duration.toFixed(1)}s > ${maxSeconds}s. ${isMusafoVideo ? "Split it into a series (node tools/musafo.mjs series)" : "Cut a step"}; never speed the voice up.`);
if (tl.duration < L.minSeconds) warn("too-short", `${tl.duration.toFixed(1)}s: under ${L.minSeconds}s you are posting a trailer for advice you never give.`);

// 2. beat plan completeness
// one take (Docucine): the hero of a line is a real photo or document lying in the world, or a word / mark on it
const REG = brand.oneTake ? ["photo", "document", "map", "drawn", "type"] : ["footage", "screen", "drawn", "type"];
for (const b of beats) {
  if (!b.job) err("no-job", `beat ${b.id} has no job.`);
  if (!b.hero) err("no-hero", `beat ${b.id} has no hero: this is where people skip.`);
  if (/\s(and|dan|\+)\s/i.test(b.hero ?? "")) warn("two-heroes", `beat ${b.id} hero "${b.hero}" looks like two heroes: split the beat.`);
  if (!REG.includes(b.register)) err("register", `beat ${b.id} register must be one of ${REG.join("|")}.`);
  // story videos: one shot = one moving clip of up to 15 s, slowed down at most ×1.8 to fill its narration (user 2026-11-07,
  // the same limit as tools/musafo.mjs check)
  const maxBeat = isMusafoVideo ? (brand.musafo?.maxShotSeconds ?? 15) * 1.8 : L.maxBeatSeconds;
  if (b.duration > maxBeat) err("card-outstays", `beat ${b.id} holds ${b.duration.toFixed(1)}s (> ${maxBeat.toFixed(1)}s). Split it or add a change on a word mark.`);
  if (b.duration < L.minBeatSeconds) warn("flash-beat", `beat ${b.id} is only ${b.duration.toFixed(2)}s.`);
}

// 3. same framing twice in a row = not a cut (one take has no cuts: the camera moves to the next hero instead)
for (let i = 1; i < beats.length && !brand.oneTake; i++) {
  if (beats[i].framing && beats[i].framing === beats[i - 1].framing && beats[i].register === beats[i - 1].register)
    err("same-framing", `${beats[i - 1].id} -> ${beats[i].id} both "${beats[i].register}/${beats[i].framing}". A cut to an identical picture isn't a cut.`);
}

// 4. hook belongs to the viewer's problem, not the mascot
for (const b of beats) if (b.character && b.start < L.noCharacterBefore) err("character-in-hook", `beat ${b.id} shows the character before ${L.noCharacterBefore}s.`);
if (beats[0]?.register === "type" && beats[0].framing === "title") warn("logo-hook", "first beat looks like a title card; frame 0 should be the problem or the result.");

// 5. footage budget: only threat / real-event beats get generated footage
const footage = beats.filter((b) => b.register === "footage").reduce((s, b) => s + b.duration, 0);
// Musafo is footage from start to end by design (one clip per shot)
if (footage > L.maxFootageSeconds && !isMusafoVideo) warn("footage-budget", `${footage.toFixed(1)}s of generated footage (> ${L.maxFootageSeconds}s). Put money only on beats that carry a feeling.`);

// 6. dead air: silence in the voice with no beat change
for (let i = 0; i < words.length - 1; i++) {
  const gap = words[i + 1].start - words[i].end;
  if (gap > L.maxDeadAir) {
    const changes = beats.some((b) => b.start > words[i].end - 0.1 && b.start < words[i + 1].start + 0.1);
    (changes ? warn : err)("dead-air", `${gap.toFixed(2)}s silence at ${words[i].end.toFixed(2)}s after "${words[i].text}"${changes ? " (a beat cuts there)" : ""}.`);
  }
}

// 7. every number on screen is spoken
const spoken = " " + words.map((w) => norm(w.text)).join(" ") + " ";
const lang = brand.voice.languageCode || "en";
const compDir = join(dir, "compositions");
for (const f of readdirSync(compDir).filter((f) => f.endsWith(".html") && f !== "captions.html")) {
  const visible = readFileSync(join(compDir, f), "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");
  for (const raw of visible.match(/\d[\d.,]*/g) || []) {
    if (!numberIsSpoken(raw, spoken, lang)) err("unspoken-number", `"${raw}" is on screen in ${f} but never said out loud.`);
  }
}

// 9. dangling animation targets: GSAP silently no-ops on a missing id, so the beat never renders and every check passes
const sources = existsSync(join(dir, "sources.txt")) ? readFileSync(join(dir, "sources.txt"), "utf8") : "";
for (const f of readdirSync(compDir).filter((f) => f.endsWith(".html") && f !== "captions.html")) {
  const s = readFileSync(join(compDir, f), "utf8").replace(/<!--[\s\S]*?-->/g, ""); // placeholders in comments are not wiring
  const ids = new Set([...s.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
  for (const m of s.matchAll(/tl\.(?:fromTo|to|set)\(\s*"([^"]+)"/g))
    for (const sel of m[1].split(","))
      for (const id of [...sel.matchAll(/#([\w-]+)/g)].map((x) => x[1]))
        if (!ids.has(id)) err("dangling-target", `${f}: "#${id}" is animated but no element has that id; the beat silently never renders.`);

  // 10. footage wiring: a <video> that is hidden in CSS or faded by GSAP renders BLACK and `hyperframes check` still passes
  for (const tag of s.match(/<video\b[^>]*>/g) || []) {
    const id = tag.match(/\sid="([\w-]+)"/)?.[1];
    const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
    if (!id) { err("footage-wiring", `${f}: a <video> has no id.`); continue; }
    if (!/\smuted\b/.test(tag)) err("footage-wiring", `${f}: #${id} must be muted (sound goes in a separate <audio>).`);
    if (src && !existsSync(join(dir, src))) err("footage-wiring", `${f}: #${id} src ${src} does not exist.`);
    const css = s.match(new RegExp(`#${id}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    if (/opacity\s*:\s*0(?![.\d])|visibility\s*:\s*hidden/.test(css)) err("footage-wiring", `${f}: #${id} is hidden in its CSS; it will render black under the overlay.`);
    if (new RegExp(`tl\\.(?:fromTo|to|set)\\(\\s*"[^"]*#${id}\\b[^"]*"[^;]*(?:autoAlpha|opacity)`).test(s)) err("footage-wiring", `${f}: GSAP fades #${id}; fade its wrapper or the overlay instead.`);
  }

  // 11. provenance: every real screenshot, Commons file and piece of footage is logged in sources.txt
  for (const m of s.matchAll(/(?:src|href)="(assets\/(?:screens|footage|frames|keyvisuals|commons)\/[^"]+)"/g)) {
    const base = m[1].split("/").pop();
    if (!sources.includes(base)) err("unlogged-source", `${f}: ${m[1]} has no line in sources.txt (where it came from; generated footage must say it is generated, not a real incident).`);
  }
}

// 12. never fake a user interface: a "screen" beat shows a REAL screenshot or no screen at all
for (const b of beats.filter((b) => b.register === "screen")) {
  const f = join(compDir, `${b.id}.html`);
  const s = existsSync(f) ? readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, "") : "";
  if (!/<img[^>]+src="assets\/screens\//.test(s)) warn("no-real-screen", `beat ${b.id} is register "screen" but shows no real screenshot yet (assets/screens/${b.id}.png). Never ship a drawn or generated UI.`);
}

// 13. one take: every beat needs its camera stop in world.html (SHOTS.<id>), or the camera skips its hero
if (brand.oneTake) {
  const w = existsSync(join(compDir, "world.html")) ? readFileSync(join(compDir, "world.html"), "utf8") : "";
  if (!w) err("no-world", "one-take preset but compositions/world.html is missing: run cues.");
  for (const b of beats) if (w && !new RegExp(`\\b${b.id}\\s*:\\s*\\{`).test(w)) err("no-shot", `world.html: beat ${b.id} has no camera stop in SHOTS ({ ${b.id}: { at: "...", z: ... } }).`);
}

// 8. platform-safe band (static check on hard-coded top values in scene CSS)
for (const f of readdirSync(compDir).filter((f) => f.endsWith(".html"))) {
  const s = readFileSync(join(compDir, f), "utf8");
  for (const m of s.matchAll(/data-safe="text"[^>]*style="[^"]*top:\s*(\d+)px/g)) {
    const y = +m[1];
    if (y < brand.safe.top || y > brand.safe.bottom) err("unsafe-text", `${f}: text at top:${y}px is outside the ${brand.safe.top}-${brand.safe.bottom}px band.`);
  }
}

if (plan.beats.length !== beats.length) err("stale-timeline", "beats.json changed since the last `cues` run.");

for (const w of warns) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✖ ${e}`);
console.log(`${errors.length} error(s), ${warns.length} warning(s) - ${beats.length} beats, ${tl.duration.toFixed(1)}s, footage ${footage.toFixed(1)}s`);
process.exit(errors.length ? 1 : 0);
