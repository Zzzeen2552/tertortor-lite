// progress.mjs: what Claude is working on after a click in TERTORTOR, how long it usually takes, and when it is done
// (user 2026-11-07: popup with an estimate after every approval, and a push notification when the work is finished).
//
// A process starts with a Studio event in .events.jsonl (draft-approved, storyline-approved, …) and is done when the
// file it produces is newer than the event. Measured durations go to .process-times.json, and the estimate becomes
// the 25th-75th percentile of the last runs once there are three of them.
// .waiting is the heartbeat of tools/wait-event.mjs: fresh = a Claude session will pick up the click.
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJSON, sceneTemplate } from "./lib.mjs";
import { productionDone, productionState, storylineApproval, draftApproval, checkHooks, loadMusafo, charSheet, STORY_TYPES, NO_DRAFT } from "./musafo.mjs";
import { approval, checkFlow } from "./flow.mjs";
import { isAws } from "./aws.mjs";

const EVENTS = join(ROOT, ".events.jsonl"), TIMES = join(ROOT, ".process-times.json"), BEAT = join(ROOT, ".waiting");
const VIDEOS = join(ROOT, "videos");
const mtime = (d, f) => (existsSync(join(d, f)) ? statSync(join(d, f)).mtimeMs : 0);
const typeOf = (d) => (existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).type ?? "" : "");
// one-take explainer preset (Docucine): no Flow step; voice → beat table → world
const isOneTake = (d) => { const id = existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).preset : null; const f = id && join(d, "..", "..", "presets", id, "preset.json"); return !!(f && existsSync(f) && readJSON(f).oneTake); };
const isStory = (d) => !!STORY_TYPES[typeOf(d)];

// event type → what Antigravity does next, default estimate in minutes, the file that marks it done, and what the user does then
export const PROCESSES = {
  "musafo-new": { label: "Antigravity menulis draft cerita", eta: [3, 8], out: (d) => (existsSync(join(d, "assets", "reference", "bahan.md")) && !NO_DRAFT.includes(typeOf(d)) ? "draft.md" : "storyline.md"), next: "draft siap kamu edit dan setujui" },
  // Berakit ke Hulu (user 2026-11-07): no draft step; the series storyline comes straight from the source and the user edits it
  "berakitkehulu-new": { label: "Antigravity menulis storyline (series bila lebih dari 2 menit)", eta: [4, 10], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  // Cinematic gaya cerita (user 2026-11-22): same start as Berakit ke Hulu
  "cinestory-new": { label: "Antigravity menulis storyline dari brief gaya Cinematic", eta: [4, 10], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  "bumidipijak-new": { label: "Antigravity menulis storyline (series bila lebih dari 2 menit)", eta: [4, 10], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  // Miracle of Hajj (user 2026-11-08): a short anecdote → storyline with the cause looked for and the verse, one video
  "miracleofhajj-new": { label: "Antigravity menyusun storyline: sebab yang dicari + dalil Al-Qur'an", eta: [3, 8], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  // photos of the main character added to a project later (tab Tokoh)
  characters: { label: "Antigravity membuat character sheet per usia dari foto tokoh", eta: [5, 15], out: () => "musafo.json", next: "character sheet siap dilihat di tab Tokoh" },
  // Ubah format (user 2026-11-13): a ticked ratio → its own project; pictures, clips and layout are remade, then rendered
  "format-new": { label: "Antigravity membuat ulang gambar, klip, dan tata letak untuk rasio baru, lalu merender", eta: [30, 90], done: (d, at) => { const s = d.split(/[\\/]/).pop(), f = join(d, "out", `${s}.mp4`); return existsSync(f) && statSync(f).mtimeMs > at ? statSync(f).mtimeMs : 0; }, next: "versi rasio baru siap ditonton" },
  "draft-approved": { label: "Antigravity menulis storyline dari draftmu", eta: [3, 6], out: () => "storyline.md", next: "storyline siap disetujui" },
  "storyline-approved": { label: "Antigravity menulis naskah per shot", eta: [5, 12], out: () => "script.md", next: "naskah siap disetujui" },
  "docucine-new": { label: "Antigravity menulis naskah dari sumber dan idemu", eta: [4, 10], out: () => "script.md", next: "naskah siap kamu edit dan setujui" },
  "beats-approved": { label: "Antigravity membangun dunia, mengecek still dan gerak kamera, lalu thumbnail", eta: [20, 45], out: () => "compositions/world.html", next: "dunia siap; setujui thumbnail lalu render" },
  // Video Explainer baru (user 2026-11-22: progres sesudah brief): Studio memanggil /ready → Antigravity melengkapi brief, lalu
  // naskah; dengan video referensi Antigravity berhenti di 2-3 konsep (concepts.json) dan user memilih dulu (event concept)
  "explainer-new": {
    label: (d) => (explainerWithRef(d) ? "Antigravity membaca brief dan video referensi, lalu menyusun 2-3 konsep" : "Antigravity melengkapi brief dan menulis naskah"),
    eta: (d) => (explainerWithRef(d) ? [8, 20] : [5, 12]),
    done: (d, at) => { const f = explainerWithRef(d) ? "concepts.json" : "script.md"; const t = mtime(d, f); return t > at && (f !== "script.md" || realScript(d)) ? t : 0; },
    steps: (d, at) => explainerNewSteps(d, at),
    next: (d) => (explainerWithRef(d) ? "konsep siap; pilih satu di tab Konsep" : "naskah siap kamu edit dan setujui"),
  },
  // done = a real script written after the concepts were offered. Not "after the click": Antigravity (or a pick made in chat) can
  // write the script seconds before Studio logs the click (user 2026-11-22: naskah selesai tapi Studio masih 50 %)
  concept: { label: "Antigravity menulis naskah dari konsep pilihanmu", eta: [5, 10], done: (d, at) => conceptScriptAt(d, at), steps: (d, at) => [{ label: "Konsep dipilih", done: 1 }, { label: "Naskah", done: conceptScriptAt(d, at) ? 1 : 0 }], next: "naskah siap disetujui" },
  "script-approved": {
    // Storytelling (user 2026-11-07): approving the script starts nothing; voice and images wait for the Production button
    skip: (d) => isStory(d),
    label: (d) => (isStory(d) ? "Antigravity membuat suara (Gemini TTS)" : isOneTake(d) ? "Antigravity membuat suara (Gemini TTS), lalu beat table" : "Antigravity menulis prompt Google Flow"),
    eta: (d) => (isStory(d) ? [10, 20] : isOneTake(d) ? [12, 25] : [5, 10]),
    out: (d) => (isStory(d) ? "voice/words.json" : isOneTake(d) ? "build/timeline.json" : "flow.json"),
    // measurable steps (user 2026-11-22: "berhenti di 95 %" while nothing had been written)
    steps: (d, at) => (isOneTake(d)
      ? [{ label: "Suara", done: mtime(d, "voice/words.json") > at ? 1 : 0 }, { label: "Beat table", done: mtime(d, "build/timeline.json") > Math.max(at, mtime(d, "voice/words.json") - 1) ? 1 : 0 }]
      : [{ label: "Prompt Flow ditulis", done: mtime(d, "flow.json") > at ? 1 : 0 }, { label: "Prompt Flow lolos check", done: mtime(d, "flow.json") > at && flowOk(d) ? 1 : 0 }]),
    next: (d) => (isStory(d) ? "suara selesai; gambar dan klip menyusul" : isOneTake(d) ? "beat table siap kamu setujui" : "prompt Flow siap"),
  },
  // done(d, at) → end time in ms (0 = not yet), for processes with more than one output file
  // Video Explainer (user 2026-11-20): tombol Production di tab Naskah → suara, beat, scene, gerbang check; render menunggu thumbnail
  // done = the gate passed after the click (tools/check.mjs writes build/check.json), not the first timeline.json
  "explainer-production": { label: "Antigravity membuat suara, beat, dan scene sampai lolos check", eta: [20, 50], done: (d, at) => (mtime(d, "build/check.json") > at ? mtime(d, "build/check.json") : 0), steps: (d) => explainerSteps(d), next: "scene siap dicek di preview HyperFrames; setujui thumbnail lalu render" },
  production: { label: "Antigravity membuat suara (Gemini TTS), lalu key visual per shot", eta: [20, 45], done: (d, at) => productionDone(d, at), steps: (d) => storySteps(d), next: "suara dan semua key visual sudah jadi" },
  // App Demo (product appdemo) writes demo.json, builds and renders: done when an MP4 is newer than the click
  "ad-new": { label: (d) => (existsSync(join(d, "demo.json")) ? "Antigravity menyusun storyboard demo aplikasi, membangun, lalu merender" : "Antigravity menyusun iklan"), eta: (d) => (existsSync(join(d, "demo.json")) ? [8, 20] : [10, 25]), done: (d, at) => { if (!existsSync(join(d, "demo.json"))) { const f = join(d, "ad.json"); return existsSync(f) && statSync(f).mtimeMs > at ? statSync(f).mtimeMs : 0; } const mp4 = existsSync(join(d, "out")) ? readdirSync(join(d, "out")).filter((x) => x.endsWith(".mp4")).map((x) => statSync(join(d, "out", x)).mtimeMs).sort((a, b) => b - a)[0] ?? 0 : 0; return mp4 > at ? mp4 : 0; }, next: (d) => (existsSync(join(d, "demo.json")) ? "demo aplikasi siap ditonton" : "iklan siap dicek") },
  // AWS (Cinematic, user 2026-11-17) answers with aws.json (data + scenes) and a first build: the animatic with slates and TBC chips
  "cinematic-new": { label: "Antigravity menyusun data, adegan, dan animatic rekap", eta: [5, 15], done: (d, at) => { if (!isAws(d)) return 0; const f = join(d, "build", "timeline.json"); return existsSync(f) && statSync(f).mtimeMs > at ? statSync(f).mtimeMs : 0; }, next: "animatic dan daftar footage siap di tab AWS" },
};

// ---------- measured steps for every process (user 2026-11-22: "cek di semua preset dan channel") ----------
// Each workflow is done when the file its NEXT user step needs is there, not when the first file appears:
//  - a story storyline can only be approved with 3 valid hooks (checkHooks), so storyline + hooks.json;
//  - a character sheet is assets/characters/<id>.png (musafo.json also changes for other reasons);
//  - every ad (Flashcut, BRI, App Demo) ends with a rendered MP4 the user watches; BRI never writes ad.json.
const hooksOk = (d) => { try { return checkHooks(d).length === 0; } catch { return false; } };
const newestFile = (d, sub, re) => { const dir = join(d, sub); if (!existsSync(dir)) return 0; let t = 0; for (const f of readdirSync(dir)) if (re.test(f)) t = Math.max(t, statSync(join(dir, f)).mtimeMs); return t; };
const mp4At = (d) => newestFile(d, "out", /\.mp4$/i);
const storylineSteps = (d, at) => [
  { label: "Storyline ditulis", done: mtime(d, "storyline.md") > at ? 1 : 0 },
  { label: "3 pilihan hook", done: mtime(d, "storyline.md") > at && hooksOk(d) ? 1 : 0 },
];
const storylineDone = (d, at) => { const t = mtime(d, "storyline.md"); return t > at && hooksOk(d) ? Math.max(t, mtime(d, "hooks.json")) : 0; };
for (const k of ["berakitkehulu-new", "bumidipijak-new", "miracleofhajj-new", "cinestory-new", "draft-approved"]) Object.assign(PROCESSES[k], { steps: storylineSteps, done: storylineDone });
// Musafo with a source text writes a draft first; without one it goes straight to the storyline
const musafoDraft = (d) => val(PROCESSES["musafo-new"].out, d) === "draft.md";
Object.assign(PROCESSES["musafo-new"], {
  steps: (d, at) => (musafoDraft(d) ? [{ label: "Draft cerita ditulis", done: mtime(d, "draft.md") > at ? 1 : 0 }] : storylineSteps(d, at)),
  done: (d, at) => (musafoDraft(d) ? (mtime(d, "draft.md") > at ? mtime(d, "draft.md") : 0) : storylineDone(d, at)),
});
const chars = (d) => loadMusafo(d)?.characters ?? [];
const sheetsNew = (d, at) => chars(d).filter((c) => mtime(d, charSheet(c.id)) > at).length;
Object.assign(PROCESSES.characters, {
  steps: (d, at) => [{ label: `Character sheet ${sheetsNew(d, at)}/${chars(d).length || "?"}`, done: chars(d).length ? sheetsNew(d, at) / chars(d).length : 0 }],
  // photos of one age → only that sheet is remade: done once a sheet is new and every age has one
  done: (d, at) => (sheetsNew(d, at) > 0 && chars(d).every((c) => existsSync(join(d, charSheet(c.id)))) ? Math.max(...chars(d).map((c) => mtime(d, charSheet(c.id)))) : 0),
});
const hasPhotos = (d) => existsSync(join(d, "assets", "reference", "tokoh")) && readdirSync(join(d, "assets", "reference", "tokoh")).some((f) => /\.(png|jpe?g|webp)$/i.test(f));
PROCESSES["storyline-approved"].steps = (d, at) => [
  ...(hasPhotos(d) ? [{ label: "Character sheet", done: chars(d).length && chars(d).every((c) => existsSync(join(d, charSheet(c.id)))) ? 1 : 0 }] : []),
  { label: "Naskah per shot", done: mtime(d, "script.md") > at ? 1 : 0 },
];
PROCESSES["format-new"].steps = (d, at) => [
  { label: "Gambar dan klip", done: Math.max(newestFile(d, "assets/frames", /./), newestFile(d, "assets/footage", /./), newestFile(d, "assets/keyvisuals", /./)) > at ? 1 : 0 },
  { label: "Tata letak", done: newestFile(d, "compositions", /\.html$/) > at ? 1 : 0 },
  { label: "Render", done: mp4At(d) > at ? 1 : 0 },
];
PROCESSES["cinematic-new"].steps = (d, at) => [
  { label: "Data dan adegan (aws.json)", done: mtime(d, "aws.json") > at ? 1 : 0 },
  { label: "Animatic", done: mtime(d, "build/timeline.json") > at ? 1 : 0 },
];
const productOf = (d) => (existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).product : null) ?? (existsSync(join(d, "demo.json")) ? "appdemo" : "flashcut");
Object.assign(PROCESSES["ad-new"], {
  label: (d) => ({ appdemo: "Antigravity menyusun storyboard demo aplikasi, membangun, lalu merender", bri: "Antigravity menggerakkan key visual, menyusun iklan BRI, lalu merender" }[productOf(d)] ?? "Antigravity menyusun iklan, lalu merender"),
  eta: (d) => ({ appdemo: [8, 20], bri: [20, 45] }[productOf(d)] ?? [10, 25]),
  steps: (d, at) => {
    const render = { label: "Render MP4", done: mp4At(d) > at ? 1 : 0 };
    if (productOf(d) === "bri") return [{ label: "Klip key visual", done: newestFile(d, "assets/footage", /\.mp4$/i) > at ? 1 : 0 }, { label: "Komposisi", done: mtime(d, "compositions/kv.html") > at ? 1 : 0 }, render];
    if (productOf(d) === "appdemo") return [{ label: "Storyboard (demo.json)", done: mtime(d, "demo.json") > at ? 1 : 0 }, render];
    return [{ label: "Susunan iklan (ad.json)", done: mtime(d, "ad.json") > at ? 1 : 0 }, render];
  },
  done: (d, at) => (mp4At(d) > at ? mp4At(d) : 0),
  next: (d) => (productOf(d) === "appdemo" ? "demo aplikasi siap ditonton" : "iklan siap ditonton dan disetujui"),
});
const val = (v, d) => (typeof v === "function" ? v(d) : v);

// ---------- progress (user 2026-11-22 "keliatan progress berapa persennya") ----------
// Measured from the files each step leaves behind, so a step Claude already finished before the click counts as done.
// A step's `done` is 0..1 (scenes count partly). Processes without steps get a time-based estimate (`estimated`).
const escStub = (t = "") => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// a scene counts as designed once its file no longer equals the stub cues.mjs wrote for it
function sceneDesigned(d, b) {
  const f = join(d, "compositions", `${b.id}.html`);
  if (!existsSync(f)) return false;
  const stub = (b.stub && sceneTemplate(d, b.stub)) || sceneTemplate(d, b.register ?? "type");
  if (!stub) return true;
  const fresh = readFileSync(stub, "utf8").replaceAll("__ID__", b.id).replaceAll("__HERO__", escStub(b.heroText ?? b.hero)).replaceAll("__JOB__", escStub(b.job));
  return readFileSync(f, "utf8") !== fresh;
}
function explainerSteps(d) {
  const words = mtime(d, "voice/words.json"), tl = mtime(d, "build/timeline.json"), chk = mtime(d, "build/check.json");
  let beats = [];
  try { beats = readJSON(join(d, "beats.json")).beats ?? []; } catch {}
  const designed = beats.filter((b) => sceneDesigned(d, b)).length;
  const lastScene = Math.max(0, ...beats.map((b) => mtime(d, `compositions/${b.id}.html`)));
  return [
    { label: "Prompt footage", done: existsSync(join(d, "flow.json")) ? 1 : 0 },
    { label: "Suara", done: words ? 1 : 0 },
    { label: "Beat", done: words && tl >= words ? 1 : 0 },
    { label: `Scene ${designed}/${beats.length || "?"}`, done: beats.length ? designed / beats.length : 0 },
    { label: "Lolos check", done: chk && chk >= Math.max(tl, lastScene) ? 1 : 0 },
  ];
}
// script.md with real lines (the template has only # notes), same rule as the Studio's explainerStage
const realScript = (d) => existsSync(join(d, "script.md")) && readFileSync(join(d, "script.md"), "utf8").split(/\r?\n/).filter((l) => l.trim() && !/^\s*[#>]/.test(l)).length > 2;
const reqOf = (d) => (existsSync(join(d, "request.json")) ? readJSON(join(d, "request.json")) : {});
const refDir = (d) => join(d, "assets", "reference");
const refList = (d) => (existsSync(refDir(d)) ? readdirSync(refDir(d)) : []);
const explainerWithRef = (d) => refList(d).some((f) => /\.(mp4|mov|webm|m4v)$/i.test(f)) || !!reqOf(d).refLink;
// the script for a picked concept: real lines, and newer than the concepts (or than the click, when no concepts.json)
const conceptScriptAt = (d, at) => {
  const t = mtime(d, "script.md"), offered = mtime(d, "concepts.json") || at;
  return realScript(d) && t > Math.min(at, offered) ? t : 0;
};
function explainerNewSteps(d, at) {
  // "Diisi Claude" in brief.md: done once its first field has text after the click
  const brief = existsSync(join(d, "brief.md")) ? readFileSync(join(d, "brief.md"), "utf8") : "";
  const briefDone = mtime(d, "brief.md") > at && /\*\*Penonton:\*\*[ \t]*\S/.test(brief) ? 1 : 0;
  if (explainerWithRef(d)) {
    const files = refList(d);
    return [
      { label: "Brief dilengkapi", done: briefDone },
      { label: "Video referensi diukur", done: files.some((f) => f.endsWith(".ref.md")) ? 1 : 0 },
      { label: "Analisis referensi", done: files.includes("analysis.md") ? 1 : 0 },
      { label: "2-3 konsep", done: mtime(d, "concepts.json") > at ? 1 : 0 },
    ];
  }
  return [
    { label: "Brief dilengkapi", done: briefDone },
    { label: "Naskah ditulis", done: mtime(d, "script.md") > at && realScript(d) ? 1 : 0 },
  ];
}
function storySteps(d) {
  const st = productionState(d);
  return [
    { label: "Suara", done: st.voice ? 1 : 0 },
    { label: `Key visual ${st.frames}/${st.need}`, done: st.need ? st.frames / st.need : 0 },
  ];
}
function progressOf(type, d, at, eta) {
  const P = PROCESSES[type];
  if (P.steps) {
    let steps;
    try { steps = P.steps(d, at); } catch { steps = null; }
    if (steps?.length) {
      const sum = steps.reduce((a, s) => a + s.done, 0);
      const now = steps.find((s) => s.done < 1);
      // never 100 % while the process is still listed as running
      return { pct: Math.min(99, Math.round((100 * sum) / steps.length)), step: now?.label ?? steps.at(-1).label, steps: steps.map((s) => ({ label: s.label, done: s.done >= 1 })), estimated: false };
    }
  }
  // time-based estimate only once Antigravity has visibly started: a click nobody picked up must not crawl to 95 %
  if (!activitySince(d, at)) return { pct: 0, step: claudeWaiting() ? "Antigravity mulai sebentar lagi" : "Menunggu Antigravity (menunggu giliran / klik di Studio)", steps: [], estimated: true, idle: true };
  const mid = ((eta[0] + eta[1]) / 2) * 60e3;
  return { pct: Math.min(90, Math.round((100 * (Date.now() - at)) / mid)), step: null, steps: [], estimated: true };
}

// flow.json passes `npm run flow -- check` (no errors)
function flowOk(d) {
  try { return checkFlow(d).errors.length === 0; } catch { return false; }
}
// any file Claude wrote in the project after the click; Studio's own writes (approval, captions, edits, caches) don't count
const STUDIO_FILES = new Set(["request.json", "caption.md", "script-edits.json", ".status.json", "tebar.json", "share.json"]);
const STUDIO_DIRS = new Set([".thumbnails", ".waveform-cache", ".hyperframes", "node_modules", ".trash"]);
function activitySince(d, at, depth = 0) {
  let names = [];
  try { names = readdirSync(d, { withFileTypes: true }); } catch { return false; }
  for (const e of names) {
    if (e.isDirectory()) {
      if (STUDIO_DIRS.has(e.name) || depth > 3) continue;
      if (activitySince(join(d, e.name), at, depth + 1)) return true;
    } else if (!STUDIO_FILES.has(e.name)) {
      try { if (statSync(join(d, e.name)).mtimeMs > at) return true; } catch {}
    }
  }
  return false;
}


const endAt = (type, d, at) => (PROCESSES[type].done ? PROCESSES[type].done(d, at) : mtime(d, val(PROCESSES[type].out, d)));

// ---------- when a process really starts (user 2026-11-22: naskah selesai tapi Studio masih 50 %, "di semua preset dan channel")
// The click is logged when Studio receives it, but the approval or pick it stands for can come earlier: made in chat with
// Claude, or Claude already working on it. Work finished between that moment and the click must count, or the process sticks
// forever. So each process is measured from its input: the approval/concepts it is based on, when that came shortly
// before the click (≤ 2 h; an older one means the user is re-running the step on purpose, so the click counts).
const isoMs = (iso) => (iso ? Date.parse(iso) || 0 : 0);
const approvedAt = (a) => (a?.approved ? isoMs(a.at) : 0);
const FROM = {
  "draft-approved": (d) => approvedAt(draftApproval(d)),
  "storyline-approved": (d) => approvedAt(storylineApproval(d)),
  "script-approved": (d) => approvedAt(approval(d)),
  "beats-approved": (d) => isoMs(reqOf(d).beatsApprovedAt),
  concept: (d) => mtime(d, "concepts.json"),
  "explainer-production": (d) => approvedAt(approval(d)),
  production: (d) => approvedAt(approval(d)),
};
const LOOKBACK = 2 * 3600e3;
function startOf(type, d, at) {
  let f = 0;
  try { f = FROM[type]?.(d) ?? 0; } catch {}
  return f > 0 && f < at && at - f <= LOOKBACK ? f : at;
}
const times = () => { try { return JSON.parse(readFileSync(TIMES, "utf8")); } catch { return {}; } };
function estimate(type, d) {
  const runs = (times()[type] ?? []).slice(-8).map((x) => x.s / 60).sort((a, b) => a - b);
  if (runs.length < 3) return val(PROCESSES[type].eta, d);
  const q = (p) => runs[Math.min(runs.length - 1, Math.floor(p * runs.length))];
  return [Math.max(1, Math.round(q(0.25))), Math.max(1, Math.round(q(0.75)))];
}

export const claudeWaiting = () => existsSync(BEAT) && Date.now() - statSync(BEAT).mtimeMs < 10e3;
export const antigravityWaiting = claudeWaiting;

// running processes: the newest process event of each project that has no newer output yet (and is under 6 hours old)
export function working() {
  if (!existsSync(EVENTS)) return [];
  const last = {};
  for (const l of readFileSync(EVENTS, "utf8").split("\n")) {
    if (!l.trim()) continue;
    let e; try { e = JSON.parse(l); } catch { continue; }
    if (PROCESSES[e.type] && e.slug) last[e.slug] = e;
  }
  const out = [];
  for (const e of Object.values(last)) {
    const d = join(VIDEOS, e.slug), at = Date.parse(e.at);
    if (!existsSync(d) || Date.now() - at > 6 * 3600e3) continue;
    const P = PROCESSES[e.type];
    if (P.skip?.(d)) continue;
    const since = startOf(e.type, d, at);
    if (endAt(e.type, d, since) > since) continue;
    const name = existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).name : e.slug;
    const eta = estimate(e.type, d);
    out.push({ slug: e.slug, name, type: e.type, label: val(P.label, d), since: e.at, eta, next: val(P.next, d), progress: progressOf(e.type, d, since, eta) });
  }
  return out;
}

// called every few seconds by the Studio server: processes that were running last time and are done now
let prev = null;
export function finished() {
  const now = working(), was = prev ?? now;
  prev = now;
  // gone from the list because its output appeared (not because a newer click replaced it)
  const startW = (w) => startOf(w.type, join(VIDEOS, w.slug), Date.parse(w.since));
  const endOf = (w) => endAt(w.type, join(VIDEOS, w.slug), startW(w));
  const done = was.filter((w) => !now.some((n) => n.slug === w.slug && n.since === w.since) && endOf(w) > startW(w));
  const t = times();
  for (const w of done) {
    // work finished before the click was logged (e.g. a script written while the concept was picked in chat): no timing
    if (endOf(w) - Date.parse(w.since) < 10e3) continue;
    (t[w.type] ??= []).push({ s: Math.round((endOf(w) - Date.parse(w.since)) / 1000), at: w.since });
    if (t[w.type].length > 30) t[w.type] = t[w.type].slice(-30);
  }
  if (done.length) writeFileSync(TIMES, JSON.stringify(t, null, 1));
  return done;
}
