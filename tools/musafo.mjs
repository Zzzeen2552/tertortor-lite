// musafo.mjs: Musafo projects (meta.json type "musafo"). Raw material (article, book excerpt, rough idea) ->
// storyline.md (user approves) -> a story told as narration over one stylized 3D clip per shot,
// captions in Indonesian + English. Voice, cues, check and finish are the explainer's; musafo.json is the shot list
// and everything else (script.md, beats.json, compositions/<shot>.html, captions) is generated from it.
//
//   node tools/musafo.mjs new   <slug> "Judul" [--story file.txt]   (Studio does this from the raw-material form)
//   node tools/musafo.mjs storyline-approve <slug>                   (or the button in Studio)
//   node tools/musafo.mjs series <slug> <parts>                      story > 90 s -> <slug>, <slug>-2, ... (one project per part)
//   node tools/musafo.mjs build <slug>          musafo.json -> script.md + beats.json + scenes (+ cues once the voice exists)
//   node tools/musafo.mjs clips <slug> [--force] [--seconds 10]  after the voice: group shots into multi-cut H3 generates (≤ 15 s; 10 for Flow)
//   node tools/musafo.mjs add   <slug> image <shotId> <file>
//   node tools/musafo.mjs add   <slug> clip <clipId|shotId> <file>   (clipId: split at the detected cuts into its shots)
//   node tools/musafo.mjs check <slug>
//
// musafo.json: { "shots": [ { "id": "s01", "framing": "wide|medium|close", "hero": "what the picture shows",
//   "lines": [ { "text": "Di antara jutaan manusia,", "en": "Among millions of people," } ],
//   "image": "<image prompt, starts with the style block>", "motion": "<image-to-video prompt>" } ],
//   "clips": [ { "id": "c1", "shots": ["s01", "s02", "s03"], "seconds": 13, "cuts": [4.2, 8.9], "prompt": "<H3 multi-shot>" } ] }
// Files follow the id: assets/frames/<id>.png (first frame), assets/footage/<id>.mp4 (clip, 1080x1920, silent).
// With "clips" (user 2026-11-03), one H3 generate carries 2-4 consecutive shots as [Shot 1], [Shot 2], ... cut at the
// beat lengths from build/timeline.json; only the first shot of each clip needs an image (LOAD IMAGE = first frame).
// The raw generate is kept at assets/clips/<clipId>.mp4 and split into assets/footage/<shotId>.mp4.
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, readJSON, writeJSON, die, run, probeDuration, loadBrand, norm, idWords } from "./lib.mjs";
import { prepFootage } from "./prep-footage.mjs";
import { approval } from "./flow.mjs";
import { logEdits } from "./script-edit.mjs";
import { gemini } from "./gemini-api.mjs";
import { createHash } from "node:crypto";
import { ayatErrors, CLOSING_RE } from "./ayat.mjs";

const FRAMINGS = ["wide", "medium", "close"];
// Story project types that share this engine (user 2026-11-05): Musafo, and Berakit ke Hulu (its own project type and
// channel: brand origin stories, same flow, own image style). Each reads brand.json → <type> (styleAnchor, people,
// refs, clipLook, clipKeep, video, maxSeconds, ...).
// BumiDiPijak (user 2026-11-08, "fully independent"): its own type too, legends and history from Babad Tanah Jawa,
// dark oil paintings (standard since 2026-11-08, brand.json → bumidipijak), own preset (presets/bumidipijak) and skill (/bumidipijak)
export const STORY_TYPES = { musafo: { label: "Musafo", skill: "musafo" }, berakitkehulu: { label: "Berakit ke Hulu", skill: "berakit-ke-hulu" }, bumidipijak: { label: "BumiDiPijak", skill: "bumidipijak" }, miracleofhajj: { label: "Miracle of Hajj", skill: "miracle-of-hajj" } };
// types that go from the source straight to a storyline the user edits (no Draft step); BKH and BDP split past 2 minutes,
// Miracle of Hajj (user 2026-11-08: Musafo look, pilgrims' experiences, one story up to 150 s) builds a whole story out of a
// two-sentence anecdote, so a draft of the source would add nothing
export const NO_DRAFT = ["berakitkehulu", "bumidipijak", "miracleofhajj"];
export const storyType = (dir) => (dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")).type : null);
// a Musafo channel with its own look (BumiDiPijak, kisah Babad Tanah Jawa, user 2026-11-07: same flow, hand-drawn plates instead of 3D)
// overrides the type's style from brand.json → <channel id>; channels without a block (Miracle of Hajj) stay Musafo
const channelOfDir = (dir) => (dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")).channel : null);
// a story type can carry several looks (Berakit ke Hulu, user 2026-11-08: PRESET1 = the Pixar-like 3D, PRESET2 = the bright
// painterly storybook): brand.json → <type>.looks.<id> overrides styleAnchor/clipLook/clipKeep/grain/refs, picked per project
// by meta.json → look (default <type>.defaultLook)
const lookOfDir = (dir) => (dir && existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")).look : null);
export function looksOf(type) {
  const b = loadBrand()[type] ?? {};
  return { looks: Object.entries(b.looks ?? {}).map(([id, l]) => ({ id, label: l.label ?? id, description: l.description ?? "" })), defaultLook: b.defaultLook ?? null };
}
const conf = (dir) => {
  const b = loadBrand(), t = storyType(dir), ch = channelOfDir(dir);
  const c = { ...(b.musafo ?? {}), ...(STORY_TYPES[t] && t !== "musafo" ? b[t] ?? {} : {}), ...(ch && ch !== t && ch !== "musafo" ? b[ch] ?? {} : {}) };
  const look = c.looks?.[lookOfDir(dir) ?? c.defaultLook];
  return look ? { ...c, ...look, look: lookOfDir(dir) ?? c.defaultLook } : c;
};
export function setLook(dir, look) {
  const t = storyType(dir), l = loadBrand()[t]?.looks ?? {};
  if (!l[look]) throw new Error(`gaya "${look}" tidak ada di brand.json → ${t}.looks`);
  writeJSON(join(dir, "meta.json"), { ...readJSON(join(dir, "meta.json")), look });
  return look;
}
export const isMusafo = (dir) => !!STORY_TYPES[storyType(dir)];
export const loadMusafo = (dir) => (existsSync(join(dir, "musafo.json")) ? readJSON(join(dir, "musafo.json")) : null);
const frame = (id) => `assets/frames/${id}.png`;
const clip = (id) => `assets/footage/${id}.mp4`;
// script tokens exactly as tts.alignToScript counts them, so line i <-> words.json indexes
const tokens = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w) && !/^\[.*\]$/.test(w));

// draft.md (user 2026-11-07): before any storyline, a story with a source text (Library Cerita → assets/reference/bahan.md)
// gets a draft: Claude retells the whole story in Indonesian, complete and in the source's order. Studio shows it next to
// the source text (two columns); the user edits it and approves it. The storyline is drawn from the approved draft, and
// the user's wording in it is kept.
const hasSource = (dir) => existsSync(join(dir, "assets", "reference", "bahan.md"));
const draftHash = (dir) => createHash("sha1").update(readFileSync(join(dir, "draft.md"), "utf8").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12);
export function draftApproval(dir) {
  const r = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {};
  // Berakit ke Hulu (user 2026-11-07): source → series storyline straight away; the user edits the storyline itself in Studio
  const needed = hasSource(dir) && !NO_DRAFT.includes(storyType(dir));
  if (!existsSync(join(dir, "draft.md"))) return { needed, written: false, approved: false, stale: false };
  const a = r.draftApproval;
  return { needed, written: true, approved: !!a && a.hash === draftHash(dir), stale: !!a && a.hash !== draftHash(dir), at: a?.at, editedAt: r.draftEditedAt ?? null };
}
export function saveDraft(dir, text) {
  const t = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (t.split(/\s+/).length < 20) throw new Error("Draft terlalu pendek.");
  writeFileSync(join(dir, "draft.md"), t + "\n");
  const p = join(dir, "request.json");
  const r = existsSync(p) ? readJSON(p) : {};
  r.draftEditedAt = new Date().toISOString(); // the user touched it: Claude keeps their words from here on
  writeJSON(p, r);
  return draftApproval(dir);
}
export function approveDraft(dir, by = "user") {
  if (!existsSync(join(dir, "draft.md"))) throw new Error("draft.md belum ditulis");
  const p = join(dir, "request.json");
  const r = existsSync(p) ? readJSON(p) : {};
  r.draftApproval = { hash: draftHash(dir), at: new Date().toISOString(), by };
  writeJSON(p, r);
  return r.draftApproval;
}

// the user edits storyline.md in Studio before approving (user 2026-11-07): their words from then on; the hash changes,
// so an earlier approval lapses on its own
export function saveStoryline(dir, text) {
  const t = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (t.split(/\s+/).length < 20) throw new Error("Storyline terlalu pendek.");
  writeFileSync(join(dir, "storyline.md"), t + "\n");
  const p = join(dir, "request.json");
  const r = existsSync(p) ? readJSON(p) : {};
  r.storylineEditedAt = new Date().toISOString();
  writeJSON(p, r);
  return storylineApproval(dir);
}

// ---------- main characters (user 2026-11-07, Berakit ke Hulu) ----------
// The user uploads photos of the real person (assets/reference/tokoh/); Claude makes one character sheet per life stage
// in Google Flow with those photos as ingredients (assets/characters/<id>.png, add <slug> character <id> <file>), and
// every shot image showing that stage uses the sheet as an ingredient and repeats its desc sentence word for word.
// musafo.json → characters: [{ id, name, age, desc }], shots[].characters: [id, ...]
export const charRefs = (dir) => { const d = join(dir, "assets", "reference", "tokoh"); return existsSync(d) ? readdirSync(d).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)) : []; };
export const charSheet = (id) => `assets/characters/${id}.png`;
// series parts share their characters (user 2026-11-08, Eka Tjipta 2 had no sheets): characters[] entries, sheets and the
// user's photos of every part flow to the other parts that lack them (a newer sheet replaces an older one)
export function seriesDirs(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  if (!meta.series) return [];
  const { id, total } = meta.series;
  return Array.from({ length: total }, (_, i) => join(ROOT, "videos", i ? `${id}-${i + 1}` : id)).filter((d) => d !== dir && existsSync(d));
}
export function syncCharacters(dir) {
  const done = [];
  for (const from of seriesDirs(dir)) {
    const src = loadMusafo(from), dst = loadMusafo(dir);
    if (!src || !dst) continue;
    const lk = (d) => lookOfDir(d) ?? conf(d).defaultLook ?? null, sameLook = lk(from) === lk(dir);
    const have = new Set((dst.characters ?? []).map((c) => c.id)), add = (src.characters ?? []).filter((c) => !have.has(c.id));
    if (add.length) { dst.characters = [...(dst.characters ?? []), ...add]; writeJSON(join(dir, "musafo.json"), dst); done.push(...add.map((c) => `tokoh ${c.id}`)); }
    for (const c of dst.characters ?? []) {
      const a = join(from, charSheet(c.id)), b = join(dir, charSheet(c.id));
      // a sheet is drawn in its part's look (BKH PRESET1/PRESET2): it never crosses to a part with another look
      if (sameLook && existsSync(a) && (!existsSync(b) || statSync(a).mtimeMs > statSync(b).mtimeMs + 1000)) {
        mkdirSync(dirname(b), { recursive: true });
        copyFileSync(a, b);
        const line = existsSync(join(from, "sources.txt")) ? readFileSync(join(from, "sources.txt"), "utf8").split(/\r?\n/).find((l) => l.startsWith(charSheet(c.id) + "\t")) : null;
        source(dir, charSheet(c.id), line ? line.split("\t").slice(1).join("\t") : `AI-generated character sheet of ${c.name}, ${c.age}; not a photograph`);
        done.push(`sheet ${c.id}`);
      }
    }
    for (const f of charRefs(from)) {
      const b = join(dir, "assets", "reference", "tokoh", f);
      if (!existsSync(b)) { mkdirSync(dirname(b), { recursive: true }); copyFileSync(join(from, "assets", "reference", "tokoh", f), b); done.push(`foto ${f}`); }
    }
  }
  return done;
}
export function checkCharacters(dir, m) {
  const errors = [], warns = [], cs = m.characters ?? [], ids = new Set();
  for (const c of cs) {
    const at = `tokoh ${c.id ?? "?"}`;
    if (!/^[a-z][a-z0-9-]*$/.test(c.id ?? "")) errors.push(`${at}: id huruf kecil, mis. eka-anak`);
    if (ids.has(c.id)) errors.push(`${at}: id dobel`);
    ids.add(c.id);
    for (const k of ["name", "age", "desc"]) if (!c[k]?.trim()) errors.push(`${at}: ${k} kosong`);
  }
  for (const s of m.shots ?? []) for (const id of s.characters ?? []) {
    const c = cs.find((x) => x.id === id);
    if (!c) { errors.push(`shot ${s.id}: tokoh ${id} tidak ada di characters`); continue; }
    if (c.desc && s.image && !s.image.includes(c.desc.trim())) errors.push(`shot ${s.id}: prompt gambar tidak memuat kalimat tokoh ${id} persis (characters[].desc)`);
    if (!existsSync(join(dir, charSheet(id))) && existsSync(join(dir, "assets", "frames", `${s.id}.png`))) errors.push(`shot ${s.id}: gambar dibuat sebelum character sheet ${id} ada; buat sheet-nya dulu lalu ulang gambar ini`);
  }
  if (charRefs(dir).length && m.shots?.length && !cs.length) warns.push("ada foto tokoh di assets/reference/tokoh tapi musafo.json belum punya characters (character sheet per usia)");
  return { errors, warns };
}

// storyline.md: the arc Claude draws from the raw material; the user approves it before any script is written.
// hooks.json: what keeps people watching, written with the storyline and approved with it:
//   { "options": [ { "id": "A", "type": "cold open|pertanyaan|kutipan", "line": "first spoken line", "image": "first frame",
//     "loop": "the question left open", "why": "why it stops the scroll" } ] (3 options), "chosen": "A" (the user's pick),
//     "rehook": { "line": "…", "at": "≈ second" }, "cliffhanger": "last line of a series part that is not the last" }
const HOOK_TYPES = ["cold open", "pertanyaan", "kutipan"];
export const loadHooks = (dir) => (existsSync(join(dir, "hooks.json")) ? readJSON(join(dir, "hooks.json")) : null);
const storylineHash = (dir) => {
  const { chosen, ...hooks } = loadHooks(dir) ?? {};
  return createHash("sha1").update(readFileSync(join(dir, "storyline.md"), "utf8").replace(/\s+/g, " ").trim() + JSON.stringify(hooks)).digest("hex").slice(0, 12);
};
export function storylineApproval(dir) {
  const a = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")).storylineApproval : null;
  if (!existsSync(join(dir, "storyline.md"))) return { approved: false, stale: false, written: false };
  return { written: true, approved: !!a && a.hash === storylineHash(dir), stale: !!a && a.hash !== storylineHash(dir), at: a?.at, hook: loadHooks(dir)?.chosen ?? null };
}
export function checkHooks(dir) {
  const h = loadHooks(dir), errors = [];
  const series = readJSON(join(dir, "meta.json")).series;
  if (!h) return ["hooks.json belum ditulis (3 pilihan hook + re-hook)"];
  const opts = h.options ?? [];
  if (opts.length !== 3) errors.push("hooks.json: tulis tepat 3 pilihan hook");
  if (new Set(opts.map((o) => o.type)).size !== opts.length) errors.push(`hooks.json: tiap pilihan hook beda jenis (${HOOK_TYPES.join(", ")})`);
  for (const o of opts) {
    const at = `hook ${o.id ?? "?"}`;
    if (!HOOK_TYPES.includes(o.type)) errors.push(`${at}: type harus ${HOOK_TYPES.join("|")}`);
    for (const k of ["line", "image", "loop", "why"]) if (!o[k]?.trim()) errors.push(`${at}: ${k} kosong`);
    errors.push(...hookLineErrors(o.line ?? "").map((e) => `${at}: ${e}`));
  }
  if (!h.rehook?.line?.trim()) errors.push("hooks.json: re-hook (kait di tengah video) belum ditulis");
  if (series && series.part < series.total && !h.cliffhanger?.trim()) errors.push(`bagian ${series.part}/${series.total}: cliffhanger belum ditulis`);
  return errors;
}
// the first spoken line: lands within ~3 s, no greeting, no "in this video"
function hookLineErrors(line) {
  const e = [];
  const n = tokens(line).length;
  if (n > 12) e.push(`kalimat hook ${n} kata (maks 12, ±3 detik)`);
  if (/^\s*(assalamu|bismillah|halo|hai|hi\b|selamat (pagi|siang|sore|malam)|sahabat|teman-teman)/i.test(line)) e.push("hook dibuka dengan salam/sapaan; langsung masuk cerita");
  if (/di video ini|kali ini kita|simak sampai/i.test(line)) e.push('hook memakai "di video ini"/"simak sampai"; langsung masuk cerita');
  return e;
}
// A story with a source text (Library Cerita → assets/reference/bahan.md) keeps the source's order (user 2026-11-07):
// storyline.md lists "## Alur asli" (the events as the source tells them, numbered) and "## Beda dari alur asli"
// (every cut, merge, or move, or "tidak ada"), so the user sees the changes before approving.
export function sourceFlowErrors(dir) {
  if (storyType(dir) === "miracleofhajj") return mohStorylineErrors(dir);
  if (!existsSync(join(dir, "assets", "reference", "bahan.md")) || !existsSync(join(dir, "storyline.md"))) return [];
  const s = readFileSync(join(dir, "storyline.md"), "utf8");
  const sec = (h) => s.split(/^## /m).find((x) => x.toLowerCase().startsWith(h))?.split("\n").slice(1).join("\n").trim();
  const e = [];
  const alur = sec("alur asli");
  if (!alur) e.push('storyline belum punya bagian "## Alur asli" (urutan kejadian di sumber)');
  else if ((alur.match(/^\s*\d+\./gm) ?? []).length < 3) e.push('"## Alur asli" harus berupa daftar bernomor kejadian sesuai urutan sumber');
  if (!sec("beda dari alur asli")) e.push('storyline belum punya bagian "## Beda dari alur asli" (tulis "tidak ada" bila sama)');
  return e;
}

// Miracle of Hajj (user 2026-11-08): the source is a few sentences, so the storyline shows the user what Claude built on
// it: the anecdote word for word, everything added, the cause it looked for (a guess, never a verdict), and the verses
function mohStorylineErrors(dir) {
  if (!existsSync(join(dir, "storyline.md"))) return [];
  const s = readFileSync(join(dir, "storyline.md"), "utf8");
  const sec = (h) => s.split(/^## /m).find((x) => x.toLowerCase().startsWith(h))?.split("\n").slice(1).join("\n").trim();
  const e = [];
  if (!sec("cerita asli")) e.push('storyline belum punya "## Cerita asli" (kisah dari user/sumber, kata per kata)');
  if (!sec("yang ditambahkan")) e.push('storyline belum punya "## Yang ditambahkan" (semua detail dramatisasi yang tidak ada di cerita asli)');
  if (!sec("sebab yang dicari")) e.push('storyline belum punya "## Sebab yang dicari" (dugaan kesalahannya, ditulis sebagai dugaan)');
  const dalil = sec("dalil");
  if (!dalil) e.push('storyline belum punya "## Dalil" (QS. surah: ayat, dari node tools/ayat.mjs get)');
  else if (!/\d{1,3}:\d{1,3}/.test(dalil)) e.push('"## Dalil" harus menyebut ayat sebagai surah:ayat (mis. 6:38)');
  return e;
}

export function approveStoryline(dir, by = "user", hook) {
  if (!existsSync(join(dir, "storyline.md"))) throw new Error("storyline.md belum ditulis");
  const dr = draftApproval(dir);
  if (dr.needed && !dr.approved) throw new Error(dr.written ? "Draft cerita berubah atau belum disetujui: setujui draft dulu (tab Draft)" : "Draft cerita belum ditulis: storyline dibuat dari draft yang kamu setujui");
  const flow = sourceFlowErrors(dir);
  if (flow.length) throw new Error(flow.join("; "));
  const errs = checkHooks(dir);
  if (errs.length) throw new Error(errs.join("; "));
  const h = loadHooks(dir);
  const pick = hook ?? h.chosen;
  if (!h.options.some((o) => o.id === pick)) throw new Error("pilih satu hook dulu");
  writeJSON(join(dir, "hooks.json"), { ...h, chosen: pick });
  const p = join(dir, "request.json");
  const r = existsSync(p) ? readJSON(p) : {};
  r.storylineApproval = { hash: storylineHash(dir), at: new Date().toISOString(), by, hook: pick };
  writeJSON(p, r);
  return r.storylineApproval;
}

export function createMusafo(slug, title, story, source = "", { type = "musafo", channel, look } = {}) {
  // a story type with its own preset (presets/<type>, e.g. BumiDiPijak) uses it; the others share presets/musafo
  const preset = existsSync(join(ROOT, "presets", type, "preset.json")) ? type : "musafo";
  const r = spawnSync("node", [join(ROOT, "tools", "new.mjs"), slug, title, "--preset", preset], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  const dir = join(ROOT, "videos", slug);
  const meta = readJSON(join(dir, "meta.json"));
  const looks = loadBrand()[type]?.looks;
  writeJSON(join(dir, "meta.json"), { ...meta, type, ...(channel ? { channel } : {}), ...(looks ? { look: looks[look] ? look : loadBrand()[type].defaultLook } : {}) });
  const src = source.trim() ? `**Sumber:** ${source.trim()}\n\n` : "";
  const { label, skill } = STORY_TYPES[type];
  writeFileSync(join(dir, "brief.md"), `# Brief: ${title}\n\n> Proyek ${label} dari TERTORTOR. Claude: ikuti /${skill} ${slug} (bahan mentah → storyline.md → naskah).\n\n## Bahan mentah (dari user, jangan diubah)\n\n${src}${story.trim()}\n`);
  writeJSON(join(dir, "musafo.json"), { shots: [] });
  writeFileSync(join(dir, "costs.md"), `# Biaya: ${slug}\n\n| Item | Detail | Kredit/USD |\n| --- | --- | --- |\n`);
  return dir;
}

// ---------- series: a story longer than 90 s is split into parts, each its own project ----------
// Part 1 keeps the slug; parts 2..n are <slug>-2..n with the same brief, storyline and its approval (storyline.md
// carries the plan per part: "## Bagian 1", "## Bagian 2", ...). Each part gets its own shots, voice and render.
export function makeSeries(slug, total) {
  const dir = join(ROOT, "videos", slug);
  if (!isMusafo(dir)) throw new Error(`${slug} bukan proyek Musafo`);
  if (!(total >= 2 && total <= 10)) throw new Error("jumlah bagian 2-10");
  const meta = readJSON(join(dir, "meta.json"));
  const req = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {};
  const base = (req.title || meta.name).replace(/\s*\(Bagian \d+\/\d+\)$/, "");
  const made = [];
  for (let k = 1; k <= total; k++) {
    const s = k === 1 ? slug : `${slug}-${k}`;
    const d = join(ROOT, "videos", s);
    const title = `${base} (Bagian ${k}/${total})`;
    if (k > 1 && !existsSync(d)) {
      createMusafo(s, title, "", "", { type: meta.type, channel: meta.channel, look: meta.look });
      for (const f of ["brief.md", "storyline.md"]) if (existsSync(join(dir, f))) writeFileSync(join(d, f), readFileSync(join(dir, f), "utf8"));
    }
    const { approval: _a, ...rest } = req;
    writeJSON(join(d, "request.json"), { ...(k === 1 ? req : rest), title, created: k === 1 ? req.created : new Date((Date.parse(req.created) || Date.now()) + k).toISOString() });
    const m = readJSON(join(d, "meta.json"));
    writeJSON(join(d, "meta.json"), { ...m, name: title, series: { id: slug, part: k, total } });
    made.push(s);
  }
  for (const s of made.slice(1)) syncCharacters(join(ROOT, "videos", s));
  return made;
}

// ---------- gate ----------
export function checkMusafo(dir) {
  const m = loadMusafo(dir) ?? { shots: [] };
  const errors = [], warns = [];
  const style = conf(dir).styleAnchor;
  if (!m.shots.length) errors.push("musafo.json belum punya shot");
  { const ch = checkCharacters(dir, m); errors.push(...ch.errors); warns.push(...ch.warns); }
  if (m.shots.length && !storylineApproval(dir).approved) warns.push("storyline belum disetujui user: tulis storyline.md dan tunggu persetujuan sebelum shot");
  // at most 10 shots whatever the story, each one picture and one clip of up to 15 s (user 2026-11-07)
  const maxShots = conf(dir).maxShots ?? 10, maxShotSec = m.clipSeconds ?? conf(dir).maxShotSeconds ?? 15, // the clip tool's length (Flow 10 s, H3 15 s)
    wpm = conf(dir).wordsPerMinute ?? 140;
  if (m.shots.length > maxShots) errors.push(`${m.shots.length} shot (maks ${maxShots}): gabungkan kalimat ke shot yang lebih sedikit; satu shot boleh berisi beberapa baris caption`);
  const beatLen = existsSync(join(dir, "build", "timeline.json")) && existsSync(join(dir, "voice", "words.json")) ? Object.fromEntries(readJSON(join(dir, "build", "timeline.json")).beats.map((b) => [b.id, b.duration])) : null;
  const ids = new Set();
  m.shots.forEach((s, i) => {
    const at = `shot ${s.id ?? i + 1}`;
    if (!/^[a-z][a-z0-9-]*$/.test(s.id ?? "")) errors.push(`${at}: id harus huruf kecil (mis. s01)`);
    if (ids.has(s.id)) errors.push(`${at}: id dobel`);
    ids.add(s.id);
    if (!FRAMINGS.includes(s.framing)) errors.push(`${at}: framing harus ${FRAMINGS.join("|")}`);
    if (i && s.framing === m.shots[i - 1].framing) errors.push(`${at}: framing sama dengan shot sebelumnya (${s.framing}); cut ke gambar serupa bukan cut`);
    if (!s.hero) errors.push(`${at}: hero kosong`);
    const sec = beatLen?.[s.id] ?? ((s.lines ?? []).reduce((a, l) => a + tokens(l.text ?? "").length, 0) / wpm) * 60;
    // a clip is at most 15 s; a longer shot holds the clip's last frame for the rest (up to 5 s), beyond that it fails
    // one shot = one clip, cut to cut inside it (user 2026-11-07): scenes[] = { line, scene, motion }, scene 1 = the shot's image
    const sc = s.scenes ?? [], nl = (s.lines ?? []).length;
    // a baked orb (calligraphy in the frame) may stay one take: a cut would make Flow draw the sphere again without it
    const oneTake = [s.orb ?? []].flat().some((o) => o.baked);
    if (nl > 1 && !sc.length) (oneTake ? warns : errors).push(`${at}: satu adegan untuk ${sec.toFixed(1)} s; tambahkan scenes (adegan berikutnya mulai di kalimat ke-n) supaya klipnya multi-scene, cut to cut`);
    if (sc.length > MAX_SHOTS - 1) errors.push(`${at}: ${sc.length + 1} adegan (maks ${MAX_SHOTS} per klip H3)`);
    sc.forEach((x, k) => {
      if (!(Number.isInteger(x.line) && x.line > (k ? sc[k - 1].line : 0) && x.line < nl)) errors.push(`${at}: scenes[${k}].line harus naik, > ${k ? sc[k - 1].line : 0} dan < ${nl} (indeks kalimat di shot ini, mulai 0)`);
      if (!x.scene?.trim() || !x.motion?.trim()) errors.push(`${at}: scenes[${k}] butuh scene dan motion (bahasa Inggris)`);
    });
    // a clip shorter than its shot is slowed down to fill it (user 2026-11-07, Flow 10 s), up to ×1.8
    if (sec > maxShotSec * MAX_STRETCH) errors.push(`${at}: ${beatLen ? "" : "perkiraan "}${sec.toFixed(1)} s narasi (klip ${maxShotSec} s diperlambat maks ×${MAX_STRETCH} = ${(maxShotSec * MAX_STRETCH).toFixed(0)} s); pindahkan kalimat ke shot tetangga atau pendekkan`);
    else if (sec > maxShotSec + 0.5) warns.push(`${at}: ${beatLen ? "" : "perkiraan "}${sec.toFixed(1)} s narasi; klip ${maxShotSec} s diperlambat ×${(sec / maxShotSec).toFixed(2)}`);
    if (!s.lines?.length) errors.push(`${at}: tidak ada kalimat`);
    for (const l of s.lines ?? []) {
      if (!tokens(l.text ?? "").length) errors.push(`${at}: kalimat kosong`);
      if (!l.en?.trim()) errors.push(`${at}: terjemahan Inggris kosong untuk "${l.text}"`);
      if (tokens(l.text ?? "").length > 9) warns.push(`${at}: caption "${l.text}" > 9 kata; pecah jadi dua baris`);
    }
    if (!s.image) errors.push(`${at}: prompt gambar kosong`);
    else {
      if (style && !s.image.includes(style)) errors.push(`${at}: prompt gambar tidak memuat blok gaya (brand.json → ${storyType(dir) ?? "musafo"}${conf(dir).look ? `.looks.${conf(dir).look}` : ""}.styleAnchor)`);
      // only the scene part: the people block itself names the Prophet (as an orb of light, user 2026-11-07)
      const scn = [sceneOf(s.image, conf(dir)), ...(s.scenes ?? []).map((x) => x.scene)].join(" ");
      if (/\b(prophet|rasul|nabi|sahab(a|at)|companion of the prophet)\b/i.test(scn) && !/no (visible )?face|faceless|featureless|from behind|silhouette|orb of light|sphere of (warm )?(white )?light/i.test(scn)) errors.push(`${at}: Nabi/sahabat tidak boleh digambar dengan wajah`);
      if (/\b(text|letters|caption|logo|watermark)\b/i.test(s.image) && !/no text/i.test(s.image)) warns.push(`${at}: prompt gambar menyebut teks; tambahkan "no text, no letters"`);
    }
    if (!s.motion) errors.push(`${at}: prompt gerak kosong`);
  });
  const cl = checkClips(dir, m);
  errors.push(...cl.errors);
  warns.push(...cl.warns);
  // retention: the chosen hook opens the video, a re-hook sits in the middle, a series part ends on its cliffhanger
  const lines = m.shots.flatMap((s) => s.lines ?? []);
  const hooks = loadHooks(dir);
  // series part 2+ opens with its own hook (hooks.json → parts.<n>.line), not part 1's chosen option
  const sp = readJSON(join(dir, "meta.json")).series, partHook = sp?.part > 1 ? hooks?.parts?.[sp.part]?.line : null;
  if (lines.length && (partHook || hooks?.chosen)) {
    const hook = partHook ? { line: partHook } : hooks.options.find((o) => o.id === hooks.chosen);
    const want = tokens(hook?.line ?? "").map(norm), got = lines.flatMap((l) => tokens(l.text ?? "")).map(norm);
    if (!want.every((w, i) => got[i] === w)) errors.push(`video tidak dibuka dengan hook ${partHook ? `bagian ${sp.part}` : `terpilih (${hooks.chosen})`}: "${hook?.line}"`);
  } else if (lines.length) errors.push("belum ada hook terpilih: tulis hooks.json bersama storyline dan minta user memilih");
  if (lines.length) {
    const total = lines.reduce((a, l) => a + tokens(l.text ?? "").length, 0);
    let before = 0, at = -1;
    for (const l of lines) { if (l.rehook) { at = before / total; break; } before += tokens(l.text ?? "").length; }
    if (total > 90 && at < 0) errors.push('belum ada re-hook: tandai satu baris di tengah video dengan "rehook": true');
    else if (at >= 0 && (at < 0.25 || at > 0.7)) warns.push(`re-hook ada di ${Math.round(at * 100)}% naskah; taruh di 25-70%`);
    const series = readJSON(join(dir, "meta.json")).series;
    if (series && series.part < series.total && !(lines.at(-1).cliffhanger && /bersambung/i.test(lines.at(-1).text))) errors.push(`bagian ${series.part}/${series.total}: baris terakhir harus cliffhanger ("cliffhanger": true) dan menyebut "bersambung"`);
    // Miracle of Hajj: a real verse from equran.id, quoted word for word, and the fixed closing line (user 2026-11-08)
    if (storyType(dir) === "miracleofhajj") {
      errors.push(...ayatErrors(m));
      if (!CLOSING_RE.test(lines.at(-1).text ?? "")) errors.push(`baris terakhir harus "Wallahu a'lam bishawab" (penutup setiap cerita Miracle of Hajj)`);
    }
  }
  const has = (p) => existsSync(join(dir, p));
  // multi-cut: only the first shot of each generate needs a picture (the other shots come from the prompt)
  const needImage = clipMode(m) ? m.clips.map((c) => c.shots[0]) : m.shots.map((s) => s.id);
  const images = needImage.filter((id) => has(frame(id))).length;
  const clips = m.shots.filter((s) => has(clip(s.id))).length;
  const script = has("script.md") ? readFileSync(join(dir, "script.md"), "utf8") : "";
  if (m.shots.length && script && !script.includes(scriptText(m))) warns.push("script.md tidak sama dengan musafo.json: jalankan build");
  const words = has("voice/words.json") ? readJSON(join(dir, "voice", "words.json")) : null;
  const n = m.shots.flatMap((s) => s.lines ?? []).reduce((a, l) => a + tokens(l.text ?? "").length, 0);
  // 90 s per video (user 2026-11-03); a longer story becomes a series of separate projects
  // meta.json → maxSeconds: one long video the user asked for and will cut down themself (user 2026-11-07), up to 179 s
  const own = has("meta.json") ? readJSON(join(dir, "meta.json")).maxSeconds : null;
  const max = Math.min(own ?? conf(dir).maxSeconds ?? 90, 179);
  const seconds = words?.length ? words.at(-1).end : (n / (conf().wordsPerMinute ?? 140)) * 60;
  const oneStory = storyType(dir) === "miracleofhajj"; // one story per video, never a series (user 2026-11-08)
  if (seconds > max) errors.push(`${words ? "durasi" : "perkiraan durasi"} ${Math.round(seconds)} s > ${max} s: ${oneStory ? "satu cerita Miracle of Hajj maksimal 2,5 menit, padatkan storyline-nya (minta persetujuan lagi)" : "jadikan series (node tools/musafo.mjs series <slug> <jumlah bagian>) dan pecah naskahnya"}`);
  if (words && words.length !== n) errors.push(`suara punya ${words.length} kata, musafo.json ${n}: naskah berubah setelah suara dibuat, buat take baru`);
  const ap = approval(dir);
  const steps = [
    { name: "Bahan", ok: has("brief.md") },
    ...(draftApproval(dir).needed ? [{ name: "Draft", ok: draftApproval(dir).approved }] : []),
    { name: "Storyline", ok: storylineApproval(dir).approved },
    ...((m.characters ?? []).length ? [{ name: `Tokoh ${m.characters.filter((c) => has(charSheet(c.id))).length}/${m.characters.length}`, ok: m.characters.every((c) => has(charSheet(c.id))) }] : []),
    { name: "Naskah", ok: m.shots.length > 0 && ap.approved },
    { name: "Suara", ok: !!words && !(has("voice/source.json") && readJSON(join(dir, "voice", "source.json")).draft) },
    { name: `Gambar ${images}/${needImage.length || "–"}`, ok: m.shots.length > 0 && images === needImage.length },
    { name: `Klip ${clips}/${m.shots.length || "–"}`, ok: m.shots.length > 0 && clips === m.shots.length },
    { name: "Render", ok: has(`out/${dir.split(/[\\/]/).pop()}.mp4`) },
  ];
  return { data: m, errors, warns, steps, images, clips, seconds, generates: cl.generates, series: readJSON(join(dir, "meta.json")).series ?? null };
}

const scriptText = (m) => m.shots.map((s) => s.lines.map((l) => l.text.trim()).join(" ")).join("\n\n");

// ---------- the user edits the script in Studio (user 2026-11-06) ----------
// edits = [{ id, lines: [{ text, en }] }]: only the spoken text and its English caption change; a line keeps its other
// fields (rehook, cliffhanger) by position. script.md is rewritten right away, so an earlier approval goes stale and the
// user approves again; every changed shot is logged in script-edits.json (before/after, whether a voice or clip already
// existed) so Claude knows which sentences need a new voice (npm run swap) and which clips may no longer match.
// Studio "Edit naskah": a line whose English caption is empty (the editor clears it when the user changes the Indonesian
// line and leaves the English alone) is translated here in one Gemini call, with the rest of the script as context so
// names, terms, and tone match the captions already there (user 2026-11-07). Returns the Indonesian lines translated.
export async function fillEnglish(dir, edits) {
  const m = loadMusafo(dir);
  const todo = (edits ?? []).flatMap((e) => (e?.lines ?? []).filter((l) => String(l?.text ?? "").trim() && !String(l?.en ?? "").trim()));
  if (!todo.length || !m?.shots?.length) return [];
  const context = m.shots.flatMap((s) => s.lines.map((l) => `${l.text} => ${l.en}`)).join("\n");
  const ask = todo.map((l, i) => `${i + 1}. ${String(l.text).trim()}`).join("\n");
  const out = await gemini({
    soft: true,
    json: true,
    system: "You translate the spoken Indonesian lines of a short vertical story video into its English captions. Each caption sits under its Indonesian line on screen, so keep it about as short as the line, plain and natural, and say only what the line says: no added facts, no explanations. Keep names, places, and Arabic or Islamic terms spelled the way the existing captions spell them, and match their tone.",
    text: `Existing captions (Indonesian => English):\n${context}\n\nTranslate these lines, in order:\n${ask}\n\nAnswer as {"en": ["...", ...]} with exactly ${todo.length} strings.`,
  });
  const en = Array.isArray(out?.en) ? out.en : [];
  if (en.length !== todo.length || en.some((x) => !String(x ?? "").trim())) throw new Error("Terjemahan otomatis tidak lengkap; isi terjemahan Inggrisnya sendiri atau simpan lagi.");
  todo.forEach((l, i) => (l.en = String(en[i]).trim()));
  return todo.map((l) => String(l.text).replace(/\s+/g, " ").trim());
}

export function editScript(dir, edits, autoEn = []) {
  const m = loadMusafo(dir);
  if (!m?.shots?.length) throw new Error("Naskah belum ada.");
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const voiced = existsSync(join(dir, "voice", "words.json"));
  const changed = [];
  for (const e of edits ?? []) {
    const s = m.shots.find((x) => x.id === e?.id);
    if (!s) throw new Error(`Shot ${e?.id} tidak ada.`);
    const lines = (e.lines ?? []).map((l) => ({ text: clean(l.text), en: clean(l.en) })).filter((l) => l.text || l.en);
    if (!lines.length) throw new Error(`Shot ${s.id}: minimal satu kalimat.`);
    const bad = lines.find((l) => !tokens(l.text).length || !l.en);
    if (bad) throw new Error(`Shot ${s.id}: tiap kalimat butuh teks Indonesia dan terjemahan Inggris.`);
    const before = s.lines.map((l) => ({ text: l.text, en: l.en }));
    if (JSON.stringify(before) === JSON.stringify(lines)) continue;
    // per-line flags (rehook, ayat, …) follow their sentence, not its position: an inserted line must not steal them;
    // the cliffhanger stays on the shot's last line (user 2026-11-08 added a line before "Bersambung.")
    const used = new Set(), cliff = s.lines.some((l) => l.cliffhanger);
    const prev = (l, i) => {
      let k = s.lines.findIndex((o, j) => !used.has(j) && o.text === l.text);
      if (k < 0 && !used.has(i) && s.lines[i] && !lines.some((n) => n.text === s.lines[i].text)) k = i;
      if (k < 0) return {};
      used.add(k);
      const { cliffhanger, ...rest } = s.lines[k];
      return rest;
    };
    s.lines = lines.map((l, i) => ({ ...prev(l, i), ...l, ...(cliff && i === lines.length - 1 ? { cliffhanger: true } : {}) }));
    changed.push({ shot: s.id, before, after: lines, voiced, clip: existsSync(join(dir, clip(s.id))), spoken: before.map((l) => l.text).join(" ") !== lines.map((l) => l.text).join(" "), ...(lines.some((l) => autoEn.includes(l.text)) ? { autoEn: lines.filter((l) => autoEn.includes(l.text)).map((l) => l.text) } : {}) });
  }
  if (!changed.length) return { changed: [], warns: [] };
  writeJSON(join(dir, "musafo.json"), m);
  const title = readJSON(join(dir, "meta.json")).name;
  writeFileSync(join(dir, "script.md"), `# Naskah: ${title}\n# (dibuat dari musafo.json oleh tools/musafo.mjs: ubah musafo.json, lalu build lagi)\n\n${scriptText(m)}\n`);
  logEdits(dir, changed);
  const r = checkMusafo(dir);
  return { changed: changed.map((c) => c.shot), warns: [...r.errors, ...r.warns].filter((w) => !/^(clip|storyline|suara punya)/.test(w)) };
}

// ---------- production (user 2026-11-07): one click in the Shot tab → Claude makes the voice, then the key visuals ----------
// Ready once the script is approved for the current storyline. Done when voice/words.json is newer than the click and
// every picture the clips need exists (tools/progress.mjs uses productionDone for the popup and the push).
export function productionNeeds(dir) {
  const m = loadMusafo(dir);
  return clipMode(m) ? m.clips.map((c) => c.shots[0]) : (m?.shots ?? []).map((s) => s.id);
}
export function productionState(dir) {
  const r = existsSync(join(dir, "request.json")) ? readJSON(join(dir, "request.json")) : {};
  const need = productionNeeds(dir), frames = need.filter((id) => existsSync(join(dir, frame(id)))).length;
  const voice = existsSync(join(dir, "voice", "words.json"));
  return { ready: storylineApproval(dir).approved && approval(dir).approved, startedAt: r.productionAt ?? null, voice, frames, need: need.length, done: voice && frames === need.length };
}
export function productionDone(dir, at) {
  const w = join(dir, "voice", "words.json");
  if (!existsSync(w) || statSync(w).mtimeMs <= at) return 0;
  const need = productionNeeds(dir).map((id) => join(dir, frame(id)));
  if (!need.every((f) => existsSync(f))) return 0;
  return Math.max(statSync(w).mtimeMs, ...need.map((f) => statSync(f).mtimeMs));
}
export function startProduction(dir) {
  const st = productionState(dir);
  if (!st.ready) throw new Error("Setujui storyline dan naskah dulu; production membuat suara dari naskah yang disetujui.");
  const p = join(dir, "request.json"), r = readJSON(p);
  r.productionAt = new Date().toISOString();
  writeJSON(p, r);
  return { ...st, startedAt: r.productionAt };
}

// ---------- build: musafo.json -> script.md, beats.json, scenes ----------
export function buildMusafo(dir, slug) {
  const m = loadMusafo(dir);
  const r = checkMusafo(dir);
  // a shot that is too long for its clip only matters at the clip step; the user trims it in Edit naskah (user 2026-11-07)
  if (r.errors.filter((e) => !e.startsWith("suara") && !/ s narasi \(/.test(e)).length) die(r.errors.join("\n✖ "));
  const title = readJSON(join(dir, "meta.json")).name;
  writeFileSync(join(dir, "script.md"), `# Naskah: ${title}\n# (dibuat dari musafo.json oleh tools/musafo.mjs: ubah musafo.json, lalu build lagi)\n\n${scriptText(m)}\n`);
  // cue = shortest prefix of the shot's first line that does not appear again before it (cues.mjs searches forward)
  // cues.mjs also matches a digit to its spoken word ("4" = "empat"): compare the same way, or "Empat" opening a shot
  // is found at an earlier "4" (eka-tjipta s08, 2026-11-07)
  const key = (w) => (/^\d+$/.test(w) ? norm(idWords(+w)) : w);
  const all = m.shots.flatMap((s) => s.lines.flatMap((l) => tokens(l.text).map(norm).map(key)));
  let at = 0, prev = 0;
  const beats = m.shots.map((s, i) => {
    const own = tokens(s.lines.map((l) => l.text).join(" ")).map(norm).map(key);
    let cue = null;
    if (i) for (let k = 1; k <= Math.min(5, own.length); k++) {
      const p = own.slice(0, k);
      const hitAt = all.findIndex((_, j) => j >= prev && p.every((w, q) => all[j + q] === w));
      if (hitAt === at) { cue = tokens(s.lines.map((l) => l.text).join(" ")).slice(0, k).join(" ").replace(/[^\p{L}\p{N}\s'-]/gu, ""); break; }
    }
    if (i && !cue) die(`shot ${s.id}: kata pembukanya juga muncul di shot sebelumnya; ubah kalimat pertamanya`);
    prev = at; at += own.length;
    return { id: s.id, ...(i ? { cue } : {}), job: `shot ${i + 1}: ${s.lines[0].text}`, hero: s.hero, register: "footage", framing: s.framing, character: false };
  });
  writeJSON(join(dir, "beats.json"), { cutLead: 0.05, tail: 1.2, beats });
  const tl = existsSync(join(dir, "build", "timeline.json")) ? readJSON(join(dir, "build", "timeline.json")).beats : [];
  for (const s of m.shots) writeFileSync(join(dir, "compositions", `${s.id}.html`), scene(dir, s, tl.find((b) => b.id === s.id)?.duration, leadOf(m, s.id)));
  if (existsSync(join(dir, "voice", "words.json"))) {
    const c = spawnSync("node", [join(ROOT, "tools", "cues.mjs"), slug], { encoding: "utf8" });
    if (c.status !== 0) die(c.stderr || c.stdout);
    // second pass: scenes know their beat length now (clips shorter than the beat are held on their last frame)
    const tl2 = readJSON(join(dir, "build", "timeline.json")).beats;
    for (const s of m.shots) writeFileSync(join(dir, "compositions", `${s.id}.html`), scene(dir, s, tl2.find((b) => b.id === s.id)?.duration, leadOf(m, s.id)));
    spawnSync("node", [join(ROOT, "tools", "cues.mjs"), slug], { encoding: "utf8" });
  }
  return { shots: m.shots.length, words: all.length };
}

// The Prophet's orb with the calligraphy baked into the key visual (user 2026-11-07): an overlay on a moving AI clip
// drifts off the sphere, so the channel's calligraphy (#5d6b70) is put on the orb in the frame itself and the clip is
// generated in Flow from that frame. Finds the bright sphere nearest shots[].orb x/y (or --at); when the frame has none
// (the orb arrives later in the shot) it draws a soft white sphere there, and --end writes it as <id>.end.png for
// Flow's last frame instead of replacing the first frame. The untouched frame is kept as <id>.raw.png.
export function orbKv(dir, id, { at, size, end } = {}) {
  const m = loadMusafo(dir), s = m.shots.find((x) => x.id === id);
  if (!s) throw new Error(`shot ${id} tidak ada`);
  const o = [s.orb ?? []].flat()[0] ?? {};
  const fdir = join(dir, "assets", "frames"), raw = join(fdir, `${id}.raw.png`), cur = join(fdir, `${id}.png`);
  if (!existsSync(raw)) { if (!existsSync(cur)) throw new Error(`assets/frames/${id}.png belum ada`); writeFileSync(raw, readFileSync(cur)); }
  const [W, H] = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", raw]).stdout.toString().trim().split(",").map(Number);
  const k = 1080 / W;
  let x = ((at?.[0] ?? o.x ?? 50) / 100) * W, y = ((at?.[1] ?? o.y ?? 38) / 100) * H, diam = size ? size / k : null, found = false;
  if (!end) {
    const px = spawnSync("ffmpeg", ["-v", "error", "-i", raw, "-vf", "format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 }).stdout;
    const seen = new Uint8Array(W * H), blobs = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || px[i] < 248) continue;
      let n = 0, sx = 0, sy = 0, x0 = W, x1 = 0;
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const j = st.pop(), jx = j % W;
        n++; sx += jx; sy += (j / W) | 0; x0 = Math.min(x0, jx); x1 = Math.max(x1, jx);
        for (const q of [j - 1, j + 1, j - W, j + W]) if (q >= 0 && q < W * H && !seen[q] && px[q] >= 248 && Math.abs((q % W) - jx) <= 1) { seen[q] = 1; st.push(q); }
      }
      // round, not a sky band: filled about like a circle of its width
      if (n >= 60 && n > 0.5 * Math.PI * ((x1 - x0) / 2) ** 2) blobs.push({ x: sx / n, y: sy / n, d: x1 - x0 + 1 });
    }
    const near = blobs.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
    if (near && Math.hypot(near.x - x, near.y - y) < W * 0.15) { x = near.x; y = near.y; diam = diam ?? (o.size ? o.size / k : near.d * 1.15); found = true; }
  }
  diam ??= (o.size ?? 180) / k;
  const kw = Math.round(diam * 0.62), kh = Math.round(kw * 1020 / 960);
  const KALI = join(ROOT, "musafo", "assets", "muhammad-kaligrafi.png"), color = (conf(dir).orb?.color ?? "#5d6b70").replace("#", "0x");
  const R = Math.round(diam * 0.8), D = R * 2;
  // glow: alpha falls off from a solid core to nothing at R (only when the sphere is drawn)
  const glow = found ? "" : `color=c=white:s=${D}x${D},format=rgba,geq=r='255':g='250':b='238':a='255*clip((1-hypot(X-${R},Y-${R})/${R})*2.2,0,1)'[g];[0][g]overlay=${Math.round(x - R)}:${Math.round(y - R)}[b];`;
  const out = join(fdir, end ? `${id}.end.png` : `${id}.png`);
  const fc = `${glow}color=c=${color}:s=${kw}x${kh}[c];[1]scale=${kw}:${kh},format=rgba,alphaextract[mk];[c][mk]alphamerge[k];[${found ? "0" : "b"}][k]overlay=${Math.round(x - kw / 2)}:${Math.round(y - kh / 2)}:format=auto`;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-i", KALI, "-filter_complex", fc, "-frames:v", "1", out]);
  if (r.status) throw new Error(r.stderr.toString());
  return { file: `assets/frames/${id}${end ? ".end" : ""}.png`, found, x: +((x / W) * 100).toFixed(1), y: +((y / H) * 100).toFixed(1), diam: Math.round(diam * k), kali: Math.round(kw * k) };
}

// the first shot of the generate a shot belongs to: its frame stands in while that generate is not made yet
const leadOf = (m, id) => m.clips?.find((c) => c.shots?.includes(id))?.shots[0];
// one shot = full-bleed clip; without a clip yet, its first frame (or its generate's first frame) with a slow push;
// without either, a placeholder
function scene(dir, s, dur, lead) {
  const has = (p) => existsSync(join(dir, p));
  let media;
  if (has(clip(s.id))) {
    let src = clip(s.id);
    const len = probeDuration(join(dir, src));
    const slow = loadMusafo(dir)?.clips?.find((c) => c.shots?.[0] === s.id && c.stretch);
    if (dur && len < dur + 0.1 && slow) {
      // multi-scene clip planned shorter than its shot: slow it down to the shot's length so the cuts land on their lines
      const f = Math.min(MAX_STRETCH, (dur + 0.3) / len);
      src = `assets/footage/${s.id}.slow.mp4`;
      run("ffmpeg", ["-y", "-v", "error", "-i", join(dir, clip(s.id)), "-vf", `setpts=${f.toFixed(4)}*PTS,fps=30`, "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", join(dir, src)]);
      source(dir, src, `${clip(s.id)} slowed ×${f.toFixed(2)} to fill the shot (same AI-generated clip)`);
    } else if (dur && len < dur + 0.1) {
      src = `assets/footage/${s.id}.hold.mp4`;
      run("ffmpeg", ["-y", "-v", "error", "-i", join(dir, clip(s.id)), "-vf", `tpad=stop_mode=clone:stop_duration=${(dur - len + 0.5).toFixed(2)}`, "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", join(dir, src)]);
      source(dir, src, `${clip(s.id)} held on its last frame to fill the shot (same AI-generated clip)`);
    }
    const d = Math.max(0.1, Math.min(dur ?? len, probeDuration(join(dir, src)) - 0.05)).toFixed(2);
    media = `<video id="${s.id}-clip" src="${src}" data-start="0" data-duration="${d}" muted playsinline></video>`;
  } else if (has(frame(s.id))) media = `<img id="${s.id}-clip" src="${frame(s.id)}" alt="">`;
  else if (lead && has(frame(lead))) media = `<img id="${s.id}-clip" src="${frame(lead)}" alt="">`;
  else media = `<div id="${s.id}-clip" class="ph">${esc(s.hero)}</div>`;
  const still = !has(clip(s.id));
  // the Prophet (user 2026-11-07): the picture shows only a white orb of light (AI garbles Arabic, so no text in the
  // image); this layer writes مُحَمَّد ﷺ in a real Arabic font on that orb while he is present.
  // shots[].orb: { x, y } (% of the frame, where the orb is in the picture), size (px, 240), from/to (line index in this shot)
  // baked: true = the calligraphy is already in the key visual and the clip was generated from it (user 2026-11-07:
  // an overlay drifts off the moving orb), so no layer here. `node tools/musafo.mjs orb-kv <slug> <shot>` bakes it.
  const orbs = [s.orb ?? []].flat().filter((o) => !o.baked);
  let starts = null;
  try { starts = orbs.length ? lineStarts(dir, loadMusafo(dir))[s.id] : null; } catch {}
  // the user's standard calligraphy (musafo/assets/muhammad-kaligrafi.png, user 2026-11-07), copied into the project;
  // the font text is only a fallback when that file is missing
  const KALI = "assets/muhammad-kaligrafi.png", kaliSrc = join(ROOT, "musafo", KALI);
  if (orbs.length && existsSync(kaliSrc) && !has(KALI)) {
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, KALI), readFileSync(kaliSrc));
    source(dir, KALI, "Kaligrafi Muhammad ﷺ: gambar standar channel dari user (2026-11-07), latar dibuang");
  }
  const orbHtml = orbs.map((o, k) => { const z = o.size ?? 240; return `<div id="${s.id}-orb${k}" class="orb" style="left:${o.x ?? 50}%;top:${o.y ?? 38}%;width:${z}px;height:${z}px">${has(KALI) ? `<i class="kali" style="width:${Math.round(z * 0.62)}px;height:${Math.round(z * 0.62 * 1020 / 960)}px"></i>` :`<span class="saw" style="font-size:${Math.round(z * 0.13)}px">ﷺ</span><span class="nm" style="font-size:${Math.round(z * 0.3)}px">مُحَمَّد</span>`}</div>`; }).join("");
  const orbTl = orbs.map((o, k) => {
    const a = Math.max(0, (starts?.[o.from ?? 0] ?? 0) - 0.2), b = o.to != null ? starts?.[o.to + 1] : null;
    return `tl.fromTo("#${s.id}-orb${k}", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, ${a.toFixed(2)});` +
      (b != null ? `\n    tl.to("#${s.id}-orb${k}", { opacity: 0, duration: 0.4, ease: "power2.in" }, ${Math.max(a + 0.7, b - 0.4).toFixed(2)});` : "");
  }).join("\n    ");
  // film grain over the clip (user 2026-11-07): AI clips smooth the grain of their first frame away, so it is added here.
  // Positions are drawn at build time from a seed per shot (no Math.random in the page), 12 jumps a second.
  const G = { opacity: 0.16, fps: 12, ...(conf(dir).grain ?? {}) };
  let seed = [...s.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const grainJumps = G.opacity > 0 ? Array.from({ length: Math.ceil((dur ?? 20) * G.fps) }, (_, k) => [+(k / G.fps).toFixed(3), Math.round(rnd() * 400), Math.round(rnd() * 400)]) : [];
  const grainSvg = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.95' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='3.2' intercept='-1.1'/><feFuncG type='linear' slope='3.2' intercept='-1.1'/><feFuncB type='linear' slope='3.2' intercept='-1.1'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`);
  const grainCss = grainJumps.length ? `
    #${s.id}-grain { position: absolute; inset: 0; background: url("${grainSvg}") 0 0 / 400px 400px; mix-blend-mode: overlay; opacity: ${G.opacity}; pointer-events: none; }` : "";
  const grainTl = grainJumps.length ? `for (const [t, x, y] of ${JSON.stringify(grainJumps)}) tl.set("#${s.id}-grain", { backgroundPosition: x + "px " + y + "px" }, t);` : "";
  const orbCss = orbs.length ? `
    #root .orb { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0;
      background: radial-gradient(circle, rgba(255,255,255,.98) 0%, rgba(255,250,235,.92) 44%, rgba(255,240,205,.45) 62%, rgba(255,235,190,0) 72%);
      box-shadow: 0 0 90px 36px rgba(255,236,200,.32); }
${has(KALI) ? "" : `    #root .orb span { font-family: "Segoe UI", serif; color: #6b4a1a; line-height: 1; direction: rtl; }
    #root .orb .nm { font-weight: 700; margin-top: 2%; }
`}    #root .orb .kali { display: block; background: ${conf(dir).orb?.color ?? "#5d6b70"}; -webkit-mask: url("${KALI}") center / contain no-repeat; mask: url("${KALI}") center / contain no-repeat; }` : "";
  return `<template>
  <!-- GENERATED by tools/musafo.mjs from musafo.json (shot ${s.id}, ${s.framing}): edit musafo.json, not this file -->
  <style>
    #root { position: absolute; inset: 0; background: #0d1416; overflow: hidden; }
    #${s.id}-media { position: absolute; inset: 0; }
    #${s.id}-clip { width: 100%; height: 100%; object-fit: cover; display: block; }
    #${s.id}-media .ph { display: grid; place-items: center; padding: 0 120px; text-align: center; font: 600 40px/1.3 var(--font-body); color: #8aa; background: linear-gradient(#1c2a2e, #0d1416); }
    #${s.id}-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.35) 100%); }${grainCss}${orbCss}
  </style>
  <div id="root" data-composition-id="${s.id}" data-width="1080" data-height="1920">
    <div id="${s.id}-media">${media}</div>
    <div id="${s.id}-shade"></div>${orbHtml}${grainJumps.length ? `<div id="${s.id}-grain"></div>` : ""}
  </div>
  <script>
    const C = /*@cues*/{}/*@end*/;
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${s.id}-media", { scale: ${still ? 1.1 : 1.02} }, { scale: 1, duration: C.dur, ease: "none" }, 0);${grainTl ? `\n    ${grainTl}` : ""}${orbTl ? `\n    ${orbTl}` : ""}
    window.__timelines["${s.id}"] = tl;
  </script>
</template>
`;
}
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------- captions: one line at a time, Indonesian (or Arabic) on top, English below (cues.mjs calls this) ----------
export function musafoCaptions(dir, words, total, c) {
  const m = loadMusafo(dir);
  const lines = m.shots.flatMap((s) => s.lines);
  const snap = (t) => Math.round(t * 30) / 30;
  let i = 0;
  const spans = lines.map((l) => {
    const n = tokens(l.text).length;
    const w = words.slice(i, i + n);
    i += n;
    return w.length ? { ...l, a: w[0].start, b: w.at(-1).end } : null;
  }).filter(Boolean);
  const arabic = (t) => /[؀-ۿ]/.test(t);
  const markup = spans.map((l, k) => `    <div class="cap" id="cap-${k}"><span class="id${arabic(l.text) ? " ar" : ""}">${esc(l.text)}</span><span class="en">${esc(l.en)}</span></div>`).join("\n");
  const timing = spans.map((l, k) => [k, snap(Math.max(0.05, l.a - 0.08)), snap(Math.min(total, spans[k + 1] ? spans[k + 1].a - 0.08 : l.b + 0.6))]);
  return `<template>
  <style>
    #root { position: absolute; inset: 0; pointer-events: none; }
    #captions-stage { position: absolute; left: 0; right: 0; ${c.bottom != null ? `top: 0; height: ${c.bottom}px` : `top: ${c.y}px`}; }
    .cap { position: absolute; left: 80px; right: 80px; ${c.bottom != null ? "bottom: 0" : "top: 0"}; text-align: center; opacity: 0; }${c.shadow ? `
    .cap span { text-shadow: ${c.shadow}; }` : ""}
    .cap span { display: inline; padding: 6px 18px 8px; background: ${c.pill}; box-decoration-break: clone; -webkit-box-decoration-break: clone; border-radius: ${c.radius ?? 6}px; }
    .cap .id { font: ${c.weight} ${c.size}px/1.35 var(--font-caption); color: ${c.color}; }
    .cap .id.ar { font-family: ${c.arabicFont ?? '"Noto Naskh Arabic", "Segoe UI", serif'}; font-size: ${Math.round(c.size * 1.15)}px; direction: rtl; }
    .cap .en { display: table; margin: 10px auto 0; font: italic 500 ${c.enSize}px/1.35 var(--font-body); color: ${c.enColor}; }
  </style>
  <div id="root" data-composition-id="captions" data-width="1080" data-height="1920">
    <div id="captions-stage" data-layout-allow-overlap>
${markup}
    </div>
  </div>
  <script>
    // GENERATED by tools/musafo.mjs from musafo.json + voice/words.json. Edit the lines in musafo.json.
    const tl = gsap.timeline({ paused: true });
    for (const [k, a, b] of ${JSON.stringify(timing)}) {
      const el = "#cap-" + k;
      tl.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, a);
      tl.to(el, { opacity: 0, duration: 0.14, ease: "power2.in" }, Math.max(a + 0.2, b - 0.14));
      tl.set(el, { opacity: 0, visibility: "hidden" }, b);
    }
    window.__timelines["captions"] = tl;
  </script>
</template>
`;
}

// ---------- multi-cut clips: one H3 generate (≤ musafo.video.seconds) carries 2-4 consecutive shots ----------
// User 2026-11-03: instead of one 6 s generate per shot (±18 per 90 s video), one 15 s generate per 2-4 shots (±6).
// Cut times come from the beat lengths the voice produced, so clips are planned after the voice exists.
const clipRaw = (id) => `assets/clips/${id}.mp4`;
const MAX_SHOTS = 4;
const MAX_STRETCH = 1.8; // a clip may be slowed down at most this much to fill its shot (user 2026-11-07)
export const clipMode = (m) => !!m?.clips?.length;
// musafo.json → clipSeconds overrides it per project, e.g. 10 when the clips are made in Google Flow (clips --seconds 10)
const genSeconds = (m) => m?.clipSeconds ?? conf().video?.seconds ?? 15;
// seconds from the start of each shot's beat to the first spoken word of each of its lines (voice/words.json)
function lineStarts(dir, m) {
  const words = readJSON(join(dir, "voice", "words.json")), beats = readJSON(join(dir, "build", "timeline.json")).beats;
  const out = {};
  let w = 0;
  for (const s of m.shots) {
    const b = beats.find((x) => x.id === s.id);
    out[s.id] = s.lines.map((l) => { const t = words[w]?.start ?? 0; w += tokens(l.text).length; return Math.max(0, t - (b?.start ?? 0)); });
  }
  return out;
}
function beatLengths(dir) {
  const p = join(dir, "build", "timeline.json");
  return existsSync(p) ? Object.fromEntries(readJSON(p).beats.map((b) => [b.id, b.duration])) : null;
}
const I2VA = "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.";
const stamp = (t) => `00:${t.toFixed(3).padStart(6, "0")}`;
// the scene part of an image prompt: style and people blocks are said once for the whole clip
function sceneOf(image = "", c = conf()) {
  let s = image;
  for (const block of [c.styleAnchor, c.people]) if (block) s = s.replace(block, "");
  // musafo-prompt skill prompts open with "Create a vertical 9:16 image of …": the clip prompt wants the scene only
  // (babad-tanah-jawa-prompt: "Create a vertical 9:16 hand-drawn mixed-media artwork of …"; BumiDiPijak since 2026-11-08: "… dark oil painting of …")
  // ("Create a vertical 9:16 close-up image of …", "Create a cinematic vertical 9:16 image of …" too)
  s = s.replace(/^\s*(Create|Generate) an? (cinematic )?(vertical )?9:16 ([\w-]+ ){0,3}?(image|artwork|painting) (of )?/i, "");
  return s.replace(/^[\s.,;]+/, "").trim();
}
// "Close-up of ..." reads as a noun phrase after "cuts to": give it an article
const lc = (s) => {
  const t = s.charAt(0).toLowerCase() + s.slice(1);
  return /^(extreme close-up|close-up|medium shot|medium close-up|wide shot|top-down view|low-angle view|high-angle view)\b/.test(t) ? `a ${t}` : t;
};
const dot = (s = "") => (/[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + ".");

// H3 I2VA multi-shot prompt (skill h3-prompt-writing, references/base-en.txt § Shots and Cuts): <Picture 1> is
// the first shot's image; later shots are described from their own image prompt, cut at strictly increasing times.
const CLIP_LOOK = "Stylized 3D animated film with soft matte clay-like materials, warm golden-hour light and cool teal shadows";
const CLIP_KEEP = "Every shot keeps the same stylized 3D look, golden-hour light, and the same plain white ihram or modest clothing; faces stay seen from behind, in silhouette, turned down, or featureless. No text, no letters, no logos, no dialogue.";
// c = the project's conf (channel style): clipLook opens shot 1, clipKeep closes the prompt
// baked: the first frame carries the Prophet's calligraphy on the orb (orbKv), so the clip must keep it, not erase it
const BAKED = "The glowing sphere of light carries the same dark blue-grey Arabic calligraphy as in <Picture 1>, unchanged in shape and centred on the sphere, moving and scaling with it in every shot where the sphere appears.";
// every cut restates the look (user 2026-11-08: after cut 1 the style kept drifting when only shot 1 named it)
export const cutStyle = (c, pic = "<Picture 1>") => `Rendered in exactly the same style as ${pic}: ${lc(dot(c.clipLook ?? CLIP_LOOK))} Same palette, light and texture, no change of medium.`;
export function clipPrompt(shots, cuts, c = conf(), { baked = false } = {}) {
  const body = shots.map((s, i) => i
    ? `[Shot ${i + 1}] At ${stamp(cuts[i - 1])}, the camera cuts to ${lc(dot(sceneOf(s.image, c)))} ${cutStyle(c)} ${dot(s.motion)}`
    : `[Shot 1] ${c.clipLook ?? CLIP_LOOK}, exactly as in <Picture 1>, preserving its subjects, clothing, composition and setting: ${lc(dot(sceneOf(s.image, c)))} ${dot(s.motion)}`).join(" ");
  let keep = c.clipKeep ?? CLIP_KEEP;
  if (baked) keep = `${BAKED} ${keep.replace(/,? and the glowing sphere of light stays a plain sphere of light/, "").replace("No text, no letters", "No other text, no letters")}`;
  return `${I2VA}\n\nintegrated_multimodal_description: ${body} ${keep}\n\noverall_soundscape: N/A\n\nnon_diegetic_music: N/A`;
}

// Main character in a clip (user 2026-11-07, BKH): the age's character sheet is uploaded as image 1 and the key visual as
// image 2, and the prompt (H3 full-reference, skill h3-prompt-writing references/ref-en.txt) ties the main character to
// <Picture 1> in every scene, so a scene after a cut keeps the face instead of inventing one from text.
// era = musafo.json → shots[].era ?? era, said in every clip so later scenes stay in the story's period.
const SAME = /\b[Tt]he (same )?(boy|girl|teenager|young man|young woman)\b/g;
export function refClipPrompt(parts, cuts, ch, c = conf(), era = "") {
  const desc = ch.desc.trim().replace(/\.$/, "");
  const scene = (p, i) => {
    let t = lc(dot(sceneOf(p.image, c)));
    t = i ? t.replace(SAME, "<Subject 1>") : t.replace(ch.desc.trim(), "<Subject 1>, " + ch.desc.trim());
    return `${t} ${dot(p.motion)}`;
  };
  const body = parts.map((p, i) => i
    ? `[Shot ${i + 1}] At ${stamp(cuts[i - 1])}, the camera cuts to ${scene(p, i)} ${cutStyle(c, "<Picture 2>")}`
    : `[Shot 1] The shot begins from <Picture 2>, preserving its composition, light and setting: ${scene(p, 0)}`);
  const with1 = body.map((b, i) => (b.includes("<Subject 1>") ? `[Shot ${i + 1}]` : null)).filter(Boolean);
  const when = era ? ` The whole video is set in ${era}: period architecture, clothing, vehicles and props only, nothing modern.` : "";
  return [
    "subject_definitions:",
    `<Subject 1> is the main character, whose identity comes only from the character sheet <Picture 1>: ${desc}. <Picture 1> gives the face, hair, skin tone, build and clothing; its turnaround layout, plain backdrop and expression panels never appear in the video.`,
    `<Picture 2> is the first frame of [Shot 1] at 0.00 seconds.`,
    "",
    "summary:",
    `[keyframe completion + reference generation] The video opens on <Picture 2> and runs ${parts.length} shot${parts.length > 1 ? "s" : ""}; <Subject 1> is always rendered from <Picture 1>, the same person in every shot where the main character appears.${when}`,
    "",
    "retention_analysis:",
    `<Subject 1> (appears in ${with1.join(", ")}): fully_preserved - the same face, hair, skin tone, build and clothing as <Picture 1> in every shot.`,
    `<Picture 2> ([Shot 1] first frame): fully_preserved - composition, light, setting and the main character's pose.`,
    "",
    "detailed_description:",
    `The target video is a ${(c.clipLook ?? CLIP_LOOK).replace(/^./, (x) => x.toLowerCase())}.${when}`,
    body.join("\n"),
    `Always use <Picture 1> for the main character: whenever the main character appears, in any shot and at any angle, it is <Subject 1> with the face from <Picture 1>, never a new face. ${c.clipKeep ?? CLIP_KEEP}`,
    "",
    "overall_soundscape: N/A",
    "",
    "non_diegetic_music: N/A",
  ].join("\n");
}
const isRef = (p = "") => p.startsWith("subject_definitions:");

// greedy: consecutive shots into one generate while they fit (seconds - 0.5 s margin) and stay ≤ 4 shots
// only = shot ids: re-plan just their clips and keep the others (and their edited prompts) as they are
export function planClips(dir, { force = false, seconds, only } = {}) {
  const m = loadMusafo(dir);
  if (!m?.shots?.length) throw new Error("musafo.json belum punya shot");
  if (clipMode(m) && !force) throw new Error("clips sudah ada; pakai --force untuk menyusun ulang (prompt yang sudah diedit ikut ditimpa)");
  const len = beatLengths(dir);
  if (!len || m.shots.some((s) => !(len[s.id] > 0))) throw new Error("durasi beat belum ada: buat suara dulu, lalu node tools/musafo.mjs build <slug>");
  if (seconds) m.clipSeconds = seconds;
  const max = genSeconds(m);
  if (m.shots.some((s) => s.scenes?.length)) {
    const starts = lineStarts(dir, m);
    const old = m.clips ?? [];
    m.clips = m.shots.map((s, k) => {
      if (only && !only.includes(s.id) && old[k]) return old[k];
      // shot longer than the clip: cuts are planned inside the clip at the same proportion, and the scene slows the
      // clip down to the shot's length, so every cut still lands on its line (user 2026-11-07)
      const seconds = Math.min(max, Math.max(4, Math.ceil(len[s.id] + 0.5)));
      const stretch = len[s.id] > seconds - 0.2 ? +((len[s.id] + 0.2) / seconds).toFixed(3) : 1;
      const sceneCuts = (s.scenes ?? []).map((x) => +Math.max(1.5, (starts[s.id][x.line] - 0.1) / stretch).toFixed(2));
      const parts = [s, ...(s.scenes ?? []).map((x) => ({ image: x.scene, motion: x.motion }))];
      const ch = (m.characters ?? []).find((x) => x.id === s.characters?.[0] && existsSync(join(dir, charSheet(x.id))));
      const prompt = ch ? refClipPrompt(parts, sceneCuts, ch, conf(dir), s.era ?? m.era) : clipPrompt(parts, sceneCuts, conf(dir), { baked: [s.orb ?? []].flat().some((o) => o.baked) });
      // refs = the images to upload, in this order (image 1, image 2)
      const refs = ch ? [charSheet(ch.id), `assets/frames/${s.id}.png`] : [`assets/frames/${s.id}.png`];
      return { id: `c${k + 1}`, shots: [s.id], seconds, ...(stretch > 1 ? { stretch } : {}), cuts: [], sceneCuts, refs, prompt };
    });
    writeJSON(join(dir, "musafo.json"), m);
    return m.clips;
  }
  const groups = [];
  for (const s of m.shots) {
    const g = groups.at(-1);
    const sum = g ? g.reduce((a, x) => a + len[x.id], 0) : 0;
    if (g && g.length < MAX_SHOTS && sum + len[s.id] <= max - 0.5) g.push(s);
    else groups.push([s]);
  }
  // a lone shot after a full group: hand it the previous group's last shot (same number of generates, better cuts)
  const fits = (g) => g.reduce((a, x) => a + len[x.id], 0) <= max - 0.5;
  for (let k = 1; k < groups.length; k++) {
    const a = groups[k - 1], b = groups[k];
    if (b.length === 1 && a.length >= 3 && fits([a.at(-1), ...b])) b.unshift(a.pop());
  }
  m.clips = groups.map((g, k) => {
    let t = 0;
    const cuts = g.slice(0, -1).map((s) => +(t += len[s.id]).toFixed(2));
    const total = g.reduce((a, x) => a + len[x.id], 0);
    return { id: `c${k + 1}`, shots: g.map((s) => s.id), seconds: Math.min(max, Math.max(4, Math.ceil(total + 0.5))), cuts, prompt: clipPrompt(g, cuts, conf(dir)) };
  });
  writeJSON(join(dir, "musafo.json"), m);
  return m.clips;
}

export function checkClips(dir, m) {
  const errors = [], warns = [];
  if (!clipMode(m)) return { errors, warns, generates: m.shots.length };
  const max = genSeconds(m), len = beatLengths(dir);
  const ids = m.shots.map((s) => s.id);
  if (m.clips.flatMap((c) => c.shots ?? []).join() !== ids.join()) errors.push(`clips: tiap shot tepat satu kali dan berurutan (${ids.join(", ")}); jalankan node tools/musafo.mjs clips <slug> --force`);
  for (const c of m.clips) {
    const at = `clip ${c.id}`, n = c.shots?.length ?? 0, p = c.prompt ?? "";
    const scn = c.sceneCuts ?? [], cuts = c.cuts ?? [], all = [...cuts, ...scn].sort((a, b) => a - b), parts = n + scn.length;
    if (n > MAX_SHOTS) errors.push(`${at}: ${n} shot dalam satu generate (maks ${MAX_SHOTS}; di atas itu H3 menggabungkan cut)`);
    if (!(c.seconds >= 4 && c.seconds <= max)) errors.push(`${at}: durasi ${c.seconds} s (H3: 4-${max} s)`);
    if (cuts.length !== Math.max(0, n - 1)) errors.push(`${at}: ${n} shot butuh ${Math.max(0, n - 1)} waktu cut`);
    else if (all.some((t, i) => t < (i ? all[i - 1] : 0) + 1.5) || (all.length && all.at(-1) > c.seconds - 1)) errors.push(`${at}: waktu cut harus naik, tiap adegan ≥ 1,5 s, cut terakhir ≥ 1 s sebelum akhir (adegan yang mulai sesudah ${c.seconds - 1} s tidak masuk klip)`);
    if (parts > MAX_SHOTS) errors.push(`${at}: ${parts} adegan dalam satu generate (maks ${MAX_SHOTS})`);
    if (isRef(p)) {
      if (!/<Picture 1>/.test(p) || !/<Picture 2>/.test(p) || (c.refs ?? []).length !== 2) errors.push(`${at}: prompt referensi butuh refs [character sheet, key visual] dan <Picture 1>/<Picture 2>`);
    } else if (!p.startsWith(I2VA)) errors.push(`${at}: prompt harus dibuka dengan baris I2VA ("${I2VA}")`);
    const shot = m.shots.find((s) => s.id === c.shots?.[0]);
    if (shot?.characters?.length && existsSync(join(dir, charSheet(shot.characters[0]))) && !isRef(p)) errors.push(`${at}: shot ${shot.id} punya tokoh utama; klip harus memakai character sheet sebagai image 1 (clips --force)`);
    for (let k = 1; k <= parts; k++) if (!p.includes(`[Shot ${k}]`)) errors.push(`${at}: [Shot ${k}] tidak ada di prompt`);
    if (p.includes(`[Shot ${parts + 1}]`)) errors.push(`${at}: prompt punya lebih dari ${parts} adegan`);
    const codes = [...p.matchAll(/At 00:(\d\d\.\d{1,3})/g)].map((x) => +x[1]);
    if (codes.length !== all.length || codes.some((t, i) => Math.abs(t - all[i]) > 0.05)) errors.push(`${at}: timecode cut di prompt (${codes.join(", ") || "–"}) tidak sama dengan cuts (${all.join(", ") || "–"})`);
    if (!/overall_soundscape:\s*N\/A/.test(p) || !/non_diegetic_music:\s*N\/A/.test(p)) errors.push(`${at}: klip bisu: overall_soundscape dan non_diegetic_music harus N/A`);
    if (/<d>/.test(p)) errors.push(`${at}: tidak ada dialog di klip (narasi dari Gemini TTS)`);
    // 4000 is RunningHub's prompt box; Google Flow and Meta Muse take longer prompts (user 2026-11-10: Coklat c10 ran in Flow at 4154)
    if (p.length > 4000) (/Google Flow|Meta Muse/.test(m.videoTool ?? "") ? warns : errors).push(`${at}: prompt ${p.length} karakter (maks 4000 di RunningHub)`);
    if (n === 1 && !scn.length && m.clips.length > 1 && len && (len[c.shots[0]] ?? 0) < max / 2) warns.push(`${at}: hanya satu shot; gabungkan dengan clip tetangga bila muat supaya hemat`);
    if (len) {
      const need = (c.shots ?? []).reduce((a, id) => a + (len[id] ?? 0), 0);
      if (need > c.seconds * (c.stretch ? MAX_STRETCH : 1) + 0.05) errors.push(`${at}: shot-nya butuh ${need.toFixed(1)} s, generate hanya ${c.seconds} s${c.stretch ? ` (diperlambat maks ×${MAX_STRETCH})` : ""}`);
      let t = 0;
      const plan = (c.shots ?? []).slice(0, -1).map((id) => +(t += len[id] ?? 0).toFixed(2));
      if (plan.some((x, i) => Math.abs(x - (cuts[i] ?? -9)) > 0.3)) errors.push(`${at}: cut ${cuts.join(", ")} tidak cocok dengan durasi beat sekarang (${plan.join(", ")}): suara berubah, jalankan clips --force`);
    } else warns.push(`${at}: belum ada durasi beat (build/timeline.json); waktu cut belum bisa dicek`);
  }
  return { errors, warns, generates: m.clips.length };
}

// split one downloaded generate at its cuts: planned times scaled to the real length, then snapped to the nearest
// detected scene change within ±1.5 s (detectShots in tools/ref.mjs); a cut that is not detected stays at the plan
function addMultiClip(dir, m, c, file) {
  const raw = join(dir, clipRaw(c.id));
  const r = prepFootage(file, raw);
  if (/audio/.test(run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", raw]).stdout)) die(`${clipRaw(c.id)} masih punya audio`);
  const len = r.duration;
  const sc = run("ffmpeg", ["-hide_banner", "-i", raw, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], { allowFail: true });
  const changes = [...(sc.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((x) => +x[1]).filter((t) => t > 0.3 && t < len - 0.3);
  const scale = len / c.seconds, used = new Set();
  const snaps = (c.cuts ?? []).map((t) => {
    const want = t * scale;
    const near = changes.filter((x) => Math.abs(x - want) <= 1.5 && !used.has(x)).sort((p, q) => Math.abs(p - want) - Math.abs(q - want))[0];
    if (near != null) used.add(near);
    return { plan: t, at: +(near ?? want).toFixed(3), detected: near != null };
  });
  const bounds = [0, ...snaps.map((s) => s.at), len];
  for (let i = 1; i < bounds.length; i++) if (bounds[i] - bounds[i - 1] < 0.5) die(`${c.id}: potongan ${c.shots[i - 1]} hanya ${(bounds[i] - bounds[i - 1]).toFixed(2)} s; cek klipnya (cut terdeteksi: ${changes.map((x) => x.toFixed(2)).join(", ") || "–"})`);
  const tool = m.videoTool || "image-to-video";
  source(dir, clipRaw(c.id), `AI-generated dramatisation (${tool} from ${frame(c.shots[0])}, multi-shot ${c.shots.join("+")}); not real footage`);
  const lens = beatLengths(dir) ?? {};
  c.shots.forEach((id, i) => {
    const start = bounds[i] + (i ? 0.04 : 0); // skip the transition frame
    const dur = bounds[i + 1] - start - (i < c.shots.length - 1 ? 0.04 : 0);
    prepFootage(raw, join(dir, clip(id)), { start: +start.toFixed(3), dur: +Math.max(0.3, dur - 0.005).toFixed(3) });
    source(dir, clip(id), `AI-generated dramatisation, cut ${i + 1}/${c.shots.length} of ${clipRaw(c.id)}; not real footage`);
    const short = lens[id] && dur < lens[id] - 0.3 ? `  (beat ${lens[id].toFixed(2)} s: ditahan di frame terakhir)` : "";
    console.log(`  ${id}  ${start.toFixed(2).padStart(6)} → ${(start + dur).toFixed(2).padStart(6)}  ${dur.toFixed(2)} s${i ? (snaps[i - 1].detected ? "  cut terdeteksi" : "  ⚠ cut tidak terdeteksi, pakai waktu rencana") : ""}${short}`);
  });
  c.status = "done";
  c.split = snaps;
  writeJSON(join(dir, "musafo.json"), m);
  console.log(`✔ clip ${c.id} (${len.toFixed(2)} s) → ${c.shots.map((id) => clip(id)).join(", ")}`);
}

// ---------- add a generated image / clip ----------
function add(dir, kind, id, file) {
  const m = loadMusafo(dir);
  if (kind === "character") {
    const c = m?.characters?.find((x) => x.id === id);
    if (!c) die(`tokoh ${id} tidak ada di musafo.json → characters`);
    if (!existsSync(file)) die(`file tidak ada: ${file}`);
    mkdirSync(join(dir, "assets", "characters"), { recursive: true });
    run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "scale='min(2048,iw)':-2", "-frames:v", "1", join(dir, charSheet(id))]);
    source(dir, charSheet(id), `AI-generated character sheet (${m.imageTool || "image model"}) of ${c.name}, ${c.age}, stylized from the user's reference photos; not a photograph`);
    const parts = seriesDirs(dir).filter((d) => syncCharacters(d).length);
    return console.log(`✔ character ${id} → ${charSheet(id)}${parts.length ? ` (juga ke ${parts.map((d) => basename(d)).join(", ")})` : ""}`);
  }
  const mc = kind === "clip" ? m?.clips?.find((x) => x.id === id) : null;
  if (mc) {
    if (!existsSync(file)) die(`file tidak ada: ${file}`);
    return addMultiClip(dir, m, mc, file);
  }
  const s = m?.shots.find((x) => x.id === id);
  if (!s) die(`shot ${id} tidak ada di musafo.json`);
  if (!existsSync(file)) die(`file tidak ada: ${file}`);
  const tool = kind === "image" ? m.imageTool : m.videoTool;
  if (kind === "image") {
    mkdirSync(join(dir, "assets", "frames"), { recursive: true });
    run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-frames:v", "1", join(dir, frame(id))]);
    source(dir, frame(id), `AI-generated illustration (${tool || "image model"}), shot ${id}; not a photograph`);
  } else {
    const r = prepFootage(file, join(dir, clip(id)));
    const a = run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", r.out]).stdout;
    if (/audio/.test(a)) die(`${clip(id)} masih punya audio`);
    source(dir, clip(id), `AI-generated dramatisation (${tool || "image-to-video"} from ${frame(id)}), shot ${id}; not real footage`);
    console.log(`  ${r.duration.toFixed(2)} s`);
  }
  console.log(`✔ ${kind} ${id} → ${kind === "image" ? frame(id) : clip(id)}`);
}
function source(dir, path, line) {
  const p = join(dir, "sources.txt");
  const old = existsSync(p) ? readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith(path + "\t")) : [];
  writeFileSync(p, [...old, `${path}\t${line}`].join("\n") + "\n");
}

if (process.argv[1]?.endsWith("musafo.mjs")) {
  const [cmd, slug, ...rest] = process.argv.slice(2);
  const dir = slug && join(ROOT, "videos", slug);
  if (cmd !== "new" && (!dir || !existsSync(dir))) die("Usage: node tools/musafo.mjs new|storyline-approve|series|build|clips|add|check <slug> ...");
  if (cmd === "new") {
    const si = rest.indexOf("--story");
    const story = si >= 0 ? readFileSync(rest.splice(si, 2)[1], "utf8") : "";
    const ti = rest.indexOf("--type"); // --type berakitkehulu | bumidipijak | miracleofhajj (default musafo)
    const type = ti >= 0 ? rest.splice(ti, 2)[1] : "musafo";
    if (!STORY_TYPES[type]) die(`--type: ${Object.keys(STORY_TYPES).join(" | ")}`);
    const li = rest.indexOf("--look"); // --look preset1 | preset2 (types with brand.json → <type>.looks)
    const look = li >= 0 ? rest.splice(li, 2)[1] : undefined;
    createMusafo(slug, rest.join(" ") || slug, story, "", { type, look });
    console.log(`✔ videos/${slug}/ (${STORY_TYPES[type].label}). Tulis musafo.json, lalu: node tools/musafo.mjs build ${slug}`);
  } else if (cmd === "look") {
    // node tools/musafo.mjs look <slug> [<id>]: show or set the project's look (BKH PRESET1/PRESET2, user 2026-11-08)
    if (rest[0]) { try { setLook(dir, rest[0]); } catch (e) { die(e.message); } }
    const { looks, defaultLook } = looksOf(storyType(dir));
    if (!looks.length) die(`${STORY_TYPES[storyType(dir)]?.label ?? "proyek ini"} tidak punya pilihan gaya`);
    const cur = readJSON(join(dir, "meta.json")).look ?? defaultLook;
    for (const l of looks) console.log(`${l.id === cur ? "●" : "○"} ${l.id}  ${l.label}`);
  } else if (cmd === "series") {
    try {
      const made = makeSeries(slug, +rest[0]);
      console.log(`✔ series ${made.length} bagian: ${made.join(", ")}. Tulis musafo.json tiap bagian sesuai "## Bagian k" di storyline.md.`);
    } catch (e) {
      die(e.message);
    }
  } else if (cmd === "storyline-approve") {
    console.log("✔ storyline disetujui", approveStoryline(dir, "chat").at);
  } else if (cmd === "build") {
    const synced = syncCharacters(dir);
    if (synced.length) console.log(`✔ dari bagian lain series: ${synced.join(", ")}`);
    const r = buildMusafo(dir, slug);
    console.log(`✔ ${r.shots} shot, ${r.words} kata → script.md, beats.json, compositions/`);
  } else if (cmd === "clips") {
    syncCharacters(dir);
    try {
      const si = rest.indexOf("--seconds");
      const oi = rest.indexOf("--only"); // --only s05,s08: re-plan these shots' clips, keep the rest
      const cs = planClips(dir, { force: rest.includes("--force") || oi >= 0, seconds: si >= 0 ? +rest[si + 1] : undefined, only: oi >= 0 ? rest[oi + 1].split(",") : undefined });
      for (const c of cs) console.log(`  ${c.id}  ${c.shots.join(" + ").padEnd(28)} ${String(c.seconds).padStart(2)} s  cut ${c.cuts.join(", ") || "–"}`);
      console.log(`✔ ${cs.length} generate H3 untuk ${cs.reduce((a, c) => a + c.shots.length, 0)} shot. Gambar cukup untuk: ${cs.map((c) => c.shots[0]).join(", ")}`);
    } catch (e) {
      die(e.message);
    }
  } else if (cmd === "add") {
    const [kind, id, file] = rest;
    if (!["image", "clip", "character"].includes(kind) || !id || !file) die("Usage: node tools/musafo.mjs add <slug> image <shotId> <file> | clip <clipId|shotId> <file> | character <characterId> <file>");
    add(dir, kind, id, file);
  } else if (cmd === "orb-kv") {
    const [id, ...o] = rest;
    if (!id) die("Usage: node tools/musafo.mjs orb-kv <slug> <shotId> [--at x,y] [--size px] [--end]");
    const opt = (k) => { const i = o.indexOf(k); return i >= 0 ? o[i + 1] : undefined; };
    try {
      const r = orbKv(dir, id, { at: opt("--at")?.split(",").map(Number), size: opt("--size") && +opt("--size"), end: o.includes("--end") });
      console.log(`✔ ${r.file}: bola ${r.found ? "ditemukan" : "digambar"} di ${r.x}%, ${r.y}% (Ø ${r.diam} px), kaligrafi ${r.kali} px. Generate klipnya di Flow dari gambar ini.`);
    } catch (e) {
      die(e.message);
    }
  } else if (cmd === "check") {
    const r = checkMusafo(dir);
    console.log(r.steps.map((s) => `${s.ok ? "✔" : "·"} ${s.name}`).join("   "));
    r.warns.forEach((w) => console.log(`  ⚠ ${w}`));
    if (r.errors.length) die(r.errors.join("\n✖ "));
  } else die("Usage: node tools/musafo.mjs new|storyline-approve|series|build|clips|add|check <slug> ...");
}
