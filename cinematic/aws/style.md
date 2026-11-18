# AWS: rekap sinematik + visualisasi data

Look Cinematic (user 2026-11-17). Bukan Blender dan bukan generate: **footage asli acara** dari klien di-grade seperti
film, lalu motion graphic data di atasnya. Semua dari `aws.json` lewat `tools/aws.mjs` (HyperFrames, satu komposisi
`compositions/film.html`). Preset tampilan: `presets/aws/` (warna, font Thai, grade, musik sementara).

## Alur

1. Studio `#/baru/cinematic/aws` (judul, brief, format master, file brief/footage/logo) → `node tools/aws.mjs new` → event
   `cinematic-new` (look `aws`). Lewat CLI: `node tools/aws.mjs new <slug> "Judul" --format horizontal --idea "…"`.
2. Claude (skill `/aws`): baca brief + `assets/reference/`, jalankan `/paket-ide` untuk sudut dan hook, tulis `aws.json`
   (data + adegan), teks Thai lewat terjemahan yang hati-hati + Inggris lewat `/humanizer`.
3. `node tools/aws.mjs check <slug>` → animatic: slot footage berlabel (slate), angka yang belum ada = kotak "TBC".
   Snapshot (`npx hyperframes snapshot videos/<slug> --at …`) tiap adegan, perbaiki, laporkan ke user dengan daftar slot
   footage dan angka yang masih kurang.
4. Footage masuk per slot (tab AWS → Unggah, atau salin ke `assets/footage/` dan isi `src`). Angka diisi di
   `aws.json → data.<key>.value`. Logo di `assets/logos/`, lagu berlisensi di `assets/music/` + `music.track` + `license`.
5. Render: tab AWS → **Render** (atau `npm run finish -- <slug> --no-thumbnail`). Baca contact sheet.
6. Rasio lain: **9:16 + 1:1** (`node tools/aws.mjs formats <slug>` lalu `finish` tiap varian). Varian = proyek
   `<slug>-9x16`, `<slug>-1x1` yang selalu menyalin `aws.json` + aset master; jangan edit varian.
7. **Paket After Effects**: tab AWS → "Paket After Effects" (`node tools/aws-ae.mjs <slug>`) → `out/ae/`:
   `plate.mov` (footage ter-grade + shade, ProRes 422 HQ), `graphics.mov` (semua grafis di alpha tanpa huruf, ProRes 4444),
   `audio/music.wav` + `audio/sfx.wav`, `footage/`, `logos/`, `.srt`, `README.md`, dan `<slug>.jsx` yang membuat komposisi
   dengan **setiap baris Thai/Inggris dan angka sebagai text layer yang bisa diedit** (posisi dan waktu diukur di browser,
   angka naik lewat expression Source Text, marker per adegan). Font yang perlu dipasang editor: Kanit, IBM Plex Sans Thai,
   JetBrains Mono (Google Fonts, OFL). Untuk varian 9:16/1:1, jalankan `aws-ae` pada proyek variannya.

## Adegan (`aws.json → scenes[].kind`)

| kind | isi | data |
| --- | --- | --- |
| `open` | montase cepat wajah/tangan, nama acara menghantam di ketukan, riser + hit | `title`, `line` |
| `stat` | 1-2 angka besar dihitung naik (1,2-1,6 s, tabular), plus gambar kedua dari angka yang sama: `viz: "cloud"` (angka di tengah, konfeti berkumpul jadi cincin), `"tiles"` (grid tile 3D, satu tile naik per unit), `"dots"` (satu titik per unit) atau `"curve"` (kurva kumulatif dari `data.<key>.series`) | `stats`, `viz` |
| `funnel` | batang horizontal linear dari semua pendaftar sampai Top 20 (penyempitan = ceritanya), batang terakhir aksen; dengan `themes`, paruh kedua jadi hub (`hub`) berkabel ke tiap tema dengan percikan cahaya | `steps`, `themes`, `hub` |
| `statement` | satu kalimat di tengah kartu warna penuh (`bg`: accent/light/dark), masuk dengan blur | `line` |
| `burst` | satu kata per ketukan, kartu bergantian accent/light/dark (acuan: 9 cut tiap 0,25 s) | `words`, `bgs` |
| `montage` | potongan cepat finalis, tiap cut menyalakan sel di papan 20 dan memberi label tema | `count`, `footage[].theme` |
| `end` | "Berikutnya": dua tanggal di rel, hadiah dihitung naik, lalu kartu logo (utama besar, mitra satu baris, "Powered by AWS" terpisah) | `timeline`, `prize`, `logos`, `powered` |

Footage per adegan dibagi rata di grid 0,5 s (120 bpm), tiap shot dorong pelan 1,04↔1,12 dan geser ±1,2%, cahaya bocor hangat
di setiap cut. Teks: Thai besar (Kanit Bold) + Inggris kecil di bawahnya (IBM Plex Sans Thai), juga jadi `out/<slug>.en.srt`.

## Bahasa gerak (user 2026-11-17)

Reel peluncuran SaaS: bingkai **HUD** di atas segalanya (siku sudut, `hudLabel` kiri atas, timecode berjalan, `01 / BAGIAN`
kiri bawah, garis progres; `aws.hud: false` mematikannya), **kicker** `■ 02 — LEARN` yang hurufnya di-decode (`section` per
adegan), kalimat pendek dengan **satu kata beraksen** (`*kata*` di `th`/`en`), sesuatu berubah tiap ±0,5 s, kartu warna penuh
di sela adegan data, dan ledakan kata satu per ketukan. Grid titik halus di atas footage.

## Aturan tetap

- **Footage asli dulu.** Tidak ada stock, tidak ada generate untuk orang/acara nyata. Slot kosong tampil sebagai slate
  berlabel, bukan diisi gambar tebakan. Hanya peserta dengan persetujuan PDPA; wajah yang tidak setuju di-blur sebelum masuk
  `assets/footage/` (ffmpeg `boxblur` pada area itu) dan dicatat di `sources.txt`.
- **Angka hanya dari klien.** `value: null` = TBC dan tampil sebagai kotak putus-putus; `check` memperingatkan. Jangan pernah
  mengarang atau "membulatkan supaya bagus". Lebar batang funnel hanya digambar berskala bila semua langkah sudah ada angkanya.
  Baris sumber kecil (`source`) di adegan data.
- **Logo asli saja**, dari klien/mitra, tidak digambar ulang. Selama belum ada: kotak putus-putus berisi nama. Urutan dan
  aturan lock-up AWS mengikuti keputusan mitra.
- Grade lewat `npx hyperframes media-treatment` (atribut `data-color-grading` pada `.ftg`, default `presets/aws/preset.json →
  grade`: deep-contrast 0,55, bayangan biru-tosca, sorot amber, vignette, grain), **tidak pernah** filter CSS.
- Teks ≥ 28 px; angka terbesar di layar; satu angka dihitung pada satu waktu (bukan dashboard).
- Musik sementara dari kode (`anim-music`, bebas lisensi) sampai lagu berlisensi dipilih; energi naik ke Top 20 lalu turun.
- Teks Thai ditulis Claude: minta native speaker klien memeriksa sebelum final, dan catat di laporan.
- `finish --no-thumbnail` (video klien, tanpa thumbnail di depan, tanpa watermark channel).

## Hindari

- Grid kartu KPI, pie chart, semua angka naik bersamaan, angka tanpa sumber.
- Letter-spacing yang dianimasikan (patah per piksel saat dirender), filter CSS pada footage.
- Menyalin layar Zoom/Teams yang memperlihatkan nama/identitas peserta tanpa persetujuan.

## Keputusan user 2026-11-17 (lanjutan)

- **Huruf mirip Amazon Ember** (font merek AWS, tidak bebas): keluarga `AWS Sans` = Inter (Latin) + IBM Plex Sans Thai (Thai),
  judul **Bold 700**, kalimat **Light 300** seperti iklan AWS. File Ember berlisensi dari brand kit AWS → taruh di
  `presets/aws/fonts/ember/`; `build` memakainya otomatis di depan `AWS Sans` (jangan commit ke repo publik).
- **Warna AWS**: aksen oranye `#FF9900`, kartu gelap dan kartu penutup = gradien biru → ungu → magenta.
- **Musik**: lagu berlisensi dari user di `assets/music/` (`aws.json → music.track`) boleh disambung jadi panjang film tepat di
  awal bar; lisensinya dicatat di `aws.json → music.license` sampai dikonfirmasi untuk klien.
- **Previz AI**: footage Google Flow (key visual dulu, gratis; video Omni 1.1 Flash multi-cut 15 kredit) dan Meta Muse **di
  muse.ai lewat Chrome** (bukan muse4ai bila akun di-pause). Tiap slot punya `origin` → `sources.txt` menulis "AI-generated …
  previz". Diganti footage asli klien sebelum final kecuali klien setuju.
- **Angka dummy**: `data.<key>.placeholder: true` untuk preview; HUD menampilkan "ANGKA SEMENTARA · DUMMY DATA" di setiap
  frame dan `check` memperingatkan sampai angka klien masuk.
