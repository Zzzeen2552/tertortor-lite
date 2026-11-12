# Product: App Demo (demo aplikasi, tanpa narasi)

Engine `tools/appdemo.mjs`, preset `presets/appdemo` (warna, font Lora + Inter, musik). Satu proyek = `demo.json` → satu
komposisi `compositions/demo.html` sepanjang video. Uji: `videos/uji-appdemo` (UI TERTORTOR sendiri, bukan untuk publish).

## Acuan (`reference/appdemo-ref.mp4`, 28 s, 6 adegan, cut keras)

| Detik | Adegan | Yang terjadi |
| --- | --- | --- |
| 0–5 | headline + ponsel | headline serif diketik di tengah, kata kunci miring berwarna dengan stabilo; headline naik dan mengecil, ponsel berisi UI naik dari bawah; layar ponsel blur, satu kartu UI terangkat keluar dan miring sedikit; pill gelap meluncur dari kiri |
| 5–10 | kartu bertumpuk | headline baru diketik, kartu UI masuk dari kanan bergantian, satu notifikasi jatuh di bawahnya |
| 10–15 | utas | kartu berturut-turut membangun satu percakapan |
| 15–20 | fokus | satu kartu UI besar, item dicentang satu per satu, tombol ditekan |
| 20–24 | daftar | empat baris manfaat bercentang, kalimat penutup diketik di bawah |
| 24–28 | penutup | ikon aplikasi, "Meet your *village.*", nama aplikasi |

Latar terang dengan gumpalan warna lembut yang bergeser pelan; musik tenang, tanpa suara orang. Warna acuan (oranye/krem)
**diganti shade biru BRI** (user): latar `#F4F8FE`, gumpalan `#B9D1F4`/`#D6E5FB`, teks navy `#0E2148`, aksen biru BRI
`#1F5BC6` (tone lain: navy `#0B3D91`, biru langit `#2E7BE6`), pill navy `#0B3D91`.

## Gerak ponsel (user 2026-11-12: "posisi handphone bisa dibikin lebih dinamis")

Dua acuan tambahan di `reference/` (iklan pihak ketiga, hanya gerak kamera yang diambil):
- `phone-motion-ref.mp4` (app bank, 12,8 s): layar sebagai lempeng 3D besar yang miring dan terpotong bingkai, kamera tidak
  pernah diam, lapisan UI terangkat ke depan dalam kedalaman. → adegan `phone`: ponsel 3D (perspektif 2300 px), pose
  `right` / `left` bergantian (rotasi Y ±34°, X 16°, Z ±6°, skala 1,22, geser ±130 px), masuk dari bawah sambil berputar
  1,2 s `expo.out`, lalu terus melayang sampai lewat cut. Potongan UI naik dari layarnya sendiri (`translateZ` 220 px,
  skala 1,12), layar di belakangnya blur 4 px.
- `phone-motion-ref2.mp4` (SaaS, 33 s, 16:9): beberapa ponsel besar melingkari teks di tengah, lingkaran berputar dan kamera
  mundur. → adegan `orbit`: 2–4 screenshot dalam ponsel yang mengarah keluar dari headline (sudut mulai 45°), lingkaran masuk
  dari rotasi −50° dan skala 1,75, lalu berputar pelan 7°. Headline tetap di tengah (skala 0,82), celah 530 px dari pusat.

## Aturan

- **UI tidak pernah digambar ulang atau di-generate.** Ponsel memuat screenshot user apa adanya; setiap kartu yang melayang
  adalah crop dari screenshot itu (`crop: [x, y, w, h]` dalam piksel gambar). Yang boleh dibuat dari kode hanya tipografi
  (headline, pill, daftar manfaat, nama aplikasi), bingkai ponsel generik, dan cincin tap.
- Data pribadi di screenshot (nama, nomor rekening, saldo, nomor HP) tidak boleh tampil: pilih crop yang menghindarinya,
  atau minta user screenshot akun demo.
- **Format judul** untuk headline, pill, daftar, dan kalimat penutup (dipasang otomatis); kata di `*bintang*` = miring biru
  dengan stabilo. Headline ≤ 38 karakter, maks. dua baris (`/` memaksa pindah baris).
- Klaim dan angka hanya dari formulir user atau yang terlihat di screenshot. Tidak ada "nomor 1", "tercepat", dsb. yang
  tidak diberikan user.
- Dua adegan berurutan tidak boleh berjenis sama (kecuali `stack`). Adegan pertama selalu ada UI dalam 2 detik pertama
  setelah headline selesai; penutup (`end`) selalu terakhir.
- Tanpa watermark channel (`meta.json → watermark: false`) dan tanpa thumbnail di depan video (`thumbnail.json → cover: false`).
- Tata letak: headline di y 200, konten sampai y 1700 (seperti BRI, iklan mengikuti acuannya, bukan pita 168–1330).

## Jenis adegan (`demo.json → scenes[]`)

| `kind` | Isi | Kunci |
| --- | --- | --- |
| `phone` | ponsel 3D miring berisi satu screenshot, lalu potongan UI terangkat ke depan | `screen`, `pose?: right|left|front`, `tilt?: { ry, rx, rz, x, y, s }`, `pops: [{ crop, at? }]`, `pill: { text, at?, y? }` |
| `orbit` | 2–4 ponsel melingkari headline, berputar | `screens: [..]`, `angle?` (45), `spin?` (1 / −1) |
| `stack` | 2–4 potongan UI bertumpuk masuk dari kanan, opsional satu jatuh di bawah | `cards: [{ src, crop }]`, `drop: { src, crop, at? }` |
| `focus` | satu potongan besar, tap, lalu keadaan sesudahnya (screenshot kedua, crop sama) | `src`, `crop`, `tap: [x, y]`, `at?`, `then?` |
| `list` | baris manfaat bercentang + kalimat penutup diketik | `items: [..]`, `foot` |
| `end` | ikon, headline, nama aplikasi | `icon?`, `name?` |

Durasi tiap adegan dihitung dari isinya dan dibulatkan ke ketukan (96 BPM) supaya cut jatuh di ketukan; `dur` menimpanya.
Panjang total ikut `request.json → seconds` kira-kira (biasanya 5–6 adegan, 20–30 s). Musik `anim-music` dari
`preset.json → music` (epiano, pad, lofi), klik ketik + pop kartu disintesis ke `assets/sfx/fx.wav`, whoosh di cut.

## Alur kerja (event `ad-new` dengan product `appdemo`)

1. Baca `request.json` (app, idea, benefits, closing, seconds, notes) dan lihat semua `assets/products/ui-N.png` + `icon-1.png`.
   `node tools/appdemo.mjs info <slug>` memberi ukuran tiap gambar (crop dalam piksel ini).
2. Jalankan `/paket-ide` singkat untuk sudut dan headline pertama, lalu tulis `demo.json` (headline lewat `/humanizer`).
   Adegan pertama = masalah/janji utama + ponsel; manfaat dari formulir → `list`; `closing` → headline `end`.
3. `node tools/appdemo.mjs check <slug>` (build + aturan + `hyperframes check`), lalu still tiap adegan
   (`npx hyperframes snapshot videos/<slug> --at …`): cek crop pas di elemen UI (tidak terpotong di tengah teks), pill tidak
   menimpa kartu, tidak ada data pribadi. Perbaiki crop/at, ulangi.
4. `npm run finish -- <slug> --no-thumbnail`, baca `out/contact-sheet.png`, laporkan MP4. Tidak ada biaya (semua dari kode).
