---
name: berakit-ke-hulu
description: Berakit ke Hulu (user menyingkatnya BKH) di proyek MOTION/TERTORTOR. Video vertikal 9:16 kisah asal-usul merek dan pendiri usaha Indonesia (Kapal Api, BCA, Sosro, ...) dari bahan mentah user → storyline → narasi lisan (Gemini TTS) → satu adegan film animasi 3D Indonesia tempo dulu + satu klip image-to-video per shot → caption Indonesia + Inggris. Pakai untuk "/berakit-ke-hulu <slug>", "bikin video Berakit ke Hulu" / "BKH", event berakitkehulu-new, atau proyek dengan meta.json type "berakitkehulu".
---

# /berakit-ke-hulu <slug>

**BKH** = singkatan user untuk Berakit ke Hulu (2026-11-07); nama di Studio tetap "Berakit ke Hulu". Jenis proyek keempat di TERTORTOR (user 2026-11-05): **channel sendiri**, bukan bagian dari Musafo. Alur produksinya
sama persis dengan Musafo dan memakai engine yang sama (`tools/musafo.mjs`, state `videos/<slug>/musafo.json`), jadi
**ikuti langkah 0-6 di `.claude/skills/musafo/SKILL.md`** dengan perbedaan di bawah. Yang beda hanya isi cerita dan gaya
gambar. Bahasa jawaban: Indonesia santai.

## Alur Berakit ke Hulu (user 2026-11-07)
1. **Bahan:** user menempel link artikel (Studio mengambil teksnya ke `assets/reference/bahan.md`) atau teks di formulir,
   atau memakai Library Cerita. Opsional: foto asli tokoh utama (`assets/reference/tokoh/`). Link/teks panjang otomatis masuk
   Library Cerita (`request.json → story_ref.book`) dan semua kisahnya tertaut ke proyek ini: setelah storyline ditulis, kembalikan
   kisah yang tidak dipakai dengan `npm run stories -- release <book> <id>` (sebut di laporan).
2. **Storyline langsung** (event `berakitkehulu-new`): **tanpa tahap Draft**. Tulis `storyline.md` + `hooks.json` dari
   `bahan.md` (abaikan komentar pembaca di akhir artikel), lengkap dengan `## Alur asli`, `## Beda dari alur asli`, dan
   `## Tokoh`. Lebih dari 2 menit = series (`## Bagian k`, tiap bagian < 120 s, berakhir di titik tegang; hook/re-hook/
   cliffhanger bagian 2 dst. di `hooks.json → parts`).
3. **User mengedit storyline di Studio** (tab Storyline, teks sumber di kiri) lalu menyetujuinya. Setelah
   `request.json → storylineEditedAt` ada, storyline itu kata-kata user: naskah mengikutinya, tidak mengembalikan yang ia hapus.
4. **Character sheet** (bila ada foto tokoh): setelah storyline disetujui, sebelum naskah. Lihat § Tokoh di bawah.
5. `node tools/musafo.mjs series <slug> <n>` bila series, lalu naskah per bagian, persetujuan, Production, seperti Musafo.

## Tokoh: foto asli → character sheet per usia (user 2026-11-07)
- Usia tokoh utama dari `## Tokoh` di storyline (mis. anak 9-12, remaja, pemuda, dewasa, tua). Catat di
  `musafo.json → characters: [{ "id": "eka-anak", "name": "Eka Tjipta", "age": "9-12 tahun", "desc": "<satu kalimat Inggris>" }]`.
- **Satu character sheet per usia di Google Flow** (Nano Banana, gratis): ingredients = foto asli dari
  `assets/reference/tokoh/` (pilih yang paling dekat usianya) + 1 adegan gaya dari `berakitkehulu/reference/gambar/`.
  Prompt: "Create a character reference sheet, 16:9, of <desc>: front view, three-quarter view, side profile and full
  body standing, plus three facial expressions (worried, determined, smiling), on a plain warm grey background, same face
  in every view, resembling the person in the reference photos at age <usia>." lalu `styleAnchor`. Wajah **mirip foto user**
  dalam gaya 3D Pixar-like (user memberi fotonya: ini menimpa aturan "invented people, not likenesses" di skill
  `/berakitkehulu-prompt`); nama asli tetap tidak ditulis di prompt. Usia yang tidak ada fotonya: turunkan dari foto terdekat
  (lebih muda/tua), jelaskan di laporan.
- **Series berbagi tokoh** (user 2026-11-08): `characters[]`, sheet, dan foto tokoh mengalir otomatis ke bagian lain
  (`syncCharacters`: saat `series`, `add … character`, `build`, `clips`). Sheet hanya menyeberang ke bagian dengan gaya
  (`look`) yang sama; bagian PRESET2 butuh sheet PRESET2 sendiri (prompt sheet di atas + styleAnchor PRESET2, GPT Image,
  foto tokoh sebagai Image 4), dan sheet PRESET1 yang terlanjur tersalin hanya cadangan wajah sampai sheet itu dibuat.
- `node tools/musafo.mjs add <slug> character <id> <file>` → `assets/characters/<id>.png` + `sources.txt`. Cek lewat
  `frame-checker` (wajah sama di semua sudut, tidak ada teks palsu). Studio menampilkannya di tab **Tokoh**.
- Di naskah: `shots[].characters: ["eka-anak"]`, dan prompt `image` shot itu memuat `desc` **persis** (`check` menolak bila
  tidak). Saat membuat key visual, sheet usia itu ikut sebagai ingredient. `check` juga menolak gambar shot yang dibuat
  sebelum sheet-nya ada.
- **Klip juga memakai sheet** (user 2026-11-07, setelah wajah Eka berubah di adegan sesudah cut): tiap klip yang shot-nya
  punya `characters` diupload dengan **image 1 = character sheet usia di cerita** (`characters[0]`) dan **image 2 = key
  visual** shot itu, urutan dari `clips[].refs`. Prompt-nya format H3 full-reference (`refClipPrompt` di
  `tools/musafo.mjs`, dibuat otomatis oleh `clips`): `<Subject 1>` = tokoh utama dari `<Picture 1>`, `<Picture 2>` = frame
  pertama, setiap "the same boy/teenager/young man" di `scenes` menjadi `<Subject 1>`, dan prompt menyuruh **selalu memakai
  image 1 untuk tokoh utama** di semua adegan. Dengan begitu berapa pun adegan yang muat dalam 15 s, wajahnya tetap sama. Di
  `scenes[].scene` sebut tokoh utama sebagai "the same boy/teenager/young man" (bukan deskripsi baru). `check` menolak klip
  bertokoh yang promptnya bukan format ini. App RunningHub harus punya dua input gambar; bila hanya satu, berhenti dan
  laporkan (jangan jalankan tanpa sheet).
- **Era di setiap adegan klip**: `musafo.json → era` (mis. "Makassar, Dutch East Indies, in the 1930s"), `shots[].era`
  untuk shot yang beda zaman (mis. Jepang masuk 1942). Prompt klip menulis "The whole video is set in <era>: period
  architecture, clothing, vehicles and props only, nothing modern." Adegan sesudah cut tidak punya gambar, jadi tanpa
  kalimat ini zamannya bergeser. Benda yang belum ada di zaman itu (kipas angin langit-langit di sekolah kampung 1930-an,
  plastik, lampu modern) tidak ditulis di `scenes`.
- Series: character sheet dibuat sekali di bagian 1 lalu disalin ke bagian lain (`assets/characters/` + `characters` yang sama).
- Foto ditambahkan belakangan di tab Tokoh = event `characters`: buat/ulang sheet usia yang terdampak, laporkan.

## Bahan dari Library Cerita
Buku biografi pendiri atau sejarah merek (PDF), link artikel, atau teks tempelan dimasukkan di TERTORTOR → Library
Cerita → tab **Berakit ke Hulu** (`npm run stories -- ingest <file.pdf> | ingest-url <url> | ingest-text <file.txt>
--channel berakitkehulu`). Link: teks artikel diambil dari halamannya (menu dan daftar berita dibuang, komentar
pembaca diabaikan saat dipindai). Gemini mencatat tiap kisah dengan merek, tokoh, dan
kutipan tokoh yang dicek kata per kata ke halaman. "Jadikan video" membuat proyek type `berakitkehulu` + event
`berakitkehulu-new`; storyline ditulis dari `assets/reference/bahan.md`, bukan dari ringkasan Gemini. Kutipan bertanda ⚠
dicek manual dulu.

## Gaya (bukan gaya Musafo)
- **Dua gaya visual, dipilih per proyek** (user 2026-11-08): `meta.json → look`, dipilih user di formulir Buat video atau
  di tab Shot editor (`node tools/musafo.mjs look <slug> [preset1|preset2]`; proyek tanpa `look` = `defaultLook` preset2 sejak user 2026-11-10, sebelumnya preset1).
  Blok gaya yang berlaku = `brand.json → berakitkehulu.looks.<look>` (`styleAnchor`, `clipLook`, `clipKeep`, `grain`,
  `refs`); `check` memeriksa styleAnchor gaya proyek itu. Baca `look` proyek sebelum menulis satu prompt pun.
  - **PRESET1 · 3D sinematik**: gaya awal (Kapal Api, Liem/BCA, Sosro). Semua aturan di bawah berlaku apa adanya.
  - **PRESET2 · 3D cerah**: render 3D bersih ala tanah liat pahat (subsurface scattering di kulit, tanpa garis tinta),
    cahaya volumetrik sore keemasan, jalanan tropis padat detail, oker-terakota-hijau jenuh di bawah langit biru, wajah
    lembut dan ramah. **Gambar dibuat di GPT Image, sementara manual oleh user** (user 2026-11-08): Claude menulis prompt
    lengkap dan menampilkannya di chat dalam satu blok untuk disalin; user mengunggah 3 gambar acuan sebagai Image 1-3
    (styleAnchor menutup dengan "Image 1, 2 and 3 as visual style reference only."), lalu menyimpan hasilnya untuk
    `add <slug> image`. Kata kunci styleAnchor dari user, jangan diubah. Acuan:
    `reference/gambar/PRESET 2/`, `reference/video/PRESET2/`, analisis di `analysis.md` § PRESET2. Aturan orang, era, dan
    komposisi dari `/berakitkehulu-prompt` tetap, tapi style block-nya diganti styleAnchor PRESET2, dan cahaya mengikuti
    PRESET2: siang dan sore selalu terang keemasan (adegan susah tetap terang, kesusahannya lewat ekspresi, baju, dan benda),
    malam = cahaya lampu minyak hangat di jalan yang tetap penuh detail. Wide shot boleh lebih sering (jalan dan kampung
    yang ramai adalah ciri gaya ini). Acuannya kota tua Vietnam: jangan pernah ada bendera Vietnam atau bendera negara lain;
    bangunannya ruko dan kampung Indonesia tempo dulu; merah putih hanya bila ceritanya menyebut.
  - Ganti gaya di tengah proyek: gambar dan klip lama tetap bergaya lama; tulis ulang `image` semua shot dengan styleAnchor
    baru, buat ulang key visual dan character sheet, lalu `clips --force`.
- **Prompt gambar ditulis dengan skill `/berakitkehulu-prompt`** (dari user, 2026-11-07), menggantikan `/musafo-prompt`
  dan semua aturan wajah/orb Musafo. Baca `references/style-bible.md` dan `era-and-settings.md` sekali per sesi,
  `story-beats.md` saat memecah naskah jadi shot. Di MOTION: "Create a cinematic vertical 9:16 image of …", 90-150 kata,
  subjek (umur, suku, ekspresi, pakaian dan bekas pakainya) → aksi → tempat + era (satu kalimat era, tanpa anakronisme,
  penanda tropis) → komposisi (subjek di dua pertiga bawah, sepertiga bawah kosong untuk caption) → cahaya → **styleAnchor
  gaya proyek (`brand.json → berakitkehulu.looks.<look>.styleAnchor`) persis di akhir** (PRESET1 = style block skill;
  `check` menolak bila tidak ada). Character sheet juga memakai styleAnchor gaya proyek.
- **Wajah terlihat dan ekspresif**, pusat emosinya. Nama asli tidak pernah ditulis di prompt; narasi yang menyebut nama.
  Tanpa foto dari user: tokoh = arketipe (umur, peran, rupa). Dengan foto: wajah mengikuti character sheet (§ Tokoh). Satu kalimat deskripsi tokoh utama per usia, dipakai persis
  sama di semua shot (tulis di `storyline.md` → `## Tokoh`). Tionghoa-Indonesia digambar sebagai orang Indonesia, tanpa karikatur.
- Satu warna aksen per frame pada benda ceritanya; cahaya mengikuti suasana (mendung untuk susah, bohlam/jendela untuk
  interior, blue hour + lampion untuk pasar malam, golden hour untuk harapan/menang). Perang: kelangkaan dan antrean, bukan darah.
- Gambar acuan di `berakitkehulu/reference/gambar/` (PRESET1, file di akar folder) dan `gambar/PRESET 2/` (PRESET2), video acuan di `berakitkehulu/reference/video/`,
  `berakitkehulu/reference/analysis.md`. Ingredients di Google Flow: 1-3 adegan dari folder `refs` gaya proyek (bukan thumbnail
  ber-teks); tokoh yang sama di shot lain: gambar shot sebelumnya ikut sebagai ingredient supaya wajah dan baju konsisten.
- `scenes[].scene` (multi-scene dalam satu klip) ditulis dengan urutan yang sama tanpa style block; prompt klip memakai
  `clipLook`/`clipKeep` dari gaya proyek (`brand.json → berakitkehulu.looks.<look>`) otomatis.
- Tidak ada orb, kaligrafi, atau `shots[].orb` (khusus Musafo). Grain dari style block saja (`berakitkehulu.grain` 0).
- **Logo merek nyata tidak pernah di-generate** (kemasan ditulis "a paper coffee bag with a simple emblem"). Bila logonya
  ada di bahan dan user mau, file logo asli ditempel di shot penutup saja + baris di `sources.txt`.

## Cerita (pengganti aturan islami Musafo)
- Kisah nyata asal-usul merek/pendiri usaha Indonesia. Bentuk: anak muda/keadaan sulit → kerja keras → titik balik (ide,
  kesempatan, keberanian) → sukses → merek/produk hari ini → satu pelajaran untuk penonton → satu ajakan pendek.
- **Bahan user adalah sumbernya**: tidak menambah nama, tahun, angka, tempat, atau kejadian yang tidak ada di bahan. Yang
  tidak pasti disebut sebagai "konon"/"cerita yang beredar" atau dihapus.
- Aturan dalil/ayat/hadis dan larangan menggambar Nabi/sahabat dari Musafo tidak relevan di sini; tokoh nyata (pendiri,
  keluarga) boleh digambar sebagai karakter animasi bergaya, tanpa meniru foto asli wajahnya.
- Merek hanya disebut di narasi; gambar tanpa logo/teks (lihat Gaya). Produk hari ini di shot penutup.
- Hook: kalimat pertama menaruh penonton di tengah kejadian. Acuan memakai judul besar di layar di detik pertama
  ("MALU ATAU MAJU", "PENDIRI BANK BERLOGO CENGKEH"); alur engine belum punya judul layar, jadi tawarkan teks judul hook
  (≤ 5 kata, uji sekilas `/paket-ide`) di storyline dan sebutkan bila user ingin ditambahkan sebagai langkah tersendiri.
- Gaya bicara default: "seperti pendongeng sejarah: hangat, penuh semangat, ada jeda dramatis" (bukan gaya ustadz).

## Sama dengan Musafo
- Skill `/paket-ide` dijalankan sebelum storyline (sudut, 10 calon hook, uji sekilas, taruhan) dan saat menulis judul
  layar/caption posting. Keunggulan channel ini = momen spesifik pendiri dari biografi, bukan "rahasia sukses" umum.
- Storyline + 3 pilihan hook (`hooks.json`), persetujuan storyline dan naskah di TERTORTOR, satu video utuh sampai 179 s
  **lebih dari 2 menit = series** (user 2026-11-07, Eka Tjipta; beda dari Musafo): tiap bagian < 120 s, berakhir di titik
  tegang, `node tools/musafo.mjs series <slug> <n>` setelah storyline disetujui; hook/re-hook/cliffhanger bagian 2 dst. di
  `hooks.json → parts`.
- **Tanpa Draft** (beda dari Musafo, user 2026-11-07): storyline langsung dari sumber, dan user mengedit storyline itu sendiri.
- **Alur asli dulu** (user 2026-11-07, aturan lengkap di skill `/musafo` § 1): storyline punya `## Alur asli` (kejadian
  bernomor persis urutan buku) dan `## Beda dari alur asli`; naskah mengikuti storyline yang disetujui butir demi butir.
  Kejadian dari sumber tidak dibuang demi durasi: user yang memendekkan.
- Naskah: maks 10 shot, tiap shot ≤ `clipSeconds` narasi (diperlambat maks ×1,8), multi-scene `scenes` per kalimat,
  `framing` bergantian, `node tools/musafo.mjs build|check` (skill `/musafo` § 2), lewat `/humanizer`.
- `script-approved`: `node tools/script-edit.mjs list <slug>` lalu berhenti. Tombol **Production** (event `production`):
  suara satu take Gemini TTS (style dari `request.json → voiceStyle`) → build → key visual semua shot di Flow (gratis; akun
  Chrome kedua `flow.google.com/?authuser=1` di PC graef), lalu laporkan. Klip menunggu keputusan user (skill `/musafo` § 3b, 5).
- Caption ID + EN, `npm run check`, contact sheet lewat `frame-checker` sebelum menyerahkan.
- Event dari TERTORTOR: `berakitkehulu-new` (proyek baru → storyline), `characters` (foto tokoh baru), `storyline-approved`
  (character sheet bila ada foto, lalu `series` bila perlu, lalu naskah), `script-approved`, `production`.

## Feedback
Setiap koreksi user → satu baris di `.claude/skills/video-vertikal/LESSONS.md` dengan asal `berakitkehulu/<slug>`.
