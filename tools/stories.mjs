// stories.mjs: the Musafo story library. A long book (PDF) -> its text per page -> Gemini scans it chunk by chunk for
// every self-contained story -> musafo/library/<book>/stories.json. Each story is storyline material (arc, figures,
// dalil quoted from the page, scores, estimated length); "use" turns one story into a Musafo project, one at a time.
// The "berakitkehulu" channel is Berakit ke Hulu's own library: brand/founder stories, quotes instead of dalil, and
// "use" makes a Berakit ke Hulu project.
//
//   npm run stories -- channel [add "MiracleofHajj"]   list / add a channel (the library is split per channel)
//   npm run stories -- ingest <file.pdf> [--title "Judul buku"] [--author "Penulis"] [--channel <id>]   text per page + scan
//   npm run stories -- ingest-url  <url>       [same options]   web article (news, blog) -> text + scan
//   npm run stories -- ingest-text <file.txt>  [same options]   pasted text -> text + scan
//   npm run stories -- scan   <book> [--force]      (re)scan chunks that have no result yet
//   npm run stories -- list   [<book>]
//   npm run stories -- use    <book> <storyId>       -> videos/<slug>/ (Musafo, excerpt as raw material)
//   npm run stories -- release <book> <storyId>      a story the project's storyline left out -> back to "baru"
//   npm run stories -- recheck [<book>...] [--fix]   find each story's quoted text in the pages; report (or fix) wrong ranges
//
// Book text stays local (musafo/library/*/pages.json and musafo/sumber/ are not in git). Gemini reads the book, not
// Claude: one call per ~20 pages, so a 500-page book costs ~25 cheap calls instead of Claude tokens.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, appendFileSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { ROOT, readJSON, writeJSON, die, run, norm } from "./lib.mjs";
import { gemini, MODEL } from "./gemini-api.mjs";
import { createMusafo, STORY_TYPES } from "./musafo.mjs";

export const LIBRARY = join(ROOT, "musafo", "library");
const SOURCES = join(ROOT, "musafo", "sumber");
const CHUNK_PAGES = 20, OVERLAP = 2, MAX_CHARS = 90000;
// pdftotext ships with Git for Windows (ucrt64/mingw64), which a Studio started from the Desktop shortcut has no PATH to
const PDFTOTEXT = ["C:\\Program Files\\Git\\ucrt64\\bin\\pdftotext.exe", "C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe"].find((p) => existsSync(p)) ?? "pdftotext";
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "buku";

// Each book belongs to one channel (Musafo, MiracleofHajj, ...): the library is shown per channel, and a video made
// from a story carries that channel. Channels live in musafo/library/channels.json; books without one are Musafo.
export const CHANNELS = join(LIBRARY, "channels.json");
export const listChannels = () => (existsSync(CHANNELS) ? readJSON(CHANNELS) : [{ id: "musafo", label: "Musafo" }]);
export function addChannel(label) {
  label = String(label ?? "").trim();
  const id = slugify(label).replace(/-/g, "");
  if (!label || !id) throw new Error("nama channel kosong");
  const all = listChannels();
  if (!all.some((c) => c.id === id)) { all.push({ id, label }); mkdirSync(LIBRARY, { recursive: true }); writeJSON(CHANNELS, all); }
  return all.find((c) => c.id === id);
}
export const channelOf = (b) => b.book.channel ?? "musafo";
// a channel may belong to another story type (Berakit ke Hulu has its own library): that type decides the scan prompt
// and the kind of project "use" makes. Channels without a type are Musafo channels.
export const typeOfChannel = (id) => listChannels().find((c) => c.id === id)?.type ?? "musafo";

export const listBooks = () => (existsSync(LIBRARY) ? readdirSync(LIBRARY).filter((d) => existsSync(join(LIBRARY, d, "stories.json"))) : []);
export const loadBook = (id) => readJSON(join(LIBRARY, id, "stories.json"));
// ids are given on every save (a scan can stop halfway on quota); once given they never change
const saveBook = (id, b) => {
  b.stories.sort((x, y) => x.pages[0] - y.pages[0]);
  let n = Math.max(0, ...b.stories.map((s) => +s.id?.slice(1) || 0));
  for (const s of b.stories) if (!s.id) s.id = `k${String(++n).padStart(3, "0")}`;
  writeJSON(join(LIBRARY, id, "stories.json"), b);
};
const pagesOf = (id) => readJSON(join(LIBRARY, id, "pages.json"));

// ---------- 1. PDF -> text per page ----------
export function ingest(file, { title, author = "", channel } = {}) {
  if (channel && !listChannels().some((c) => c.id === channel)) die(`channel tidak ada: ${channel}`);
  file = resolve(file);
  if (!existsSync(file) || extname(file).toLowerCase() !== ".pdf") die(`bukan file PDF: ${file}`);
  // keep the PDF next to the other sources so the library survives the Downloads folder being cleaned
  mkdirSync(SOURCES, { recursive: true });
  const kept = join(SOURCES, basename(file));
  if (resolve(kept) !== file) copyFileSync(file, kept);
  const id = slugify(title || basename(file, extname(file)));
  const dir = join(LIBRARY, id);
  mkdirSync(dir, { recursive: true });
  const txt = join(dir, "book.txt");
  const r = run(PDFTOTEXT, ["-enc", "UTF-8", kept, txt], { allowFail: true });
  if (r.status !== 0 || !existsSync(txt)) die(`pdftotext gagal membaca PDF: ${(r.stderr || r.error?.message || "").trim().slice(0, 200)}`);
  const pages = readFileSync(txt, "utf8").split("\f").map((p) => p.replace(/[ \t]+\n/g, "\n").trim());
  if (pages.at(-1) === "") pages.pop();
  const chars = pages.reduce((a, p) => a + p.length, 0);
  if (chars < pages.length * 200) die(`PDF ini hampir tanpa teks (${chars} karakter untuk ${pages.length} halaman): kemungkinan hasil scan. Perlu OCR dulu.`);
  writeJSON(join(dir, "pages.json"), pages);
  const old = existsSync(join(dir, "stories.json")) ? loadBook(id) : null;
  saveBook(id, { book: { id, title: title || old?.book.title || basename(file, extname(file)), author: author || old?.book.author || "", channel: channel || old?.book.channel || "musafo", file: `musafo/sumber/${basename(file)}`, pages: pages.length, chars }, chunks: old?.chunks ?? {}, stories: old?.stories ?? [] });
  return { id, pages: pages.length, chars };
}

// ---------- 1b. pasted text or a web article -> the same library ----------
// Neither has pages, so the text is cut into ~2,500-character "pages" at paragraph breaks; page numbers in a story then
// point into that text (bahan.md carries the excerpt either way).
const PAGE_CHARS = 2500;
function toPages(text) {
  const pages = [];
  let cur = "";
  for (const para of text.replace(/\r/g, "").split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)) {
    if (cur && cur.length + para.length > PAGE_CHARS) { pages.push(cur); cur = ""; }
    cur += (cur ? "\n\n" : "") + para;
  }
  if (cur) pages.push(cur);
  return pages;
}
export function ingestText(text, { title, author = "", channel, url = "", file = "", project } = {}) {
  if (channel && !listChannels().some((c) => c.id === channel)) throw new Error(`channel tidak ada: ${channel}`);
  const pages = toPages(String(text ?? ""));
  const chars = pages.reduce((a, p) => a + p.length, 0);
  if (chars < 300) throw new Error(`teksnya terlalu pendek (${chars} karakter) untuk dicari kisahnya`);
  title = String(title || "").trim() || pages[0].split("\n")[0].slice(0, 80);
  const id = slugify(title);
  const dir = join(LIBRARY, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "book.txt"), pages.join("\n\n"));
  writeJSON(join(dir, "pages.json"), pages);
  const old = existsSync(join(dir, "stories.json")) ? loadBook(id) : null;
  saveBook(id, { book: { id, title, author: author || old?.book.author || "", channel: channel || old?.book.channel || "musafo", kind: url ? "link" : "teks", ...(url ? { url } : {}), file, pages: pages.length, chars, ...((project || old?.book.project) ? { project: project || old.book.project } : {}) }, chunks: old?.chunks ?? {}, stories: old?.stories ?? [] });
  return { id, pages: pages.length, chars };
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m));
// a news/blog page -> its title and readable text. The page is cut at container tags (div, section, ...) and only the
// segments with real prose are kept: ≥ 200 characters and mostly not links (menus, "terkini" and "terpopuler" lists are
// all links); scripts, nav, header, footer and aside are dropped first
export async function fetchArticle(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`link tidak bisa dibuka (HTTP ${r.status})`); // thrown, not die(): Studio calls this too
  const html = await r.text();
  const meta = (k) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)`, "i"))?.[1];
  const title = decode(meta("og:title") ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "").trim();
  const body = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const plain = (h) => decode(h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h[1-6]|li|blockquote|tr)>/gi, "\n\n").replace(/<[^>]+>/g, " "))
    .split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const text = body.split(/<\/?(?:div|section|article|main|ul|ol|table)\b[^>]*>/i)
    .map((seg) => ({ t: plain(seg), links: plain([...seg.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => m[1]).join(" ")).length }))
    .filter((s) => s.t.length >= 200 && s.links / s.t.length < 0.3)
    .map((s) => s.t).join("\n\n");
  return { title, author: decode(meta("author") ?? "").trim(), text };
}

// ---------- 2. Gemini scans chunks for stories ----------
// Pages are marked [[P n]] (n = PDF page, 1-based) and answered as "Pn" strings. The old [[HALAMAN n]] marker was a bare
// number like the page number printed in the book's header/footer (Hayatus Sahabah: printed = PDF + 2), and Gemini copied
// the printed one, so "use" cut the wrong pages. relocate() below still checks every range against the quoted text.
const PAGES_RULE = `- "pages": label penanda halaman [[P n]] tempat kisah mulai dan selesai, ditulis "Pn" (mis. ["P12","P13"]). Angka halaman
  yang tercetak di kepala/kaki halaman buku BUKAN penanda ini: abaikan. "page" pada kutipan juga label "Pn".`;
const SYSTEM_MUSAFO = `Kamu editor konten islami untuk video vertikal pendek (Reels/TikTok, satu video utuh sampai 179 detik, narasi lisan ±140 kata/menit).
Tugasmu membaca potongan buku dan mencatat SETIAP kisah yang berdiri sendiri dan bisa diceritakan ulang sebagai video:
ada tokoh, kejadian, titik balik, dan pelajaran. Nasihat umum tanpa kejadian bukan kisah (lewati), kecuali sangat kuat
sebagai satu adegan.
Aturan keras:
- Hanya isi yang ADA di teks. Jangan menambah nama, tempat, angka, kejadian, ayat, atau hadis.
- "dalil": "text" dikutip PERSIS dari teks dalam bahasa aslinya (Arab/Inggris/Indonesia, jangan diterjemahkan), "id" terjemahan
  Indonesianya (kosong bila teks sudah Indonesia), "ref" rujukan persis seperti tertulis di teks (mis. "QS. Al-Baqarah: 186",
  "Bukhari"). Kosongkan bila tidak ada.
${PAGES_RULE}
- Kisah yang terpotong di akhir potongan tetap dicatat dengan "partial": true.
- "figures": tokoh; tandai "prophet": true bila tokoh adalah Nabi atau sahabat (tidak boleh digambar wajahnya).
- Nilai 1-5: "emotion" (menyentuh), "visual" (mudah digambarkan sebagai adegan), "clarity" (jelas tanpa banyak konteks).
- "estSeconds": perkiraan durasi narasi yang menceritakan kisah ini secara utuh tapi padat (detik).
- Semua isian lain dalam bahasa Indonesia, apa pun bahasa bukunya.
- Gelar "Hadhrat" / "Hazrat" / "Hadrat" di depan nama ditulis "Sahabat" (mis. "Sahabat Umar"); Nabi tetap "Nabi". Hanya di
  dalil "text" dan "ref" gelar asli dibiarkan karena dikutip persis.`;
const SCHEMA_MUSAFO = `Jawab JSON: {"stories":[{"title":"judul pendek","pages":["P12","P13"],"partial":false,"summary":"3-5 kalimat",
"arc":{"pembuka":"adegan pembuka","konflik":"...","titikBalik":"...","emosi":"...","pelajaran":"..."},
"figures":[{"name":"...","prophet":false}],"place":"...","era":"...","dalil":[{"text":"kutipan persis bahasa asli","id":"terjemahan Indonesia","ref":"rujukan di teks","page":"P12"}],
"emotion":1,"visual":1,"clarity":1,"estSeconds":60,"notes":"catatan sensitif / konteks yang perlu"}]}. Tanpa kisah: {"stories":[]}.`;

const SYSTEM_BKH = `Kamu editor konten untuk channel "Berakit ke Hulu": video vertikal pendek (Reels/TikTok, satu video utuh sampai 179 detik per
video, narasi lisan ±140 kata/menit) tentang asal-usul merek, perusahaan, dan pendiri usaha (Indonesia diutamakan).
Tugasmu membaca potongan buku dan mencatat SETIAP kisah yang berdiri sendiri dan bisa diceritakan ulang sebagai video:
ada tokoh, kejadian konkret (adegan), titik balik (ide, kesempatan, keberanian, kegagalan), dan pelajaran. Kisah jatuh-bangun,
keputusan berani, dan anekdot masa kecil/awal usaha paling berharga. Teori manajemen, statistik, atau opini tanpa kejadian
bukan kisah (lewati).
Aturan keras:
- Hanya isi yang ADA di teks. Jangan menambah nama, tempat, tahun, angka, merek, atau kejadian. Angka dan tahun ditulis persis.
- "quotes": ucapan tokoh yang dikutip di teks, "text" PERSIS seperti tertulis (bahasa aslinya), "who" siapa yang
  mengucapkan, "page" halamannya. Kosongkan bila tidak ada.
- "brand": merek/perusahaan yang dibahas (kosong bila tidak ada).
${PAGES_RULE}
- Kisah yang terpotong di akhir potongan tetap dicatat dengan "partial": true.
- Nilai 1-5: "emotion" (menyentuh/menegangkan), "visual" (mudah digambarkan sebagai adegan film animasi Indonesia tempo
  dulu), "clarity" (jelas tanpa banyak konteks).
- "estSeconds": perkiraan durasi narasi yang menceritakan kisah ini secara utuh tapi padat (detik).
- Semua isian lain dalam bahasa Indonesia, apa pun bahasa bukunya.`;
const SCHEMA_BKH = `Jawab JSON: {"stories":[{"title":"judul pendek","pages":["P12","P13"],"partial":false,"summary":"3-5 kalimat",
"arc":{"pembuka":"adegan pembuka","konflik":"...","titikBalik":"...","emosi":"...","pelajaran":"..."},
"figures":[{"name":"..."}],"brand":"...","place":"...","era":"...","quotes":[{"text":"kutipan persis","who":"...","page":"P12"}],
"emotion":1,"visual":1,"clarity":1,"estSeconds":60,"notes":"catatan sensitif / konteks yang perlu"}]}. Tanpa kisah: {"stories":[]}.`;
// BumiDiPijak (user 2026-11-07): a Musafo channel telling Babad Tanah Jawa stories, but a Javanese court chronicle: legend and history mixed, no dalil
const SYSTEM_BTJ = `Kamu editor konten untuk channel "BumiDiPijak": video vertikal pendek (Reels/TikTok, satu video utuh sampai 179 detik,
narasi lisan ±140 kata/menit) tentang kisah dari Babad Tanah Jawa(i) dan kronik Jawa sejenis: Majapahit, Demak, Pajang, Mataram,
para wali, raja, pendiri desa dan kraton, legenda, dan pusaka.
Tugasmu membaca potongan buku dan mencatat SETIAP kisah yang berdiri sendiri dan bisa diceritakan ulang sebagai video:
ada tokoh, kejadian konkret (adegan), titik balik, dan makna. Daftar silsilah, daftar nama, atau ringkasan pemerintahan tanpa
kejadian bukan kisah (lewati), kecuali satu adegan di dalamnya sangat kuat.
Aturan keras:
- Hanya isi yang ADA di teks. Jangan menambah nama, tempat, tahun, angka, atau kejadian. Ejaan nama dan tempat persis seperti teks.
- "legend": true bila kisahnya legenda atau mukjizat (kesaktian, makhluk gaib, Nyai Roro Kidul, pusaka bertuah, wahyu);
  false bila peristiwa yang dicatat sebagai sejarah (perang, suksesi, pendirian kraton). Kisah campuran: true.
- "quotes": tembang, sengkalan, atau ucapan tokoh yang dikutip di teks, "text" PERSIS (bahasa aslinya: Jawa/Indonesia/Belanda/
  Inggris, jangan diterjemahkan), "id" terjemahan Indonesianya (kosong bila sudah Indonesia), "who", "page". Kosongkan bila tidak ada.
- "figures": tokoh; tandai "sacred": true untuk Nabi, malaikat, atau wali (tidak boleh digambar wajahnya).
${PAGES_RULE}
- Kisah yang terpotong di akhir potongan tetap dicatat dengan "partial": true.
- Nilai 1-5: "emotion" (menyentuh/menegangkan), "visual" (mudah digambarkan sebagai lukisan minyak gelap berkabut: gapura bata, kraton,
  hutan, sungai, laut selatan), "clarity" (jelas tanpa banyak konteks).
- "estSeconds": perkiraan durasi narasi yang menceritakan kisah ini secara utuh tapi padat (detik).
- Semua isian lain dalam bahasa Indonesia, apa pun bahasa bukunya.`;
const SCHEMA_BTJ = `Jawab JSON: {"stories":[{"title":"judul pendek","pages":["P12","P13"],"partial":false,"legend":false,"summary":"3-5 kalimat",
"arc":{"pembuka":"adegan pembuka","konflik":"...","titikBalik":"...","emosi":"...","pelajaran":"..."},
"figures":[{"name":"...","sacred":false}],"place":"...","era":"Majapahit/Demak/Pajang/Mataram/...","quotes":[{"text":"kutipan persis","id":"terjemahan","who":"...","page":"P12"}],
"emotion":1,"visual":1,"clarity":1,"estSeconds":60,"notes":"catatan sensitif / konteks yang perlu"}]}. Tanpa kisah: {"stories":[]}.`;
// Miracle of Hajj (user 2026-11-08): pilgrims' experiences, usually only a few sentences each (a thread, a comment, a
// story told by a tour leader). Each one is a story; Claude finds the cause and the verse later, not the scanner.
const SYSTEM_MOH = `Kamu editor konten untuk channel "Miracle of Hajj": video vertikal pendek (Reels/TikTok, maksimal 150 detik) tentang
pengalaman nyata jamaah haji dan umrah di tanah suci: kejadian ajaib, aneh, atau mistis yang dialami seseorang.
Tugasmu membaca teks (thread, artikel, kumpulan cerita) dan mencatat SETIAP pengalaman yang berdiri sendiri, walaupun hanya
satu-dua kalimat. Cerita pendek justru yang biasa di channel ini. Perkenalan penulis, disclaimer, dan nasihat umum tanpa
kejadian bukan kisah (lewati).
Aturan keras:
- Hanya isi yang ADA di teks. Jangan menambah nama, tempat, angka, kejadian, sebab, ayat, atau hadis.
- "original": cerita itu dikutip PERSIS dari teks (bahasa aslinya, ejaan tidak dibetulkan).
- "habit": kebiasaan, pekerjaan, atau perbuatan tokoh sebelum berangkat yang DISEBUT di teks (kosong bila tidak disebut).
- "event": kejadian di tanah suci, singkat. "place": Mekah/Madinah/Arafah/Mina/Masjidil Haram/... bila disebut.
- "figures": tokoh disebut sesuai perannya (mis. "tetangga penulis", "jamaah lansia"); nama orang tidak dicatat.
${PAGES_RULE}
- Nilai 1-5: "emotion" (menyentuh/menegangkan), "visual" (mudah digambarkan), "clarity" (jelas tanpa banyak konteks).
- "estSeconds": perkiraan durasi narasi bila cerita ini dikembangkan jadi satu video (60-150).
- Semua isian lain dalam bahasa Indonesia.`;
const SCHEMA_MOH = `Jawab JSON: {"stories":[{"title":"judul pendek","pages":["P12","P13"],"partial":false,"summary":"1-3 kalimat",
"original":"kutipan persis","habit":"...","event":"...","place":"...","figures":[{"name":"peran tokoh","prophet":false}],
"emotion":1,"visual":1,"clarity":1,"estSeconds":90,"notes":"catatan sensitif / konteks yang perlu"}]}. Tanpa kisah: {"stories":[]}.`;
// keyed by story type, or by a channel id when that Musafo channel has its own prompt
const PROMPTS = { musafo: [SYSTEM_MUSAFO, SCHEMA_MUSAFO], berakitkehulu: [SYSTEM_BKH, SCHEMA_BKH], bumidipijak: [SYSTEM_BTJ, SCHEMA_BTJ], miracleofhajj: [SYSTEM_MOH, SCHEMA_MOH] };

function chunks(pages) {
  const out = [];
  for (let a = 0; a < pages.length; a += CHUNK_PAGES - OVERLAP) {
    const b = Math.min(pages.length, a + CHUNK_PAGES);
    let text = "";
    for (let i = a; i < b; i++) text += `\n[[P ${i + 1}]]\n${pages[i]}`;
    out.push({ key: `${a + 1}-${b}`, from: a + 1, to: b, text: text.slice(0, MAX_CHARS) });
    if (b === pages.length) break;
  }
  return out;
}

export async function scan(id, { force = false, log = console.log } = {}) {
  const book = loadBook(id);
  const pages = pagesOf(id);
  const [SYSTEM, SCHEMA] = PROMPTS[channelOf(book)] ?? PROMPTS[typeOfChannel(channelOf(book))] ?? PROMPTS.musafo;
  // book.startPage/endPage: the readable story text (Babad Tanah Jawi: the English translation; the Javanese-script
  // edition after it extracts as garbage and the model then invents stories from it)
  const { startPage = 1, endPage = Infinity } = book.book;
  const todo = chunks(pages).filter((c) => (force || !book.chunks[c.key]) && c.to >= startPage && c.from <= endPage);
  log(`${book.book.title}: ${pages.length} halaman, ${todo.length} potongan untuk dipindai`);
  for (const [i, c] of todo.entries()) {
    const head = `Buku: "${book.book.title}"${book.book.author ? ` oleh ${book.book.author}` : ""}. Potongan halaman ${c.from}-${c.to}.${book.book.url ? `\nIni artikel web (${book.book.url}): abaikan komentar pembaca, iklan, dan daftar berita lain; catat kisah dari artikelnya saja.` : ""}\n\n${SCHEMA}\n\nTEKS:\n${c.text}`;
    let res;
    try {
      res = await gemini({ system: SYSTEM, text: head, json: true });
    } catch (e) {
      log(`  ✖ ${c.key}: ${e.message}`);
      continue;
    }
    const found = (res.stories ?? []).filter((s) => s.title && Array.isArray(s.pages));
    for (const st of found) {
      st.pages = st.pages.map(pageNo).filter(Boolean);
      if (!st.pages.length) st.pages = [c.from, c.from];
      st.pages = [Math.min(...st.pages), Math.max(...st.pages)];
      for (const d of quotesOf(st)) if (d.page != null) d.page = pageNo(d.page);
    }
    // the range is checked against the quoted text, not trusted: see relocate()
    for (const [st, r] of relocateAll(found, pages)) { applyMove(st, r); verify(st, pages); }
    const fresh = loadBook(id);
    fresh.chunks[c.key] = { at: new Date().toISOString(), found: found.length, by: `gemini ${MODEL}` };
    fresh.stories = merge(fresh.stories, found.map((s) => ({ ...s, chunk: c.key, ...(fresh.book.project ? { status: "dipakai", project: fresh.book.project } : {}) })));
    saveBook(id, fresh);
    log(`  ✔ hal. ${c.key}: ${found.length} kisah (${i + 1}/${todo.length})`);
  }
  return loadBook(id).stories.length;
}

// the same story found in two overlapping chunks: keep the complete / longer one
function merge(old, found) {
  const all = [...old];
  for (const s of found) {
    s.pages = [Math.min(...s.pages), Math.max(...s.pages)];
    s.parts = Math.max(1, Math.ceil((s.estSeconds ?? 60) / 179)); // one full video up to 179 s (user 2026-11-07)
    s.score = +(((s.emotion ?? 0) + (s.visual ?? 0) + (s.clarity ?? 0)) / 3).toFixed(1);
    s.status ??= "baru";
    const same = all.findIndex((o) => o.pages[0] <= s.pages[1] && s.pages[0] <= o.pages[1] && (norm(o.title).slice(0, 14) === norm(s.title).slice(0, 14) || overlap(o.pages, s.pages) > 0.6));
    if (same < 0) { all.push(s); continue; }
    const o = all[same];
    if (o.status !== "baru") continue;
    if ((o.partial && !s.partial) || (!!o.partial === !!s.partial && (s.summary?.length ?? 0) > (o.summary?.length ?? 0))) all[same] = { ...s, id: o.id };
  }
  return all;
}
const overlap = (a, b) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]) + 1) / Math.max(1, Math.min(a[1] - a[0], b[1] - b[0]) + 1);

// ---------- page ranges checked against the quoted text ----------
// "P246", 246 or "246" -> 246
const pageNo = (v) => +String(v ?? "").replace(/\D/g, "") || 0;
const flat = (t) => norm(String(t ?? "").replace(/\s+/g, ""));
const quotesOf = (st) => [...(st.dalil ?? []), ...(st.quotes ?? [])];
// every quoted verse/hadith must be found word for word in the pages it came from; otherwise it is flagged
function verify(st, pages) {
  const text = flat(pages.slice(Math.max(0, st.pages[0] - 2), st.pages[1] + 1).join(" "));
  if (st.original) st.originalVerified = text.includes(flat(st.original)); // Miracle of Hajj: the anecdote quoted word for word
  for (const d of quotesOf(st)) d.verified = !!d.text && text.includes(flat(d.text)) && (!d.ref || text.includes(flat(d.ref)));
}
// the whole book as one flat string (letters/digits only) + where each page starts in it, so a quote that runs over a page
// break (headers, footnotes in between) is still found piece by piece
const INDEX = new WeakMap();
function bookIndex(pages) {
  if (!INDEX.has(pages)) {
    const starts = [];
    let all = "";
    for (const p of pages) { starts.push(all.length); all += flat(p); }
    INDEX.set(pages, { all, starts });
  }
  return INDEX.get(pages);
}
const pageAt = (starts, pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
// Where the story's own words (original, dalil, quotes) sit in the book. Each quote is cut into 32-character pieces; a
// piece that occurs at most 3 times counts at the occurrence nearest the page Gemini gave (the quote's own "page", else the
// story range), within MAX_SHIFT pages. -> [{ ref, page }] per quote that was found: page = where most of its pieces are.
const WIN = 32, MAX_SHIFT = 8;
function anchors(st, pages) {
  const { all, starts } = bookIndex(pages);
  const [a, b] = st.pages, out = [];
  const quotes = [{ text: st.original }, ...quotesOf(st)];
  for (const q of quotes) {
    const f = flat(q.text);
    if (f.length < 24) continue;
    const ref = q.page ? [q.page, q.page] : [a, b];
    const dist = (pg) => (pg < ref[0] ? ref[0] - pg : pg > ref[1] ? pg - ref[1] : 0);
    const wins = [];
    for (let i = 0; i + WIN <= f.length && wins.length < 12; i += WIN) wins.push(f.slice(i, i + WIN));
    if (f.length < WIN) wins.push(f);
    else if (f.length % WIN) wins.push(f.slice(-WIN));
    const count = {};
    for (const w of wins) {
      const at = [];
      for (let p = all.indexOf(w); p >= 0 && at.length < 4; p = all.indexOf(w, p + 1)) at.push(pageAt(starts, p));
      if (!at.length || at.length > 3) continue;
      const best = at.sort((x, y) => dist(x) - dist(y))[0];
      if (dist(best) <= MAX_SHIFT) count[best] = (count[best] ?? 0) + 1;
    }
    const pgs = Object.keys(count).map(Number);
    if (!pgs.length) continue;
    const page = pgs.sort((x, y) => count[y] - count[x] || x - y)[0];
    out.push({ ref: q.page || 0, page, pages: pgs });
  }
  return out;
}
// Shift = where the quotes really are minus the page Gemini gave them (most common among the quotes). A quote without its
// own page (Miracle of Hajj "original") only says the range must hold it: smallest shift that does. The shifted range is
// then widened to every page a quote runs onto.
// -> { how: "kutipan", shift, pages } | { how: "belum" } when no quote was found (no quote, or Gemini changed its words)
function relocate(st, pages) {
  const found = anchors(st, pages);
  if (!found.length) return { how: "belum", shift: 0, pages: st.pages };
  const [a, b] = st.pages;
  const votes = {};
  for (const q of found) if (q.ref) votes[q.page - q.ref] = (votes[q.page - q.ref] ?? 0) + 1;
  let shift = +(Object.entries(votes).sort((x, y) => y[1] - x[1] || Math.abs(x[0]) - Math.abs(y[0]))[0]?.[0] ?? 0);
  if (!Object.keys(votes).length) {
    const hits = found.flatMap((q) => q.pages), out = (d) => hits.filter((h) => h < a + d || h > b + d).length;
    for (let d = 1; d <= MAX_SHIFT && out(shift); d++) for (const s of [-d, d]) if (out(s) < out(shift)) shift = s;
  }
  const hits = found.flatMap((q) => q.pages).filter((h) => h >= a + shift - 2 && h <= b + shift + 2);
  const lo = Math.max(1, Math.min(a + shift, ...hits)), hi = Math.min(pages.length, Math.max(b + shift, ...hits));
  return { how: "kutipan", shift, pages: [lo, hi] };
}
// Stories without a found quote take the shift their chunk's other stories agree on (Gemini makes the same mistake for a
// whole call): at least 2 located stories and 2/3 of them on one shift. -> Map story -> result
function relocateAll(stories, pages) {
  const res = new Map(stories.map((st) => [st, relocate(st, pages)]));
  const byChunk = {};
  for (const [st, r] of res) if (r.how === "kutipan") (byChunk[st.chunk ?? ""] ??= []).push(r.shift);
  for (const [st, r] of res) {
    if (r.how !== "belum") continue;
    const sh = byChunk[st.chunk ?? ""] ?? [];
    const count = {};
    for (const s of sh) count[s] = (count[s] ?? 0) + 1;
    const [mode, n] = Object.entries(count).sort((x, y) => y[1] - x[1])[0] ?? [];
    if (n >= 2 && n / sh.length >= 2 / 3 && +mode !== 0) {
      const d = +mode;
      res.set(st, { how: "tebakan", shift: d, pages: [Math.max(1, st.pages[0] + d), Math.min(pages.length, st.pages[1] + d)] });
    }
  }
  return res;
}
function applyMove(st, r) {
  if (r.shift) for (const d of quotesOf(st)) if (d.page) d.page += r.shift;
  st.pages = r.pages;
  st.pagesCheck = { how: r.how, shift: r.shift, at: new Date().toISOString().slice(0, 10) };
}
// recheck: every story of every book (or one) against its pages; --fix writes the corrected ranges
export function recheck(ids = listBooks(), { fix = false, log = console.log } = {}) {
  const report = [];
  for (const id of ids) {
    const book = loadBook(id);
    const pages = pagesOf(id);
    const moves = relocateAll(book.stories, pages);
    const moved = [], missing = [];
    for (const [st, r] of moves) {
      const changed = r.pages[0] !== st.pages[0] || r.pages[1] !== st.pages[1];
      if (r.how === "belum") missing.push(st);
      else if (changed) moved.push({ id: st.id, title: st.title, project: st.project, from: [...st.pages], to: r.pages, how: r.how, shift: r.shift });
      if (fix) { applyMove(st, r); verify(st, pages); }
    }
    if (fix) saveBook(id, book);
    report.push({ id, stories: book.stories.length, moved, missing: missing.map((s) => ({ id: s.id, title: s.title, pages: s.pages })) });
    log(`\n${id}: ${book.stories.length} kisah, ${moved.length} rentang ${fix ? "dibetulkan" : "salah"}, ${missing.length} tanpa kutipan yang ketemu`);
    for (const m of moved) log(`  ${m.id}  hal.${m.from.join("-")} → ${m.to.join("-")}  (${m.how}, geser ${m.shift > 0 ? "+" : ""}${m.shift})${m.project ? `  [${m.project}: cek bahan.md]` : ""}  ${m.title}`);
    if (missing.length) log(`  tanpa kutipan: ${missing.map((s) => s.id).join(" ")}`);
  }
  return report;
}

// ---------- 3. one story -> one Musafo project ----------
export function useStory(bookId, storyId, { emit = true, extra = {} } = {}) {
  const book = loadBook(bookId);
  const s = book.stories.find((x) => x.id === storyId);
  if (!s) throw new Error(`kisah ${storyId} tidak ada di ${bookId}`);
  if (s.project && existsSync(join(ROOT, "videos", s.project))) return { slug: s.project, existed: true };
  const pages = pagesOf(bookId);
  const [a, b] = s.pages;
  let slug = slugify(s.title);
  for (let i = 2; existsSync(join(ROOT, "videos", slug)); i++) slug = `${slugify(s.title)}-${i}`;
  const where = book.book.url ? `, ${book.book.url}` : book.book.kind === "teks" ? " (teks tempelan)" : `, hal. ${a === b ? a : `${a}–${b}`} (PDF)`;
  const source = `${book.book.title}${book.book.author ? `, ${book.book.author}` : ""}${where}`;
  const channel = channelOf(book), type = typeOfChannel(channel);
  const fig = (s.figures ?? []).map((f) => `${f.name}${f.prophet ? " (Nabi/sahabat: jangan digambar)" : ""}`).join(", ");
  const material = [
    `Kisah dari library cerita (${bookId} / ${s.id}). Teks asli halamannya ada di assets/reference/bahan.md.`,
    "",
    `**Ringkasan:** ${s.summary}`,
    s.original && `**Cerita asli (dikutip):** ${s.original}${s.originalVerified === false ? " ⚠ belum cocok kata per kata dengan teks: cek di bahan.md" : ""}`,
    s.habit && `**Kebiasaan/perbuatan yang disebut:** ${s.habit}`,
    s.event && `**Kejadian di tanah suci:** ${s.event}`,
    s.arc && `**Alur:** pembuka: ${s.arc?.pembuka} · konflik: ${s.arc?.konflik} · titik balik: ${s.arc?.titikBalik} · emosi: ${s.arc?.emosi} · pelajaran: ${s.arc?.pelajaran}`,
    fig && `**Tokoh:** ${fig}`,
    s.brand && `**Merek/perusahaan:** ${s.brand}`,
    s.place && `**Tempat/masa:** ${s.place}${s.era ? `, ${s.era}` : ""}`,
    s.dalil?.length && `**Dalil di teks:**\n${s.dalil.map((d) => `- ${d.text}${d.id ? ` — ${d.id}` : ""} (${d.ref}, hal. ${d.page})${d.verified ? "" : " ⚠ belum cocok kata per kata dengan teks halaman: cek di bahan.md sebelum dipakai"}`).join("\n")}`,
    s.quotes?.length && `**Kutipan di teks:**\n${s.quotes.map((q) => `- "${q.text}"${q.who ? ` — ${q.who}` : ""} (hal. ${q.page})${q.verified ? "" : " ⚠ belum cocok kata per kata dengan teks halaman: cek di bahan.md sebelum dipakai"}`).join("\n")}`,
    `**Perkiraan durasi:** ${s.estSeconds} s${s.parts > 1 ? ` → series ${s.parts} bagian (lebih dari 179 s)` : ""}`,
    s.notes && `**Catatan:** ${s.notes}`,
  ].filter(Boolean).join("\n");
  // a Musafo channel tags the project; another story type (Berakit ke Hulu) is a project type of its own
  const dir = createMusafo(slug, s.title, material, source, type === "musafo" ? { channel } : { type });
  mkdirSync(join(dir, "assets", "reference"), { recursive: true });
  const excerpt = pages.slice(a - 1, b).map((p, i) => `[[HALAMAN PDF ${a + i}]]\n${p}`).join("\n\n");
  writeFileSync(join(dir, "assets", "reference", "bahan.md"), `# ${s.title}\n\n${source}\n\n${excerpt}\n`);
  writeJSON(join(dir, "request.json"), { type, ...(type === "musafo" ? { channel } : {}), title: s.title, story: material, source, story_ref: { book: bookId, id: s.id }, voice: "Gemini TTS", ...extra, created: new Date().toISOString() });
  s.status = "dipakai";
  s.project = slug;
  saveBook(bookId, book);
  if (emit) appendFileSync(join(ROOT, ".events.jsonl"), JSON.stringify({ at: new Date().toISOString(), type: `${type}-new`, slug, ...(type === "musafo" ? { channel } : {}), from: `${bookId}/${s.id}` }) + "\n");
  return { slug, existed: false };
}

// A book scan runs for many minutes: its progress lives in musafo/library/.job.json (not in the Studio process), so a
// Studio restart neither kills it nor forgets it, and a scan started from the terminal shows in Studio too.
// a project made from a link/text takes every story of that source; the ones its storyline leaves out are released
export function releaseStory(bookId, storyId) {
  const book = loadBook(bookId);
  const s = book.stories.find((x) => x.id === storyId);
  if (!s) throw new Error(`kisah ${storyId} tidak ada di ${bookId}`);
  s.status = "baru";
  delete s.project;
  saveBook(bookId, book);
  return s;
}
// a link or text typed in the new-video form joins the channel's library too (user 2026-11-07): the same link is found
// again instead of read twice, and its stories are tied to the project
export function sourceToLibrary({ text, title, author = "", channel, url = "", project }) {
  const same = listBooks().map(loadBook).find((b) => url && b.book.url === url);
  if (same) {
    same.book.project ??= project;
    for (const s of same.stories) if (s.status === "baru" && same.book.project === project) Object.assign(s, { status: "dipakai", project });
    saveBook(same.book.id, same);
    return { id: same.book.id, existed: true, scanned: Object.keys(same.chunks).length > 0 };
  }
  const r = ingestText(text, { title, author, channel, url, project });
  return { id: r.id, existed: false, scanned: false };
}

export const JOB = join(LIBRARY, ".job.json");
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
export function readJob() {
  if (!existsSync(JOB)) return null;
  const j = readJSON(JOB);
  return j.state === "running" && !alive(j.pid) ? { ...j, state: "error", line: `berhenti di tengah jalan (${j.line}). Klik "Pindai ulang yang belum" untuk melanjutkan.` } : j;
}

if (process.argv[1]?.endsWith("stories.mjs")) {
  const args = process.argv.slice(2);
  if (["ingest", "ingest-url", "ingest-text", "scan"].includes(args[0])) {
    if (readJob()?.state === "running") die("Masih ada buku yang sedang dibaca; tunggu sampai selesai.");
    mkdirSync(LIBRARY, { recursive: true });
    const label = args[0] === "scan" ? `Memindai ${args[1]}` : args[0] === "ingest-url" ? `Membaca ${args[1]}` : `Membaca ${basename(args[1] ?? "")}`;
    const job = (state, line) => writeJSON(JOB, { state, label, line, pid: process.pid, at: new Date().toISOString() });
    job("running", "mulai…");
    const log = console.log, err = console.error;
    console.log = (...a) => { log(...a); job("running", a.join(" ").trim().slice(0, 200)); };
    console.error = (...a) => { err(...a); job("error", a.join(" ").replace(/^✖ /, "").trim().slice(0, 200)); };
    process.on("exit", (code) => { const j = readJSON(JOB); if (j.state === "running") job(code === 0 ? "done" : "error", j.line); });
  }
  const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const force = args.includes("--force") && args.splice(args.indexOf("--force"), 1);
  const title = opt("title"), author = opt("author"), channel = opt("channel");
  const [cmd, a1, a2] = args;
  if (cmd === "channel") {
    if (a1 === "add" && a2) console.log(`✔ channel ${JSON.stringify(addChannel(args.slice(2).join(" ")))}`);
    else for (const c of listChannels()) console.log(`${c.id}  ${c.label}`);
  } else if (cmd === "ingest") {
    if (!a1) die('Usage: npm run stories -- ingest <file.pdf> [--title "Judul"] [--author "Penulis"] [--channel <id>]');
    const r = ingest(a1, { title, author, channel });
    console.log(`✔ ${r.id}: ${r.pages} halaman, ${r.chars} karakter`);
    const n = await scan(r.id);
    console.log(`✔ ${n} kisah di musafo/library/${r.id}/stories.json`);
  } else if (cmd === "ingest-url" || cmd === "ingest-text") {
    if (!a1) die(`Usage: npm run stories -- ${cmd} <${cmd === "ingest-url" ? "url" : "file.txt"}> [--title "Judul"] [--author "Penulis"] [--channel <id>]`);
    const art = cmd === "ingest-url" ? await fetchArticle(a1) : { text: readFileSync(a1, "utf8") };
    const r = ingestText(art.text, { title: title || art.title, author: author || art.author, channel, ...(cmd === "ingest-url" ? { url: a1 } : { file: `musafo/sumber/${basename(a1)}` }) });
    console.log(`✔ ${r.id}: ${r.chars} karakter, ${r.pages} bagian`);
    const n = await scan(r.id);
    console.log(`✔ ${n} kisah di musafo/library/${r.id}/stories.json`);
  } else if (cmd === "scan") {
    if (!a1) die("Usage: npm run stories -- scan <book> [--force]");
    console.log(`✔ ${await scan(a1, { force: !!force })} kisah`);
  } else if (cmd === "list") {
    for (const id of a1 ? [a1] : listBooks()) {
      const b = loadBook(id);
      console.log(`\n${id} · ${b.book.title} · ${channelOf(b)} · ${b.book.pages} hal · ${b.stories.length} kisah`);
      for (const s of b.stories) console.log(`  ${s.id}  hal.${String(s.pages.join("-")).padEnd(8)} ★${s.score}  ${String(s.estSeconds).padStart(3)}s${s.parts > 1 ? ` (${s.parts} bag.)` : "        "}  ${s.status === "baru" ? "" : `[${s.project ?? s.status}] `}${s.title}`);
    }
  } else if (cmd === "use") {
    if (!a1 || !a2) die("Usage: npm run stories -- use <book> <storyId>");
    try {
      const r = useStory(a1, a2);
      console.log(`${r.existed ? "• sudah ada" : "✔ proyek dibuat"}: videos/${r.slug}/ → /${STORY_TYPES[typeOfChannel(channelOf(loadBook(a1)))]?.skill ?? "musafo"} ${r.slug}`);
    } catch (e) {
      die(e.message);
    }
  } else if (cmd === "recheck") {
    const fix = args.includes("--fix");
    const ids = args.slice(1).filter((x) => x !== "--fix");
    recheck(ids.length ? ids : listBooks(), { fix });
    if (!fix) console.log("\n(laporan saja; tambah --fix untuk menulis rentang yang benar ke stories.json)");
  } else if (cmd === "release") {
    if (!a1 || !a2) die("Usage: npm run stories -- release <book> <storyId>");
    try { console.log(`✔ ${a2} kembali ke library: ${releaseStory(a1, a2).title}`); } catch (e) { die(e.message); }
  } else die("Usage: npm run stories -- channel [add \"Nama\"]|ingest|scan|list|use|release|recheck ...");
}
