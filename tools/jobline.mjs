// jobline.mjs: one line per finished job, so a run nobody watches still shows the team at work (user 2026-11-23; idea
// from the Take One skill, github.com/talsiach/take-one, MIT: "when a job finishes, post one short line that starts
// with its name and says what it decided"). The line goes to the chat AND to videos/<slug>/joblines.jsonl, which Studio
// shows on the video page and in the progress banner (also from the phone through the relay).
//
//   node tools/jobline.mjs <slug> <Peran> "<apa yang diputuskan>"
//   node tools/jobline.mjs <slug> --list
//
// Roles (a job the video does not need is skipped; say so in a word when it matters):
import { existsSync, readFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib.mjs";

export const ROLES = {
  Strategist: "untuk siapa, di mana diposting, satu hal yang dibawa pulang; sudut dan hook dari /paket-ide",
  "Creative director": "satu ide dan payoff-nya",
  Writer: "setiap kata: storyline, naskah, teks layar (lewat /humanizer)",
  "Voice director": "suara siapa dan cara bacanya (Gemini TTS satu take, swap)",
  "Art director": "gaya: preset, character sheet, blok gaya prompt",
  "Storyboard artist": "tiap shot/beat: waktu, apa yang terjadi, apa yang harus terbaca",
  Cinematographer: "tiap frame: key visual, klip (Flow/Muse/H3), kamera, scene",
  Composer: "musik dan di mana ketukannya jatuh",
  "Sound designer": "SFX tiap kejadian visual",
  Editor: "potongan, join, build, render, finish, mix -14 LUFS",
  Reviewer: "skor reviewer mata segar dan yang dikembalikan",
  "Social copywriter": "caption posting, judul YouTube, headline thumbnail",
};
const file = (slug) => join(ROOT, "videos", slug, "joblines.jsonl");

export function readJobs(slug) {
  const f = file(slug);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

// job lines of the last `hours` per video, newest last; only files touched in that window are read
export function recentJobs(hours = 3, max = 8) {
  const out = {}, since = Date.now() - hours * 3600e3, V = join(ROOT, "videos");
  if (!existsSync(V)) return out;
  for (const s of readdirSync(V)) {
    const f = join(V, s, "joblines.jsonl");
    if (!existsSync(f) || statSync(f).mtimeMs < since) continue;
    const l = readJobs(s).filter((j) => Date.parse(j.at) >= since);
    if (l.length) out[s] = l.slice(-max);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [slug, role, ...rest] = process.argv.slice(2);
  if (!slug || !existsSync(join(ROOT, "videos", slug))) { console.error("✖ pakai: node tools/jobline.mjs <slug> <Peran> \"<keputusan>\""); process.exit(1); }
  if (role === "--list") { for (const j of readJobs(slug)) console.log(`${j.at.slice(11, 16)}  ${j.role}: ${j.text}`); process.exit(0); }
  const text = rest.join(" ").trim();
  const known = Object.keys(ROLES).find((r) => r.toLowerCase() === String(role ?? "").toLowerCase());
  if (!known || !text) { console.error(`✖ peran: ${Object.keys(ROLES).join(", ")}; lalu satu kalimat keputusannya.`); process.exit(1); }
  appendFileSync(file(slug), JSON.stringify({ at: new Date().toISOString(), role: known, text: text.slice(0, 300) }) + "\n");
  console.log(`${known}: ${text}`);
}
