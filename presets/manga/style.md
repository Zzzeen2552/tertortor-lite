# Preset: Manga Panels (komik hitam-putih)

Dibuat dari pengamatan film demo "Manga Panels" di galeri lemo-opuscar (user 2026-11-23). Yang diambil hanya
**idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan **tidak disalin**; kode
preset ini ditulis sendiri. Jangan memakai cerita, tokoh, atau panel demo itu (fotografer jalanan dan merpati).

Intinya: **halaman manga hitam-putih yang bergerak.** Tinta G-pen, screentone, panel bergaris tebal yang dipotong
terbuka tepat di ketukan, garis fokus dan garis kecepatan, balon kata, lettering efek suara besar, dan **satu warna
spot** (merah default) untuk satu benda yang penting. Cocok untuk kisah berdrama, aksi, olahraga, momen sepersekian
detik, kisah tokoh, dan explainer yang dibawakan seperti bab manga.

## Pembagian kerja: gambar vs kode
- **Gambar (generate atau domain publik)**: hanya isi panel: tokoh, tempat, benda. Hitam-putih bertinta, satu benda
  boleh merah. Dibuat di Flow (gratis, cadangan GPT Image / Muse sesuai kuota), atau cetakan domain publik
  (Hokusai Manga, ukiyo-e lewat `npm run commons`). Asal tiap gambar di `sources.txt`.
- **Kode**: tata panel dan garis tepinya, garis fokus, garis kecepatan, screentone, balon, kotak narasi, efek suara,
  getar halaman. Jangan minta model gambar menggambar balon, teks, atau garis fokus (hasilnya huruf acak).

## Prompt gambar (inti, tulis isinya sendiri per panel)
"black and white manga panel, G-pen ink lineart, screentone shading, high contrast, clean white background areas,
dynamic camera angle, [adegan], [tokoh: usia, rambut, pakaian], no text, no speech bubbles, no sound effects, no
panel border" + bila perlu "the only colour is a small red [benda]". Rasio sesuai panel: panel besar 1:1 atau 4:5,
panel lebar 16:9, panel tinggi 9:16. Tokoh yang berulang: satu lembar karakter dulu, lalu dipakai sebagai acuan.

## Alur yang cocok
1. **Hook (0-2 s)**: `type`, garis fokus penuh halaman + satu kata efek suara (masalah dalam satu bunyi).
2. **Tokoh dan situasi**: `footage`, satu panel besar + balon kata (hook dalam kalimat).
3. **Momen dipecah**: `drawn`, tiga panel (lebar, dekat, benturan) yang terbuka satu per satu di kata kuncinya.
4. **Layar**: `screen` hanya dengan screenshot asli (ponsel tinta di panel garis fokus).
5. **Penutup**: panel besar lagi atau halaman hitam (`.mg-page.black`) dengan satu kata.

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/manga/build.mjs`)
- `.mg-page` kertas putih gading (`.black` = halaman hitam). `.mg-panel` + `.art` + `.frame`: panel bergaris 8 px;
  `.ink` memaksa gambar jadi hitam-putih murni (lepas untuk panel yang memakai warna spot).
- `.mg-lines`: SVG garis fokus (`focus()` di stub `type`/`screen`) atau garis kecepatan (`speed()` di stub `drawn`),
  dibuat dari seed tetap.
- `.mg-tone`: screentone titik. `.mg-sfx` lettering Anton dengan pinggir putih tebal (`.red` = warna spot, kata `<em>`
  merah). `.mg-balloon` balon kata (`--tx` = letak ekor, `.shout` = balon teriak bersudut). `.mg-box` kotak narasi.
- `.mg-phone` + `.mg-ring`: ponsel tinta untuk screenshot asli.
- Potongan siap tempel di `presets/manga/blocks.html`: balon teriak, pikiran, halaman hitam, tiga panel tegak, sabetan.

## Warna
Hitam `#111`, putih gading `#F6F3EA`, putih murni di dalam panel, abu hanya dari screentone, dan **satu warna spot**
(Color tone: Merah default, Biru, Oranye, Pink, Hijau) untuk satu benda per halaman (atau satu kata efek suara).
Caption: kotak putih bersudut siku, teks hitam kapital, kata aktif merah.

## Tipografi
- Archivo Black untuk efek suara (150-260 px, miring −8°, pinggir putih 18 px). Montserrat 800 kapital untuk balon
  (42-50 px) dan caption; Montserrat 700 untuk kotak narasi. Satu balon maksimal dua baris pendek.

## Gerak
- Kepribadian: **energik, tegas, berbasis potongan** (halaman manga dibalik). Panel dipotong terbuka 0,2-0,26 s
  `power4.out` dari sisinya sendiri; panel kedua dan ketiga terbuka di mark `p2` / `p3` (di ketukan).
- Di dalam panel kamera melayang pelan (scale 1,05 → 1,12, geser 20-40 px, `ease: "none"`).
- Garis fokus mengecil 1,25 → 1 saat panel terbuka, lalu "mendidih" (berkedut ±0,5°) delapan kali per detik.
- Efek suara dicap di mark `slam`: skala 1,8 → 1 + putar −18° → −8° dalam 0,18-0,22 s `back.out(2.2-2.4)`; halaman
  bergetar sekali (`elastic.out`). Balon muncul 0,2 s `back.out(2)` dari ekornya.
- SFX preset: `thump` di cut, `hit` di `slam`, `whoosh` di `p2`/`p3`, `pop` di `tap`. Musik skor otomatis cepat atau lagu
  berlisensi; panel terbuka tepat di ketukan.

## Hindari
- **Teks, balon, atau efek suara di dalam gambar generate**; huruf Jepang palsu sebagai hiasan.
- **Warna lebih dari satu spot**, gradien, glow, bayangan lembut; gambar berwarna penuh di dalam panel.
- **Gaya anime cel berwarna, chibi, atau 3D**: ini manga cetak hitam-putih.
- **Meniru tokoh, judul, atau gaya mangaka tertentu**; tokoh buatan sendiri.
- **Chat/aplikasi yang digambar**; layar hanya screenshot asli.
- **Panel yang muncul dengan fade**: panel selalu dipotong terbuka. Lebih dari tiga panel per beat.
- **Batas**: panel 260 ms, efek suara 220 ms, balon 200 ms, getar 220 ms; stagger ≤ 250 ms.
