# Preset: Line-Art Cutaway (gambar teknik)

Dibuat dari pengamatan film demo "Line-Art Cutaway" (folder `hardcore-info`) di galeri lemo-opuscar (user 2026-11-23).
Yang diambil hanya **idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan
**tidak disalin**; kode preset ini ditulis sendiri. Jangan memakai cerita atau benda dari demo itu (antena di bingkai ponsel).

Intinya: **benda nyata dibuka di atas lembar gambar teknik.** Garis hitam ditelusuri di depan mata, benda dipotong atau
dipisah lapisannya, lalu satu jalur diberi warna aksen: hanya itu yang sedang dijelaskan. Callout huruf, lup pembesar,
garis ukur, label mono. Tenang dan presisi, seperti manual teknik yang menerangkan satu hal.
Cocok untuk "apa isi benda ini", cara kerja alat, salah kaprah sehari-hari, keselamatan alat rumah tangga, teknologi.

## Alur yang cocok
1. **Hook (0-2 s)**: `type`, judul di lembar gambar dengan garis ukur di bawahnya (klaim yang mengejutkan).
2. **Benda utuh**: `footage` = foto/klip asli benda (Commons atau foto user) sebagai cetakan abu-abu berbingkai
   crop mark, satu detail dikotak aksen + label.
3. **Dibuka**: `drawn` = potongan/exploded view benda yang sama sebagai garis; jalur aksen tergambar di kata kuncinya,
   lup membuka pada detail itu, callout A/B muncul.
4. **Ukuran / angka**: garis ukur atau gelombang dari `blocks.html`; angka wajib diucapkan.
5. **Di ponselmu**: `screen` = screenshot asli di ponsel garis tipis, satu baris dicincin + label.
6. **Penutup**: `type`, satu kalimat pelajaran, garis bawah aksen di kata kuncinya.

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/cutaway/build.mjs`)
- `.lc-paper`: kertas hangat `#F3F1EA` + titik grid 60 px + tanda plus; `.plain` = titik saja (di belakang foto).
- `.lc-draw`: SVG gambar teknik. `l` garis luar 3 px, `t` garis dalam 1,8 px, `g` bidang abu, `w` bidang putih,
  `a` **satu jalur aksen** 12 px, `af` isian aksen, `dash` garis titik-titik penunjuk. Semua `l`/`t`/`a` diberi
  `pathLength="1"` lalu ditelusuri (`strokeDashoffset` 1 → 0).
- `.lc-title` Inter 800 kapital, kata `<em>` = warna aksen yang digelapkan (`--acc-ink`, supaya kontras di kertas);
  `.lc-label` mono tebal kapital, `.lc-note` mono abu, `.lc-head` baris kepala lembar (kiri: job, kanan: jenis lembar).
- `.lc-call` (+ `.on`): callout bulat berisi **huruf**, bukan angka (angka di layar wajib diucapkan).
- `.lc-loupe`: lup pembesar (lingkaran putih bergaris) + `dash` ke titik yang dibesarkan.
- `.lc-plate` + `.lc-hl`: foto/klip abu-abu dengan crop mark, kotak aksen pada detail. `.lc-phone` + `.lc-ring`: ponsel.
- Potongan siap tempel di `presets/cutaway/blocks.html`: exploded view tiga lapis, potongan berarsir (material),
  garis ukur, tangan garis, deret callout, gelombang.

## Menggambar benda
- Gambar ulang dari **foto asli atau ukuran asli** benda (proporsi benar), bukan dari ingatan. Bila ada foto, taruh di
  beat `footage` sebelum versi garisnya supaya penonton percaya gambarnya.
- Bagian dalam yang tidak pasti ditulis jujur di `.lc-note` ("posisi ilustratif"). Tidak ada angka yang dikarang.
- Garis bersih: sudut membulat, arsir hanya di bidang potong, maksimal satu bidang abu per benda.

## Warna
Kertas hangat, tinta hampir hitam `#17171B`, abu `#E7E4DC` untuk bidang, putih untuk bidang terang, dan **satu aksen**
(Color tone: Oranye default, Biru teknik, Merah, Hijau, Ungu) untuk satu jalur per frame. Caption: kotak putih, teks
tinta, kata aktif oranye gelap.

## Tipografi
- Inter 800 kapital untuk judul (110-160 px), JetBrains Mono untuk label (32 px tebal kapital) dan catatan (28 px abu).
- Teks sedikit: satu judul + satu label + satu catatan per beat.

## Gerak
- Kepribadian: **presisi dan tenang** (manual teknik). Judul naik per kata 0,24 s `power3.out` (terbaca < 0,3 s).
- **Telusur garis** = gerak hero: 0,5-0,6 s `power2.inOut`, garis luar dulu lalu bagian dalam (stagger total 0,3 s).
  Bidang abu/putih muncul setelah garisnya (0,3 s).
- Jalur aksen tergambar 0,4 s di mark `path`; lup membuka 0,3 s `power3.out` di mark `zoom`; callout `back.out(1.6)`
  0,22 s di mark `call`; kotak aksen di foto 0,24 s di `slam`; cincin layar 0,2 s di `tap`.
- Ambien: lembar mendorong pelan (scale 1 → 1,035 atau geser 24 px sepanjang beat, `ease: "none"`).
- SFX preset: `tick` di cut dan `path`/`call`, `pop` di `zoom`/`tap`, `thump` di `slam`. Musik skor otomatis pelan
  atau lagu ambient berlisensi; cut tetap di ketukan.

## Footage
- Foto/klip asli benda (Commons, foto user, atau rekaman berlisensi) dicetak abu-abu di `.lc-plate`, tidak pernah
  full-bleed berwarna. Generate hanya bila benda itu tidak punya foto bebas, dan beri catatan di `sources.txt`.

## Hindari
- **Render 3D mengilap, gradien, bayangan, glow, blueprint biru**: ini gambar tinta di kertas hangat.
- **Lebih dari satu warna aksen** atau dua jalur aksen dalam satu frame; aksen sebagai dekorasi.
- **Callout bernomor** yang angkanya tidak diucapkan; label lebih dari enam kata; teks italic atau serif.
- **Bagian dalam yang dikarang sebagai fakta**: tandai "ilustratif" bila posisi tidak pasti.
- **UI aplikasi yang digambar**: layar hanya screenshot asli.
- **Gerak cepat ala UI** (pop besar, bounce kuat, shake); tidak ada tween posisi lebih dari 0,6 s kecuali telusur garis.
- **Batas**: judul 240 ms, telusur 600 ms, jalur aksen 400 ms, lup 300 ms, callout 220 ms, cincin 200 ms; stagger ≤ 300 ms.
