---
name: musafo
description: Musafo di proyek MOTION/TERTORTOR. Video vertikal 9:16 kisah islami untuk media sosial dari bahan mentah user (ide kasar, artikel, kutipan buku) → storyline → narasi lisan (Gemini TTS) → satu ilustrasi 3D golden hour + satu klip image-to-video per shot → caption Indonesia + Inggris. Pakai untuk "/musafo <slug>", "bikin video Musafo", atau proyek dengan meta.json type "musafo".
---

> **TERTORTOR LITE:** channel Musafo tidak ada di sini. Skill ini disimpan hanya sebagai manual teknis engine `tools/musafo.mjs` yang dipakai Berakit ke Hulu dan BumiDiPijak (langkah 0-6). Jangan membuat proyek `type: "musafo"`.


# /musafo <slug>

Jenis proyek ketiga di TERTORTOR (setara explainer dan city timelapse). Gaya diambil dari `musafo/reference/`
(baca `musafo/reference/analysis.md` sekali per sesi). Bahasa jawaban: Indonesia santai. State: `videos/<slug>/musafo.json`;
semua yang lain (script.md, beats.json, scene, caption) dibuat oleh `node tools/musafo.mjs build <slug>`.
Gerbang: `node tools/musafo.mjs check <slug>` sampai tanpa ✖, lalu `npm run check -- <slug>` sebelum render.

## 0. Proyek
- Dibuat dari TERTORTOR (Buat video → Musafo): `request.json` berisi `title`, `story` (bahan mentah), `source`
  (judul buku/penulis/link, opsional), `voiceSpeaker`, `voiceStyle`. Bahan mentah juga ada di `brief.md`.
- Tanpa Studio: `node tools/musafo.mjs new <slug> "Judul" --story bahan.txt`.
- **Dari Library Cerita** (buku panjang): user mengunggah PDF di TERTORTOR → Library Cerita (atau
  `npm run stories -- ingest <file.pdf> --title … --author …`). `tools/stories.mjs` mengambil teks per halaman (pdftotext),
  Gemini membaca per 20 halaman dan mencatat tiap kisah ke `musafo/library/<buku>/stories.json` (ringkasan, alur, tokoh,
  dalil yang dikutip persis + dicek kata per kata ke teks halaman, skor, perkiraan durasi). Claude **tidak** membaca buku
  utuh. Tombol "Jadikan video" (atau `npm run stories -- use <buku> <id>`) membuat proyek: ringkasan di `brief.md`, teks
  asli halamannya di `assets/reference/bahan.md` (tidak masuk git). Storyline ditulis dari `bahan.md`, bukan dari
  ringkasan Gemini. Dalil bertanda ⚠ (belum cocok dengan teks) dicek manual di `bahan.md` sebelum dipakai.
- Formulir Buat video memilih sumber: link, tempel teks, atau Library Cerita (user 2026-11-07). Link/teks panjang otomatis
  masuk Library Cerita dengan semua kisahnya tertaut ke proyek (`request.json → story_ref.book`); setelah storyline ditulis,
  kembalikan kisah yang tidak dipakai: `npm run stories -- release <book> <id>`.

## 0. Draft cerita → user mengedit dan menyetujui (bila ada teks sumber)
User 2026-11-07: begitu kisah dipilih (Library Cerita → `assets/reference/bahan.md`, atau kutipan buku/artikel), yang
pertama ditulis **`draft.md`**, bukan storyline. Studio menampilkannya di tab **Draft** berdampingan dengan teks buku
(kiri buku, kanan draft); user mengeditnya langsung lalu klik "Setujui draft" (event `draft-approved`).
- Isi: kisahnya diceritakan ulang **utuh dan persis urutan sumber** dalam bahasa Indonesia yang wajar, paragraf pendek,
  satu kejadian per paragraf, dialog dikutip (terjemahan setia, makna tidak bergeser). Belum ada hook, pelajaran, ajakan,
  atau pemotongan durasi: itu urusan storyline. Gelar "Hadhrat" → "Sahabat"; Nabi/Rasulullah tetap.
- Di akhir, satu bagian `## Catatan` pendek: sumber + halaman, catatan sanad dari buku, istilah yang terjemahannya dipilih
  (mis. "lenient" → "mudah"), dan bagian sumber yang sengaja tidak masuk (mis. ciri fisik Nabi). Tanpa dramatisasi.
- Lewat `/humanizer`, lalu jalankan `node tools/wait-event.mjs` di background dan berhenti.
- Setelah user mengedit (`request.json → draftEditedAt`), **draft adalah kata-kata user**: storyline mengikuti draft itu,
  bukan teks buku, dan tidak mengembalikan bagian yang user hapus. `approveStoryline` menolak bila draft belum disetujui
  atau berubah sesudahnya.

## 1. Storyline → user menyetujui
Bahan mentah bisa berantakan: ide satu kalimat, artikel panjang, kutipan buku, transkrip ceramah. **Sebelum menulis,
jalankan skill `/paket-ide`**: minimal 8 sudut cerita + 10 calon hook di `paket.md`, uji sekilas, keunggulan channel
(detail spesifik dari bahan), dan satu baris **Taruhan:** di storyline. Lalu tulis `storyline.md`:
- **Satu benang cerita, satu video utuh** (user 2026-11-07, menggantikan batas 90 detik): semua kejadian dari sumber
  masuk, sampai 179 detik (±415 kata). User sendiri yang memendekkan lewat Edit naskah di Studio; kalimat yang ia hapus
  tidak ditambahkan lagi. Lebih dari 179 detik: tanya user mau series atau bagian mana yang dibuang. Artikel/buku
  yang memuat banyak kisah: pilih satu yang paling kuat dan sebutkan 1-2 kisah lain di bagian "Bisa jadi video berikutnya".
- **Series hanya bila user memintanya** (atau cerita > 179 detik dan user memilih series). Bagi di storyline.md per bagian
  (`## Bagian 1`, `## Bagian 2`, …), tiap bagian 60-90 detik dan berdiri sendiri:
  - Bagian 1 buka di tempat kejadian seperti biasa; bagian 2 dst. buka dengan satu kalimat pengingat ("Kemarin kita
    sampai di…") lalu langsung masuk adegan.
  - Setiap bagian kecuali yang terakhir ditutup di titik tegang + "Bersambung ke bagian berikutnya."
  - Pelajaran, dalil, dan ajakan hanya di bagian terakhir (bagian lain boleh satu kalimat renungan pendek).
  - Tulis jumlah bagian dan perkiraan durasi tiap bagian di ringkasan untuk user.
  Setelah storyline disetujui: `node tools/musafo.mjs series <slug> <jumlah>` → proyek `<slug>` (Bagian 1),
  `<slug>-2`, `<slug>-3`, … dengan judul "(Bagian k/n)", brief dan storyline yang sama (persetujuan ikut). Kerjakan
  bagian satu per satu: naskah, persetujuan, suara, gambar, klip, render. Gaya visual dan speaker suara sama di semua bagian.
- **Alur asli dulu** (user 2026-11-07, setelah Lelaki Baladawiyyah: hadis yang diucapkan di pasar dipindah ke akhir,
  jawaban Nabi dipotong sampai maknanya bergeser, syahadat tokohnya hilang). Kisah yang punya teks sumber (Library
  Cerita → `assets/reference/bahan.md`, atau kutipan buku/artikel dari user):
  - `## Alur asli` di storyline.md: daftar bernomor kejadian **persis urutan sumber**, satu kejadian per butir, dialog
    penting dikutip (terjemahan setia). Ini yang dibandingkan user dengan teks sumber di tab Storyline.
  - Tahap storyline (pembuka, konflik, …) adalah label di atas urutan itu, **bukan alasan memindah kejadian**. Ucapan,
    dalil, atau doa yang terjadi di tengah kisah tetap di tempatnya; pelajaran di akhir boleh merujuk balik, tidak memindahnya.
  - Ucapan Nabi/tokoh tidak dipotong sampai maknanya berubah (contoh: "Kalian pemilik barang kalian" tanpa "aku hanya
    ingin bertemu Allah tanpa ada yang menuntutku" terdengar seperti menolak). Terjemahan yang bisa disalahpahami ditulis
    maknanya ("That is Allaah" → "Itu dari Allah", bukan "Itu Allah").
  - `## Beda dari alur asli`: setiap kejadian yang dibuang, digabung, atau dipindah, dengan alasannya (atau "tidak ada").
    Kejadian yang membawa makna (jawaban Nabi, titik balik, syahadat/keputusan tokoh, akhir kisah) tidak boleh dibuang:
    video boleh panjang (sampai 179 detik), user yang memendekkan. Tunjukkan bagian ini ke user di chat bersama ringkasan.
  - `approveStoryline` (tombol Studio) menolak storyline tanpa dua bagian itu bila `bahan.md` ada.
- Isi: judul kerja, sumber, lalu alur bertahap: **Pembuka** (penonton langsung di tempat kejadian) → **Konflik** →
  **Titik balik** → **Emosi** → **Pelajaran untuk penonton** ("kita…") → **Dalil** (hanya bila ada di bahan, dikutip
  persis dengan sumbernya) → **Ajakan** (satu kalimat). Tiap tahap 1-3 kalimat, plus perkiraan durasi.
- Bagian **"Dari bahan / tambahan"**: tandai apa yang diambil langsung dari bahan dan apa yang ditambahkan untuk
  dramatisasi (suasana, gerak tubuh). Fakta baru (nama, tempat, angka, kejadian, ayat, hadis) tidak boleh ditambahkan.
- Ide kasar tanpa kisah konkret: tawarkan 2 arah storyline dalam satu file (A/B) dan biarkan user memilih saat menyetujui.
- **Kait retensi → `hooks.json`** (ditulis bersama storyline, dicek `checkHooks`, disetujui bersama storyline):
  - **3 pilihan hook**, tiap pilihan beda jenis: `cold open` (langsung di tengah kejadian), `pertanyaan` (menyentuh
    penonton, dijawab oleh kisahnya), `kutipan` (kalimat/detail paling kuat dari bahan, termasuk titik balik yang diceritakan
    lebih dulu). Tiap pilihan: `line` (kalimat pertama yang diucapkan, ≤ 12 kata ±3 detik, tanpa salam/sapaan, tanpa
    "di video ini"), `image` (gambar pertama, harus sudah bercerita tanpa suara), `loop` (pertanyaan yang sengaja dibiarkan
    terbuka = open loop), `why` (kenapa orang berhenti scroll). Hook tidak boleh menjanjikan isi yang tidak ada di bahan.
  - **Re-hook** `{ line, at }`: satu kalimat di 25-70% durasi yang membuka rasa penasaran baru ("Tapi yang terjadi
    sesudahnya…"), biasanya tepat sebelum titik balik.
  - **Cliffhanger** (hanya bagian series yang bukan terakhir): kalimat penutup di titik tegang, diakhiri "Bersambung ke
    bagian berikutnya." Bagian 2 dst.: hook dulu, baru satu kalimat pengingat.
  User memilih satu hook di tab Storyline (atau sebut di chat → `node tools/musafo.mjs storyline-approve <slug>` setelah
  `hooks.json → chosen` diisi pilihannya).
- Lewat `/humanizer`, lalu tunjukkan ringkasannya di chat. User menyetujui lewat tombol "Setujui storyline" di TERTORTOR
  (event `storyline-approved`) atau di chat (`node tools/musafo.mjs storyline-approve <slug>`). Jalankan
  `node tools/wait-event.mjs` di background, lalu berhenti. Revisi = tulis ulang storyline.md (persetujuan lama otomatis
  gugur karena isinya berubah).

## 2. Naskah = musafo.json → user menyetujui
Tulis `shots` dari storyline yang disetujui. Aturan isi:
- **Naskah mengikuti storyline yang disetujui, butir demi butir, urutan sama** (user 2026-11-07). Tidak ada kejadian
  yang dibuang, dipadatkan sampai maknanya hilang, atau dipindah setelah storyline disetujui. Kalau ternyata kepanjangan:
  revisi storyline (series atau "Beda dari alur asli" baru) dan minta persetujuan lagi, jangan potong diam-diam di naskah.
- **Bahan user adalah sumbernya.** Jangan menambah kejadian, nama, angka, ayat, atau hadis yang tidak ada di bahan. Ayat dan
  hadis dikutip persis sesuai yang user tulis (atau sumber yang user sebut); kalau ragu, tanya. Kalimat Arab (syahadat,
  doa, potongan ayat) boleh ditulis dalam huruf Arab di `text`; Gemini TTS membacanya, caption menampilkannya.
- Bentuk dari referensi: buka **di tempat kejadian** (kalimat pertama sudah di dalam cerita, tanpa salam/perkenalan),
  adegan → konflik → titik balik → emosi → pelajaran untuk penonton ("kita…") → dalil bila ada di cerita → satu ajakan pendek.
- Lisan, hangat, kalimat pendek; boleh gaya ceramah ("hadirin" sesekali). ±140 kata/menit, **satu video utuh sampai 179 s (±415 kata)**, user memendekkannya sendiri;
  `check` gagal di atas itu (perkiraan dari jumlah kata, lalu durasi suara sebenarnya). Kepanjangan → jadikan series, jangan
  mempercepat suara.
- `lines`: satu frasa caption per baris (≤ 9 kata), dengan `en` terjemahan Inggris yang wajar (bukan kata per kata).
- Naskah **dibuka persis dengan hook terpilih** (gambar shot pertama = `image` hook itu); baris re-hook diberi
  `"rehook": true`; bagian series yang bukan terakhir ditutup dengan baris `"cliffhanger": true` yang menyebut "bersambung".
  `check` gagal bila salah satunya tidak ada.
- **Maksimal 10 shot per video, apa pun ceritanya** (user 2026-11-07). Satu shot = satu gambar = satu klip H3, narasi
  **maks 15 s (±35 kata)**, berisi beberapa baris caption. Pilih 10 momen terkuat dari storyline; kalimat lain menempel
  ke shot momen terdekat. `check` gagal di atas 10 shot; shot 15-20 s hanya peringatan (sisa klip = frame terakhir
  ditahan), di atas 20 s gagal. Batasnya ikut panjang klip proyek: `musafo.json → clipSeconds` (Flow 10 s) menggantikan 15.
- **Prompt klip satu shot = multi-scene, cut to cut** (user 2026-11-07). Shot dengan lebih dari satu kalimat wajib punya
  `scenes: [{ "line": n, "scene": "…", "motion": "…" }]`: adegan berikutnya mulai di kalimat ke-n shot itu (indeks mulai 0,
  naik), `scene` ditulis seperti bagian adegan `image` (bahasa Inggris, bisa berdiri sendiri), maks 4 adegan per shot,
  tiap adegan ≥ 1,5 s. Adegan pertama = `image` shot (satu-satunya gambar yang dibuat di Flow). `clips` lalu membuat satu
  generate per shot dengan `[Shot 1]…[Shot n]` dan timecode cut dari waktu kalimat di suara (`sceneCuts`). Ilustrasinya harfiah dari kalimat itu; kalimat
  abstrak → benda simbolik (tetes air mata dalam sorot cahaya, ponsel menyala, mangkuk makanan, sapu dan debu, rumah kampung).
- `framing` bergantian wide/medium/close; dua shot berurutan tidak boleh sama. `hero` = apa yang tampak (pendek).
- `image`: **tulis dengan skill `/musafo-prompt`** (dari user, 2026-11-07; Musafo dan Miracle of Hajj, bukan BumiDiPijak atau Berakit ke
  Hulu). Bentuknya "Create a vertical 9:16 image of …", kalimat naratif ±80-140 kata: subjek → aksi → tempat → komposisi →
  arah cahaya, lalu kalimat pakaian dan wajah sesuai mode (Hajj modern atau sirah abad ke-7, `references/sirah-era.md`), lalu
  `brand.json → musafo.styleAnchor` (= style block skill) **persis** di akhir. Ruang kosong di sepertiga bawah untuk caption.
  Tidak ada teks di gambar. Wajah tokoh utama dari belakang/siluet/menunduk/terpotong, kerumunan berkepala oval polos;
  sahabat hanya figur tanpa wajah dan tanpa nama di prompt.
  **Rasulullah tidak pernah digambar**: di `image`/`scenes` hanya "a soft sphere of warm white light" di tempat beliau
  hadir (pusat cahaya kosong, tanpa menyebut beliau di prompt). Nama beliau ditempel scene memakai kaligrafi standar dari
  user `musafo/assets/muhammad-kaligrafi.png` (disalin otomatis ke proyek + `sources.txt`): `shots[].orb = { x, y, size,
  from, to }` (x/y = % letak bola cahaya di gambar, from/to = indeks kalimat di shot itu).
  **Kaligrafi ditempel ke key visual, bukan di atas klip** (user 2026-11-07: lapisan di atas klip meleset dari bola yang
  bergerak). Setelah key visual jadi: setel `orb.x/y/size` (Ø bola dalam px pada lebar 1080), `node tools/musafo.mjs orb-kv
  <slug> <shot>` (cari bola terdekat dari x/y, tempel kaligrafi #5d6b70, simpan asli sebagai `<shot>.raw.png`), set
  `orb.baked: true`, lalu `clips --only <shot>` supaya prompt klip meminta kaligrafi tetap di bola. Unggah frame itu ke Flow
  sebagai Start frame. Shot yang bolanya baru muncul belakangan: `orb-kv … --end --at x,y --size px` menggambar bola +
  kaligrafi sebagai `<shot>.end.png` untuk End frame Flow, dan shot itu satu take tanpa cut. Jangan ada cut ke adegan lain
  yang juga menampilkan bola (Flow menggambar ulang bolanya tanpa kaligrafi). Shot `baked` tidak diberi lapisan orb.
  **Grain film** (user 2026-11-07): style block sudah menyebut "fine film grain", dan scene tiap shot menambah lapisan grain
  bergerak (`brand.json → musafo.grain`, opacity 0.22, 12 lompatan/detik) karena klip AI menghaluskan grain.
- `motion`: gerak shot itu (dalam bahasa Inggris, satu-dua kalimat): satu gerak kamera pelan (push in / drift / tilt) +
  satu gerak di dalam frame (kain tertiup, debu melayang, tetes jatuh, layar ponsel menyala, jamaah berjalan). Jangan
  menyebut cut, durasi, teks, atau suara: `clips` menyusunnya jadi `[Shot k]` di prompt H3 multi-shot.
- `image` shot selain shot pertama tiap generate tetap ditulis lengkap: bagian adegannya (setelah blok gaya dan orang)
  menjadi deskripsi `[Shot k]` di prompt H3, jadi tulis adegannya sebagai kalimat yang bisa berdiri sendiri.
- Channel (`meta.json → channel`, mis. `miracleofhajj`): Library Cerita dipisah per channel, tapi semua channel memakai
  alur dan gaya Musafo yang sama (user 2026-11-04). Channel hanya menandai untuk akun mana videonya. (Berakit ke Hulu dan BumiDiPijak bukan
  channel Musafo: jenis proyek sendiri, skill `/berakit-ke-hulu` dan `/bumidipijak`.)
- **Miracle of Hajj bukan channel Musafo lagi** (user 2026-11-08): jenis proyek sendiri (`type: "miracleofhajj"`), skill
  `/miracle-of-hajj` (cerita singkat jamaah → sebab yang dicari + dalil Al-Qur'an dari equran.id, ditutup Wallahu a'lam bishawab).
  Gaya gambar dan preset tetap Musafo.
- **BumiDiPijak bukan channel Musafo lagi** (user 2026-11-08): jenis proyek sendiri (`type: "bumidipijak"`), skill
  `/bumidipijak`, preset `presets/bumidipijak`. Engine-nya tetap `tools/musafo.mjs`.
- Gelar "Hadhrat" / "Hazrat" dari buku terjemahan ditulis **"Sahabat"** (mis. "Sahabat Umar", user 2026-11-04) di
  storyline, naskah, caption, dan hook; Nabi tetap "Nabi". Caption Inggris memakai nama saja (mis. "Umar").
- Taruhan dari storyline sudah terasa di hook atau kalimat kedua; gambar shot pertama lolos uji sekilas (`/paket-ide` § 2, 4).
- Setiap draf naskah lewat `/humanizer` (catatan bahasa Indonesia di skill `video-vertikal`).

Lalu `node tools/musafo.mjs build <slug>` (menulis `script.md`) dan `check`. Tunjukkan naskah ke user (teks + jumlah shot +
perkiraan durasi dan biaya klip), minta persetujuan: klik "Setujui naskah" di TERTORTOR (event `script-approved`) atau
`npm run flow -- approve <slug>` bila user setuju di chat. Jalankan `node tools/wait-event.mjs` di background, lalu berhenti.

## Production (tombol di tab Shot, user 2026-11-07)
Persetujuan naskah (`script-approved`) **tidak** langsung memulai suara: jalankan `node tools/script-edit.mjs list`,
sesuaikan `scenes` bila jumlah kalimat shot berubah (nomor kalimat saja, kata-kata user tidak disentuh), lalu berhenti.
Event `production` (user klik "Production") = kerjakan berurutan tanpa bertanya: **1. suara** (§ 3, satu take Gemini TTS)
→ `build` → **2. key visual** semua shot yang belum punya gambar (§ 4, Flow), lalu laporkan. Selesai = `voice/words.json`
lebih baru dari klik dan semua gambar ada (Studio mengirim push). Klip (§ 3b) menunggu keputusan user sesudahnya.

## 3. Suara
Sama seperti explainer: Gemini TTS di AI Studio, satu take untuk seluruh naskah (teks di tab Suara), speaker dari
`request.json → voiceSpeaker`, style dari `voiceStyle` (default "seperti ustadz bercerita di majelis: hangat, pelan, ada jeda
haru"). Lalu `npm run voice -- <slug> --audio <wav> --source gemini-tts`, lalu `node tools/musafo.mjs build <slug>` lagi
(cues + caption). Mengubah satu kalimat setelah ada suara: ubah `musafo.json`, build, lalu `npm run swap`.

**Naskah yang diedit user di Studio** (user 2026-11-06, tombol "Edit naskah"): `musafo.json` dan `script.md` sudah diubah
oleh Studio, persetujuan lama gugur, dan perubahannya ada di `script-edits.json`. Saat `script-approved` datang, cek dulu
`node tools/script-edit.mjs list <slug>`. Kata-kata user tidak ditulis ulang dan tidak di-humanizer; hanya beri tahu bila
ada yang melanggar aturan (dalil dikarang, caption > 9 kata, hook berubah, durasi > batas). Tanpa suara: lanjut langkah 3
biasa. Sudah ada suara: **jangan rekam ulang semua**: tiap kalimat yang berubah dibuat di AI Studio dengan speaker + style
yang sama, `npm run swap -- <slug> --find "<lama>" --replace "<baru>" --audio <baris.wav>`, lalu build. Shot yang sudah
punya klip dan isinya berubah: tanyakan ke user apakah klipnya masih cocok sebelum membuat ulang (15 kredit). Selesai:
`node tools/script-edit.mjs done <slug>`.

## 3b. Generate H3 multi-shot (`clips`, user 2026-11-03)
Setelah suara + build (durasi beat ada di `build/timeline.json`): `node tools/musafo.mjs clips <slug>`. Shot berurutan
digabung jadi satu generate H3 ≤ `musafo.video.seconds` (15 s), 2-4 shot per generate, dengan waktu cut = durasi beat.
Hasilnya `musafo.json → clips`: `{ id: "c1", shots: [...], seconds, cuts: [...], prompt }`. Prompt dibuat dari `image`
(bagian adegan) + `motion` tiap shot dalam format I2VA multi-shot skill `h3-prompt-writing` (`[Shot 2] At 00:04.200, the
camera cuts to …`), bisu (`N/A`). Boleh dipoles manual (gerak, kontinuitas), tapi timecode harus tetap = `cuts`; `check`
menolak bila beda, bila > 4 shot, > 15 s, atau bila suara berubah (jalankan `clips --force`, prompt ikut ditimpa).
Hemat: ±6 generate per video 90 detik, bukan ±18. Tampil di TERTORTOR tab Shot (kartu per generate, tombol Salin).

## 4. Gambar per shot
- **Dengan `clips`, gambar cukup untuk shot pertama tiap generate** (`check` menghitung hanya itu); shot berikutnya
  dibuat H3 dari teks dengan gaya yang sama.
- **Default: Meta Muse lewat muse4ai** (`brand.json → musafo.image`, user 2026-11-11). Prasyarat: Muse4AI terbuka, satu akun
  siap, `node tools/local-proxy.mjs` hidup; cek kuota dulu dengan `node tools/muse.mjs status`. Per shot:
  `node tools/muse.mjs image assets/frames/<shot>.muse.webp --prompt-file <prompt> --ref <3 gambar musafo/reference/gambar>`
  (±1 menit, 1152×2048). Prompt = `image` shot + "Images 1, 2 and 3 are visual style references only: match their matte
  clay-like 3D rendering, palette and lighting, not their composition or people." Acuan asli channel (mis. no. 4, 10, 18:
  sosok sendiri, duduk, lanskap) lebih baik daripada KV proyek. Muse menambah detail sendiri: tulis yang dilarang secara
  eksplisit (pose tangan "palms open, no mudra", "plain low stone well, no winch", "no lanterns, no lit lamps" di siang
  hari) dan cek tiap gambar. Catat tiap generate di `costs.md` sebagai kuota Muse; `imageTool` = "Meta Muse (muse4ai)".
- Cadangan pertama: **Google Flow** (`musafo.image.flow`) lewat Claude in Chrome: proyek baru → Image,
  9:16, Nano Banana, x1; tambahkan 1-3 gambar dari `musafo/reference/gambar` sebagai ingredients supaya gayanya sama.
  Gambar di Flow gratis, tidak perlu izin. Satu prompt per kali, tunggu selesai, unduh. "Unusual activity" → jangan retry,
  minta user klik Retry. Halaman "Layanan Tidak Diizinkan" = akun Chrome adalah akun Workspace yang Flow-nya dimatikan:
  minta user mengganti akun sendiri (Claude tidak memilih akun Google).
- Cadangan bila Flow tidak bisa dipakai: `musafo.image.fallback` lewat agen `runninghub-operator` (Qwen Image 2.1 dengan
  gambar referensi di LOAD IMAGE, 9:16; bila gagal start setelah 1 reload + 1 retry, zimage3.0 teks saja). Catat koin.
- Set `musafo.json → imageTool` sesuai alat yang benar-benar dipakai.
- `node tools/musafo.mjs add <slug> image <shotId> <file>` (crop 1080×1920, baris `sources.txt`).
- Cek semua gambar sekaligus lewat agen `frame-checker` (grid): gaya sama dengan referensi, tanpa teks/huruf palsu, tangan
  dan wajah tidak rusak, tidak ada wajah Nabi. Yang gagal diulang sebelum masuk klip.

## 5. Klip (koin)
- Langsung Run Now tanpa minta izin koin (user 2026-11-04). Catat saldo sebelum dan sesudah, laporkan jumlah generate
  dan koin terpakai, tulis di `costs.md`.
- App `brand.json → musafo.video` (MiniMax H3 di RunningHub), satu generate per job lewat agen `runninghub-operator`:
  LOAD IMAGE = `assets/frames/<shot pertama>.png`, PROMPT = `clips[].prompt`, RATIO 9:16, DURASI = `clips[].seconds`.
- `node tools/musafo.mjs add <slug> clip <clipId> <file>`: MP4 dinormalisasi (1080×1920 30 fps, audio dibuang dan dicek),
  disimpan di `assets/clips/<clipId>.mp4`, lalu dipotong per shot ke `assets/footage/<shotId>.mp4`. Waktu cut rencana
  diskalakan ke panjang asli lalu ditempel ke scene change terdekat (±1,5 s); cut yang tidak terdeteksi memakai waktu
  rencana (⚠ di output: lihat klipnya). Set `videoTool`. Potongan yang lebih pendek dari beat-nya ditahan di frame
  terakhir otomatis saat build.
- Tanpa `clips` (proyek lama): satu klip per shot, `add <slug> clip <shotId> <file>`, PROMPT = `motion`.

## 6. Render
`node tools/musafo.mjs build <slug>` → `npm run check -- <slug>` → `npm run finish -- <slug>`. Baca `out/contact-sheet.png`
(lewat `frame-checker`) sebelum menyerahkan. Caption posting (judul ≤ 60 karakter, teks cover ≤ 5 kata, lihat `/paket-ide` § 2; deskripsi, hashtag) lewat `/humanizer`, sertakan
"Ilustrasi dibuat dengan AI". Jangan unggah ke platform tanpa izin.

## Feedback
Koreksi user → satu baris di `.claude/skills/video-vertikal/LESSONS.md` dengan asal `musafo/<slug>`; aturan yang bisa dicek
mesin masuk ke `checkMusafo` di `tools/musafo.mjs`.
