// progress.mjs: what Claude is working on after a click in TERTORTOR, how long it usually takes, and when it is done
// (user 2026-11-07: popup with an estimate after every approval, and a push notification when the work is finished).
//
// A process starts with a Studio event in .events.jsonl (draft-approved, storyline-approved, …) and is done when the
// file it produces is newer than the event. Measured durations go to .process-times.json, and the estimate becomes
// the 25th-75th percentile of the last runs once there are three of them.
// .waiting is the heartbeat of tools/wait-event.mjs: fresh = a Claude session will pick up the click.
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJSON } from "./lib.mjs";
import { productionDone } from "./musafo.mjs";

const EVENTS = join(ROOT, ".events.jsonl"), TIMES = join(ROOT, ".process-times.json"), BEAT = join(ROOT, ".waiting");
const VIDEOS = join(ROOT, "videos");
const mtime = (d, f) => (existsSync(join(d, f)) ? statSync(join(d, f)).mtimeMs : 0);
const typeOf = (d) => (existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).type ?? "" : "");
// one-take explainer preset (Docucine): no Flow step; voice → beat table → world
const isOneTake = (d) => { const id = existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).preset : null; const f = id && join(d, "..", "..", "presets", id, "preset.json"); return !!(f && existsSync(f) && readJSON(f).oneTake); };
const isStory = (d) => ["musafo", "berakitkehulu", "bumidipijak", "miracleofhajj"].includes(typeOf(d));

// event type → what Claude does next, default estimate in minutes, the file that marks it done, and what the user does then
export const PROCESSES = {
  "musafo-new": { label: "Claude menulis draft cerita", eta: [3, 8], out: (d) => (existsSync(join(d, "assets", "reference", "bahan.md")) && !["berakitkehulu", "bumidipijak", "miracleofhajj"].includes(typeOf(d)) ? "draft.md" : "storyline.md"), next: "draft siap kamu edit dan setujui" },
  // Berakit ke Hulu (user 2026-11-07): no draft step; the series storyline comes straight from the source and the user edits it
  "berakitkehulu-new": { label: "Claude menulis storyline (series bila lebih dari 2 menit)", eta: [4, 10], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  "bumidipijak-new": { label: "Claude menulis storyline (series bila lebih dari 2 menit)", eta: [4, 10], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  // Miracle of Hajj (user 2026-11-08): a short anecdote → storyline with the cause looked for and the verse, one video
  "miracleofhajj-new": { label: "Claude menyusun storyline: sebab yang dicari + dalil Al-Qur'an", eta: [3, 8], out: () => "storyline.md", next: "storyline siap kamu edit dan setujui" },
  // photos of the main character added to a project later (tab Tokoh)
  characters: { label: "Claude membuat character sheet per usia dari foto tokoh", eta: [5, 15], out: () => "musafo.json", next: "character sheet siap dilihat di tab Tokoh" },
  "draft-approved": { label: "Claude menulis storyline dari draftmu", eta: [3, 6], out: () => "storyline.md", next: "storyline siap disetujui" },
  "storyline-approved": { label: "Claude menulis naskah per shot", eta: [5, 12], out: () => "script.md", next: "naskah siap disetujui" },
  "docucine-new": { label: "Claude menulis naskah dari sumber dan idemu", eta: [4, 10], out: () => "script.md", next: "naskah siap kamu edit dan setujui" },
  "beats-approved": { label: "Claude membangun dunia, mengecek still dan gerak kamera, lalu thumbnail", eta: [20, 45], out: () => "compositions/world.html", next: "dunia siap; setujui thumbnail lalu render" },
  concept: { label: "Claude menulis naskah dari konsep pilihanmu", eta: [5, 10], out: () => "script.md", next: "naskah siap disetujui" },
  "script-approved": {
    // Storytelling (user 2026-11-07): approving the script starts nothing; voice and images wait for the Production button
    skip: (d) => isStory(d),
    label: (d) => (isStory(d) ? "Claude membuat suara (Gemini TTS)" : isOneTake(d) ? "Claude membuat suara (Gemini TTS), lalu beat table" : "Claude menulis prompt Google Flow"),
    eta: (d) => (isStory(d) ? [10, 20] : isOneTake(d) ? [12, 25] : [5, 10]),
    out: (d) => (isStory(d) ? "voice/words.json" : isOneTake(d) ? "build/timeline.json" : "flow.json"),
    next: (d) => (isStory(d) ? "suara selesai; gambar dan klip menyusul" : isOneTake(d) ? "beat table siap kamu setujui" : "prompt Flow siap"),
  },
  // done(d, at) → end time in ms (0 = not yet), for processes with more than one output file
  production: { label: "Claude membuat suara (Gemini TTS), lalu key visual per shot", eta: [20, 45], done: (d, at) => productionDone(d, at), next: "suara dan semua key visual sudah jadi" },
  // App Demo (product appdemo) writes demo.json, builds and renders: done when an MP4 is newer than the click
  "ad-new": { label: (d) => (existsSync(join(d, "demo.json")) ? "Claude menyusun storyboard demo aplikasi, membangun, lalu merender" : "Claude menyusun iklan"), eta: (d) => (existsSync(join(d, "demo.json")) ? [8, 20] : [10, 25]), done: (d, at) => { if (!existsSync(join(d, "demo.json"))) { const f = join(d, "ad.json"); return existsSync(f) && statSync(f).mtimeMs > at ? statSync(f).mtimeMs : 0; } const mp4 = existsSync(join(d, "out")) ? readdirSync(join(d, "out")).filter((x) => x.endsWith(".mp4")).map((x) => statSync(join(d, "out", x)).mtimeMs).sort((a, b) => b - a)[0] ?? 0 : 0; return mp4 > at ? mp4 : 0; }, next: (d) => (existsSync(join(d, "demo.json")) ? "demo aplikasi siap ditonton" : "iklan siap dicek") },
};
const val = (v, d) => (typeof v === "function" ? v(d) : v);

const endAt = (type, d, at) => (PROCESSES[type].done ? PROCESSES[type].done(d, at) : mtime(d, val(PROCESSES[type].out, d)));
const times = () => { try { return JSON.parse(readFileSync(TIMES, "utf8")); } catch { return {}; } };
function estimate(type, d) {
  const runs = (times()[type] ?? []).slice(-8).map((x) => x.s / 60).sort((a, b) => a - b);
  if (runs.length < 3) return val(PROCESSES[type].eta, d);
  const q = (p) => runs[Math.min(runs.length - 1, Math.floor(p * runs.length))];
  return [Math.max(1, Math.round(q(0.25))), Math.max(1, Math.round(q(0.75)))];
}

export const claudeWaiting = () => existsSync(BEAT) && Date.now() - statSync(BEAT).mtimeMs < 10e3;

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
    if (endAt(e.type, d, at) > at) continue;
    const name = existsSync(join(d, "meta.json")) ? readJSON(join(d, "meta.json")).name : e.slug;
    out.push({ slug: e.slug, name, type: e.type, label: val(P.label, d), since: e.at, eta: estimate(e.type, d), next: val(P.next, d) });
  }
  return out;
}

// called every few seconds by the Studio server: processes that were running last time and are done now
let prev = null;
export function finished() {
  const now = working(), was = prev ?? now;
  prev = now;
  // gone from the list because its output appeared (not because a newer click replaced it)
  const endOf = (w) => endAt(w.type, join(VIDEOS, w.slug), Date.parse(w.since));
  const done = was.filter((w) => !now.some((n) => n.slug === w.slug && n.since === w.since) && endOf(w) > Date.parse(w.since));
  const t = times();
  for (const w of done) {
    (t[w.type] ??= []).push({ s: Math.round((endOf(w) - Date.parse(w.since)) / 1000), at: w.since });
    if (t[w.type].length > 30) t[w.type] = t[w.type].slice(-30);
  }
  if (done.length) writeFileSync(TIMES, JSON.stringify(t, null, 1));
  return done;
}
