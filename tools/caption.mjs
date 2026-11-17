// Posting caption + YouTube title for every video (user 2026-11-12/13), used by "Kirim ke Tebar". Moved out of buffer.mjs when
// Buffer was removed (user 2026-11-16 "hapus aja buffer"): caption.md = marker comment, "# title", caption; credits.md
// is appended on load.
//
//   node tools/caption.mjs <slug>     the agent writes caption.md (Gemini, Claude haiku as backup)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJSON, die, videoDir } from "./lib.mjs";
import { material } from "./thumbnail.mjs";
import { gemini } from "./gemini-api.mjs";

// the caption the user starts from: caption.md if Claude wrote one, else the title; credits.md is always appended
// (CLAUDE.md: credits of Commons / stock media must go with the post)
// (only "# heading" lines are dropped: hashtags have no space after #)
const heading = /^#+\s.*(\r?\n|$)/gm;
const captionFile = (dir) => join(dir, "caption.md");
// caption.md starts with a marker comment: "agent <CAPTION_RULES>" (writeCaption under the current rules) or "user" (saved
// from the dialog). An agent caption from older rules or without a marker counts as missing, so the dialog writes a fresh
// one under the current rules (user 2026-11-13: old long captions kept showing up). Bump CAPTION_RULES when the rules change.
const CAPTION_RULES = "2026-11-14";
const marker = /^<!--\s*caption\s+(.*?)\s*-->\s*(\r?\n|$)/m;
const captionRaw = (dir) => (existsSync(captionFile(dir)) ? readFileSync(captionFile(dir), "utf8") : "");
// who wrote caption.md: "user" (saved in the dialog), "agent", or null (no file)
export const captionBy = (dir) => { const raw = captionRaw(dir); return !raw ? null : raw.match(marker)?.[1] === "user" ? "user" : "agent"; };
export const hasCaption = (dir) => { const m = captionRaw(dir).match(marker)?.[1]; return m === "user" || m === `agent ${CAPTION_RULES}`; };
export function defaultText(dir) {
  const meta = existsSync(join(dir, "meta.json")) ? readJSON(join(dir, "meta.json")) : {};
  const own = hasCaption(dir) ? captionRaw(dir).replace(marker, "").replace(heading, "").trim() : "";
  const credits = existsSync(join(dir, "credits.md")) ? readFileSync(join(dir, "credits.md"), "utf8").replace(heading, "").trim() : "";
  return [own || meta.name || "", credits].filter(Boolean).join("\n\n");
}
// the YouTube title the agent wrote (first "# " line of caption.md), else null
export const captionTitle = (dir) => (hasCaption(dir) ? readFileSync(captionFile(dir), "utf8").match(/^#\s+(.+)$/m)?.[1].trim() || null : null);

// (user 2026-11-12): the agent writes the posting caption + YouTube title from what the video says
// (tools/thumbnail.mjs material: hook, script, idea), Gemini with Claude haiku as backup; the user edits it in the dialog
// before anything is sent. Written to caption.md (# title, then the caption); credits.md is appended by defaultText.
const CAPTION_SYSTEM = `Kamu menulis caption posting untuk video vertikal pendek berbahasa Indonesia (TikTok, Instagram Reels, YouTube Shorts,
Facebook Reels), plus judul YouTube. Caption dibaca setelah orang menonton atau saat video baru mulai: tugasnya membuat orang
menonton sampai habis, berkomentar, atau menyimpan.
Aturan:
- Bahasa lisan sehari-hari, seperti orang bercerita ke teman. Kalimat pendek, satu ide per kalimat. Campur kalimat 3 kata dan 15 kata.
- Baris pertama = hook (skill hook-generator-id + tiktok-hook-planner-id dari user, 2026-11-13). Diam-diam tulis dulu
  6 calon baris pertama, satu per mekanisme, lalu pakai yang paling kuat untuk bahan ini:
  1 Klaim Berani (bantah anggapan umum, harus dibayar isi video), 2 Celah Pertanyaan (pertanyaan konkret yang jawabannya
  belum ketebak), 3 Bukti Duluan (hasil/angka nyata di depan), 4 Pengakuan Masalah (penonton mengenali dirinya),
  5 Pola Kejut (beda dari feed di detik pertama), 6 Taruhan Sosial/Identitas (harga diri, status, rasa malu).
  Satu mekanisme saja per hook, maks. ±50 karakter, bukan sapaan, berdiri sendiri (terlihat sebelum "lainnya").
  Satu angka spesifik bila ADA di bahan ("4 tahun", "2.500 gulden"), lebih kuat dari kata sifat; jangan mengarang angka.
  Buka loop, jangan tutup di caption: jawabannya ada di video. Jangan mengulang kalimat pembuka video persis.
- Singkat (user 2026-11-13, terutama TikTok): baris pertama, lalu paling banyak satu kalimat konteks. Total 100-220 karakter
  sebelum hashtag dan ajakan penutup. Baris kosong di antara baris.
- Ajakan penutup (user 2026-11-14), tepat sebelum hashtag, dua baris: (1) baris follow yang diberikan di bahan ("ATURAN
  FOLLOW"), ditulis persis; (2) "Colek temanmu yang ceritanya mirip <X>." X = inti kisah ini dalam 3-8 kata yang dikenali
  penonton dari hidupnya sendiri (contoh: "anak toko yang kehilangan ayahnya", "nekat beli usaha saat orang lain kabur"),
  bukan nama tokoh.
- Akhiri dengan 3-5 hashtag relevan dalam satu baris (huruf kecil, tanpa spasi).
- Hanya fakta yang ada di bahan. Jangan mengarang angka, tahun, nama, kutipan, ayat, atau hadis. Jangan janji yang tidak dibayar video.
- Dilarang: tanda pisah panjang (— atau –), pola "bukan X, tapi Y", "di video ini", "simak sampai habis", "wajib tonton",
  "yuk", tanda seru beruntun, emoji lebih dari satu, kata pengisi khas AI (menyelami, mengungkap, perjalanan luar biasa,
  tak terlupakan, sungguh, betapa, inilah, rahasia di balik), tiga kata sifat berderet, kalimat penutup bijak satu baris.
- title: judul YouTube 40-90 karakter, huruf pertama tiap kata kapital, tanpa emoji, tanpa hashtag, tanpa tanda pisah panjang.`;
const clean = (s) => String(s ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
export async function writeCaption(dir) {
  const has = (p) => existsSync(join(dir, p));
  const extra = [];
  if (has("storyline.md")) extra.push(`Storyline:\n${readFileSync(join(dir, "storyline.md"), "utf8").slice(0, 3000)}`);
  // series part that is not the last: "follow to watch the next part"; otherwise follow for the next story (user 2026-11-14)
  const sr = (has("meta.json") ? readJSON(join(dir, "meta.json")) : {}).series;
  extra.push(`ATURAN FOLLOW: ${sr && sr.part < sr.total ? "Follow untuk nonton sambungannya." : "Follow untuk cerita berikutnya."}`);
  const out = await gemini({ json: true, soft: true, system: CAPTION_SYSTEM, text: `${material(dir)}\n\n${extra.join("\n\n")}\n\nJawab JSON: {"mechanism":"<nama mekanisme hook yang dipakai>","caption":"...","title":"..."}` });
  const caption = clean(out?.caption), title = clean(out?.title).replace(/^#+\s*/, "").slice(0, 100);
  if (!caption) throw new Error("Caption tidak terbaca dari Gemini/Claude; coba lagi.");
  // no "Visual dibuat dengan bantuan AI." line (user 2026-11-13 asked to drop it); a line the model adds anyway is removed
  const body = caption.replace(/^.*\b(dibuat|dibikin)\b.*\bAI\b.*$\n?/gim, "").replace(/\n{3,}/g, "\n\n").trim();
  writeFileSync(captionFile(dir), `<!-- caption agent ${CAPTION_RULES} -->\n${title ? `# ${title}\n\n` : ""}${body}\n`);
  return { text: defaultText(dir), title: title || captionTitle(dir) || "" };
}

// the user's edited caption + title from the dialog (user 2026-11-13, "Simpan caption"). defaultText appends credits.md
// again on load, so a copy of the credits at the end of the edit is dropped before writing caption.md.
export function saveCaption(dir, { text = "", title = "" }) {
  const credits = existsSync(join(dir, "credits.md")) ? readFileSync(join(dir, "credits.md"), "utf8").replace(heading, "").trim() : "";
  let body = String(text).replace(/\r\n/g, "\n").trim();
  if (credits && body.endsWith(credits)) body = body.slice(0, -credits.length).trim();
  const t = String(title).replace(/^#+\s*/, "").replace(/\s+/g, " ").trim().slice(0, 100);
  writeFileSync(captionFile(dir), `<!-- caption user -->\n${t ? `# ${t}\n\n` : ""}${body}\n`);
  return { text: defaultText(dir), title: t || captionTitle(dir) || "" };
}

// what was posted through Buffer before it was removed (videos/<slug>/buffer.json), for the PUBLISHED badge only
export const bufferHistory = (dir) => (existsSync(join(dir, "buffer.json")) ? readJSON(join(dir, "buffer.json")) : []);

if (process.argv[1]?.endsWith("caption.mjs")) {
  const slug = process.argv[2] ?? die("Usage: node tools/caption.mjs <slug>");
  const c = await writeCaption(videoDir(slug));
  console.log(`# ${c.title}

${c.text}`);
}
