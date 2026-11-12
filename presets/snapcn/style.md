# Preset: SNAPCN

Dibangun ulang dari bahasa visual [snapcn](https://github.com/shadcn-labs/snapcn) (registry komponen Remotion bergaya
shadcn untuk video demo produk, 2026-11-06). **Tidak ada kode snapcn yang disalin.** Repo-nya MIT untuk 60 komponen gratis,
tapi komponen Pro (termasuk "Manifesto" di `remotion/`) dilarang diredistribusi sebagai kode, jadi yang diambil di sini hanya
token warna, pilihan huruf, dan karakter gerak yang terbaca dari README, `MOTION.md`, `DESIGN.md`, dan komponen gratis.
Semua scene ditulis sendiri dengan GSAP.

Rasanya: **rapi tapi percaya diri, cepat**. Seperti video peluncuran produk SaaS di media sosial (dirombak 2026-11-06 dari
tiga acuan user: "animasi kamera dan grafisnya kurang dinamis… hook in the first second, distinct beats, social energy,
quick cuts", musik yang setiap cut-nya jatuh di ketukan). Tampilan tetap bersih; energinya datang dari kamera, tempo, dan
kata tunggal, bukan dari efek.

## Tempo dan musik

- **Quick cut:** beat 0,5-1,5 s. Satu kata/frasa pendek per beat (`Fills up.` `Sleep.` `Smart filters.`) diselingi beat
  bukti (kartu video, layar asli) yang lebih panjang.
- **Musik:** setelah `npm run cues`, jalankan `node tools/music.mjs <slug>` (skor otomatis) atau `--track <file>` (lagu
  berlisensi). Setiap cut di-snap ke ketukan, mark ke setengah ketukan. Tandai satu beat `"drop": true` di `beats.json`
  untuk riser + impact (biasanya beat solusi/produk).

## Latar

- `.snap-page`: kertas putih hangat `--ground` (#FAF9F6) dengan grid titik tipis 40 px dan cahaya putih lembut di atas tengah.
  Ini latar default semua scene kecuali footage.
- `.snap-page.night`: versi gelap (#0A0A0B, kartu #141417, garis #26272B). **Maksimal satu beat per video**, untuk
  momen kontras (angka besar, CTA, "sebelum vs sesudah").
- Tidak ada tekstur kertas, grain, gradien warna-warni, atau neon. Pemisah = garis rambut, bukan bayangan tebal.

## Kartu dan chip

- `.snap-card`: putih, garis 2 px `--border` (#D9D9D9), radius 28 px (radius 10 snapcn × skala vertikal), bayangan
  sangat lembut. Satu kartu = satu ide. Isinya ikon garis, angka, atau screenshot.
- `.snap-chip`: pil kecil mono (JetBrains Mono 34 px, abu `--muted`) dengan titik biru bercincin di kiri. Dipakai sebagai
  kicker di atas judul ("langkah 1", "pengaturan", "AI"). Pendek: maks ±22 karakter.

## Tipografi

- Judul: **Poppins 600**, sentence case (bukan kapital), tracking −0.035em, 96–128 px, baris 1.04. Poppins dipilih karena
  geometris (a satu-tingkat), sama seperti yang dikejar komponen snapcn.
- Satu kata kunci boleh biru: bungkus dengan `<em>`. Penekanan kedua: `.snap-hl` (stabilo biru transparan di bawah kata,
  disapu dari kiri lewat `backgroundSize` 0% → 100%; stub type memasangnya otomatis ke kata `<em>` atau kata terakhir).
- Teks pendukung: Inter 500 44 px `--muted` (`.snap-sub`). Angka/menu: JetBrains Mono.
- Caption: Poppins 600 sentence case, pil putih radius 18, kata aktif = kotak biru teks putih.

## Gerak (karakter snapcn, versi GSAP)

| Nama | Isi | GSAP |
| --- | --- | --- |
| word reveal | tiap kata: opacity 0→1, naik 24 px, blur 8→0, stagger 2 frame (0,067 s) | `expo.out` 0,5 s (≈ cubic-bezier .22,1,.36,1) |
| mask wipe | teks/garis dibuka kiri→kanan, cepat di awal, ekor panjang | `clipPath inset(0 100% 0 0)` → `inset(0 0% 0 0)`, `expo.out` 0,45 s |
| card extrude | kartu masuk dari scale 0.92, y 60, blur 10 | `expo.out` 0,6 s, tanpa overshoot |
| settle | semua mendarat dengan sisa jarak yang menyusut tetap tiap frame: **tidak memantul** | `expo.out` / `power4.out`; `back.out` hanya ≤ 1.2 untuk pop kecil (cincin tap) |
| camera drift | seluruh scene mendekat 1.00→1.06 selama beat | `none` |
| **whip** | tiap scene masuk dari samping: x ±300 px + motion blur 18 px → 0 (`DIR` = 1 / -1, selang-seling antar beat) | `expo.out` 0,32 s |
| **word fly** | mode kata (≤ 2 kata, ≤ 14 huruf): kata raksasa (ukuran menyesuaikan kata terpanjang, maks 236 px) terbang dari samping dengan blur 20 px; titik akhir jadi titik aksen yang pop | `expo.out` 0,42 s; titik `back.out(3)` |
| **punch** | di mark: kamera 1 → 1.07 → 1.02 | 0,07 s `power2.out` lalu 0,4 s `expo.out` |
| **flip** | `FLIP = true`: seluruh frame warna aksen, teks `--on-accent`; 1-2 beat per video, di beat drop | — |
| exit | tidak ada exit per elemen; cut bersih ke beat berikutnya (whip beat berikutnya yang membawa gerak) | — |

- Tidak ada getar, glitch, atau gerak dekoratif berulang. Penekanan = punch + stabilo + flip, di ketukan.
- Hero tetap terbaca ≤ 0,3 s: stagger kata dibatasi supaya kata terakhir sudah muncul sebelum 0,35 s.
- Mark `slam` di beat type menyapu stabilo/biru ke kata kunci; mark `tap` di beat screen memunculkan cincin fokus biru
  (gaya `ring` shadcn) dan kursor panah generik.

## Register

- **type**: chip + judul word reveal di kertas bertitik. Bisa `.night` untuk satu beat kontras.
- **screen**: screenshot asli di bingkai ponsel putih bergaris rambut, judul di atas, cincin fokus + kursor di mark `tap`.
  Tetap: jangan pernah menggambar tiruan UI. Placeholder hanya sampai screenshot asli ada.
- **drawn**: satu `.snap-card` besar di tengah berisi ikon garis (stroke ink 6, aksen biru) yang digambar dengan dash, di
  atas grid titik yang mekar dari tengah; label Poppins di bawah kartu.
- **footage**: klip penuh layar, scrim putih tipis di atas, judul di dalam kartu putih (tidak ada teks langsung di atas video).

## Grafik

Ikon garis sederhana (stroke bulat, 6 px pada viewBox 100), satu warna ink + satu detail biru. Tanpa isi warna penuh, tanpa
gradien. Tanpa logo merek.

## Hindari

Gaya default Claude yang diam-diam masuk kalau tidak dilarang. Sebut satu per satu, jangan cuma "hindari tampilan AI".

- **Warna:** gradien ungu-biru atau pelangi, glow/neon, aksen kedua selain biru (merah `--alert` hanya untuk peringatan nyata), latar abu dingin (#F5F5F5 dsb., latar selalu putih hangat).
- **Bentuk:** glassmorphism, kartu dengan bayangan tebal/gelap, garis tepi berwarna, gradient border, sudut berbeda-beda di satu frame (kartu 28, chip pil, ponsel 66).
- **Tipografi:** judul semua kapital, Inter untuk judul (judul selalu Poppins), font tebal 800–900, teks rata kiri-kanan, lebih dari satu kata biru per judul, emoji.
- **Gerak:** `back.out`/elastic > 1.2 kecuali titik aksen, getar, glitch, typewriter huruf per huruf, rotasi 3D, partikel melayang, exit animasi per elemen, loop dekoratif, scene yang masuk tanpa whip (kecuali beat pertama), dua beat berturutan whip dari sisi yang sama, cut yang tidak jatuh di ketukan musik.
- **Grafik:** ikon isi penuh atau berwarna-warni, ilustrasi orang, mockup UI buatan (layar hanya screenshot asli).
- **Batas:** whip 320 ms, kata masuk 420-450 ms dengan stagger ≤ 60 ms (kata terakhir muncul < 350 ms), kartu 550–600 ms, wipe 400 ms, punch ≤ 1.07, drift ≤ 1.06, flip ≤ 2 beat per video.
