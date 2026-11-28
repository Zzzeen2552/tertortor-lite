# Preset: Spy Titles (siluet 60-an)

Dibuat dari pengamatan film demo "60s Spy Title Sequence" di galeri lemo-opuscar (user 2026-11-23). Yang diambil hanya
**idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan **tidak disalin**. Kode
preset ini ditulis sendiri. Jangan memakai judul, tokoh, atau kredit dari demo itu.

Intinya: **setiap video adalah pembuka film mata-mata yang tidak pernah ada.** Kertas potong datar dengan empat tinta.
Huruf raksasa jadi panggung tempat siluet berjalan, dan setiap hentakan musik jadi cut. Tokohnya selalu siluet tanpa
wajah, jadi cocok untuk kisah yang orangnya harus disamarkan: perselingkuhan, penipuan, kejahatan, rahasia keluarga.
Ini juga gaya utama channel perselingkuhan yang direncanakan user.

## Alur yang cocok
1. **Hook (0-2 s)**: `type`, satu kata raksasa yang jadi inti rahasianya ("RAHASIA", "HOTEL", "STRUK"), siluet
   berjalan di depannya, papan tergantung jatuh di kata kedua. Kalimat pertama menaruh penonton di dalam kejadian.
2. **Kecurigaan**: `drawn`, motif tunggal (lubang kunci + mata, kunci, pintu setengah terbuka, cincin, ponsel tertelungkup).
3. **Bukti**: `footage` lewat lubang (dramatisasi Flow/Muse tanpa wajah jelas, atau foto benda), dan `screen` bila
   memang ada screenshot asli. **Chat dan aplikasi tidak pernah digambar ulang**; kalau tidak ada screenshot asli,
   pakai motif ponsel tertelungkup di `drawn`.
4. **Kejar / konfrontasi**: blok atap (`blocks.html`): bulan, atap merah berjendela kuning, dua siluet berlari.
5. **Penutup**: `type` dengan kata raksasa terakhir + siluet berbalik arah (`data-dir="left"`), papan berisi
   pelajaran atau pertanyaan untuk penonton.

Naskah: kalimat pendek, nada narator film noir, orang kedua di hook. Kisah nyata disamarkan (nama, kota, pekerjaan).
Tidak ada visual seksual atau kekerasan eksplisit: rahasianya ditunjukkan lewat benda (kunci, struk, dua cangkir).

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/spytitles/build.mjs`)
- Bidang: `.sp-world` (hitam) + salah satu `.sp-acc` (aksen), `.sp-red` (merah bata), `.sp-cream` (krem). Selalu tambah
  `.sp-grain`. **Ganti warna bidang tiap beat** (hitam → aksen → krem → merah …), jangan dua beat berurutan sama.
- `.sp-giant`: satu kata League Gothic raksasa, berdiri di atas `.sp-road` (pita hitam di 1120 px, garis putus-putus).
  Huruf di dalam `<em>` = tinta merah. Ukurannya dihitung dari jumlah huruf (maks. delapan).
- `.sp-sign`: papan hitam berbingkai krem tergantung dua tali, Bebas Neue. Untuk kicker / nama peran ("SANG SUAMI").
- `.sp-title` (+ `.ink` di bidang krem): judul League Gothic dengan kata `<em>` merah. `.sp-kick`: label kecil.
- `.sp-sil`: siluet SVG (pria bertopi fedora + trench coat di stub `type`/`footage`, perempuan bertopi lebar di
  `blocks.html`). `.ink` = hitam dengan tepi potong selebar 4 px berwarna bidang (`--cut`) supaya siluet terbaca di
  depan huruf hitam; `.hot` = syal/tas merah = penanda tokoh utama.
- `.sp-cream` punya garis diagonal tipis bawaan. `.sp-hole`: footage di dalam lubang (lingkaran atau lubang kunci), selalu duotone (`.tint` merah, `.tint.acc` aksen).
- `.sp-cone` + `.sp-moon`: lampu sorot. `.sp-roofs`: deret atap merah berjendela aksen. `.sp-slash`: pita diagonal merah.
- `.sp-phone` + `.sp-ring`: ponsel kertas hitam berisi screenshot asli, cincin krem di baris yang dibahas.
- Filter `#<id>-rough` (feTurbulence + displacement) memberi tepi gunting; seed-nya berganti 8 kali per detik (line boil).
- Potongan siap tempel: `presets/spytitles/blocks.html` (perempuan, atap + kejar, lubang kunci untuk footage, sayatan).

## Warna
Empat tinta, datar, tanpa gradien: hitam `#151210`, krem `#F1E6CF`, merah bata `#D9461F` (`--alert`, tetap), dan satu
aksen yang bisa diganti (Color tone: Mustard default, Merah muda, Tosca 60-an, Biru tinta, Krem pucat). Merah dipakai
untuk satu hal per frame: kata kunci, syal tokoh, lubang kunci, atau atap.

## Tipografi
- League Gothic: kata raksasa (dihitung otomatis, ±460-760 px) dan judul 170-210 px, kapital.
- Bebas Neue: papan, label, dan caption. Caption 72 px, pill krem bersudut hampir siku, teks hitam, kata aktif merah,
  maks. tiga kata, di y 1190 (di atas pita jalan). Tanpa bayangan teks.
- Teks tidak pernah miring (`<em>` = warna, bukan italic). Tanpa serif, tanpa huruf tangan.

## Gerak
- **Patah-patah 12 fps**: semua gerak posisi memakai `steps()` (helper `st(detik)`), seperti kertas digeser tangan.
  Satu-satunya gerak halus = push footage di dalam lubang dan push ponsel (`ease: "none"`).
- Masuk: huruf raksasa jatuh 0,12 s `steps(3)`, stagger ≤ 0,03 s; judul naik per kata 0,15 s; motif mendarat 0,14 s.
- Siluet berjalan: kaki/lengan bolak-balik 0,34 s `steps(4)` (yoyo), maju ≤ 150 px/detik; set huruf bergeser
  berlawanan arah 60 px (counter-motion).
- Papan jatuh di mark `slam`: 0,34 s `back.out(2.2)` dari atas, tali ikut. Mata membuka di mark `peek`: 0,17 s, lalu
  melirik (pose ditahan, tanpa tween di antaranya).
- Lubang footage membuka dari lubang jarum 0,2 s `steps(4)`. Cincin layar 0,17 s `steps(3)`.
- **Setiap cut jatuh di ketukan** (`node tools/music.mjs`), SFX preset: `thump` di setiap cut (hentakan brass), `hit`
  di `slam`, `tick` di `peek`, `pop` di `tap`. Musik skor otomatis 100-120 BPM, atau lagu surf/jazz berlisensi.

## Footage
- Dramatisasi (Flow/Muse): orang dari belakang, siluet di pintu, tangan memegang benda, lorong hotel, mobil di malam
  hari; wajah tidak dikenali; layar ponsel mati. `sources.txt`: "AI-generated dramatisation, not a real incident".
- Selalu di dalam `.sp-hole` dengan duotone; tidak pernah full-bleed berwarna asli.

## Hindari
- **Gradien, bayangan lembut, glow, 3D**: semua datar seperti kertas; bayangan hanya offset tegas (ponsel).
- **Gerak halus ala UI**: tween `power`/`back` panjang pada posisi, slide masuk yang mulus, parallax halus. Pakai `steps()`.
- **Wajah, foto orang sungguhan, nama asli** pihak dalam kisah. Tokoh = siluet.
- **Chat/WhatsApp/DM yang digambar** atau di-generate, notifikasi palsu, "screenshot" rekaan.
- **Lebih dari empat tinta** per frame, merah di dua tempat sekaligus, dua beat berurutan dengan bidang sama.
- **Teks**: italic, serif, huruf tangan, kata raksasa lebih dari delapan huruf, papan lebih dari tiga kata.
- **Batas**: huruf jatuh 120 ms, judul 150 ms, motif 140 ms, lubang 200 ms, papan 340 ms, cincin 170 ms; stagger total ≤ 250 ms.
