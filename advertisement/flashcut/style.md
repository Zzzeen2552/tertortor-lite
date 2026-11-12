# Advertisement · Flashcut

> Gaya dari analisis acuan (`reference/analysis.md`, 2026-11-05). Preset `presets/flashcut/` (stub `photo` dan `endcard`),
> alat `tools/ad.mjs`. Proyek dibuat dari formulir Studio (foto angle, logo, model opsional, CTA) lalu skill
> `/flashcut`. Jangan memakai logo, nama, atau produk dari acuan (Oakley).

## Acuan

- Video: lampiran Telegram `t.me/amirmushichba/30` "OAKLEY PRODUCT REVEAL 11.5s60" → `reference/flashcut-telegram.mp4`
  (acuan utama), salinan X https://x.com/AmirMushich/status/2118053988423676155 → `reference/flashcut-x.mp4`. Tidak di-commit.
- Starter kit `Flash-Cut-Starter 0.1.2` → `reference/starter-kit/` (dibaca, tidak dijalankan, lisensi belum ditetapkan
  pemiliknya, kodenya tidak disalin). Jalurnya After Effects, yang tidak terpasang di sini. MOTION membangun ulang
  gayanya di HyperFrames. Ringkasannya di `reference/analysis.md`.

## Gaya (dari analisis)

- **Produk adalah hero, teks bukan.** Satu produk, tanpa wajah, tanpa narasi, tanpa caption.
- **Dua dunia bergantian:** makro detail (DOF tipis, latar hitam/gradasi abu, highlight tajam) dan hero produk utuh
  melayang di latar off-white hangat (±#E2DCD4–#E9E3DC, terukur dari acuan). Pola: detail, detail, kilat, HERO,
  detail…, HERO + nama di end card.
- **Tempo:** ±11,5 s total, median shot 0,35 s (0,2–1,4 s), end card ±4,5 s. 6 cut di 3 detik pertama. Cut besar
  diberi hit audio, potongan kecil di antaranya mengikuti musik.
- **Kilatan 1–3 frame:** threshold hitam-putih keras, cincin bergerigi melingkari produk, ripple garis putih, motion
  smear horizontal; punch-in hero dengan lompatan ukuran antar frame (bukan zoom halus).
- **Palet = warna produk itu sendiri.** Tidak ada warna grafis tambahan selain hitam/putih kilatan dan latar off-white.
- **Tipografi:** grotesk netral huruf kecil, kecil: nama produk ±44 px kiri bawah, sub-label ±18 px, label mikro pojok
  ±14–16 px, garis bantu/crosshair tipis. Di MOTION minimal teks 28 px, jadi skala ini harus dinaikkan
  (nama ±72 px, sub-label 28 px) atau aturan minimal diubah untuk Advertisement: keputusan user.
- **SFX dua lapis** (acuan SFX user, `reference/analysis.md` → "Acuan SFX"): tick/klik kecil di setiap label, lompatan, dan kilatan;
  sub impact hanya di HERO, ledakan kedua, dan end card (maks satu per 1,5-3 s), didahului swell 0,2-0,8 s. Tanpa musik boleh hening
  di antara bunyi. Musik dari user (formulir Studio) = `ad.json → music`, master −14 LUFS; tanpa itu −20 LUFS.
- **Audio:** musik/sound bed terus + hit di cut besar, −14 LUFS di MOTION (acuan −20,8). Kit: tick/klik/tap detail +
  bunyi mekanis/digital, subdrop dan ambience rendah, mid jarang. Kit `library/sfx/` (whoosh/hit/thump/tick/pop) jadi titik awal.

## Prinsip susunan (dari starter kit, alasan di baliknya; angka hanya contoh kasus Oakley)

- Penonton mengenali, kehilangan, lalu menemukan lagi produk. Tiap shot harus membawa informasi baru: skala, fokus,
  material, atau sudut. Crop ulang dari foto yang sama bukan shot baru.
- Intensitas bertahap: padat di awal → tenang di kedalaman material → ledakan pendek → end card. FX tidak boleh terus-menerus.
- Grafik menyambung melintasi cut (logo/teks mulai sebelum cut, berganti skala tepat di cut, selesai sesudahnya).
- FX sesuai material: produk organik/halus = threshold hanya aksen 1–5 frame; produk teknis boleh lebih banyak inversi.
- End card: putaran/reveal cepat (±1 s), lalu produk diam menghadap depan dengan scale pelan dan cukup waktu baca
  (±3,5 s). Sisi produk terbaik dipilih sebelum aset dibuat.
- Teks putih mode Difference boleh untuk label di atas gambar, tapi cek di frame terang, gelap, dan abu tengah.

## Yang bisa dan tidak bisa dibuat di MOTION

- Bisa (HyperFrames, $0): ritme cut, pergantian makro/hero, kilatan threshold (filter CSS/SVG), cincin bergerigi (SVG),
  smear, punch-in, tipografi, end card, SFX hit dari `library/sfx/`.
- Butuh aset nyata dari user: foto studio produk (hero di latar polos) dan makro detail, atau footage produk. Klip
  image-to-video dari foto produk = berbayar, dicatat di `costs.md`. Produk tidak boleh dikarang atau digambar ulang AI.

## Keputusan user (2026-11-05, iklan pertama: TRIPPLE TRIANGLE CYCLING CAP)

1. Aset: foto produk dari user (marketplace, watermark dihapus lokal); end card nama + CTA + grafik 11.11 dari user.
2. Durasi ±11 s, tanpa narasi, 30 fps (bawaan MOTION, tidak diubah user).
3. Musik ditambahkan user di aplikasi saat upload; video berisi SFX CC0 Freesound, master −20 LUFS.
4. Teks: label Arial 28-40 px (minimal MOTION 28 px tetap berlaku), di pita aman 168-1330 px.

## Cara pakai di ad.json (register photo)

- `fx, fy` titik foto (px) yang jatuh di layar (540, `sy`); `z0 → z1` zoom (layar px per foto px); `jumps` = lompatan
  hold (punch-in) sebagai ganti zoom halus. Foto 1000 px: zoom > 3 mulai buram.
- `dof` radius area tajam (px foto) + `blur` di luar: makro fokus tipis. Area tajam terlalu kecil di kain polos = dead air.
- `feather` untuk hero produk utuh di atas latar gradasi yang mengikuti cahaya studio foto.
- `mode` threshold / invert untuk kilat 3-5 frame.
- **Geometri kilatan diambil dari logo produk itu sendiri, bukan dari acuan** (user 2026-11-05: cincin bergerigi itu
  berasal dari logo Oakley). Topi Tripple Triangle: `tri` segitiga berlubang, `layout: "stack"` = logo tiga segitiga
  besar, satu segitiga per frame; `"orbit"` = segitiga kecil melingkari produk (3 hold state). Mode Difference supaya
  terbaca di atas produk putih dan latar hitam. Produk lain: `mark` = file logo yang diunggah user (`logo.png`), siluet putih Difference, layout yang sama.
