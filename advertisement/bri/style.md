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

## Aturan tetap (user 2026-11-13, menimpa bagian lain resep ini)

- **Logo di scene terakhir saja.** Logo Danantara, logo HUT (131), dan logo BRI **tidak tampil di keyframe** (adegan
  teks kinetik, angka promo, end frame 1, end frame 2). Ketiganya pindah ke **scene penutup** sendiri setelah end frame 2:
  latar putih polos, tiga logo dalam satu baris di tengah tinggi layar (Danantara kiri, 131 tengah, BRI dengan "Bank Rakyat
  Indonesia" kanan), dan satu baris disclaimer biru di bawah: "BRI merupakan peserta penjaminan LPS, serta berizin dan
  diawasi Otoritas Jasa Keuangan & Bank Indonesia". Tidak ada teks atau gambar lain di scene itu. Acuan:
  `reference/endcard.png`. Footer klien (URL promo, periode, tagline, kontak) dan kartu QR BRImo tetap di end frame.
- **Rounded square tidak pernah berubah bentuk.** Bingkai putih bersudut bulat di sekitar subjek (end frame 1, ciri KV
  BRI di semua materi klien) selalu persegi dengan sudut yang sama (836×834, rx 60, garis putih 8 px di 1080×1920). Di rasio
  lain (Ubah format) bentuk dan proporsinya tetap persegi, tidak boleh dilebarkan, dipanjangkan, atau dipipihkan. Yang
  boleh menyesuaikan: letaknya, dan ukurannya **mengecil secara proporsional** bila kanvas tidak muat (user 2026-11-13):
  sisi, jari-jari sudut, dan tebal garis diskalakan dengan faktor yang sama (rx = 7,2% sisi, garis ≈ 1% sisi, min. 5 px).
  Tata letak lain yang menyesuaikan diri di sekitarnya.

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
6. **File After Effects** (klien BRI minta file akhir AE yang bisa diedit, user 2026-11-13):
   `node advertisement/bri/scripts/ae-export.mjs <slug>` → `out/<slug>-after-effects.zip` (skrip `.jsx` + aset +
   `BACA-SAYA.txt`). Chrome mengukur tata letak `kv.html`, angka waktu dan gerak dibaca dari file itu, lalu
   `ae/builder.jsx` menyusun proyek AE: teks Inter = layer teks asli, bingkai/kotak/ledakan = shape layer, satu precomp
   per adegan, keyframe ber-easing, musik + SFX. Klien menjalankan File > Scripts > Run Script File lalu menyimpan `.aep`.
   AE tidak terpasang di laptop ini: cek dengan `node advertisement/bri/ae/mock-run.mjs <file.jsx>` (tiruan objek AE,
   menangkap error skrip dan nilai NaN, bukan bukti AE menerima tiap panggilan). Bila komposisi diubah (elemen/id baru),
   builder ikut diperbarui.

## Durasi per beat (user 2026-11-13)

Delapan beat, durasinya di `beats.json` (`kv: true`): `healing`, `tanpa`, `kantong`, `pakai` (teks di atas klip),
`promo` (angka odometer), `end1` (end frame promo), `end2` (end frame mitra), `close` (penutup logo). Komposisi tidak
menyimpan detik lagi: blok `/*@beats*/` berisi durasi dan semua waktu di dalam beat (hentakan, kilau, grid, logo) diturunkan
dari situ. Diubah di tab **Beat** Studio (Simpan / Simpan & render ulang) atau manual lalu
`node advertisement/bri/scripts/retime.mjs <slug>`, yang juga membuat ulang potongan orang (sampai angka promo menutup
teks), celah bingkai (jendela end frame 1), SFX, musik (`score.mjs`), dan `build/timeline.json` (daftar beat di Studio).
Cut dibulatkan ke ketukan 100 BPM: beat pertama 0,55 + 0,3k, lainnya kelipatan 0,3; penutup bebas. Minimum: teks 0,3
(Pakai 0,6), angka 0,9, end frame 1,5/1,8, penutup 1,2. Geometri dibaca dari `kv.html` tiap proyek, jadi versi 1:1, 4:5,
16:9 ikut. Klip Flow 10 s: bila end frame mitra mulai sesudahnya, frame terakhir klip ditahan (skrip memberi peringatan).

## Thumbnail (user 2026-11-13)

Default tanpa teks, tanpa logo, tanpa bayangan: foto key visual polos (`thumbnail.json → text: false, shade: false`). User
bisa memilih latar lain di tab Thumbnail: key visual lain, frame dari video (geser penggeser, "Pakai frame ini"), atau
gambar unggahan sendiri. Thumbnail tidak ditaruh di depan video (`cover: false`).
