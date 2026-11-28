# Preset: Satellite Briefing (citra satelit)

Dibuat dari pengamatan film demo "Satellite Briefing" di galeri lemo-opuscar (user 2026-11-23). Yang diambil hanya
**idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan **tidak disalin**; kode
preset ini ditulis sendiri. Jangan memakai cerita demo itu (Laut Aral).

Intinya: **tempat nyata dilihat dari orbit seperti di ruang analis.** Citra satelit asli diwarnai abu-abu, lalu di
atasnya digambar garis ukur putih tipis: reticle mengunci sasaran, garis pantai atau batas putus-putus, label
bergaris penunjuk, dan **satu angka bacaan** amber yang tipis dan besar per beat. Kamera mendorong pelan ke sasaran.
Satu beat (biasanya puncak atau penutup) dibiarkan berwarna asli, dan warnanya terasa seperti jawaban.
Cocok untuk perubahan lingkungan (danau mengering, hutan hilang, pantai mundur, kota tumbuh), bencana, geografi,
dan kisah tempat yang hanya terlihat utuh dari atas.

## Sumber citra (wajib asli, tidak pernah di-generate)
- NASA Earth Observatory, Landsat, ASTER, MODIS, foto astronot ISS (domain publik), lewat
  `npm run commons -- search "<tempat> Landsat|ASTER|MODIS" --type image` lalu `commons use` (kredit otomatis).
- Copernicus Sentinel boleh bila dari Commons dengan lisensi yang lolos (kredit "contains modified Copernicus Sentinel data").
- Google Earth / Maps / Bing **tidak boleh** (lisensinya melarang). Peta digambar dari citra, bukan dari aplikasi peta.
- Dua tanggal untuk perbandingan: framing dan skala harus sama; tahun di layar wajib diucapkan.
- Baris kredit sumber selalu tampil di `.sb-meta` kanan atas pada setiap beat bercitra.

## Alur yang cocok
1. **Hook (0-2 s)**: `footage`, citra luas, reticle mengunci sasaran, satu kalimat masalah.
2. **Bentuknya**: `footage` lebih dekat, garis luar putus-putus menelusuri bentuk tempat itu, label nama.
3. **Dulu vs sekarang**: `drawn` (dua garis luar di graticule) atau blok wipe dua tanggal (`blocks.html`).
4. **Bacaan**: `type`, satu angka besar (jarak, persen, luas) dari sumber yang disebut di baris bawahnya.
5. **Di ponselmu**: `screen` hanya bila ada screenshot asli (misal aplikasi cuaca resmi).
6. **Penutup**: `footage` berwarna asli (`.sb-img.color`), kalimat terakhir.

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/satbrief/build.mjs`)
- `.sb-img` (+ `.color`) citra penuh layar abu-abu; `.sb-vig` vinyet supaya teks terbaca; `.sb-grat` graticule.
- `.sb-svg`: `o` garis putus-putus putih 3 px, `l` garis tipis 2,5 px, `acc` garis aksen 4 px, `fill` isi aksen pudar,
  `dot` titik. `.sb-ret`: reticle (cincin, empat tick, celah tengah; markup di konstanta `RET` stub).
- `.sb-read`: angka bacaan Inter 200 amber 220 px (+ `<small>` satuan), dihitung naik dari nol di stub `type`.
- `.sb-title` Inter 300 kalimat biasa, kata `<em>` = aksen tebal; `.sb-tag` label 40 px; `.sb-cap` mono kecil
  (`.dim` abu); `.sb-meta` baris atas (kiri: yang dilihat, kanan: kredit citra).
- `.sb-phone` + `.sb-ring`: ponsel garis tipis untuk screenshot asli.
- Potongan siap tempel di `presets/satbrief/blocks.html`: wipe dua tanggal, garis jarak, isi area, skala, penanda titik.

## Warna
Hitam abu `#0E1012`, putih hangat `#F2F2EE`, abu `#9AA0A6`, dan **satu aksen** untuk bacaan dan garis yang sedang
dibahas (Color tone: Amber default, Sian, Merah sinyal, Hijau radar, Kuning). Citra selalu abu-abu kecuali satu beat
berwarna. Merah sinyal (`--alert`) hanya untuk peringatan nyata.

## Tipografi
- Inter tipis: judul 300 (≈104 px, kalimat biasa, bukan kapital), angka bacaan 200 (220 px). IBM Plex Mono untuk label
  dan meta (28-30 px kapital renggang). Caption Inter 600 54 px, kotak hitam bersudut tajam, kata aktif aksen.
- Teks sedikit dan kecil; citra yang bicara. Koordinat atau tahun hanya bila diucapkan.

## Gerak
- Kepribadian: **tenang dan dingin** (ruang analis). Kamera = push-in pelan 1 → 1,1 sepanjang beat ke titik sasaran
  (`ease: "none"`), tidak pernah zoom cepat.
- Reticle mendarat di mark `lock`: dari skala 1,8 ke 1 dalam 0,4 s `power3.out`, lalu berputar pelan 25° sepanjang beat.
- Garis luar terbuka dari sasaran (clip lingkaran 0,7 s `power2.out`); label masuk 0,3 s; di mark `slam` garis luar
  berubah jadi aksen. Bacaan dihitung naik 0,9 s `power2.out` di mark `read`.
- Judul naik per kata 0,3 s `power3.out`. Tidak ada bounce, overshoot, atau glitch.
- SFX preset: `whoosh` pelan di cut, `tick` di `lock`/`tap`, `pop` di `read`, `thump` di `slam`. Musik skor otomatis
  tempo rendah atau ambient berlisensi; cut tetap di ketukan.

## Hindari
- **Citra hasil generate atau "mirip satelit"**, peta dari Google/Apple Maps, citra tanpa kredit.
- **Angka tanpa sumber** atau dihitung sendiri tanpa disebut; dua angka bacaan dalam satu beat.
- **HUD fiksi ilmiah**: garis neon, glow, scanline, teks berkedip, grid bergerak, warna hijau matriks.
- **Garis tebal atau penuh warna**: semua garis tipis putih, aksen hanya satu garis per frame.
- **Zoom cepat, shake, transisi glitch**; teks kapital besar ala trailer.
- **Batas**: judul 300 ms, reticle 400 ms, garis luar 700 ms, label 300 ms, hitung angka 900 ms; stagger ≤ 200 ms.
