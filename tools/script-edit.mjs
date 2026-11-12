// script-edit.mjs: the user edits a script in Studio (user 2026-11-06, every project type that has a script).
// Explainer: the spoken paragraphs of script.md (comment lines # > <!-- in a paragraph are kept). Storytelling
// (Musafo, Berakit ke Hulu): musafo.json → editScript in musafo.mjs. Either way script.md changes, so an earlier
// approval goes stale (flow.mjs scriptHash) and the user approves again; that approval wakes Claude as usual.
// Every change is logged in script-edits.json → pending[] { at, shot|para, before, after, voiced, clip, spoken } so
// Claude knows which sentences need a new voice (npm run swap, never a whole new take for a few lines) and which
// clips/scenes may no longer match. Claude moves handled entries to done[] (node tools/script-edit.mjs done <slug>).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJSON, writeJSON } from "./lib.mjs";

const COMMENT = /^\s*(#|>|<!--)/;
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);

export const pendingEdits = (dir) => (existsSync(join(dir, "script-edits.json")) ? readJSON(join(dir, "script-edits.json")).pending ?? [] : []);

export function logEdits(dir, changed) {
  const f = join(dir, "script-edits.json");
  const log = existsSync(f) ? readJSON(f) : { pending: [], done: [] };
  const at = new Date().toISOString();
  log.pending = [...(log.pending ?? []), ...changed.map((c) => ({ at, ...c }))];
  writeJSON(f, log);
}

// script.md as blocks (split on blank lines); a block is spoken when it has a non-comment line
const blocksOf = (dir) => {
  const f = join(dir, "script.md");
  return (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n\s*\r?\n/).map((b) => {
    const lines = b.split(/\r?\n/);
    return { notes: lines.filter((l) => COMMENT.test(l) && l.trim()), text: lines.filter((l) => !COMMENT.test(l)).join(" ").replace(/\s+/g, " ").trim() };
  });
};
export const scriptParagraphs = (dir) => blocksOf(dir).filter((b) => b.text).map((b) => b.text);

// paragraphs = the full new list of spoken paragraphs, in order (the editor sends all of them)
export function editScriptMd(dir, paragraphs) {
  if (!Array.isArray(paragraphs)) throw new Error("Format naskah salah.");
  const next = paragraphs.map(clean).filter(Boolean);
  if (!next.length) throw new Error("Naskah tidak boleh kosong.");
  const blocks = blocksOf(dir), old = blocks.filter((b) => b.text).map((b) => b.text);
  if (JSON.stringify(old) === JSON.stringify(next)) return { changed: [], warns: [] };
  // keep each spoken block's comment lines with the paragraph at the same position; comment-only blocks stay put
  const out = [];
  let i = 0;
  for (const b of blocks) {
    if (!b.text) { if (b.notes.length) out.push(b.notes.join("\n")); continue; }
    if (i < next.length) out.push([...b.notes, next[i]].join("\n"));
    i++;
  }
  for (; i < next.length; i++) out.push(next[i]);
  writeFileSync(join(dir, "script.md"), out.join("\n\n") + "\n");
  const voiced = existsSync(join(dir, "voice", "words.json"));
  const changed = [];
  for (let k = 0; k < Math.max(old.length, next.length); k++) {
    if (old[k] === next[k]) continue;
    changed.push({ para: k + 1, before: old[k] ?? null, after: next[k] ?? null, voiced, spoken: true });
  }
  logEdits(dir, changed);
  const words = next.join(" ").split(/\s+/).length;
  const warns = [];
  if (words / 150 * 60 > 179) warns.push(`±${Math.round(words / 150 * 60)} s pada 150 kata/menit: lewat batas 2:59`);
  return { changed: changed.map((c) => c.para), warns };
}

// CLI for Claude: list what the user changed, and mark it handled once voice/scenes follow
//   node tools/script-edit.mjs list <slug>
//   node tools/script-edit.mjs done <slug>
if (process.argv[1]?.endsWith("script-edit.mjs")) {
  const [cmd, slug] = process.argv.slice(2);
  const dir = join(ROOT, "videos", slug ?? "");
  if (!slug || !existsSync(dir)) { console.error("pakai: node tools/script-edit.mjs list|done <slug>"); process.exit(1); }
  const f = join(dir, "script-edits.json");
  if (cmd === "list") {
    const p = pendingEdits(dir);
    if (!p.length) console.log("Tidak ada perubahan naskah dari user yang belum ditangani.");
    for (const e of p) {
      console.log(`\n${e.shot ? "shot " + e.shot : "paragraf " + e.para} · ${e.at}${e.voiced ? " · SUDAH ADA SUARA" : ""}${e.clip ? " · sudah ada klip" : ""}${e.spoken === false ? " · hanya terjemahan" : ""}`);
      const show = (x) => (x == null ? "(tidak ada)" : Array.isArray(x) ? x.map((l) => `${l.text}  |  ${l.en}`).join("\n    ") : x);
      console.log(`  lama: ${show(e.before)}\n  baru: ${show(e.after)}`);
    }
  } else if (cmd === "done") {
    if (!existsSync(f)) process.exit(0);
    const log = readJSON(f);
    const at = new Date().toISOString();
    log.done = [...(log.done ?? []), ...(log.pending ?? []).map((e) => ({ ...e, handled: at }))];
    log.pending = [];
    writeJSON(f, log);
    console.log("✔ semua perubahan ditandai sudah ditangani");
  } else { console.error("pakai: node tools/script-edit.mjs list|done <slug>"); process.exit(1); }
}
