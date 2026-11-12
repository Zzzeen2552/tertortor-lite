---
name: bumidipijak
description: BumiDiPijak (user menyingkatnya BDP) di proyek MOTION/TERTORTOR. Video vertikal 9:16 sejarah dan legenda Jawa dari Babad Tanah Jawa (Majapahit, Demak, Pajang, Mataram, dewa dan raja legendaris) dari Library Cerita → storyline series → narasi lisan (Gemini TTS) → satu lukisan minyak gelap berkabut + satu klip image-to-video per shot → caption Indonesia + Inggris. Pakai untuk "/bumidipijak <slug>", "bikin video BumiDiPijak" / "BDP", event bumidipijak-new, atau proyek dengan meta.json type "bumidipijak".
---

# /bumidipijak <slug>

**BDP** = BumiDiPijak. Jenis proyek sendiri di TERTORTOR sejak 2026-11-08 (user: "make BDP fully independent"):
`meta.json → type: "bumidipijak"`, channel `bumidipijak`, preset `presets/bumidipijak`, gaya `brand.json → bumidipijak`.
Engine-nya sama dengan Musafo dan Berakit ke Hulu (`tools/musafo.mjs`, state `videos/<slug>/musafo.json`), jadi perintah
teknisnya (build, check, clips, add, series, voice, swap, finish) sama dengan skill `/musafo`. Isi cerita, alur, dan
gayanya milik BDP. Bahasa jawaban: Indonesia santai.

## Alur BDP
1. **Bahan:** hampir selalu dari Library Cerita BDP (buku *Babad Tanah Jawi, The Chronicle of Java*, Remmelink 2022,
   urut halaman = urut waktu). "Jadikan video" membuat proyek type `bumidipijak`, teks halaman asli di
   `assets/reference/bahan.md`, lalu event `bumidipijak-new`.
2. **Storyline langsung, tanpa Draft** (seperti BKH): tulis `storyline.md` + `hooks.json` dari `bahan.md` (atau dari
   arahan user di chat bila ada; kata-kata user didahulukan), lengkap dengan `## Alur asli`, `## Beda dari alur asli`, dan
   `## Tokoh`. Jalankan `/paket-ide` dulu (sudut, 10 calon hook, uji sekilas, taruhan).
3. **Lebih dari 2 menit = series** (user 2026-11-08, `brand.json → bumidipijak.maxSeconds` 120): `## Bagian k`, tiap bagian
   < 120 s, berdiri sendiri, berakhir di titik tegang. Batas episode yang user sebutkan menang atas pembagian Claude. Hook,
   re-hook, cliffhanger bagian 2 dst. di `hooks.json → parts`.
4. **User mengedit storyline di Studio** (tab Storyline, teks buku di kiri) lalu menyetujuinya (`storyline-approved`). Setelah
   `request.json → storylineEditedAt` ada, storyline itu kata-kata user.
5. `node tools/musafo.mjs series <slug> <n>` bila series, lalu naskah per bagian (`musafo.json`), `build`, `check`,
   persetujuan naskah, tombol Production (suara satu take → key visual di Flow), klip, render. Detail teknis: skill `/musafo` § 2-6.

## Cerita
- Sumbernya babad: campuran silsilah, legenda, dan sejarah. **Tidak ada nama, tahun, tembang, sengkalan, atau kejadian yang
  dikarang.** Klaim sejarah di narasi memakai "menurut Babad…" / "konon"; legenda diceritakan sebagai legenda.
- Ejaan nama mengikuti buku (Bathara Guru, Dèwi Sinta, Gilingwesi, Suralaya); caption Inggris memakai ejaan yang sama.
- Silsilah panjang (Adam → Sis → … → Bathara Guru) cukup satu kalimat bila perlu; jangan jadi daftar.
- Bagian sensitif dari sumber (mis. pernikahan ibu-anak di kisah Watugunung) diceritakan apa adanya tapi tidak digambar
  vulgar: cukup tatapan, jarak, bekas luka, tangan yang berhenti.
- Gelar dan istilah Jawa dipertahankan (prabu, dèwi, kraton, bertapa); dijelaskan singkat di narasi kalau perlu.
- Bentuk per bagian: buka di tempat kejadian → konflik → titik balik → tegang/emosi; bagian terakhir boleh ditutup satu
  kalimat renungan dan satu ajakan pendek. Tidak ada dalil/ayat (bukan kanal islami).
- **Suara default: Kira** (user 2026-11-08, `brand.json → bumidipijak.voice`), gaya bicara "seperti dalang bercerita: tenang, berwibawa, ada jeda". Formulir Studio dan tab Suara memakainya bila `request.json` kosong.

## Gaya gambar (lukisan minyak gelap, user 2026-11-08)
- **Gaya dari grid acuan user** `musafo/channels/bumidipijak/reference/Screenshot 2026-11-08 060132.png`: lukisan minyak gelap,
  sapuan kuas lebar, hitam tinta, abu arang, biru batu, oker zaitun, serpih emas, awan badai, kabut dan asap. Menggantikan
  arang-pastel di kertas cokelat (blok lama disimpan di `brand.json → bumidipijak.styleAnchorOld`).
- **Standar gaya BDP = lukisan minyak gelap** (user 2026-11-08); setiap proyek BDP baru memakainya. Isi adegan, era, busana, dan aturan tokoh tetap dari skill `/babad-tanah-jawa-prompt`, tapi **mediumnya bukan** arang-pastel
  skill itu. Bentuk `image`: "Create a vertical 9:16 dark oil painting of …" → subjek → aksi → tempat → komposisi (sepertiga
  bawah tenang untuk caption) → `bumidipijak.era` → `bumidipijak.styleAnchor` **persis** (`check` menolak tanpa itu) →
  "No text, no signature.".
- Di Flow: grid acuan sebagai satu-satunya ingredient, prompt diawali "Match the painting style, palette and mood of the
  reference image (do not copy its subjects or layout)." Gambar gratis; generate pelan-pelan (satu per satu) karena
  antrean cepat memicu "unusual activity".
- Tokoh kecil dan tenang; wajah kecil, menunduk atau berpaling, tidak pernah potret. Dewa dan raja sebagai arketipe tanpa
  nama di prompt; dewa tidak digambar sebagai sosok (singgasana kosong, cahaya, benda). Wali hanya dari belakang/jauh. Nabi
  dan malaikat tidak digambar. Tidak ada orb, kaligrafi, atau `shots[].orb`. Grain bergerak mati.
- Prompt klip memakai `clipLook`/`clipKeep` dari `brand.json → bumidipijak` otomatis (tetap lukisan minyak di setiap cut).

## Tampilan video
- Preset `presets/bumidipijak`: caption Indonesia putih, Inggris terakota muda, pita sedikit lebih gelap; aksen terakota
  (label episode dan kata aksen di thumbnail). Logo channel `musafo/channels/bumidipijak/logo.png` = watermark kiri atas.
- Thumbnail: teks di bawah (`thumbnail.json → position: "bottom"`) bila wajah/tokoh di sepertiga atas.

## Event dari TERTORTOR
`bumidipijak-new` (proyek baru → storyline series), `storyline-approved` (`series` bila perlu, lalu naskah),
`script-approved` (`node tools/script-edit.mjs list <slug>` lalu berhenti), `production` (suara → key visual, laporkan).

## Feedback
Setiap koreksi user → satu baris di `.claude/skills/video-vertikal/LESSONS.md` dengan asal `bumidipijak/<slug>`.
