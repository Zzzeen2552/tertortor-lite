# Preset: Risograph (cetak tinta spot)

Dibuat dari pengamatan film demo "Risograph Print" di galeri lemo-opuscar (user 2026-11-23). Yang diambil hanya
**idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan **tidak disalin**; kode
preset ini ditulis sendiri. Jangan memakai cerita atau adegan demo itu (naik sepeda Minggu pagi lewat toko roti).

Intinya: **setiap frame terlihat dicetak di mesin stensil.** Dua-tiga tinta spot transparan di kertas krem hangat,
saling menimpa (biru + kuning = hijau, biru + pink = ungu), titik halftone, butir tinta yang tidak rata, dan pelat
yang tidak pernah pas: tinta aksen selalu meleset beberapa piksel dan meloncat ke posisi baru empat kali per detik.
Hangat dan santai seperti zine, poster acara, atau peta wisata cetak. Cocok untuk kisah kota, kuliner, pasar,
jalan-jalan, gaya hidup, acara, dan explainer ringan yang tidak butuh nada serius.

## Alur yang cocok
1. **Hook (0-2 s)**: `type`, judul poster besar di atas tiga pelat (pita kuning, cakram aksen, bukit biru).
2. **Tempatnya**: `drawn`, adegan jalan/tempat dari tiga pelat; satu benda inti di tinta aksen.
3. **Bukti nyata**: `footage`, foto/klip asli dicetak duotone biru bertitik, blok aksen meleset di belakangnya.
4. **Cara / peta**: `screen`, screenshot asli di bingkai biru tercetak, cincin kuning di baris yang dibahas.
5. **Penutup**: blok matahari terbenam (`blocks.html`) atau `type` dengan kalimat ajakan.
Tiap bab boleh **menambah satu tinta** (bab pertama biru + kuning, aksen masuk saat cerita memanas), seperti demo
yang menambah tinta di tiap perhentian.

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/risograph/build.mjs`)
- `.rg-paper`: kertas krem `#F4EEDC` dengan serat (`::before`) dan bintik tinta yang hilang (`::after`, di atas
  semua pelat, di bawah judul).
- `.rg-plate` + `.rg-a` (biru) / `.rg-b` (aksen) / `.rg-c` (kuning): satu pelat = satu tinta, dicetak `multiply`.
  Isi pelat memakai `currentColor`: `.ht` / `.ht-lo` / `.ht-hi` = halftone tengah/terang/gelap, `.rg-solid` = penuh,
  `.rg-disc` = bulat, SVG `.rg-svg` dengan `.f` (isi) dan `.s` (garis 7 px).
- `.rg-title`: Archivo Black kapital biru, salinan tinta aksen tercetak meleset di belakangnya (`--mx`/`--my`), kata
  `<em>` diberi pita stabilo kuning. `.rg-kick`: label Space Mono.
- `.rg-print`: foto/klip abu-abu → duotone biru (`.tone` screen) + raster titik (`.screenx`) + blok aksen `.under`.
- `.rg-phone` + `.rg-ring`: bingkai ponsel biru dengan bayangan aksen; screenshot **tidak** di-blend supaya terbaca.
- Potongan siap tempel di `presets/risograph/blocks.html`: orang bersepeda, deret pohon, sungai, matahari terbenam
  dengan siluet kota, label stiker.

## Warna
Kertas krem, biru `#2B57C8` (garis, judul, bayangan), kuning `#FFD93D` (cahaya, fasad, stabilo), dan **satu aksen**
fluoro yang bisa diganti (Color tone: Pink fluoro default, Oranye fluoro, Merah, Hijau teal, Ungu). Warna lain hanya
lahir dari tumpang tindih (multiply). Tidak ada hitam murni dan tidak ada putih murni selain kertas.

## Tipografi
- Archivo Black kapital untuk judul (150-170 px) dan caption (62 px, kotak biru, teks krem, kata aktif kuning).
- Space Mono untuk label dan stiker. Teks tidak pernah miring; tanpa huruf tipis.

## Gerak
- Kepribadian: **santai tapi patah-patah** seperti cetakan dibalik satu per satu. Posisi masuk memakai `steps()`:
  pelat diletakkan satu per satu 0,18 s `steps(3)` (jeda 0,08 s), judul naik per kata 0,2 s `steps(4)`.
- **Misregistrasi**: pelat aksen dan salinan judul meloncat ke offset baru (3-9 px) tiap 0,25 s (helper `jitter`).
- Ambien halus: bukit/kota bergeser 30-40 px sepanjang beat (`ease: "none"`), matahari naik bertahap.
- Mark `pop` = benda aksen melompat (0,2-0,24 s `steps(4)`); `slam` = blok aksen foto meloncat; `tap` = cincin.
- SFX preset: `thump` di cut (seperti drum mesin), `pop` di `pop`/`tap`, `hit` di `slam`. Musik skor otomatis santai,
  atau lagu indie/lo-fi berlisensi; cut di ketukan.

## Footage
- Foto/klip asli (Commons, foto user) selalu dicetak duotone di `.rg-print`, tidak pernah berwarna asli atau full-bleed.
  Pilih gambar yang kontrasnya jelas (siluet, cahaya samping): halftone menghapus detail halus.

## Hindari
- **Gradien, bayangan lembut, glow, 3D, warna RGB murni**: semuanya tinta di kertas.
- **Lebih dari tiga tinta** per frame, atau hitam sebagai tinta; warna baru yang tidak lahir dari tumpang tindih.
- **Pelat yang pas sempurna dan diam**: misregistrasi dan bintik wajib ada; tapi offset tidak lebih dari 10 px
  (lebih dari itu terbaca rusak, bukan cetak).
- **Gerak mulus ala UI**: tween posisi `power`/`back` panjang, bounce, parallax halus pada benda utama.
- **UI aplikasi yang digambar**: layar hanya screenshot asli. **Wajah detail**: tokoh disederhanakan seperti ilustrasi zine.
- **Batas**: pelat 180 ms, judul 200 ms, benda aksen 240 ms, cincin 180 ms; stagger total ≤ 250 ms.
