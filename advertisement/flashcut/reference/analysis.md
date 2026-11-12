# Analisis acuan Flashcut

> Sumber: post X @AmirMushich, 2026-11-05, https://x.com/AmirMushich/status/2118053988423676155 ("Flash cut editor with
> GPT-6 Astra + After Effects + LTX", link starter kit amirmushich.link/flashcut). Diunduh dengan izin user ke
> `flashcut-x.mp4` (tidak di-commit). Data terukur di `flashcut-x.ref.md` / `.ref.json`, keyframe di `flashcut-x.shots.png`.
> Video yang sama dengan lampiran Telegram "01 FINAL - OAKLEY PRODUCT REVEAL - 11.5s60": user mengunduhnya dari Telegram
> Desktop (`flashcut-telegram.mp4`, **dipakai sebagai acuan utama**: durasi pas 11,50 s, audio AAC 202 kbps; versi X
> 11,56 s, audio 128 kbps, video sedikit lebih tajam 3,2 vs 2,7 Mbps). Pengukuran keduanya sama: 16 shot, median 0,35 s,
> end card 4,55 s, −20,8 LUFS. Starter kit `Flash-Cut-Starter-0.1.2-local.zip` ada di `starter-kit/` (lihat bagian akhir).
> Video itu sendiri menulis "oakley / independent study, not an official commercial". Jangan memakai logo, nama, atau
> produk Oakley di video kita.

## Angka (terukur)

- 11,56 s, 1080×1920, **60 fps**, AAC stereo 48 kHz, −20,8 LUFS.
- 16 shot (deteksi scene ffmpeg): rata-rata 0,72 s, **median 0,35 s**, terpendek 0,2 s, terpanjang 4,61 s (end card).
  6 cut di 3 detik pertama. Di grid 10 fps (0–7 s) masih ada kilatan 1 frame (B/W threshold, lingkaran bergerigi) yang
  lolos dari deteksi scene, jadi potongan sebenarnya lebih rapat dari angka itu.
- **Tidak ada narasi.** Transkrip whisper ("Thanks for watching…") adalah halusinasi pada musik. Audio terus menyala
  (tidak ada jeda < −40 dB ≥ 0,3 s).
- Hit audio (lonjakan RMS > 6 dB) di 0,05 / 1,05 / 2,95 / 5,90 / 10,50 s. Itu jatuh di cut besar 0,0 / 0,9 / 2,9 / 5,85 s
  dan di logo end card. Potongan kecil di antaranya tidak punya hit sendiri.

## 5 aspek

1. **Hook (0–1 s):** tanpa teks besar, tanpa wajah. Langsung makro detail produk (tangkai kacamata transparan, buram
   di depan), lalu kilatan B/W threshold dan cincin bergerigi. Produk utuh baru terlihat di ±1 s.
2. **Struktur:** potongan cepat makro ↔ satu "hero still" produk utuh di latar polos → ulang 2-3 kali dengan detail
   berbeda (lensa, nosepad, tangkai) → end card hero ±4,6 s dengan nama produk dan logo. Pola: *detail, detail, flash,
   HERO, detail…, HERO + nama*.
3. **Visual:**
   - Dua dunia bergantian: **makro** (DOF sangat tipis, latar hitam atau gradasi abu, highlight tajam di plastik
     transparan) dan **hero** (produk melayang di latar off-white hangat, terukur ±#E2DCD4–#E9E3DC, bayangan nyaris tidak ada).
   - Palet dari produknya sendiri: hijau zaitun transparan, lensa amber/tembaga, karet hitam. Satu shot iridescent
     biru-ungu. Tidak ada warna grafis tambahan.
   - Efek kilat 1–3 frame: threshold hitam-putih keras, cincin/lingkaran bergerigi (bentuk logo) melingkari produk,
     "ripple" garis putih, motion smear horizontal pada hero.
   - Hero kadang di-scale/punch-in antar dua frame (lompatan ukuran, bukan zoom halus).
4. **Tipografi:** grotesk netral (gaya Helvetica/Arial), huruf kecil, **kecil dan tenang**: nama produk ±44 px kiri
   bawah ("plantaris"), sub-label ±18 px ("optical organism"), label mikro di pojok (kode/nomor, ±14–16 px), sesekali
   garis bantu/crosshair tipis seperti blueprint. Teks tidak pernah jadi hero, produknya yang hero.
5. **Audio:** musik/sound bed terus + hit di cut besar. Tanpa VO, tanpa caption.

## Jalur alat yang jujur (untuk MOTION)

- Acuannya dibuat di After Effects + model gambar/video (LTX) dari foto/render produk. MOTION merender lewat HyperFrames,
  jadi yang bisa ditiru: ritme cut, pergantian makro/hero, kilatan threshold/cincin, tipografi kecil, end card. Semua
  itu bisa dibuat dengan HTML + GSAP + filter CSS/SVG di atas **foto atau klip produk asli**.
- Yang tidak bisa dikarang: makro produk. Butuh aset nyata dari user (foto studio, footage, atau render 3D produk),
  atau klip image-to-video dari foto produk (berbayar, dicatat di `costs.md`).
- 60 fps: HyperFrames MOTION 30 fps. Kilatan 1 frame di 60 fps = 1 frame di 30 fps tetap terbaca; perlu diputuskan user.
- Lint MOTION yang bentrok: "beat > 7 s" aman, tapi "setiap angka di layar harus diucapkan" dan aturan caption/naskah
  tidak cocok untuk iklan tanpa VO. Advertisement butuh gerbang sendiri.

## Starter kit (Flash-Cut-Starter 0.1.2, dibaca, tidak dijalankan)

Isinya dokumen + `scripts/studio.py` (Python, stdlib) + `scripts/assemble.jsx` (After Effects). Status menurut README:
alpha lokal, **lisensi kode/konten belum ditetapkan** ("pending Amir's review"), Claude Code belum diuji. Jadi hanya
dipelajari; kodenya tidak disalin ke MOTION.

- **Alat:** butuh After Effects berlisensi (2024 diuji, Windows) + Python 3.10 + FFmpeg. Di laptop ini **After Effects
  tidak terpasang** (Python 3.12 dan FFmpeg ada). Hasilnya `edit.aep` + `edit.mp4` 1080×1920 60 fps.
- **Rencana edit** (`plan.json`): berbasis frame (integer, out eksklusif), ≤ 12 s, fps 24–120; shot menutup timeline tanpa
  celah; grafik teks/gambar dengan blend normal/difference/screen dan scale key "hold" (lompatan, bukan ease); efek bawaan
  hanya `invert_bw` (B/W lalu invert) dan `threshold` per interval frame; audio sebagai klip terpisah per jalur. Ini
  mudah dipetakan ke HyperFrames (beat + mark + filter CSS), tanpa AE.
- **Sumber gambar di studi aslinya:** Nano Banana 2.1 (gambar) + Kling 3.0 lewat Pika (video), panduan LTX/Pika
  berbayar. Semuanya opsional; uji BMW di kit itu dibuat gratis dari satu foto produk resmi (hasilnya diakui datar:
  14 shot dari satu foto, tanpa sudut pandang baru).
- **Prinsip art direction** (dari revisi manual Amir, bukan aturan baku):
  - Penonton *mengenali, kehilangan, lalu menemukan lagi* produk. Variasi dari skala, fokus, material, sudut; crop
    ulang dari foto yang sama bukan shot baru.
  - Intensitas bertahap: padat di awal, tenang di kedalaman material, lalu ledakan pendek lagi. FX terus-menerus
    menghapus kontras.
  - Grafik menyambung antar cut (logo besar buram di scene A, ganti skala di cut, tajam di scene B; teks layanan
    multi-baris mulai sebelum cut). Di proyek Oakley: inversi frame 111–115 melintasi cut 112 (60 fps).
  - Huruf: Arial Regular dipilih untuk Oakley (bukan font resmi Oakley). Teks putih Difference bereaksi ke latar
    tapi hilang di abu tengah: cek di frame terang, gelap, dan tengah.
  - FX menyesuaikan material: untuk arah organik Oakley sebagian besar interval threshold dibuang, tinggal aksen pendek.
  - End card: putaran produk dipadatkan ±1,13 s, lalu produk menghadap depan dengan scale pelan ±3,42 s. Sisi produk
    yang terbaik dipilih sebelum generate.
  - Suara: tick/klik/tap detail + bunyi mekanis/digital, subdrop dan ambience rendah, mid dibiarkan jarang.

## Acuan SFX (user 2026-11-05)

Dua video dari user khusus untuk sound design. File di `reference/sfx/` (tidak di-commit); angka dari pengukuran energi per pita
(sub < 120-150 Hz, mid 150 Hz-3 kHz, high > 4-5 kHz) dan onset per 25-50 ms, bukan tebakan.

- **x.com/motionstashco/status/2117334029364277728** (promo UI Gemini, 9,9 s, −20,7 LUFS, **tanpa musik**). Hening di antara
  bunyi (median −42 dB), hanya ±5 kejadian dalam 10 s, masing-masing tepat di satu peristiwa visual:
  shimmer mid lembut saat ikon bintang terbentuk (0,85 s) → **impact sub besar** saat busur cahaya mendarat (1,65 s, ekor ±0,8 s)
  → klik tajam mid+high tepat di tap tombol kirim (4,9 s) → swell rendah saat gambar membesar (5,9 s) → impact sub paling keras
  (−4,7 dBFS) di transisi ke outro logo (7,6 s). Pola: swell/riser → hit, klik sinkron dengan aksi UI, sisanya diam.
- **x.com/kirtanlb/status/2117994417076547993** (promo kinetic type Velotile, 19,7 s, −15,4 LUFS, **musik terus**). Dua lapis di atas
  musik: (1) **tick/blip tinggi** kecil di setiap kata atau titik piksel yang muncul, 45 dalam 14 s, median jarak 0,17 s,
  bergerombol saat teks diketik (1,4-2,4 s, 4,0-5,0 s, 13,4-13,8 s); (2) **sub hit** hanya 6 kali, di pergantian bagian besar
  (2,4 s masuk grid biru, 5,1 s pill "everything", 13,3 s menuju logo), bukan di setiap cut (17 cut).

**Aturan untuk Flashcut:** dua lapis. Mikro = tick/klik pendek (30-80 ms, pelan) di setiap label yang muncul, lompatan zoom, dan
kilatan, boleh bergerombol. Makro = sub impact maksimal satu per 1,5-3 s, hanya di HERO pertama, ledakan kedua, dan end card,
didahului swell/riser 0,2-0,8 s. Versi tanpa musik (default, musik ditambah di aplikasi) boleh hening di antara bunyi; versi
dengan musik user mengikuti kirtanlb (tick di atas bed). Library CC0 sekarang belum punya riser/swell, shimmer, dan blip digital:
user mengunduhnya dari Freesound (filter CC0) lalu `npm run stock -- add … --kind sfx --source freesound --for advertisement/flashcut`.
