// flow.mjs: script approval + the Google Flow shot list (videos/<slug>/flow.json).
//
//   node tools/flow.mjs approve <slug>     record that the user approved script.md (as it is now)
//   node tools/flow.mjs status  <slug>     approval + prompt check
//   node tools/flow.mjs check   <slug>     validate flow.json (exit 1 on errors)
//   node tools/flow.mjs cut     <slug> <shotId> <libraryClipId>
//                                          split one downloaded multi-cut clip into its beats
//
// One Flow generation is up to 10 s (brand.json flow.maxClipSeconds). Use the whole length: write ONE prompt
// with several timecoded cuts that serve several beats (hook shot A, B, C...), in one consistent world.
// After download: library add, then `flow cut` trims each cut (snapped to the real scene change) into
// assets/footage/<asset>.mp4 for its beat.
//
// Order is the point: Claude writes the script -> the user approves it (Studio button or in chat) -> only then
// Claude writes flow.json, one entry per shot, written FOR that approved text. If script.md changes afterwards,
// the approval and the prompts are stale and must be redone.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readJSON, writeJSON, spokenText, loadBrand, ROOT, run, probeDuration, die } from "./lib.mjs";

export const scriptHash = (dir) => createHash("sha1").update(spokenText(join(dir, "script.md"))).digest("hex").slice(0, 12);

const req = (dir) => (existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {});

export function approval(dir) {
  const a = req(dir).approval;
  if (!a) return { approved: false, stale: false };
  return { approved: a.hash === scriptHash(dir), stale: a.hash !== scriptHash(dir), at: a.at, by: a.by };
}

export function approve(dir, by = "user") {
  const r = req(dir);
  r.approval = { hash: scriptHash(dir), at: new Date().toISOString(), by };
  r.status = "naskah disetujui";
  writeJSON(join(dir, "request.json"), r);
  return r.approval;
}

export function unapprove(dir) {
  const r = req(dir);
  delete r.approval;
  r.status = "menunggu persetujuan naskah";
  writeJSON(join(dir, "request.json"), r);
}

// A shot without "cuts" is one cut covering the whole clip.
export const cutsOf = (s) => (s.cuts?.length ? s.cuts : s.beat ? [{ from: 0, to: s.seconds, beat: s.beat, cue: s.cue, desc: s.purpose, asset: s.asset }] : []);

// Split a downloaded generation into its cuts. Planned boundaries are scaled to the real clip length, then
// snapped to the nearest real scene change within 0.8 s (models drift a few frames off the timecodes).
export async function cutClip(dir, shotId, clipId) {
  const { LIB, useClip } = await import("./library.mjs");
  const flow = loadFlow(dir);
  const s = flow?.shots?.find((x) => x.id === shotId);
  if (!s) die(`shot ${shotId} not in flow.json`);
  const db = readJSON(join(LIB, "footage.json"));
  const clip = db.clips.find((c) => c.id === clipId);
  if (!clip) die(`clip ${clipId} not in library (npm run library -- add ... first)`);
  const file = join(LIB, clip.file);
  const len = probeDuration(file);
  const scale = len / s.seconds;
  const sc = run("ffmpeg", ["-hide_banner", "-i", file, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"]);
  const changes = [...sc.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]);
  const cuts = cutsOf(s);
  const snap = (t) => { const near = changes.filter((c) => Math.abs(c - t) <= 0.8).sort((a, b) => Math.abs(a - t) - Math.abs(b - t))[0]; return near ?? t; };
  const bounds = [0, ...cuts.slice(0, -1).map((c) => snap(c.to * scale)), len];
  const count = {};
  const out = [];
  cuts.forEach((c, i) => {
    count[c.beat] = (count[c.beat] ?? 0) + 1;
    const dupes = cuts.filter((x) => x.beat === c.beat).length;
    const asset = c.asset ?? (dupes > 1 ? `${c.beat}-${count[c.beat]}` : c.beat);
    const start = bounds[i] + (i ? 0.04 : 0); // skip the transition frame
    const dur = Math.max(0.5, bounds[i + 1] - start - 0.04);
    useClip(clipId, dir.split(/[\\/]/).pop(), asset, { start: +start.toFixed(3), dur: +dur.toFixed(3) });
    out.push({ asset, beat: c.beat, start, dur });
  });
  s.status = "library";
  s.clipId = clipId;
  writeJSON(join(dir, "flow.json"), flow);
  return { out, changes, scale };
}

export const loadFlow = (dir) => (existsSync(join(dir, "flow.json")) ? readJSON(join(dir, "flow.json")) : null);

const SCREEN = /\b(phone|smartphone|screen|laptop|monitor|tablet|hp|ponsel|layar)\b/i;
const PEOPLE = /\b(person|man|woman|people|figure|hand|hands|thief|child|kid|orang|pria|wanita|tangan)\b/i;

// Every rule here is a way a generated shot was wasted before: a fake lock screen, a slow push-in that kills
// "security camera", readable faces, burned-in text, the wrong aspect.
export function checkFlow(dir) {
  const brand = loadBrand(dir);
  const errors = [], warns = [];
  const flow = loadFlow(dir);
  const ap = approval(dir);
  if (!ap.approved) errors.push(ap.stale ? "the script changed after approval: get it approved again, then rewrite the prompts" : "the script is not approved yet: prompts come after approval");
  if (!flow) return { errors: [...errors, "flow.json missing"], warns, flow, approval: ap };
  if (flow.scriptHash !== scriptHash(dir)) errors.push("flow.json was written for a different version of the script: rewrite it");
  const ids = new Set();
  let total = 0;
  const maxClip = brand.flow?.maxClipSeconds ?? 10;
  for (const s of flow.shots ?? []) {
    const tag = `shot ${s.id ?? "?"}`;
    if (!s.id || ids.has(s.id)) errors.push(`${tag}: missing or duplicate id`);
    ids.add(s.id);
    for (const k of ["purpose", "seconds", "mode", "motion"]) if (s[k] == null || s[k] === "") errors.push(`${tag}: "${k}" is empty`);
    if (s.mode === "frames" && !s.firstFrame && !s.keyvisual) errors.push(`${tag}: frames mode needs a firstFrame prompt or a keyvisual`);
    if (s.seconds > maxClip) errors.push(`${tag}: ${s.seconds}s; one Flow clip is at most ${maxClip} s (split into two generations)`);
    if (s.seconds < maxClip - 2) warns.push(`${tag}: only ${s.seconds}s of a ${maxClip}s generation; add a cut for another beat instead of paying for unused seconds`);
    total += +s.seconds || 0;
    // cuts: contiguous, each long enough to read, each named in the prompt by its timecode
    const cuts = cutsOf(s);
    if (!cuts.length) errors.push(`${tag}: no cuts (give "cuts" or "beat" + "cue")`);
    let t = 0;
    cuts.forEach((c, i) => {
      if (!c.beat || !c.cue || !c.desc) errors.push(`${tag} cut ${i + 1}: needs beat, cue and desc`);
      if (Math.abs(c.from - t) > 0.05) errors.push(`${tag} cut ${i + 1}: starts at ${c.from}s, expected ${t}s (cuts must be contiguous)`);
      if (c.to - c.from < 1.5) errors.push(`${tag} cut ${i + 1}: ${(c.to - c.from).toFixed(1)}s is too short to read (min 1.5 s)`);
      t = c.to;
    });
    if (cuts.length && Math.abs(t - s.seconds) > 0.05) errors.push(`${tag}: cuts end at ${t}s but the shot is ${s.seconds}s`);
    if (cuts.length > 4) warns.push(`${tag}: ${cuts.length} cuts in one generation; the model starts merging them above 4`);
    if (cuts.length > 1) {
      const codes = (s.motion.match(/\[?\b\d{1,2}(?:[.:]\d+)?\s*(?:s|sec)?\s*[-–]\s*\d{1,2}(?:[.:]\d+)?\s*s\b\]?/gi) || []).length;
      if (codes < cuts.length) errors.push(`${tag}: ${cuts.length} cuts but ${codes} timecodes in the prompt; write each cut as "[0-3s] ...", "[3-6s] Hard cut to ..."`);
      if (!/hard cut|cut to/i.test(s.motion)) errors.push(`${tag}: say "hard cut to" between cuts, or the model blends them into one move`);
      if (!/same [\w' -]{0,24}?(night|evening|day|world|room|location|wardrobe|lighting|lamp|light|grain|person|hand|clothes|sleeve)|consistent/i.test(s.motion)) errors.push(`${tag}: multi-cut: state the continuity ("same night, same wardrobe, same grain in every cut")`);
    }
    const all = `${s.firstFrame ?? ""} ${s.motion ?? ""}`;
    if (!/9:16|vertical|portrait/i.test(all)) errors.push(`${tag}: say "vertical 9:16"`);
    if (!/no (on-screen )?text|without text/i.test(all)) errors.push(`${tag}: add "no text, no watermark, no captions"`);
    if (!/locked off|never (moves|pans|zooms)|handheld|static camera/i.test(s.motion ?? "")) errors.push(`${tag}: name the camera move (e.g. "completely locked off, never pans or zooms" or "slight handheld shake")`);
    // The model draws gear it reads about: "camera on a tripod" put a real tripod in shot (penipuan-wa, Omni 1.1 Flash).
    if (/\b(tripod|gimbal|rig|dolly|slider|crane|camera operator)\b/i.test(all)) errors.push(`${tag}: do not name camera gear ("tripod", "gimbal", "rig"); the model draws it in frame. Describe the result instead: "static camera, completely locked off"`);
    if (SCREEN.test(all) && !/(completely black|switched off|screen is off|dead and switched off)/i.test(all)) errors.push(`${tag}: a screen is in the shot: it must be "completely black, dead and switched off", or the model invents a fake UI`);
    if (PEOPLE.test(all) && !/(not identifiable|indistinct|face not visible|faces? (are )?hidden|from behind|no face)/i.test(all)) errors.push(`${tag}: people are in the shot: keep faces indistinct / not identifiable`);
    if (/cinematic|8k|masterpiece|ultra[- ]?realistic/i.test(all)) warns.push(`${tag}: "cinematic/8K" gives AI stock; describe the camera, lens and sensor instead`);
  }
  if (!(flow.shots ?? []).length) warns.push("no shots: fine only if no beat needs real-world footage");
  if (total > brand.limits.maxFootageSeconds) warns.push(`${total}s of footage planned (> ${brand.limits.maxFootageSeconds}s budget): keep it for threat / real-event beats`);
  const plan = existsSync(join(dir, "beats.json")) ? readJSON(join(dir, "beats.json")) : null;
  if (plan) for (const b of plan.beats.filter((b) => b.register === "footage")) if (!(flow.shots ?? []).some((s) => cutsOf(s).some((c) => c.beat === b.id))) errors.push(`beat ${b.id} is register "footage" but no Flow cut serves it`);
  return { errors, warns, flow, approval: ap, total };
}

if (process.argv[1]?.endsWith("flow.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  const dir = join(ROOT, "videos", slug ?? "");
  if (!slug || !existsSync(dir)) { console.error("Usage: node tools/flow.mjs approve|status|check <slug>"); process.exit(1); }
  if (cmd === "approve") { const a = approve(dir, "chat"); console.log(`\u2714 script approved (${a.hash}) at ${a.at}`); }
  else if (cmd === "cut") {
    const [, , shotId, clipId] = process.argv.slice(2);
    const r = await cutClip(dir, shotId, clipId);
    console.log(`scene changes found: ${r.changes.map((c) => c.toFixed(2)).join(", ") || "none"}`);
    for (const o of r.out) console.log(`  ${o.asset}.mp4  <- ${o.start.toFixed(2)}s +${o.dur.toFixed(2)}s  (beat ${o.beat})`);
  }
  else {
    const r = checkFlow(dir);
    console.log(`scriptHash ${scriptHash(dir)}
script: ${r.approval.approved ? "approved" : r.approval.stale ? "CHANGED after approval" : "not approved"}${r.flow ? `, ${r.flow.shots?.length ?? 0} shot(s), ${r.total ?? 0}s` : ", no flow.json"}`);
    for (const w of r.warns) console.log(`⚠ ${w}`);
    for (const e of r.errors) console.log(`✖ ${e}`);
    if (cmd === "check") process.exit(r.errors.length ? 1 : 0);
  }
}
