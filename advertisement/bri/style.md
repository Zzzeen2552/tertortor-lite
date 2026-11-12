# Product: BRI (iklan promo, tanpa narasi)

Contoh pertama dan acuan hidup: `videos/bri-debit-virtual-visa` (13 s). Template komposisinya di `template/kv.html`, skor
musiknya di `template/score.mjs`. Iklan BRI baru = salin template itu, ganti isi dari key visual klien, ukur ulang posisi.

## Input (formulir Studio `#/baru/advertisement/bri`)

| File di `assets/products/` | Isi | Dipakai |
| --- | --- | --- |
| `kv-1.png` | foto key visual **tanpa teks** (orang + latar), 9:16 | frame awal klip Flow, latar adegan teks |
| `endframe-N.png` | KV jadi dari klien (dengan teks/logo, boleh ada watermark DRAFT) | **acuan tata letak saja**, tidak pernah dirender |
| `bg-1.png` | latar kosong untuk end frame mitra (opsional) | latar end frame 2 |
| `footer-1.png` | artwork footer kiri bawah (URL promo, periode, tagline, kontak, legal), PNG transparan | ditempel apa adanya |
| `partner-N.png` | logo partner, urut sesuai grid KV (kiri→kanan, atas→bawah) | sel grid end frame 2 |

Teks dari formulir ada di `request.json`: `headline`, `sub`, `promo` (kalimat sebelum angka), `percent` (angka promo).
Logo tetap BRI ada di `kit/`: Danantara, 131 (logo HUT), BRI, kartu QR BRImo. Kit diganti hanya bila klien mengirim
versi baru.

## Struktur (13 s, 100 BPM, ketukan di 0,55 + 0,6 n)

1. **0–2,65 s · teks kinetik di atas klip.** Klip Flow penuh layar, push-in pelan 1,0→1,1, hentakan kamera kecil di tiap
   hit. Headline dipecah per beat 2–3 kata ("Healing" / "Tanpa Drama" / "Kantong Jebol" / "Pakai / BRI Debit /
   Virtual VISA"), **tanpa kotak**, Inter 700 biru BRI 200–260 px, di langit **di belakang orang**: potongan orang per frame
   (`scripts/cutouts.mjs`) ditumpuk di atas teks. Huruf naik dari belakang kepala (yPercent 70 → 0, blur 12 → 0, stagger
   22 ms). Baris bawah tiap beat berhenti di atas y ≈ 600 (kemeja biru muda terbaca sebagai langit), dan hanya bagian
   bawah huruf yang boleh tertutup kepala/topi: kalau kata tidak terbaca, naikkan barisnya.
2. **2,65–3,85 s · angka promo.** Panel biru naik dari bawah, kalimat promo kata per kata, angka berputar seperti odometer
   (kolom digit, blur saat berputar), hentakan 1,1 + garis ledakan kuning di ketukan drop (3,55 s).
3. **3,85 s · end frame 1.** Panel menyusut ke slot angka di dalam bingkai, angka terbang mengecil ke sana, lalu end frame 1
   tersusun persis KV: headline naik dari mask, bingkai putih menggambar diri (garis atasnya lewat di **belakang** lengan
   dan kepala: `scripts/occluders.mjs` per frame; kaki, koper, lengan bawah = celah statis), logo dan artwork fade+naik
   sederhana lalu diam. Klip tetap bergerak di belakang. Kilau di angka sebagai hit kedua (5,95 s).
4. **7,45 s · end frame 2.** Zoom tembus bingkai, latar `bg-1` masuk crossfade, headline mengecil ke kiri atas, kotak
   promo menghentak dengan garis ledakan, kartu putih naik, garis grid terbuka, logo partner pop satu per satu (70 ms).
   Diam sampai akhir; satu hentakan kecil di kotak promo (11,35 s).

## Aturan

- **Format judul** di semua teks animasi (huruf pertama tiap kata kapital, singkatan tetap: BRI, VISA). Teks di dalam
  artwork klien tidak diubah.
- **Inter** untuk semua teks; biru BRI `var(--accent)` (#1F5BC6). Gerak SNAPCN: `expo.out`, whip/blur, hentakan ≤ 1,1,
  tanpa getar, glitch, atau partikel.
- Tanpa titik di akhir kata. Jangan menambah kata yang tidak ada di KV atau formulir.
- Logo, QR, footer, dan logo partner **tidak pernah digambar ulang atau di-generate**: hanya file asli. Logo partner
  dipotong margin putihnya (`scripts/trim-logo.mjs`) dan `mix-blend-mode: multiply` di kartu putih.
- Posisi end frame diukur dari KV klien (skala 900×1600 → ×1,2). Area logo dan footer diam setelah masuk.
- Tanpa watermark channel (`meta.json → watermark: false`) dan tanpa thumbnail di depan video (`thumbnail.json →
  cover: false`): iklan dimulai di frame headline.
- Tata letak mengikuti KV klien, bukan pita aman 168–1330 dan batas teks 28 px proyek ini (logo atas di y 48, legal kecil
  di footer). Ini satu-satunya pengecualian.

## Alur kerja (event `ad-new` dengan product `bri`)

1. Lihat semua file input. Bila `endframe` ada dua (promo + mitra), ikuti strukturnya; bila satu, end frame 2 dilewati.
2. Klip: Flow, Frames (frame awal = `kv-1`), Omni 1.1 Flash 720p 10 s 9:16, prompt kamera **completely locked off**,
   gerak kecil orang, latar hidup, tanpa teks/logo (prompt contoh di `costs.md` proyek contoh). Kredit Flow dilaporkan
   dan dicatat di `costs.md`. Normalkan ke `assets/footage/family.mp4` (1080×1920, 30 fps, tanpa audio) + frame terakhir
   `family-last.jpg`.
3. Salin `template/kv.html` → `compositions/kv.html`, ganti teks (format judul), angka, nama file logo/partner/latar,
   lalu ukur ulang: posisi bingkai dan slot angka dari KV, `cutouts.mjs --test` lalu `cutouts.mjs`, `occluders.mjs`
   (konstanta disesuaikan) → blok `/*@dyn*/`. `index.html`: satu host `kv` 13 s, SFX `library/sfx` di cut, `<audio
   id="music">`.
4. Musik: salin `template/score.mjs` ke folder video, sesuaikan daftar cut/tick/drop bila timing berubah, jalankan.
5. `npx hyperframes lint` + `check`, still tiap beat (`snapshot --at`), perbaiki, `npm run finish -- <slug>`, baca
   contact sheet, kirim MP4.
