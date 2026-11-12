---
name: flashcut
description: Iklan produk Flashcut di MOTION/TERTORTOR (Advertisement, tanpa narasi, ±11 s). Dari foto produk beberapa angle + logo + foto model opsional + CTA yang diisi user di Studio → ad.json (shot, kilatan logo, label, SFX) → gerbang → render. Pakai untuk "/flashcut <slug>", event `ad-new`, atau proyek dengan meta.json type "advertisement" product "flashcut".
---

# Flashcut: iklan produk dari foto

Baca dulu `advertisement/flashcut/style.md` (gaya, prinsip susunan, cara memakai `ad.json`) dan
`advertisement/flashcut/reference/analysis.md`. Contoh jadi yang disetujui user: `videos/tripple-triangle-cap/ad.json`.

## Bahan dari Studio (`videos/<slug>/`)

- `request.json`: `name` (persis untuk end card), `cta`, `notes` (klaim yang boleh ditulis, bagian yang ditonjolkan).
- `assets/products/`: `angle-N.png` (foto produk, urutan pilihan user), `logo.png` (latar putih sudah dihapus bila
  bukan PNG transparan), `model-N.png` (opsional), `cta-N.png` (grafis CTA opsional), `assets/audio/user-music-1.wav` dan
  `user-sfx-N.wav` (opsional, lisensi di `sources.txt`; pilihan user di `request.json → music` / `sfx`). Asli ada di `assets/upload/`.
- `sources.txt` sudah berisi satu baris per aset.

## Langkah

1. **Lihat semua foto** (Read). Catat untuk tiap foto: angle, bagian yang layak makro (logo, jahitan, material,
   aksesori), titik fokusnya dalam px foto (`fx, fy`), dan masalah (watermark, pita putih, resolusi rendah). Watermark
   atau teks marketplace: tanya user dulu (foto bersih, atau dihapus lokal seperti di `tripple-triangle-cap`).
2. **Tulis `ad.json`** mengikuti pola acuan: padat di awal (makro, kilat, HERO sebelum 2 s) → tenang di material →
   ledakan pendek → end card produk diam → kartu penutup nama + CTA (`register: "endcard"`, `src` grafis CTA atau logo).
   - Tiap shot membawa informasi baru (skala, fokus, material, sudut); jangan crop ulang yang sama berturutan.
   - Kilatan memakai **logo produk itu sendiri**: `"mark": { "layout": "stack" }` (logo ditumpuk, satu per frame) atau
     `"orbit"` (logo kecil melingkari produk). Jangan memakai grafik dari video acuan (cincin bergerigi = logo Oakley).
   - Label hanya nama, bagian yang terlihat di foto, atau klaim dari `notes`. Tidak ada bahan/fitur yang dikarang.
   - Foto model: shot "dipakai" di tengah, bukan di 2 detik pertama.
   - **Suara** mengikuti "Acuan SFX" di `reference/analysis.md`: tick/klik di setiap label, lompatan, dan kilatan; sub impact hanya
     di HERO, ledakan kedua, dan end card, didahului swell. SFX dari `library/audio.json` (`npm run stock -- search …`) atau file
     user (`sfx: [{ "file": "assets/audio/user-sfx-N.wav" }]`). `request.json → music: "file"` = `"music": { "file":
     "assets/audio/user-music-1.wav", "from": <detik mulai bagian lagu yang pas> }` (master −14 LUFS); `"app"` = tanpa musik,
     user menambahkannya di aplikasi (master −20 LUFS).
3. `node tools/ad.mjs check <slug>` sampai hijau, lalu `npm run finish -- <slug>`.
4. **Lihat contact sheet** dan render potongan tiap kilatan (`npx hyperframes render videos/<slug> --start … --end …`),
   karena kilatan 3-5 frame jatuh di antara tile. Cek: logo terbaca, tidak ada halo/garis putih, tidak ada dead air.
5. Kirim MP4 ke user, minta persetujuan. Revisi → ubah `ad.json`, ulangi 3-4. Feedback dicatat di
   `.claude/skills/video-vertikal/LESSONS.md`.

Jangan unggah atau publish. Teks untuk user lewat `/humanizer`.
