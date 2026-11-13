// TERTORTOR: the dashboard of the MOTION video factory. The simplest possible front door.
// Enter an idea/storyline + a reference video + key visuals -> a new videos/<slug>/ ready for Claude.
// Also lists every video's stage and plays finished renders, and browses the reusable footage library.
//   npm run studio   ->  http://localhost:4331
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, statSync, createReadStream, createWriteStream, renameSync, unlinkSync } from "node:fs";
import { join, extname, normalize, basename } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { ROOT, spokenText, loadBrand, listPresets, presetOf, isHex } from "../lib.mjs";
import { approval, approve, unapprove, checkFlow, loadFlow } from "../flow.mjs";
import { checkConcepts, pickConcept, refFiles } from "../ref.mjs";
import { isMusafo, checkMusafo, createMusafo, STORY_TYPES, storyType, storylineApproval, approveStoryline, loadHooks, checkHooks, editScript, fillEnglish, sourceFlowErrors, draftApproval, saveDraft, approveDraft, productionState, startProduction, saveStoryline, charRefs, charSheet, looksOf, setLook } from "../musafo.mjs";
import { editScriptMd, scriptParagraphs, pendingEdits } from "../script-edit.mjs";
import { working, finished, claudeWaiting } from "../progress.mjs";
import { state as chatState, send as chatSend, stop as chatStop, reset as chatReset } from "../studio-chat.mjs";
import { KINDS as FORMAT_KINDS, listFormats, sourceOf as formatSource } from "../formats.mjs";
import { createVariant, variantsOf } from "../variant.mjs";
import { VARIANT_KINDS } from "../lib.mjs";
const formatJobs = new Map(); // slug -> running tools/formats.mjs child
import { share, revoke, shareInfo } from "../share.mjs";
import { listBooks, loadBook, useStory, readJob, listChannels, addChannel, channelOf, fetchArticle, sourceToLibrary } from "../stories.mjs";
import { structure, placeOf, clipPlaces, addSub, subDir, listProducts } from "../categories.mjs";
import { isAd, loadAd, create as createAd, importAsset, ASSET_KINDS, importAudio, AUDIO_KINDS } from "../ad.mjs";
import { channelLogo, logoFile, saveLogo, removeLogo } from "../brandmark.mjs";
import { hasKey as bufferKey, keyInfo as bufferKeyInfo, setKey as setBufferKey, removeKey as removeBufferKey, writeCaption as writeBufferCaption, hasCaption as bufferHasCaption, captionTitle as bufferTitle, listBufferChannels, subBuffer, saveSubBuffer, forward as bufferForward, sentLog as bufferLog, defaultText as bufferText, MODES as BUFFER_MODES } from "../buffer.mjs";
import { settings as thumbSettings, backgrounds as thumbBackgrounds, stale as thumbStale, thumbPng, loadThumb, episodeOf } from "../thumbnail.mjs";

const PORT = +(process.env.PORT || 4331);
const VIDEOS = join(ROOT, "videos");
const TRASH = join(VIDEOS, ".trash"); // deleted videos (Studio "Hapus video"), gitignored
// Windows refuses to move a folder while a file inside is open (a video still streaming): retry for ±4 s
async function moveDir(from, to) {
  for (let i = 0; ; i++) {
    try { return renameSync(from, to); }
    catch (e) { if (i >= 8 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e; await new Promise((ok) => setTimeout(ok, 500)); }
  }
}
const LIB = join(ROOT, "library");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".csv": "text/csv", ".ico": "image/x-icon" };

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { const b = []; req.on("data", (d) => b.push(d)); req.on("end", () => ok(Buffer.concat(b))); });
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";
const safeName = (s) => basename(s).replace(/[^\w.\-]+/g, "_").slice(0, 80);

// Musafo projects (meta.json type "musafo"): story -> script -> voice -> one image + one clip per shot -> render
function musafoStage(slug) {
  const d = join(VIDEOS, slug);
  const r = checkMusafo(d);
  const req = existsSync(join(d, "request.json")) ? JSON.parse(readFileSync(join(d, "request.json"), "utf8")) : {};
  const src = existsSync(join(d, "voice", "source.json")) ? JSON.parse(readFileSync(join(d, "voice", "source.json"), "utf8")) : null;
  const ap = approval(d);
  const done = r.steps.filter((s) => s.ok).length;
  const f = (p) => (existsSync(join(d, p)) ? `/files/videos/${slug}/${p}` : null);
  const frames = r.data.shots.map((s) => f(`assets/frames/${s.id}.png`)).filter(Boolean);
  return {
    slug, type: storyType(d),
    title: req.title || slug,
    created: req.created || statSync(d).birthtime.toISOString(),
    steps: r.steps, progress: done / r.steps.length,
    next: r.steps.find((s) => !s.ok)?.name.replace(/ .*/, "") ?? "Selesai",
    video: f(`out/${slug}.mp4`), sheet: f("out/contact-sheet.png"),
    cover: frames[0] ?? null, keyvisuals: frames, reference: [],
    idea: req.story || "", preset: presetOf(d),
    draftVoice: !!src?.draft,
    // shots written before the current storyline was approved are an old draft, not something to approve
    scriptState: r.data.shots.length ? (!storylineApproval(d).approved ? "old" : ap.approved ? "approved" : ap.stale ? "stale" : "waiting") : "none",
    // the user's move: approve the storyline Claude drew from the raw material
    // story with a source text: draft first (user 2026-11-07), then storyline
    waiting: (() => { const dr = draftApproval(d); if (dr.written && !dr.approved) return "Setujui draft"; if (dr.needed && !dr.approved) return null; const sa = storylineApproval(d); return sa.written && !sa.approved ? "Setujui storyline" : null; })(),
  };
}

// every project carries its place in the style tree (category + preset/channel/product), derived from meta.json
function stage(slug) {
  const d = join(VIDEOS, slug);
  return { ...(isMusafo(d) ? musafoStage(slug) : isAd(d) ? adStage(slug) : explainerStage(slug)), ...placeOf(d), share: shareInfo(d, slug), shareJob: shareJobs.get(slug) ?? null, thumbnail: thumbInfo(d, slug), watermark: watermarkInfo(d), buffer: bufferInfo(d) };
}

// Advertisement (meta.json type "advertisement", tools/ad.mjs): product photos -> shots in ad.json -> gate -> render
// thumbnail (tools/thumbnail.mjs) and channel watermark (tools/brandmark.mjs), user 2026-11-07
function thumbInfo(d, slug) {
  const png = thumbPng(d);
  return {
    ...thumbSettings(d),
    episodeDefault: episodeOf(d),
    backgrounds: thumbBackgrounds(d).map((p) => ({ path: p, url: `/files/videos/${slug}/${p}` })),
    url: existsSync(png) ? `/files/videos/${slug}/out/thumbnail.png?t=${Math.round(statSync(png).mtimeMs)}` : null,
    stale: thumbStale(d),
    ...coverState(d, slug),
  };
}
// The cover (thumbnail in front of the video) is baked into out/<slug>.mp4 by finish. Saving a thumbnail never touches the
// video: the user approves it with "Render video" in the Thumbnail tab (user 2026-11-09). With a current out/raw.mp4 that
// is finish --skip-render (cover + loudness + contact sheet, ±1 min, no HyperFrames render); when the scenes changed after
// raw.mp4, or there is no render yet, it is the full finish. One run per slug.
const coverJobs = new Map();
const shareJobs = new Map(); // share link uploads running in the background, per slug
function rawCurrent(d) {
  const raw = join(d, "out", "raw.mp4");
  if (!existsSync(raw)) return false;
  const t = statSync(raw).mtimeMs;
  // media counts too (user 2026-11-10: clips added after a render left raw.mp4 "current" with the old stills)
  const dirFiles = (sub) => (existsSync(join(d, sub)) ? readdirSync(join(d, sub)).filter((f) => !statSync(join(d, sub, f)).isDirectory()).map((f) => join(sub, f)) : []);
  const srcs = ["index.html", "captions.html", "voice.wav", ...dirFiles("compositions"), ...dirFiles("assets/footage"), ...dirFiles("assets/frames")];
  return srcs.every((f) => !existsSync(join(d, f)) || statSync(join(d, f)).mtimeMs <= t);
}
function coverState(d, slug) {
  const fin = join(d, "out", `${slug}.mp4`), png = thumbPng(d);
  const job = coverJobs.get(slug);
  return {
    videoRendering: job ? job.mode : null,
    videoError: job?.error ?? null,
    videoBehind: !job?.mode && existsSync(fin) && ((existsSync(png) && statSync(png).mtimeMs > statSync(fin).mtimeMs) || !rawCurrent(d)),
    rendered: existsSync(fin),
    renderMode: rawCurrent(d) ? "cover" : "full",
  };
}
function renderVideo(d, slug) {
  if (coverJobs.get(slug)?.mode) return coverJobs.get(slug).mode;
  const mode = rawCurrent(d) ? "cover" : "full";
  const job = { mode, error: null };
  coverJobs.set(slug, job);
  runTool([join(ROOT, "tools", "finish.mjs"), slug, ...(mode === "cover" ? ["--skip-render"] : [])]).then((r) => {
    job.mode = null;
    if (r.code === 0) coverJobs.delete(slug);
    else job.error = r.out.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(" ") || "render gagal";
    console.log(`render ${slug} (${mode}): ${r.code === 0 ? "selesai" : job.error}`);
  });
  return mode;
}
// Buffer (tools/buffer.mjs): the sub's targets, the caption to start from, and what was already sent
function bufferInfo(d) {
  const { category, sub } = placeOf(d);
  return { ...bufferKeyInfo(sub), ...subBuffer(category, sub), text: bufferText(d), caption: bufferHasCaption(d), title: bufferTitle(d), sent: bufferLog(d).slice(-5), modes: BUFFER_MODES };
}
function watermarkInfo(d) {
  const { category, sub } = placeOf(d);
  const meta = existsSync(join(d, "meta.json")) ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")) : {};
  return { logo: !!sub && existsSync(logoFile(category, sub)), off: meta.watermark === false, on: !!channelLogo(d) };
}
// tools run as a child so a slow Gemini call or snapshot does not block the server
const runTool = (args) => new Promise((ok) => {
  const c = spawn(process.execPath, args, { cwd: ROOT });
  let out = "";
  c.stdout.on("data", (b) => (out += b)); c.stderr.on("data", (b) => (out += b));
  c.on("close", (code) => ok({ code, out }));
});

function adStage(slug) {
  const d = join(VIDEOS, slug);
  const has = (p) => existsSync(join(d, p));
  const ad = loadAd(d) ?? { shots: [] };
  const req = has("request.json") ? JSON.parse(readFileSync(join(d, "request.json"), "utf8")) : {};
  const photos = has("assets/products") ? readdirSync(join(d, "assets", "products")).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : [];
  const meta = has("meta.json") ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")) : {};
  const product = meta.product ?? ad.product ?? "flashcut";
  // key-visual products (BRI): client KV -> Flow clip -> one composition (advertisement/<product>/style.md)
  const kvForm = listProducts().find((x) => x.id === product)?.form === "kv";
  const appForm = listProducts().find((x) => x.id === product)?.form === "appdemo";
  const demo = appForm && has("demo.json") ? JSON.parse(readFileSync(join(d, "demo.json"), "utf8")) : null;
  const steps = appForm ? [
    { name: "Screenshot", ok: photos.some((p) => /^ui-/.test(p)) },
    { name: "Storyboard", ok: (demo?.scenes?.length ?? 0) > 0 },
    { name: "Komposisi", ok: has("compositions/demo.html") },
    { name: "Render", ok: has(`out/${slug}.mp4`) },
  ] : kvForm ? [
    { name: "Key visual", ok: photos.some((p) => /^kv-/.test(p)) || has("assets/keyvisuals") },
    { name: "Klip", ok: has("assets/footage/family.mp4") },
    { name: "Komposisi", ok: has("compositions/kv.html") },
    { name: "Render", ok: has(`out/${slug}.mp4`) },
  ] : [
    { name: "Foto produk", ok: photos.length > 0 },
    { name: "Shot", ok: ad.shots.length > 0 && ad.shots.at(-1)?.register === "endcard" },
    { name: "Gerbang", ok: has("build/timeline.json") },
    { name: "Render", ok: has(`out/${slug}.mp4`) },
  ];
  const f = (p) => (has(p) ? `/files/videos/${slug}/${p}` : null);
  const kvShots = kvForm && has("assets/keyvisuals") ? readdirSync(join(d, "assets", "keyvisuals")).filter((x) => /\.(png|jpe?g|webp)$/i.test(x)).sort((a, b) => /^kv-foto/.test(b) - /^kv-foto/.test(a)).map((x) => `assets/keyvisuals/${x}`) : [];
  return {
    slug, title: req.title || ad.name || JSON.parse(readFileSync(join(d, "meta.json"), "utf8")).name || slug,
    created: req.created || statSync(d).birthtime.toISOString(),
    steps, progress: steps.filter((s) => s.ok).length / steps.length, next: steps.find((s) => !s.ok)?.name ?? "Selesai",
    video: f(`out/${slug}.mp4`), sheet: f("out/contact-sheet.png"),
    cover: photos.length ? f(`assets/products/${photos.find((p) => /hero|^kv-|^ui-1./.test(p)) ?? photos[0]}`) : kvShots.length ? f(kvShots[0]) : null,
    keyvisuals: [...photos.map((p) => `/files/videos/${slug}/assets/products/${p}`), ...kvShots.map((p) => `/files/videos/${slug}/${p}`)], reference: [],
    idea: ad.notes ?? req.notes ?? "", preset: product, draftVoice: false, scriptState: "none", waiting: null, ad: true,
  };
}

const metaOf = (d) => (existsSync(join(d, "meta.json")) ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")) : {});

function explainerStage(slug) {
  const d = join(VIDEOS, slug);
  const has = (p) => existsSync(join(d, p));
  const script = has("script.md") ? readFileSync(join(d, "script.md"), "utf8").split(/\r?\n/).filter((l) => l.trim() && !/^\s*[#>]/.test(l)) : [];
  const realScript = script.length > 2;
  // a draft voice (estimate / system TTS) does not count: the video still needs its real voice
  const src = has("voice/source.json") ? JSON.parse(readFileSync(join(d, "voice", "source.json"), "utf8")) : null;
  const voice = !has("voice/words.json") ? "none" : src?.draft ? "draft" : "ok";
  const ap = realScript ? approval(d) : { approved: false, stale: false };
  const flow = ap.approved ? checkFlow(d) : null;
  const req = has("request.json") ? JSON.parse(readFileSync(join(d, "request.json"), "utf8")) : {};
  const oneTake = isOneTake(d);
  // with a reference video, Claude offers 2-3 concepts and the user picks one before the script
  const withRef = refFiles(d).length > 0 || has("concepts.json") || !!req.refLink;
  const concepts = withRef ? checkConcepts(d) : null;
  const steps = [
    ["Brief", has("brief.md")],
    ...(withRef ? [["Konsep", !!req.concept]] : []),
    ["Naskah", realScript && ap.approved],
    ...(oneTake ? [["Suara", voice === "ok"], ["Beat table", voice === "ok" && beatsApproval(d).approved], ["Dunia", has("compositions/world.html") && beatsApproval(d).approved]]
      : [["Prompt Flow", !!flow && !flow.errors.length], ["Suara", voice === "ok"], ["Beat & scene", has("build/timeline.json")]]),
    ["Render", has(`out/${slug}.mp4`) && voice === "ok"],
  ];
  const done = steps.filter((s) => s[1]).length;
  const list =(sub) => (has(sub) ? readdirSync(join(d, sub)).filter((f) => !f.startsWith(".")) : []);
  return {
    slug,
    title: req.title || (has("meta.json") ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")).name : slug),
    created: req.created || statSync(d).birthtime.toISOString(),
    steps: steps.map(([name, ok]) => ({ name, ok })),
    progress: done / steps.length,
    next: steps.find((s) => !s[1])?.[0] ?? "Selesai",
    video: has(`out/${slug}.mp4`) ? `/files/videos/${slug}/out/${slug}.mp4` : null,
    sheet: has("out/contact-sheet.png") ? `/files/videos/${slug}/out/contact-sheet.png` : null,
    keyvisuals: list("assets/keyvisuals").map((f) => `/files/videos/${slug}/assets/keyvisuals/${f}`),
    reference: list("assets/reference").filter((f) => /\.(mp4|mov|webm)$/i.test(f)).map((f) => `/files/videos/${slug}/assets/reference/${f}`),
    idea: req.idea || "",
    wide: metaOf(d).format === "horizontal",
    oneTake,
    sourceError: req.sourceError ?? null,
    preset: presetOf(d),
    accent: has("meta.json") ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")).accent ?? null : null,
    draftVoice: voice === "draft",
    scriptState: realScript ? (ap.approved ? "approved" : ap.stale ? "stale" : "waiting") : "none",
    waiting: concepts && !concepts.errors.length && !req.concept ? "Pilih konsep"
      : oneTake && realScript && !ap.approved ? "Setujui naskah"
      : oneTake && voice === "ok" && has("build/timeline.json") && !beatsApproval(d).approved ? "Setujui beat table" : null,
  };
}

// a story type's own default voice (brand.json → <type>.voice), e.g. BumiDiPijak = Kira (user 2026-11-08)
const typeVoice = (brand, type) => (type && brand[type]?.voice) || {};

function createVideo({ title, idea, duration, voice = "Gemini TTS", voiceSpeaker, preset, accent, refLink, format }) {
  let slug = slugify(title);
  for (let i = 2; existsSync(join(VIDEOS, slug)); i++) slug = `${slugify(title)}-${i}`;
  const okPreset = listPresets().some((p) => p.id === preset);
  // 9:16 or 16:9, only where the preset offers it (preset.json "formats", Docucine; user 2026-11-09)
  const okFormat = okPreset && format && (listPresets().find((p) => p.id === preset).formats ?? ["vertical"]).includes(format);
  const r = spawnSync("node", [join(ROOT, "tools", "new.mjs"), slug, title, ...(okPreset ? ["--preset", preset] : []), ...(isHex(accent) ? ["--accent", accent] : []), ...(okFormat ? ["--format", format] : [])], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const d = join(VIDEOS, slug);
  for (const sub of ["assets/reference", "assets/keyvisuals"]) mkdirSync(join(d, sub), { recursive: true });
  const req = { title, idea, duration, voice, ...(voiceSpeaker ? { voiceSpeaker } : {}), refLink: refLink || "", created: new Date().toISOString(), status: "menunggu Claude" };
  writeFileSync(join(d, "request.json"), JSON.stringify(req, null, 2));
  writeFileSync(
    join(d, "brief.md"),
    `# Brief: ${title}

> Dibuat dari TERTORTOR. Claude: lengkapi bagian kosong dari ide di bawah, lalu ikuti /video-vertikal.

## Ide / konsep / storyline (dari user, jangan diubah)

${idea.trim()}

## Masukan
- **Target durasi:** ${duration} detik (maks 179)
- **Suara:** ${voice}
- **Video referensi:** ${refLink ? refLink + " (link)" : "lihat assets/reference/"} — gaya, tempo, dan cara buka hook yang ditiru; bukan isinya. Data terukur di assets/reference/*.ref.md (npm run ref); Claude menawarkan 2-3 konsep (concepts.json) dan user memilih satu sebelum naskah.
- **Key visual:** assets/keyvisuals/ — wajib muncul / jadi first frame footage / acuan look.

## Diisi Claude
- **Penonton:**
- **Masalah (hook):**
- **Janji:**
- **Langkah:**
- **CTA:**
- **Bahan nyata (screen):**
- **Footage (cek library dulu, lalu Google Flow):**
`,
  );
  return slug;
}

// Every user decision in Studio (spot, key visual, concept, script approval) is appended to .events.jsonl. A Claude
// session waiting with `node tools/wait-event.mjs` in the background wakes on it and continues that project.
const EVENTS = join(ROOT, ".events.jsonl");

// finished work → a push notification on the user's phone through the web relay (user 2026-11-07). Studio stays the
// only place that knows a project's state; the relay only stores the notice and sends a payload-free Web Push.
async function notify(title, body, url) {
  const relay = process.env.RELAY_URL, token = process.env.RELAY_WORKER_TOKEN;
  if (!relay || !token) return;
  try {
    await fetch(`${relay.replace(/\/$/, "")}/worker/notify`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ title, body, url }), signal: AbortSignal.timeout(15e3) });
  } catch (e) { console.log("notify:", e.message); }
}
setInterval(() => {
  try {
    for (const w of finished()) notify(w.name, `Selesai: ${w.next}.`, `/#/v/${w.slug}`);
  } catch (e) { console.log("progress:", e.message); }
}, 5000).unref();
// one-take explainer (Docucine): source text → script (approved) → voice → beat table (approved) → world → render
const isOneTake = (d) => { const id = metaOf(d).preset; return !!(id && listPresets().find((x) => x.id === id)?.oneTake); };
function beatsApproval(d) {
  const req = existsSync(join(d, "request.json")) ? JSON.parse(readFileSync(join(d, "request.json"), "utf8")) : {};
  const at = req.beatsApprovedAt ?? null, f = join(d, "beats.json");
  const stale = !!at && existsSync(f) && statSync(f).mtimeMs > Date.parse(at) + 1000;
  return { approved: !!at && !stale, at, stale };
}
// the beat table the user approves (user 2026-11-09): time → narration → the one hero → on-screen text
function beatTable(d) {
  const tl = existsSync(join(d, "build", "timeline.json")) ? JSON.parse(readFileSync(join(d, "build", "timeline.json"), "utf8")) : null;
  const words = existsSync(join(d, "voice", "words.json")) ? JSON.parse(readFileSync(join(d, "voice", "words.json"), "utf8")) : [];
  const plan = existsSync(join(d, "beats.json")) ? JSON.parse(readFileSync(join(d, "beats.json"), "utf8")).beats ?? [] : [];
  if (!tl?.beats?.length) return [];
  return tl.beats.map((b) => ({ id: b.id, start: b.start, duration: b.duration, register: b.register, hero: b.hero, text: plan.find((x) => x.id === b.id)?.text ?? "",
    narration: words.filter((w) => w.start >= b.start - 0.05 && w.start < b.start + b.duration - 0.05).map((w) => w.text).join(" ") }));
}
// the article behind a Docucine project: a link in the source field (or the first non-video link in the idea) → bahan.md
const VIDEO_HOST = /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com)/i;
async function saveSource(d, link, title) {
  try {
    const a = await fetchArticle(link);
    mkdirSync(join(d, "assets", "reference"), { recursive: true });
    writeFileSync(join(d, "assets", "reference", "bahan.md"), `# ${a.title || title}\n\nSumber: ${link}\n\n${a.text.trim()}\n`);
    return null;
  } catch (e) { return e.message; }
}
const emit = (type, slug, data = {}) => appendFileSync(EVENTS, JSON.stringify({ at: new Date().toISOString(), type, slug, ...data }) + "\n");

// Musafo story library: reading + scanning a book runs in the background (Gemini, minutes for a long book); the
// last progress line is shown in the Library cerita page
// the scan runs detached from Studio and reports through musafo/library/.job.json (tools/stories.mjs), so restarting
// Studio (node --watch on every tool edit) does not kill a book that is half read
// a short sample of every Gemini speaker (tools/voice-samples.mjs → library/voices/<Name>.mp3), played before picking
const withSamples = (voices = []) => voices.map((v) => ({ ...v, sample: existsSync(join(ROOT, "library", "voices", `${v.name}.mp3`)) ? `/files/library/voices/${encodeURIComponent(v.name)}.mp3` : null }));
function runStories(args) {
  if (readJob()?.state === "running") return false;
  spawn(process.execPath, [join(ROOT, "tools", "stories.mjs"), ...args], { cwd: ROOT, windowsHide: true, detached: true, stdio: "ignore" }).unref();
  return true;
}
// Reference video -> tools/ref.mjs in the background (download a link, shots, motion, transcript; whisper can take
// a minute). One run at a time per video, so a link and an upload never analyse the same file twice at once.
const refQueue = new Map();
function runRef(slug, src) {
  const go = () => new Promise((ok) => {
    const c = spawn(process.execPath, [join(ROOT, "tools", "ref.mjs"), slug, ...(src ? [src] : [])], { cwd: ROOT, stdio: "ignore", windowsHide: true });
    c.on("exit", ok).on("error", ok);
  });
  const next = (refQueue.get(slug) || Promise.resolve()).then(go);
  refQueue.set(slug, next);
  next.then(() => refQueue.get(slug) === next && refQueue.delete(slug));
}

function serveFile(req, res, abs) {
  if (!existsSync(abs) || statSync(abs).isDirectory()) return send(res, 404, { error: "not found" });
  const size = statSync(abs).size;
  const type = MIME[extname(abs).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    return stream(createReadStream(abs, { start, end }), res);
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  stream(createReadStream(abs), res);
}
// pipe() leaves the file open when the browser drops a video range request half way; on Windows that open handle keeps
// the folder from being moved (Hapus video) until Studio restarts. Close it with the response.
function stream(s, res) {
  res.on("close", () => s.destroy());
  return s.pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = decodeURIComponent(url.pathname);
    if (p === "/") return send(res, 200, readFileSync(join(ROOT, "tools", "studio", "index.html")), MIME[".html"]);
    // browser tab icon = the Desktop shortcut's icon
    if (p === "/favicon.ico") return serveFile(req, res, join(ROOT, "tools", "tertortor.ico"));
    // PWA (user 2026-11-07): manifest, icons, and the push service worker; the relay serves the same files without login
    const pwa = { "/sw.js": ["sw.js", "text/javascript; charset=utf-8"], "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json"], "/pwa/icon-192.png": ["icon-192.png", "image/png"], "/pwa/icon-512.png": ["icon-512.png", "image/png"], "/pwa/apple-touch-icon.png": ["apple-touch-icon.png", "image/png"] }[p];
    if (pwa) return send(res, 200, readFileSync(join(ROOT, "tools", "studio", "pwa", pwa[0])), pwa[1]);
    // users by invitation (user 2026-11-09): accounts live on the web relay; Studio here (127.0.0.1 only, so the owner)
    // passes the "User" page through to /worker/users. Through the relay, /api/users* never reaches this server: the
    // relay answers it itself, for admins only.
    if (/^\/api\/users(\/|$)/.test(p)) {
      const relay = process.env.RELAY_URL, token = process.env.RELAY_WORKER_TOKEN;
      // no login here, so another website in the same browser could try to POST an invite: only this page may ask
      const host = String(req.headers.host || "");
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || (req.headers.origin && new URL(req.headers.origin).host !== host)) return send(res, 403, { error: "origin" });
      if (!relay || !token) return send(res, 503, { error: "Relay web belum diatur (RELAY_URL dan RELAY_WORKER_TOKEN di .env): akun user hanya ada di relay." });
      try {
        const r = await fetch(`${relay.replace(/\/$/, "")}/worker${req.url.slice(4)}`, { method: req.method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(req.method === "POST" ? { body: await readBody(req) } : {}), signal: AbortSignal.timeout(30e3) });
        return send(res, r.status, Buffer.from(await r.arrayBuffer()), "application/json");
      } catch (e) { return send(res, 502, { error: `Relay tidak terjangkau: ${e.message}` }); }
    }
    // Chat panel (user 2026-11-13): Claude Code headless in this folder (tools/studio-chat.mjs). No login here, so only this
    // page on this machine may use it (the web relay lets admins only through, then replays it here as localhost).
    if (/^\/api\/chat(\/|$)/.test(p)) {
      const host = String(req.headers.host || "");
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || (req.headers.origin && new URL(req.headers.origin).host !== host)) return send(res, 403, { error: "origin" });
      if (p === "/api/chat" && req.method === "GET") return send(res, 200, chatState());
      if (req.method === "POST") {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        try {
          if (p === "/api/chat") return send(res, 200, chatSend(body.text, body.context));
          if (p === "/api/chat/stop") return send(res, 200, chatStop());
          if (p === "/api/chat/new") return send(res, 200, chatReset());
        } catch (e) { return send(res, 400, { error: e.message }); }
      }
      return send(res, 404, { error: "not found" });
    }
    // what Claude is doing after the user's clicks, with estimates, and whether a Claude session is listening at all
    if (p === "/api/working" && req.method === "GET") return send(res, 200, { claude: claudeWaiting(), items: working() });
    if (p === "/api/videos" && req.method === "GET") {
      const slugs = existsSync(VIDEOS) ? readdirSync(VIDEOS).filter((s) => !s.startsWith(".") && statSync(join(VIDEOS, s)).isDirectory()) : [];
      return send(res, 200, slugs.map(stage).sort((a, b) => b.created.localeCompare(a.created)));
    }
    if (p === "/api/videos" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString());
      if (STORY_TYPES[body.type]) {
        const speaker0 = String(body.voiceSpeaker || "").trim().slice(0, 40), extra = { ...(speaker0 ? { voiceSpeaker: speaker0 } : {}), voiceStyle: String(body.voiceStyle || "").trim().slice(0, 300) };
        // source = a story from Library Cerita (user 2026-11-07): the same as "Jadikan video", with the form's voice settings
        if (body.from?.book) {
          try {
            const b = String(body.from.book);
            if (!listBooks().includes(b)) throw new Error("sumber tidak ada di Library Cerita");
            if (listChannels().find((c) => c.id === channelOf(loadBook(b)))?.draft) throw new Error("Channel ini belum didesain.");
            const r = useStory(b, String(body.from.id), { emit: false, extra });
            if (r.existed) return send(res, 400, { error: `Kisah ini sudah dipakai proyek ${r.slug}.` });
            if (body.look) try { setLook(join(VIDEOS, r.slug), String(body.look)); } catch {}
            if (!body.wait) emit(body.type === "musafo" ? "musafo-new" : `${body.type}-new`, r.slug);
            return send(res, 200, { slug: r.slug });
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
        }
        const link = String(body.link || "").trim();
        let title = String(body.title || "").trim().slice(0, 100), story = String(body.story || "").trim(), source = String(body.source || "").trim().slice(0, 300), article = null;
        // a pasted article link (user 2026-11-07): its text becomes the source (bahan.md), shown beside the storyline
        if (link) {
          if (!/^https?:\/\//i.test(link)) return send(res, 400, { error: "Link harus diawali http:// atau https://" });
          try { article = await fetchArticle(link); } catch (e) { return send(res, 400, { error: `Artikel tidak bisa dibaca: ${e.message}. Tempel teksnya di Bahan mentah.` }); }
          if (!article?.text || article.text.length < 300) return send(res, 400, { error: "Teks artikel dari link itu terlalu pendek. Tempel teksnya di Bahan mentah." });
          title ||= String(article.title || "").slice(0, 100);
          source ||= [article.author, article.title, link].filter(Boolean).join(", ").slice(0, 300);
        }
        if (!title || (!story && !article)) return send(res, 400, { error: "Judul dan bahan mentah (atau link artikel) wajib diisi." });
        let slug = slugify(title);
        for (let i = 2; existsSync(join(VIDEOS, slug)); i++) slug = `${slugify(title)}-${i}`;
        if (listChannels().find((c) => c.id === body.channel)?.draft) return send(res, 400, { error: "Channel ini belum didesain." });
        const type = body.type, channel = type === "musafo" ? (listChannels().some((c) => c.id === body.channel && (c.type ?? "musafo") === "musafo") ? body.channel : "musafo") : type;
        createMusafo(slug, title, story || `(teks artikel di assets/reference/bahan.md, dari ${link})`, source, { type, channel, look: body.look ? String(body.look) : undefined });
        if (article) {
          mkdirSync(join(VIDEOS, slug, "assets", "reference"), { recursive: true });
          writeFileSync(join(VIDEOS, slug, "assets", "reference", "bahan.md"), `# ${article.title || title}\n\nSumber: ${link}\n\n${article.text.trim()}\n`);
        }
        const tv = typeVoice(loadBrand(), type);
        const speaker = String(body.voiceSpeaker || tv.speaker || "").trim().slice(0, 40);
        writeFileSync(join(VIDEOS, slug, "request.json"), JSON.stringify({ type, channel, title, story, source, voice: "Gemini TTS", ...(speaker ? { voiceSpeaker: speaker } : {}), voiceStyle: String(body.voiceStyle || tv.style || "").trim().slice(0, 300), created: new Date().toISOString() }, null, 2) + "\n");
        // the link or pasted article also joins Library Cerita, its stories tied to this project (user 2026-11-07);
        // an idea of a few lines is not a source and stays out
        let library = null;
        if (article || story.length >= 1500) {
          try {
            library = sourceToLibrary({ text: article ? article.text : story, title, author: article?.author ?? "", channel, url: article ? link : "", project: slug });
            if (!library.scanned) library.scanning = runStories(["scan", library.id]);
            const rq = JSON.parse(readFileSync(join(VIDEOS, slug, "request.json"), "utf8"));
            writeFileSync(join(VIDEOS, slug, "request.json"), JSON.stringify({ ...rq, story_ref: { book: library.id } }, null, 2) + "\n");
          } catch (e) {
            library = { error: e.message };
          }
        }
        // photos of the main character follow as uploads (kind=tokoh); then /ready wakes Claude
        if (!body.wait) emit(type === "musafo" ? "musafo-new" : `${type}-new`, slug);
        return send(res, 200, { slug, library });
      }
      if (body.type === "advertisement") {
        // Flashcut form: the project is made first, the photos follow (upload ?kind=angle|logo|model|art), then /ready
        // wakes Claude to write ad.json
        const product = listProducts().find((x) => x.id === body.product);
        if (!product || product.draft) return send(res, 400, { error: "Product ini belum didesain." });
        if (product.form === "appdemo") {
          // App Demo: the app's UI screenshots + icon + messages; Claude writes demo.json after /ready (advertisement/appdemo/style.md)
          const clip = (k, n) => String(body[k] || "").trim().slice(0, n);
          const title = clip("title", 100), app = clip("app", 60);
          if (!title || !app) return send(res, 400, { error: "Judul dan nama aplikasi wajib diisi." });
          let slug = slugify(title);
          for (let i = 2; existsSync(join(VIDEOS, slug)); i++) slug = `${slugify(title)}-${i}`;
          const dir = createAd(slug, title, { product: product.id, name: app, cta: "" });
          const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
          writeFileSync(join(dir, "meta.json"), JSON.stringify({ ...meta, watermark: false }, null, 2) + "\n");
          writeFileSync(join(dir, "thumbnail.json"), JSON.stringify({ cover: false }, null, 2) + "\n");
          writeFileSync(join(dir, "request.json"), JSON.stringify({ type: "advertisement", product: product.id, title, app, idea: clip("idea", 3000), benefits: clip("benefits", 600), closing: clip("closing", 80), seconds: Math.max(10, Math.min(60, Number(body.seconds) || 25)), notes: clip("notes", 2000), created: new Date().toISOString() }, null, 2) + "\n");
          writeFileSync(join(dir, "demo.json"), JSON.stringify({ app, icon: null, scenes: [] }, null, 2) + "\n");
          return send(res, 200, { slug });
        }
        if (product.form === "kv") {
          // key-visual product (BRI): the client's KV + texts; Claude follows advertisement/<product>/style.md after /ready
          const clip = (k, n) => String(body[k] || "").trim().slice(0, n);
          const title = clip("title", 100), headline = clip("headline", 80);
          if (!title || !headline) return send(res, 400, { error: "Judul dan headline wajib diisi." });
          let slug = slugify(title);
          for (let i = 2; existsSync(join(VIDEOS, slug)); i++) slug = `${slugify(title)}-${i}`;
          const dir = createAd(slug, title, { product: product.id, name: headline, cta: "" });
          const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
          writeFileSync(join(dir, "meta.json"), JSON.stringify({ ...meta, watermark: false }, null, 2) + "\n");
          writeFileSync(join(dir, "thumbnail.json"), JSON.stringify({ cover: false }, null, 2) + "\n");
          writeFileSync(join(dir, "request.json"), JSON.stringify({ type: "advertisement", product: product.id, title, headline, sub: clip("sub", 120), promo: clip("promo", 120), percent: clip("percent", 12), notes: clip("notes", 2000), created: new Date().toISOString() }, null, 2) + "\n");
          return send(res, 200, { slug });
        }
        const name = String(body.name || "").trim().slice(0, 80), cta = String(body.cta || "").trim().slice(0, 120);
        if (!name || !cta) return send(res, 400, { error: "Nama produk dan CTA wajib diisi." });
        const title = String(body.title || "").trim().slice(0, 100) || name;
        let slug = slugify(title);
        for (let i = 2; existsSync(join(VIDEOS, slug)); i++) slug = `${slugify(title)}-${i}`;
        createAd(slug, title, { product: product.id, name, cta });
        writeFileSync(join(VIDEOS, slug, "request.json"), JSON.stringify({ type: "advertisement", product: product.id, title, name, cta, notes: String(body.notes || "").trim().slice(0, 2000), music: body.music === "file" ? "file" : "app", sfx: body.sfx === "mine" ? "mine" : "library", audioLicense: String(body.audioLicense || "").trim().slice(0, 200), created: new Date().toISOString() }, null, 2) + "\n");
        return send(res, 200, { slug });
      }
      if (!body.title?.trim() || !body.idea?.trim()) return send(res, 400, { error: "Judul dan ide wajib diisi." });
      if (body.preset && !listPresets().some((x) => x.id === body.preset)) return send(res, 400, { error: "Preset ini belum didesain." });
      const slug = createVideo(body);
      if (/^https?:\/\//i.test(body.refLink || "")) runRef(slug, body.refLink.trim());
      // Docucine: the source article is read now; /ready (after the uploads) wakes Claude to write the script
      if (isOneTake(join(VIDEOS, slug))) {
        const link = [String(body.sourceLink || "").trim(), ...(String(body.idea).match(/https?:\/\/\S+/g) ?? [])].find((u) => /^https?:\/\//i.test(u) && !VIDEO_HOST.test(u));
        if (link) {
          const err = await saveSource(join(VIDEOS, slug), link, body.title);
          const rp = join(VIDEOS, slug, "request.json"), r = JSON.parse(readFileSync(rp, "utf8"));
          writeFileSync(rp, JSON.stringify({ ...r, sourceLink: link, ...(err ? { sourceError: err } : {}) }, null, 2) + "\n");
        }
      }
      return send(res, 200, { slug });
    }
    const up = p.match(/^\/api\/videos\/([a-z0-9-]+)\/upload$/);
    const adKind = url.searchParams.get("kind");
    if (up && req.method === "PUT" && (ASSET_KINDS[adKind] || AUDIO_KINDS[adKind])) {
      const d = join(VIDEOS, up[1]), audio = !!AUDIO_KINDS[adKind];
      if (!isAd(d)) return send(res, 400, { error: "bukan proyek Advertisement" });
      const name = safeName(url.searchParams.get("name") || "file");
      if (audio ? !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name) : !/\.(png|jpe?g|webp)$/i.test(name)) return send(res, 400, { error: audio ? "Hanya audio MP3, WAV, M4A, AAC, OGG, atau FLAC." : "Hanya gambar PNG, JPG, atau WebP." });
      const raw = join(d, "assets", "upload", adKind);
      mkdirSync(raw, { recursive: true });
      await new Promise((ok, bad) => req.pipe(createWriteStream(join(raw, name))).on("finish", ok).on("error", bad));
      const file = audio ? importAudio(d, adKind, join(raw, name), name, String(url.searchParams.get("license") || "").slice(0, 200)) : importAsset(d, adKind, join(raw, name), name);
      return send(res, 200, { ok: true, file });
    }
    if (up && req.method === "PUT" && adKind === "tokoh") {
      const d = join(VIDEOS, up[1]);
      if (!isMusafo(d)) return send(res, 400, { error: "foto tokoh hanya untuk proyek Storytelling" });
      const name = safeName(url.searchParams.get("name") || "tokoh.jpg");
      if (!/\.(png|jpe?g|webp)$/i.test(name)) return send(res, 400, { error: "Hanya gambar PNG, JPG, atau WebP." });
      const dir = join(d, "assets", "reference", "tokoh");
      mkdirSync(dir, { recursive: true });
      await new Promise((ok, bad) => req.pipe(createWriteStream(join(dir, name))).on("finish", ok).on("error", bad));
      // added later to a project that already has a story: tell a waiting Claude session
      if (url.searchParams.get("later") === "1") emit("characters", up[1]);
      return send(res, 200, { ok: true });
    }
    const ready = p.match(/^\/api\/videos\/([a-z0-9-]+)\/ready$/);
    if (ready && req.method === "POST" && isMusafo(join(VIDEOS, ready[1]))) {
      const d = join(VIDEOS, ready[1]), t = storyType(d), dr = draftApproval(d);
      // also the "Tulis draft/storyline" button (user 2026-11-09): an approved draft without a storyline resumes from there
      emit(dr.needed && dr.approved && !existsSync(join(d, "storyline.md")) ? "draft-approved" : t === "musafo" ? "musafo-new" : `${t}-new`, ready[1]);
      return send(res, 200, { ok: true });
    }
    if (ready && req.method === "POST" && isOneTake(join(VIDEOS, ready[1]))) {
      emit("docucine-new", ready[1]);
      return send(res, 200, { ok: true });
    }
    if (ready && req.method === "POST") {
      if (!isAd(join(VIDEOS, ready[1]))) return send(res, 400, { error: "bukan proyek Advertisement" });
      emit("ad-new", ready[1]);
      return send(res, 200, { ok: true });
    }
    if (up && req.method === "PUT") {
      const kind = url.searchParams.get("kind") === "reference" ? "reference" : "keyvisuals";
      const dir = join(VIDEOS, up[1], "assets", kind);
      if (!existsSync(join(VIDEOS, up[1]))) return send(res, 404, { error: "video not found" });
      mkdirSync(dir, { recursive: true });
      const dest = join(dir, safeName(url.searchParams.get("name") || "file"));
      await new Promise((ok, bad) => req.pipe(createWriteStream(dest)).on("finish", ok).on("error", bad));
      if (kind === "reference" && /\.(mp4|mov|webm|mkv)$/i.test(dest)) runRef(up[1]);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/stories" && req.method === "GET") {
      return send(res, 200, { job: readJob(), channels: listChannels(), books: listBooks().map((id) => loadBook(id)).map((b) => ({ ...b.book, channel: channelOf(b), chunks: Object.keys(b.chunks).length, stories: b.stories })) });
    }
    if (p === "/api/stories/channel" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        return send(res, 200, addChannel(body.label));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (p === "/api/stories/upload" && req.method === "PUT") {
      const name = safeName(url.searchParams.get("name") || "buku.pdf");
      if (!/\.pdf$/i.test(name)) return send(res, 400, { error: "Hanya file PDF." });
      if (readJob()?.state === "running") return send(res, 409, { error: "Masih membaca buku lain, tunggu sampai selesai." });
      mkdirSync(join(ROOT, "musafo", "sumber"), { recursive: true });
      const dest = join(ROOT, "musafo", "sumber", name);
      await new Promise((ok, bad) => req.pipe(createWriteStream(dest)).on("finish", ok).on("error", bad));
      const title = String(url.searchParams.get("title") || "").trim(), author = String(url.searchParams.get("author") || "").trim();
      const channel = String(url.searchParams.get("channel") || "");
      if (channel && !listChannels().some((c) => c.id === channel)) return send(res, 400, { error: "channel tidak ada" });
      runStories(["ingest", dest, ...(title ? ["--title", title] : []), ...(author ? ["--author", author] : []), ...(channel ? ["--channel", channel] : [])]);
      return send(res, 200, { ok: true });
    }
    // a web article (link) or pasted text instead of a PDF: same library, same scan
    if (p === "/api/stories/source" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (readJob()?.state === "running") return send(res, 409, { error: "Masih membaca sumber lain, tunggu sampai selesai." });
      const channel = String(body.channel || "");
      if (channel && !listChannels().some((c) => c.id === channel)) return send(res, 400, { error: "channel tidak ada" });
      const title = String(body.title || "").trim().slice(0, 100), author = String(body.author || "").trim().slice(0, 100);
      const opts = [...(title ? ["--title", title] : []), ...(author ? ["--author", author] : []), ...(channel ? ["--channel", channel] : [])];
      if (body.url) {
        if (!/^https?:\/\/\S+$/i.test(String(body.url).trim())) return send(res, 400, { error: "Link harus diawali http:// atau https://" });
        runStories(["ingest-url", String(body.url).trim(), ...opts]);
        return send(res, 200, { ok: true });
      }
      const text = String(body.text || "").trim();
      if (text.length < 300) return send(res, 400, { error: "Teksnya terlalu pendek (minimal 300 karakter)." });
      if (!title) return send(res, 400, { error: "Isi judul untuk teks tempelan." });
      mkdirSync(join(ROOT, "musafo", "sumber"), { recursive: true });
      const dest = join(ROOT, "musafo", "sumber", `${slugify(title)}.txt`);
      writeFileSync(dest, text);
      runStories(["ingest-text", dest, ...opts]);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/stories/scan" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (!listBooks().includes(body.book)) return send(res, 404, { error: "buku tidak ada" });
      if (!runStories(["scan", body.book])) return send(res, 409, { error: "Masih ada yang dibaca." });
      return send(res, 200, { ok: true });
    }
    if (p === "/api/stories/use" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        if (listBooks().includes(String(body.book)) && listChannels().find((c) => c.id === channelOf(loadBook(String(body.book))))?.draft) throw new Error("Channel ini belum didesain: cerita bisa dikumpulkan, tapi belum bisa dijadikan video.");
        return send(res, 200, useStory(String(body.book), String(body.id)));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    if (p === "/api/library") {
      const db = existsSync(join(LIB, "footage.json")) ? JSON.parse(readFileSync(join(LIB, "footage.json"), "utf8")) : { clips: [] };
      // shown under each channel/preset/product: places = where the clip was filed (--for) or used
      return send(res, 200, db.clips.slice().reverse().map((c) => ({ ...c, places: clipPlaces(c) })));
    }
    // stock music + sfx (tools/stock.mjs), shown under the same channel/preset/product pages as the footage
    if (p === "/api/audio") {
      const db = existsSync(join(LIB, "audio.json")) ? JSON.parse(readFileSync(join(LIB, "audio.json"), "utf8")) : { items: [] };
      return send(res, 200, db.items.slice().reverse().map((x) => ({ ...x, places: clipPlaces(x) })));
    }
    // choose the voice for one video (and optionally make it the brand default)
    const vsel = p.match(/^\/api\/videos\/([a-z0-9-]+)\/voice$/);
    if (vsel && req.method === "POST") {
      const d = join(VIDEOS, vsel[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const speaker = String(body.speaker || "").trim().slice(0, 40), style = String(body.style || "").trim().slice(0, 300);
      if (!speaker) return send(res, 400, { error: "Pilih suara dulu." });
      const rp = join(d, "request.json");
      const r = existsSync(rp) ? JSON.parse(readFileSync(rp, "utf8")) : {};
      Object.assign(r, { voice: "Gemini TTS", voiceSpeaker: speaker, voiceStyle: style });
      writeFileSync(rp, JSON.stringify(r, null, 2) + "\n");
      if (body.makeDefault) {
        const bp = join(ROOT, "brand", "brand.json");
        const br = JSON.parse(readFileSync(bp, "utf8"));
        Object.assign(br.voice.gemini, { speaker, style });
        writeFileSync(bp, JSON.stringify(br, null, 2) + "\n");
      }
      return send(res, 200, { ok: true, speaker, style });
    }
    // category -> preset / channel / product, for the "Buat video" picker and the grouped video list
    if (p === "/api/structure") return send(res, 200, structure());
    // "+ Tambah" a preset / channel / product: a draft with the user's brief; the waiting Claude session designs it
    if (p === "/api/subs" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        const s = addSub(String(body.category || ""), body);
        emit("channel-new", s.id, { category: s.category, dir: s.dir });
        return send(res, 200, s);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // Buffer: a sub's own account (?sub=<id>, one key per sub), its targets, and forwarding one video (tools/buffer.mjs)
    if (p === "/api/buffer/channels" && req.method === "GET") {
      const bsub = String(url.searchParams.get("sub") ?? "");
      if (!/^[a-z0-9-]+$/.test(bsub)) return send(res, 400, { error: "sub wajib" });
      if (!bufferKey(bsub)) return send(res, 200, { ...bufferKeyInfo(bsub), channels: [] });
      try { return send(res, 200, { ...bufferKeyInfo(bsub), channels: await listBufferChannels(bsub) }); }
      catch (e) { return send(res, 200, { ...bufferKeyInfo(bsub), channels: [], error: e.message }); }
    }
    // the sub's Buffer API key, pasted in the Buffer panel (user 2026-11-12): stored in .buffer-keys.json (gitignored);
    // answers only "••••1234", never the key
    const skey = p.match(/^\/api\/subs\/(explainer|storytelling|advertisement)\/([a-z0-9-]+)\/buffer-key$/);
    if (skey) {
      if (!structure().find((c) => c.id === skey[1])?.subs.some((x) => x.id === skey[2])) return send(res, 404, { error: "channel tidak ada" });
      try {
        if (req.method === "POST") return send(res, 200, setBufferKey(skey[2], JSON.parse((await readBody(req)).toString() || "{}").key));
        if (req.method === "DELETE") return send(res, 200, removeBufferKey(skey[2]));
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    // "Kirim ke Buffer": the agent writes the posting caption + YouTube title (caption.md); the user edits it before sending
    const vcap = p.match(/^\/api\/videos\/([a-z0-9-]+)\/buffer-caption$/);
    if (vcap && req.method === "POST") {
      const d = join(VIDEOS, vcap[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      try { return send(res, 200, await writeBufferCaption(d)); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }
    // delete a video (user 2026-11-12): moved to videos/.trash/<slug>-<time>/ (gitignored), restorable from "Sampah"
    const vdel = p.match(/^\/api\/videos\/([a-z0-9-]+)\/delete$/);
    if (vdel && req.method === "POST") {
      const slug = vdel[1], d = join(VIDEOS, slug);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      if (JSON.parse((await readBody(req)).toString() || "{}").confirm !== slug) return send(res, 400, { error: "Ketik slug video persis untuk menghapus." });
      if (coverJobs.get(slug)?.mode || shareJobs.get(slug)) return send(res, 409, { error: "Video ini sedang dirender atau diunggah. Tunggu selesai dulu." });
      const id = `${slug}-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
      try {
        mkdirSync(TRASH, { recursive: true });
        await moveDir(d, join(TRASH, id));
        writeFileSync(join(TRASH, id, ".deleted.json"), JSON.stringify({ slug, at: new Date().toISOString() }, null, 2));
      } catch (e) {
        return send(res, 409, { error: `Folder video tidak bisa dipindah (${e.code ?? e.message}). Mungkin ada file yang sedang dibuka, mis. video sedang diputar. Tutup lalu coba lagi.` });
      }
      console.log(`hapus ${slug} → videos/.trash/${id}`);
      return send(res, 200, { ok: true, trash: id });
    }
    if (p === "/api/trash" && req.method === "GET") {
      const items = existsSync(TRASH) ? readdirSync(TRASH).filter((x) => statSync(join(TRASH, x)).isDirectory()).map((id) => {
        const t = join(TRASH, id), del = existsSync(join(t, ".deleted.json")) ? JSON.parse(readFileSync(join(t, ".deleted.json"), "utf8")) : {};
        const meta = existsSync(join(t, "meta.json")) ? JSON.parse(readFileSync(join(t, "meta.json"), "utf8")) : {};
        const slug = del.slug ?? id.replace(/-\d{14}$/, "");
        return { id, slug, title: meta.name ?? slug, at: del.at ?? statSync(t).mtime.toISOString(), taken: existsSync(join(VIDEOS, slug)) };
      }) : [];
      return send(res, 200, items.sort((a, b) => b.at.localeCompare(a.at)));
    }
    const vres = p.match(/^\/api\/trash\/([a-z0-9-]+)\/restore$/);
    if (vres && req.method === "POST") {
      const t = join(TRASH, vres[1]);
      if (!existsSync(t)) return send(res, 404, { error: "tidak ada di sampah" });
      const slug = existsSync(join(t, ".deleted.json")) ? JSON.parse(readFileSync(join(t, ".deleted.json"), "utf8")).slug : vres[1].replace(/-\d{14}$/, "");
      if (existsSync(join(VIDEOS, slug))) return send(res, 409, { error: `Sudah ada video dengan slug ${slug}.` });
      try { await moveDir(t, join(VIDEOS, slug)); } catch (e) { return send(res, 409, { error: `Tidak bisa dipulihkan (${e.code ?? e.message}).` }); }
      try { unlinkSync(join(VIDEOS, slug, ".deleted.json")); } catch {}
      return send(res, 200, { ok: true, slug });
    }
    const sbuf = p.match(/^\/api\/subs\/(explainer|storytelling|advertisement)\/([a-z0-9-]+)\/buffer$/);
    if (sbuf) {
      if (!structure().find((c) => c.id === sbuf[1])?.subs.some((x) => x.id === sbuf[2])) return send(res, 404, { error: "channel tidak ada" });
      if (req.method === "GET") return send(res, 200, subBuffer(sbuf[1], sbuf[2]));
      if (req.method === "POST") return send(res, 200, saveSubBuffer(sbuf[1], sbuf[2], JSON.parse((await readBody(req)).toString() || "{}")));
    }
    const vbuf = p.match(/^\/api\/videos\/([a-z0-9-]+)\/buffer$/);
    if (vbuf && req.method === "POST") {
      const d = join(VIDEOS, vbuf[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const b = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        const r = await bufferForward(d, vbuf[1], { text: String(b.text ?? "").slice(0, 5000), mode: b.mode, dueAt: b.dueAt, title: String(b.title ?? "").slice(0, 100), channels: Array.isArray(b.channels) ? b.channels : undefined });
        return send(res, r.results.some((x) => x.ok) ? 200 : 400, { ...r, ...(r.results.some((x) => x.ok) ? {} : { error: r.results.map((x) => `${x.name ?? x.channel}: ${x.error}`).join("; ") }), buffer: bufferInfo(d), share: shareInfo(d, vbuf[1]) });
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // the channel / preset / product logo used as the watermark of all its videos (tools/brandmark.mjs)
    // the style cover of a channel / preset / product (tools/sub-covers.mjs)
    const scover = p.match(/^\/api\/subs\/(explainer|storytelling|advertisement)\/([a-z0-9-]+)\/cover$/);
    if (scover && req.method === "GET") {
      const f = join(subDir(scover[1], scover[2]), "cover.jpg");
      if (!structure().find((c) => c.id === scover[1])?.subs.some((s) => s.id === scover[2]) || !existsSync(f)) return send(res, 404, { error: "belum ada cover" });
      res.setHeader("cache-control", "max-age=86400");
      return send(res, 200, readFileSync(f), "image/jpeg");
    }
    const slogo = p.match(/^\/api\/subs\/(explainer|storytelling|advertisement)\/([a-z0-9-]+)\/logo$/);
    if (slogo) {
      const [, cat, id] = slogo;
      if (!structure().find((c) => c.id === cat)?.subs.some((s) => s.id === id)) return send(res, 404, { error: "channel tidak ada" });
      const f = logoFile(cat, id);
      if (req.method === "GET") return existsSync(f) ? send(res, 200, readFileSync(f), "image/png") : send(res, 404, { error: "belum ada logo" });
      if (req.method === "DELETE") { removeLogo(cat, id); return send(res, 200, { ok: true }); }
      if (req.method === "PUT") {
        const tmp = join(tmpdir(), `tertortor-logo-${process.pid}${extname(safeName(url.searchParams.get("name") || "logo.png")) || ".png"}`);
        await new Promise((ok, bad) => req.pipe(createWriteStream(tmp)).on("finish", ok).on("error", bad));
        try { saveLogo(cat, id, tmp); return send(res, 200, { ok: true }); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
    }
    const sup = p.match(/^\/api\/subs\/(explainer|storytelling|advertisement)\/([a-z0-9-]+)\/upload$/);
    if (sup && req.method === "PUT") {
      const dir = join(subDir(sup[1], sup[2]), "reference");
      if (!existsSync(join(subDir(sup[1], sup[2]), "brief.md"))) return send(res, 404, { error: "brief tidak ada" });
      mkdirSync(dir, { recursive: true });
      await new Promise((ok, bad) => req.pipe(createWriteStream(join(dir, safeName(url.searchParams.get("name") || "file")))).on("finish", ok).on("error", bad));
      return send(res, 200, { ok: true });
    }
    if (p === "/api/presets") {
      // presets with a "type" belong to that project type (musafo), not to the explainer picker
      return send(res, 200, { presets: listPresets().filter((x) => !x.type).map(({ id, label, description, colors, fonts, tones, formats, oneTake }) => ({ id, label, description, colors, fonts, tones: tones ?? [], formats: formats ?? ["vertical"], oneTake: !!oneTake })), default: loadBrand().defaultPreset });
    }
    // change a video's preset: colours/fonts/captions follow on the next cues; designed scenes keep their layout
    const pset = p.match(/^\/api\/videos\/([a-z0-9-]+)\/preset$/);
    if (pset && req.method === "POST") {
      const d = join(VIDEOS, pset[1]);
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const np = listPresets().find((x) => x.id === body.preset);
      if (!np) return send(res, 400, { error: "Preset tidak dikenal." });
      const mp = join(d, "meta.json");
      const meta = existsSync(mp) ? JSON.parse(readFileSync(mp, "utf8")) : { id: pset[1] };
      // a one-take world (Docucine) and per-beat scenes are different builds; a 16:9 video needs a preset that has 16:9
      const op = listPresets().find((x) => x.id === (meta.preset ?? loadBrand().defaultPreset));
      if (!!np.oneTake !== !!op?.oneTake && existsSync(join(d, "build", "timeline.json"))) return send(res, 400, { error: "Docucine (satu kamera) dan preset lain dibangun berbeda: buat video baru untuk ganti gaya." });
      if (!(np.formats ?? ["vertical"]).includes(meta.format ?? "vertical")) return send(res, 400, { error: `Preset ${np.label} tidak punya format ${meta.format === "horizontal" ? "16:9" : "9:16"}.` });
      meta.preset = body.preset;
      // colour tone: a #rrggbb replaces the preset accent for this video; anything else returns to the preset's own
      if (isHex(body.accent)) meta.accent = body.accent; else delete meta.accent;
      writeFileSync(mp, JSON.stringify(meta, null, 2) + "\n");
      if (existsSync(join(d, "voice", "words.json"))) spawnSync("node", [join(ROOT, "tools", "cues.mjs"), pset[1]], { encoding: "utf8" });
      return send(res, 200, { ok: true, preset: body.preset });
    }
    // the visual looks of a story type (BKH PRESET1/PRESET2, user 2026-11-08), for the new-video form and the editor
    if (p === "/api/looks") return send(res, 200, looksOf(String(url.searchParams.get("type") || "")));
    const lookSet = p.match(/^\/api\/videos\/([a-z0-9-]+)\/look$/);
    if (lookSet && req.method === "POST") {
      try { return send(res, 200, { look: setLook(join(VIDEOS, lookSet[1]), String(JSON.parse((await readBody(req)).toString()).look || "")) }); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (p === "/api/voices") {
      // ?type=<story type>: that type's own default (brand.json → <type>.voice, e.g. BumiDiPijak = Kira)
      const brand = loadBrand(), g = brand.voice.gemini ?? {}, tv = typeVoice(brand, url.searchParams.get("type"));
      return send(res, 200, { voices: withSamples(g.voices), speaker: tv.speaker ?? g.speaker ?? null, style: tv.style ?? "" });
    }
    const cpick = p.match(/^\/api\/videos\/([a-z0-9-]+)\/concept$/);
    if (cpick && req.method === "POST") {
      const d = join(VIDEOS, cpick[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        const c = pickConcept(d, String(body.id || ""), "studio");
        emit("concept", cpick[1], { id: c.id });
        return send(res, 200, c);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // re-run the reference analysis (e.g. after a failed download)
    const rrun = p.match(/^\/api\/videos\/([a-z0-9-]+)\/ref$/);
    if (rrun && req.method === "POST") {
      if (!existsSync(join(VIDEOS, rrun[1]))) return send(res, 404, { error: "video not found" });
      const r = JSON.parse(readFileSync(join(VIDEOS, rrun[1], "request.json"), "utf8"));
      runRef(rrun[1], refFiles(join(VIDEOS, rrun[1])).length ? undefined : r.refLink || undefined);
      return send(res, 200, { ok: true });
    }
    // Production (Shot tab): Claude makes the voice, then the key visuals (event production, user 2026-11-07)
    const prod = p.match(/^\/api\/videos\/([a-z0-9-]+)\/production$/);
    if (prod && req.method === "POST") {
      const d = join(VIDEOS, prod[1]);
      if (!isMusafo(d)) return send(res, 404, { error: "bukan proyek Storytelling" });
      try {
        const st = startProduction(d);
        emit("production", prod[1]);
        return send(res, 200, st);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // story draft (two columns in Studio: source text | Claude's draft): the user edits and approves it before the storyline
    const drf = p.match(/^\/api\/videos\/([a-z0-9-]+)\/(draft|draft-approve)$/);
    if (drf && req.method === "POST") {
      const d = join(VIDEOS, drf[1]);
      if (!isMusafo(d)) return send(res, 404, { error: "bukan proyek Storytelling" });
      try {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        if (drf[2] === "draft") return send(res, 200, saveDraft(d, body.text));
        if (body.text != null) saveDraft(d, body.text);
        const a = approveDraft(d, "studio");
        emit("draft-approved", drf[1]);
        return send(res, 200, a);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // the user edits the storyline before approving it (user 2026-11-07)
    const sled = p.match(/^\/api\/videos\/([a-z0-9-]+)\/storyline$/);
    if (sled && req.method === "POST") {
      const d = join(VIDEOS, sled[1]);
      if (!isMusafo(d)) return send(res, 404, { error: "bukan proyek Storytelling" });
      try {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        return send(res, 200, saveStoryline(d, body.text));
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // musafo: the user approves the storyline before Claude writes the shots
    const sapv = p.match(/^\/api\/videos\/([a-z0-9-]+)\/storyline-approve$/);
    if (sapv && req.method === "POST") {
      const d = join(VIDEOS, sapv[1]);
      if (!isMusafo(d)) return send(res, 404, { error: "bukan proyek Musafo / Berakit ke Hulu" });
      try {
        const body = JSON.parse((await readBody(req)).toString() || "{}");
        const a = approveStoryline(d, "studio", body.hook ? String(body.hook) : undefined);
        emit("storyline-approved", sapv[1]);
        return send(res, 200, a);
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // "Render video" in the Thumbnail tab: the user approves the thumbnail, then the video is (re)made with it
    const thv = p.match(/^\/api\/videos\/([a-z0-9-]+)\/thumbnail\/video$/);
    if (thv && req.method === "POST") {
      const d = join(VIDEOS, thv[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      if (!existsSync(thumbPng(d)) || thumbStale(d)) return send(res, 400, { error: "simpan & render thumbnail dulu, baru render video" });
      const t = loadThumb(d);
      t.approvedAt = new Date().toISOString();
      writeFileSync(join(d, "thumbnail.json"), JSON.stringify(t, null, 2) + "\n");
      renderVideo(d, thv[1]);
      return send(res, 200, { ok: true, thumbnail: thumbInfo(d, thv[1]) });
    }
    // thumbnail: save the chosen text / background / switches, then render out/thumbnail.png (tools/thumbnail.mjs)
    const thb = p.match(/^\/api\/videos\/([a-z0-9-]+)\/thumbnail(\/options)?$/);
    if (thb && req.method === "POST") {
      const d = join(VIDEOS, thb[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      if (thb[2]) {
        const r = await runTool([join(ROOT, "tools", "thumbnail.mjs"), "options", thb[1]]);
        if (r.code !== 0) return send(res, 400, { error: r.out.trim().split("\n").at(-1) || "opsi gagal" });
        return send(res, 200, { ok: true, thumbnail: thumbInfo(d, thb[1]) });
      }
      const b = JSON.parse((await readBody(req)).toString() || "{}");
      const clean = (x, n) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, n);
      const t = loadThumb(d);
      if ("headline" in b) t.headline = clean(b.headline, 80);
      if ("sub" in b) t.sub = clean(b.sub, 140);
      if ("episode" in b) t.episode = clean(b.episode, 30);
      if ("bg" in b && thumbBackgrounds(d).includes(b.bg)) t.bg = b.bg;
      if ("cover" in b) t.cover = !!b.cover;
      if ("position" in b) t.position = b.position === "bottom" ? "bottom" : "top";
      writeFileSync(join(d, "thumbnail.json"), JSON.stringify(t, null, 2) + "\n");
      if ("watermark" in b) {
        const mp = join(d, "meta.json");
        const meta = existsSync(mp) ? JSON.parse(readFileSync(mp, "utf8")) : { id: thb[1] };
        if (b.watermark) delete meta.watermark; else meta.watermark = false;
        writeFileSync(mp, JSON.stringify(meta, null, 2) + "\n");
      }
      const r = await runTool([join(ROOT, "tools", "thumbnail.mjs"), "render", thb[1]]);
      if (r.code !== 0) return send(res, 400, { error: r.out.trim().split("\n").slice(-2).join(" ") || "render thumbnail gagal" });
      return send(res, 200, { ok: true, thumbnail: thumbInfo(d, thb[1]), watermark: watermarkInfo(d) });
    }
    // share by link (tools/share.mjs): compress the render, upload it to the relay, return the public /v/<token> link
    // Ubah format (user 2026-11-13): the finished render → 4:5, 1:1, 16:9 (9:16 for wide videos), ProRes, WebM, GIF, 720p
    // (tools/formats.mjs, ffmpeg only, $0). POST starts one background run per video; the panel under the video polls GET.
    const fmtM = p.match(/^\/api\/videos\/([a-z0-9-]+)\/formats$/);
    if (fmtM && ["GET", "POST"].includes(req.method)) {
      const slug = fmtM[1], d = join(VIDEOS, slug);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const jf = join(d, "out", "formats", "job.json");
      const info = () => {
        let job = null; try { job = JSON.parse(readFileSync(jf, "utf8")); } catch {}
        const busy = formatJobs.has(slug);
        if (job && job.running && !busy) { job.running = false; job.interrupted = true; } // Studio restarted mid-run
        const own = metaOf(d).format ?? "vertical";
        // other ratios = remakes (tools/variant.mjs + event format-new), made only for the boxes the user ticks
        const ratios = Object.entries(VARIANT_KINDS).filter(([, f]) => f !== own).map(([k]) => ({ kind: k, label: { "4x5": "4:5 feed", "1x1": "1:1 kotak", "16x9": "16:9 YouTube", "9x16": "9:16 vertikal" }[k] }));
        return { busy, job, formats: listFormats(d, slug), kinds: Object.entries(FORMAT_KINDS).map(([k, x]) => ({ kind: k, label: x.label })), ratios: metaOf(d).variantOf ? [] : ratios, variants: variantsOf(slug), variantOf: metaOf(d).variantOf ?? null };
      };
      if (req.method === "GET") return send(res, 200, info());
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      // ratio remakes: one project per ticked ratio, then Claude is woken to remake pictures, clips and layout
      const want = (Array.isArray(body.ratios) ? body.ratios : []).filter((k) => VARIANT_KINDS[k]);
      if (want.length) {
        const made = [], errors = [];
        for (const k of want) {
          try { const r = createVariant(slug, k); made.push(r.slug); emit("format-new", r.slug, { of: slug, kind: k }); }
          catch (e) { errors.push(e.message); }
        }
        if (!made.length) return send(res, 400, { error: errors.join(" ") });
        return send(res, 200, { ...info(), made, errors });
      }
      if (formatJobs.has(slug)) return send(res, 409, { error: "Masih membuat format lain untuk video ini." });
      if (!existsSync(formatSource(d, slug))) return send(res, 400, { error: "Belum ada render untuk diubah formatnya." });
      const kinds = (Array.isArray(body.kinds) ? body.kinds : []).filter((k) => FORMAT_KINDS[k]);
      if (!kinds.length) return send(res, 400, { error: "Pilih minimal satu format." });
      const child = spawn("node", [join(ROOT, "tools", "formats.mjs"), slug, "--only", kinds.join(",")], { cwd: ROOT, windowsHide: true, stdio: "ignore" });
      formatJobs.set(slug, child);
      child.on("close", () => formatJobs.delete(slug));
      child.on("error", () => formatJobs.delete(slug));
      return send(res, 202, { ...info(), busy: true });
    }
    // The upload takes 1-3 min, longer than Cloudflare keeps a web request open (±100 s → an HTML 524 page in the
    // browser), so POST only starts it and the dialog polls GET until the link is there (user 2026-11-09).
    const shr = p.match(/^\/api\/videos\/([a-z0-9-]+)\/share$/);
    if (shr && ["GET", "POST", "DELETE"].includes(req.method)) {
      const d = join(VIDEOS, shr[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const job = shareJobs.get(shr[1]);
      if (req.method === "GET") return send(res, 200, { busy: !!job?.busy, error: job?.error ?? null, share: shareInfo(d, shr[1]) });
      try {
        if (req.method === "DELETE") return send(res, 200, await revoke(d));
        if (!job?.busy) {
          const j = { busy: true, error: null };
          shareJobs.set(shr[1], j);
          share(d, shr[1], stage(shr[1]).title).then(() => shareJobs.delete(shr[1]), (e) => { j.busy = false; j.error = e.message; console.log(`share ${shr[1]}: ${e.message}`); });
        }
        return send(res, 202, { busy: true, share: shareInfo(d, shr[1]) });
      } catch (e) {
        return send(res, 400, { error: e.message });
      }
    }
    // Docucine beat table (user 2026-11-09): approved in Studio before Claude builds the world
    const bapv = p.match(/^\/api\/videos\/([a-z0-9-]+)\/beats-approve$/);
    if (bapv && (req.method === "POST" || req.method === "DELETE")) {
      const d = join(VIDEOS, bapv[1]), rp = join(d, "request.json");
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const r = existsSync(rp) ? JSON.parse(readFileSync(rp, "utf8")) : {};
      if (req.method === "DELETE") delete r.beatsApprovedAt; else r.beatsApprovedAt = new Date().toISOString();
      writeFileSync(rp, JSON.stringify(r, null, 2) + "\n");
      if (req.method === "POST") emit("beats-approved", bapv[1]);
      return send(res, req.method === "POST" ? 202 : 200, { ok: true, beatsApproval: beatsApproval(d) });
    }
    const apv = p.match(/^\/api\/videos\/([a-z0-9-]+)\/approve$/);
    if (apv && (req.method === "POST" || req.method === "DELETE")) {
      const d = join(VIDEOS, apv[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      if (req.method === "DELETE") { unapprove(d); return send(res, 200, { ok: true }); }
      const a = approve(d, "studio");
      emit("script-approved", apv[1]);
      return send(res, 200, a);
    }
    // the user edits the script (tools/script-edit.mjs): Storytelling per shot in musafo.json, explainer per paragraph of
    // script.md; script.md changes, so the approval goes stale and the next "Setujui naskah" wakes Claude as usual
    const sedit = p.match(/^\/api\/videos\/([a-z0-9-]+)\/script$/);
    if (sedit && req.method === "POST") {
      const d = join(VIDEOS, sedit[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      if (isAd(d)) return send(res, 400, { error: "Iklan tidak punya naskah." });
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      try {
        if (!isMusafo(d)) return send(res, 200, { ok: true, ...editScriptMd(d, body.paragraphs) });
        // empty English captions are translated first (Gemini, Claude haiku as fallback)
        const auto = await fillEnglish(d, body.shots);
        return send(res, 200, { ok: true, translated: auto.length, ...editScript(d, body.shots, auto) });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    const shot = p.match(/^\/api\/videos\/([a-z0-9-]+)\/flow\/([\w-]+)$/);
    if (shot && req.method === "POST") {
      const d = join(VIDEOS, shot[1]);
      const flow = loadFlow(d);
      const s = flow?.shots?.find((x) => x.id === shot[2]);
      if (!s) return send(res, 404, { error: "shot not found" });
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      if (["draft", "generated", "library"].includes(body.status)) s.status = body.status;
      writeFileSync(join(d, "flow.json"), JSON.stringify(flow, null, 2) + "\n");
      return send(res, 200, s);
    }
    const det = p.match(/^\/api\/videos\/([a-z0-9-]+)$/);
    if (det && req.method === "GET") {
      const d = join(VIDEOS, det[1]);
      if (!existsSync(d)) return send(res, 404, { error: "video not found" });
      const rd = (f) => (existsSync(join(d, f)) ? readFileSync(join(d, f), "utf8") : "");
      const ls = (sub) => (existsSync(join(d, sub)) ? readdirSync(join(d, sub)).filter((f) => !f.startsWith(".")) : []);
      const tl = rd("build/timeline.json") ? JSON.parse(rd("build/timeline.json")) : null;
      const url = (sub, f) => `/files/videos/${det[1]}/${sub}/${f}`;
      return send(res, 200, {
        ...stage(det[1]),
        duration: tl?.duration ?? null,
        beats: tl?.beats ?? [],
        ...(isOneTake(d) ? { beatTable: beatTable(d), beatsApproval: beatsApproval(d) } : {}),
        script: rd("script.md").split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n").trim(),
        paragraphs: scriptParagraphs(d),
        edits: pendingEdits(d),
        brief: rd("brief.md"),
        costs: rd("costs.md"),
        refSheets: ls("assets/reference").filter((f) => f.endsWith(".sheet.png")).map((f) => url("assets/reference", f)),
        refShots: ls("assets/reference").filter((f) => f.endsWith(".shots.png")).map((f) => url("assets/reference", f)),
        refData: ls("assets/reference").filter((f) => f.endsWith(".ref.md")).map((f) => rd(`assets/reference/${f}`)).join("\n\n"),
        refStatus: rd("assets/reference/.status.json") ? JSON.parse(rd("assets/reference/.status.json")) : null,
        refRunning: refQueue.has(det[1]),
        refAnalysis: rd("assets/reference/analysis.md"),
        concepts: checkConcepts(d),
        concept: (rd("request.json") ? JSON.parse(rd("request.json")) : {}).concept ?? null,
        voice: (() => {
          const brand = loadBrand(), g = brand.voice.gemini ?? {};
          const tv = typeVoice(brand, (rd("meta.json") ? JSON.parse(rd("meta.json")) : {}).type);
          const src = rd("voice/source.json") ? JSON.parse(rd("voice/source.json")) : null;
          const words = rd("voice/words.json") ? JSON.parse(rd("voice/words.json")) : [];
          const req = rd("request.json") ? JSON.parse(rd("request.json")) : {};
          return {
            choice: req.voice || "Gemini TTS",
            source: src?.provider ?? null,
            draft: !!src?.draft,
            words: words.length,
            seconds: words.length ? +words.at(-1).end.toFixed(1) : null,
            audio: existsSync(join(d, "assets", "voice.wav")) ? `/files/videos/${det[1]}/assets/voice.wav` : null,
            samples: ls("voice/samples").filter((f) => /\.(wav|mp3|m4a)$/i.test(f)).map((f) => ({ name: f.replace(/\.[^.]+$/, ""), url: url("voice/samples", f) })),
            speaker: req.voiceSpeaker || tv.speaker || g.speaker || null,
            style: req.voiceStyle || tv.style || g.style || "",
            brandSpeaker: g.speaker ?? null,
            voices: withSamples(g.voices),
            page: g.page ?? "https://aistudio.google.com/generate-speech",
            model: g.model ?? "",
            text: existsSync(join(d, "script.md")) ? spokenText(join(d, "script.md")).replace(/\n\n/g, " ") : "",
          };
        })(),
        screens: ls("assets/screens").filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => url("assets/screens", f)),
        footage: ls("assets/footage").filter((f) => /\.(mp4|mov|webm)$/i.test(f)).map((f) => url("assets/footage", f)),
        approval: approval(d),
        flowCheck: (() => { const f = checkFlow(d); return { errors: f.errors, warns: f.warns, total: f.total ?? 0, shots: f.flow?.shots ?? [], model: f.flow?.model ?? "" }; })(),
        musafo: isMusafo(d) ? (() => {
          const r = checkMusafo(d);
          const f = (x) => (existsSync(join(d, x)) ? `/files/videos/${det[1]}/${x}?t=${Math.round(statSync(join(d, x)).mtimeMs)}` : null);
          return { series: (existsSync(join(d, "meta.json")) ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")).series : null) ?? null, look: (existsSync(join(d, "meta.json")) ? JSON.parse(readFileSync(join(d, "meta.json"), "utf8")).look : null) ?? looksOf(storyType(d)).defaultLook, looks: looksOf(storyType(d)).looks, production: productionState(d), draft: existsSync(join(d, "draft.md")) ? readFileSync(join(d, "draft.md"), "utf8") : "", draftApproval: draftApproval(d), storyline: existsSync(join(d, "storyline.md")) ? readFileSync(join(d, "storyline.md"), "utf8") : "", storylineApproval: storylineApproval(d), storylineEditedAt: (existsSync(join(d, "request.json")) ? JSON.parse(readFileSync(join(d, "request.json"), "utf8")).storylineEditedAt : null) ?? null, charRefs: charRefs(d).map((x) => f(`assets/reference/tokoh/${x}`)), characters: (r.data.characters ?? []).map((c) => ({ ...c, sheetUrl: f(charSheet(c.id)), shots: r.data.shots.filter((s) => s.characters?.includes(c.id)).map((s) => s.id) })), hooks: loadHooks(d), hookErrors: existsSync(join(d, "storyline.md")) ? [...sourceFlowErrors(d), ...checkHooks(d)] : [], sourceText: existsSync(join(d, "assets", "reference", "bahan.md")) ? readFileSync(join(d, "assets", "reference", "bahan.md"), "utf8") : "", errors: r.errors, warns: r.warns, imageTool: r.data.imageTool ?? "", videoTool: r.data.videoTool ?? "", shots: r.data.shots.map((s) => ({ ...s, clip: r.data.clips?.find((c) => c.shots?.includes(s.id))?.id ?? null, frameUrl: f(`assets/frames/${s.id}.png`), clipUrl: f(`assets/footage/${s.id}.mp4`) })), clips: (r.data.clips ?? []).map((c) => ({ ...c, frameUrl: f(`assets/frames/${c.shots?.[0]}.png`), rawUrl: f(`assets/clips/${c.id}.mp4`) })) };
        })() : null,
      });
    }
    // Beat thumbnail from the latest render (cached; refreshed when the render changes)
    const th = p.match(/^\/api\/videos\/([a-z0-9-]+)\/thumb\/([a-z0-9-]+)\.jpg$/);
    if (th) {
      const d = join(VIDEOS, th[1]);
      const mp4 = join(d, "out", `${th[1]}.mp4`);
      const tlp = join(d, "build", "timeline.json");
      if (!existsSync(tlp)) return send(res, 404, { error: "no timeline" });
      const b = JSON.parse(readFileSync(tlp, "utf8")).beats.find((x) => x.id === th[2]);
      if (!b) return send(res, 404, { error: "no beat" });
      // no render yet, or the render is older than the current timeline (script/voice/shots changed): show the shot's
      // key visual instead of a frame from an outdated video (user 2026-11-07)
      const kv = join(d, "assets", "frames", `${b.id}.png`);
      if ((!existsSync(mp4) || statSync(mp4).mtimeMs < statSync(tlp).mtimeMs) && existsSync(kv)) {
        const out = join(d, "build", "thumbs", `${b.id}.kv.jpg`);
        if (!existsSync(out) || statSync(out).mtimeMs < statSync(kv).mtimeMs) {
          mkdirSync(join(d, "build", "thumbs"), { recursive: true });
          spawnSync("ffmpeg", ["-y", "-v", "error", "-i", kv, "-frames:v", "1", "-vf", "scale=216:-1", out]);
        }
        return serveFile(req, res, out);
      }
      if (!existsSync(mp4)) return send(res, 404, { error: "no render" });
      const out = join(d, "build", "thumbs", `${b.id}.jpg`);
      if (!existsSync(out) || statSync(out).mtimeMs < statSync(mp4).mtimeMs) {
        mkdirSync(join(d, "build", "thumbs"), { recursive: true });
        const at = b.start + Math.min(1.2, b.duration * 0.6);
        spawnSync("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(2), "-i", mp4, "-frames:v", "1", "-vf", "scale=216:-1", out]);
      }
      return serveFile(req, res, out);
    }
    if (p.startsWith("/files/")) {
      const rel = normalize(p.slice(7)).replace(/^([/\\])+/, "");
      if (rel.startsWith("..") || !/^(videos|library)[/\\]/.test(rel)) return send(res, 403, { error: "forbidden" });
      return serveFile(req, res, join(ROOT, rel));
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`TERTORTOR: http://localhost:${PORT}`);
  // style covers for subs that have none yet (a new sub gets one once it has a render): tools/sub-covers.mjs
  runTool([join(ROOT, "tools", "sub-covers.mjs")]).then((r) => { const made = r.out.split(/\r?\n/).filter((l) => l.startsWith("✔")); if (made.length) console.log(`cover gaya baru: ${made.length}`); });
});
