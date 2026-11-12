// Qur'an verses for Miracle of Hajj (user 2026-11-08): every story is tied to a dalil from the Qur'an, and no verse may
// be written from memory. The Arabic text and the Kemenag Indonesian translation come from equran.id (API v2, free, no
// key) and are cached per surah in library/quran/<n>.json, so `check` can verify offline.
//
//   node tools/ayat.mjs get 6:38            print Arabic + Kemenag translation (and cache the surah)
//   node tools/ayat.mjs get 6:38-39         a range
//   node tools/ayat.mjs get all             cache all 114 surahs (once), so search covers the whole Qur'an
//   node tools/ayat.mjs search <kata ...>   verses whose Kemenag translation has all these words (e.g. "hewan umat")
//
// In musafo.json: "ayat": ["6:38"] lists the verses the story uses, and every caption line that quotes one carries
// "ayat": "6:38". Its words must appear, in order, in that verse's Kemenag translation (or its Arabic text);
// ayatErrors() is what tools/musafo.mjs check runs.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJSON, writeJSON, die } from "./lib.mjs";

const CACHE = join(ROOT, "library", "quran");
const file = (n) => join(CACHE, `${n}.json`);

export function parseRef(ref) {
  const m = String(ref).trim().match(/^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!m) return null;
  const s = +m[1], a = +m[2], b = m[3] ? +m[3] : a;
  return s >= 1 && s <= 114 && a >= 1 && b >= a ? { surah: s, from: a, to: b } : null;
}

export async function loadSurah(n) {
  if (existsSync(file(n))) return readJSON(file(n));
  const r = await fetch(`https://equran.id/api/v2/surat/${n}`);
  if (!r.ok) throw new Error(`equran.id surat ${n}: HTTP ${r.status}`);
  const d = (await r.json()).data;
  const out = {
    source: `https://equran.id/api/v2/surat/${n} (terjemahan Kemenag)`,
    nomor: d.nomor, namaLatin: d.namaLatin, nama: d.nama, arti: d.arti,
    ayat: d.ayat.map((x) => ({ n: x.nomorAyat, arab: x.teksArab.trim(), id: x.teksIndonesia.trim() })),
  };
  mkdirSync(CACHE, { recursive: true });
  writeJSON(file(n), out);
  return out;
}
const cachedSurah = (n) => (existsSync(file(n)) ? readJSON(file(n)) : null);

// "QS. Al-An'am: 38" as the narration and screen should name it
export const label = (s, r) => `QS. ${s.namaLatin}: ${r.from}${r.to > r.from ? `-${r.to}` : ""}`;

// words only: lowercase, Arabic diacritics and punctuation removed, parentheses kept as words (Kemenag adds "(yang berada)")
const words = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "") // harakat, tatweel, Quranic marks
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const withoutParens = (t) => String(t).replace(/\([^)]*\)/g, " ");
const contains = (hay, needle) => {
  const h = words(hay), n = words(needle);
  if (!n.length) return false;
  for (let i = 0; i + n.length <= h.length; i++) if (n.every((w, k) => h[i + k] === w)) return true;
  return false;
};

// errors for a Miracle of Hajj musafo.json: listed verses are cached and real, quoted lines match the verse word for word
export function ayatErrors(m) {
  const e = [];
  const refs = m.ayat ?? [];
  if (!refs.length) e.push('musafo.json → "ayat" kosong: tiap cerita Miracle of Hajj punya minimal satu dalil Al-Qur\'an (node tools/ayat.mjs get <surah:ayat>)');
  const texts = {};
  for (const ref of refs) {
    const r = parseRef(ref);
    if (!r) { e.push(`ayat "${ref}": tulis sebagai surah:ayat (mis. 6:38 atau 2:155-156)`); continue; }
    const s = cachedSurah(r.surah);
    if (!s) { e.push(`ayat ${ref}: belum diambil dari equran.id, jalankan node tools/ayat.mjs get ${ref}`); continue; }
    const v = s.ayat.filter((x) => x.n >= r.from && x.n <= r.to);
    if (v.length !== r.to - r.from + 1) { e.push(`ayat ${ref}: ${s.namaLatin} hanya punya ${s.ayat.length} ayat`); continue; }
    texts[ref] = { id: v.map((x) => x.id).join(" "), arab: v.map((x) => x.arab).join(" "), label: label(s, r) };
  }
  const lines = (m.shots ?? []).flatMap((s) => s.lines ?? []);
  for (const ref of refs) if (texts[ref] && !lines.some((l) => l.ayat === ref)) e.push(`ayat ${ref} (${texts[ref].label}) tercantum tapi tidak ada baris naskah bertanda "ayat": "${ref}"`);
  for (const l of lines.filter((l) => l.ayat)) {
    const t = texts[l.ayat];
    if (!refs.includes(l.ayat)) { e.push(`baris "${l.text}": ayat ${l.ayat} tidak ada di musafo.json → ayat`); continue; }
    if (!t) continue;
    if (!(contains(t.id, l.text) || contains(withoutParens(t.id), l.text) || contains(t.arab, l.text)))
      e.push(`baris "${l.text}" bertanda ayat ${l.ayat} tidak cocok kata per kata dengan terjemahan Kemenag/teks Arab ${t.label}`);
  }
  return e;
}

// the last spoken line closes every story (user 2026-11-08)
export const CLOSING_RE = /wall[aā]h?u\s*a['’`]?\s*lam\s*bi\s*[sş]?h?[- ]?[sş]?h?aw[aā]b|وَ?\s*ا?للَّ?ه[ُ]?\s*أَ?عْ?لَ?مُ?\s*بِ?ا?لصَّ?وَ?ا?بِ?/i;

if (process.argv[1]?.endsWith("ayat.mjs")) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "get" && arg === "all") {
    for (let n = 1; n <= 114; n++) await loadSurah(n);
    console.log("✔ 114 surah tersimpan di library/quran/ (search sekarang mencari di seluruh Al-Qur'an)");
  } else if (cmd === "get") {
    const r = parseRef(arg) ?? (/^\d{1,3}$/.test(arg ?? "") ? { surah: +arg, from: 0, to: 0 } : null);
    if (!r) die("Usage: node tools/ayat.mjs get <surah:ayat[-ayat]> | <surah>");
    const s = await loadSurah(r.surah);
    if (!r.from) { console.log(`✔ ${s.namaLatin} (${s.ayat.length} ayat) tersimpan di library/quran/${r.surah}.json`); process.exit(0); }
    const v = s.ayat.filter((x) => x.n >= r.from && x.n <= r.to);
    if (!v.length) die(`${s.namaLatin} hanya punya ${s.ayat.length} ayat`);
    console.log(`${label(s, r)}  (${s.arti})`);
    for (const x of v) console.log(`\n[${x.n}] ${x.arab}\n${x.id}`);
  } else if (cmd === "search") {
    if (!arg) die("Usage: node tools/ayat.mjs search <kata>");
    const q = words(process.argv.slice(3).join(" ")), hits = [];
    for (const f of existsSync(CACHE) ? readdirSync(CACHE) : []) {
      const s = readJSON(join(CACHE, f));
      for (const x of s.ayat) if (q.every((w) => words(x.id).includes(w))) hits.push(`${s.nomor}:${x.n}  ${s.namaLatin}  ${x.id.slice(0, 160)}`);
    }
    console.log(hits.length ? hits.join("\n") : "Tidak ada di surah yang tersimpan. Ambil surah lain: node tools/ayat.mjs get <n>");
  } else die("Usage: node tools/ayat.mjs get <surah:ayat[-ayat]> | search <kata>");
}
