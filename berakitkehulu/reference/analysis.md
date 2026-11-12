# Berakit ke Hulu: analisis referensi

Sumber: `video/KAPAL API-H.mp4` (64 s, 1950×1080), `video/LIEM BCA H.mp4` (65 s, 1950×1080), `video/SOSRO-V.mp4`
(60 s, 1080×1920) dan 8 gambar di `gambar/` (thumbnail Kapal Api H/V, adegan Liem, kapal uap, peta dunia). Dibaca dari
contact sheet tiap 3 s, 2026-11-05. Alur produksi sama dengan Musafo; yang berbeda gaya gambar dan isi cerita.

## 1. Cerita
- Kisah asal-usul merek dan pendiri usaha Indonesia (Kapal Api, BCA/Liem, Teh Botol Sosro): anak muda miskin → kerja keras
  di toko/gudang kecil → titik balik (ide, kesempatan, pelayaran) → sukses → produk/merek hari ini di akhir.
- Hook berupa **judul besar di layar** di detik pertama ("LEGENDA AIR TUMPAH", "PENDIRI BANK BERLOGO CENGKEH", "MALU ATAU
  MAJU"), huruf 3D tebal dengan outline, di atas adegan pembuka. Thumbnail memakai judul yang sama + panah dan label kecil.
- Nama tempat sesekali muncul sebagai label di atas gambar (peta: "MADAGASKAR", "ZANZIBAR").

## 2. Gambar
- **Film animasi 3D sinematik** yang lebih detail dan lebih gelap dari Musafo: tokoh karikatural ekspresif (mata besar,
  rambut acak, ekspresi jelas: sedih, kagum, tertawa), tetapi material dan set realistis (karung goni, logam berkarat,
  kayu lapuk, kaleng enamel, debu, uap).
- Latar **Indonesia tempo dulu (1930-1970-an)**: pelabuhan, kapal uap, toko kelontong Tionghoa, gudang kopi/cengkeh, pasar,
  jalan kampung, mobil dan bus lawas, pakaian kemeja lusuh, peci, celemek.
- Cahaya **chiaroscuro**: sumber cahaya praktis kuning-amber (lampu gantung, jendela, api) dan berkas cahaya volumetrik
  melawan bayangan teal-biru; grade agak pudar seperti film lama. Malam: bulan purnama besar, laut bergelombang.
- **Wajah terlihat** dan menjadi pusat emosi (beda dengan Musafo yang menyembunyikan wajah).
- SOSRO-V sedikit lebih realistis (semi-real 3D, warna sepia hangat), Kapal Api dan Liem lebih "Pixar"; keduanya satu keluarga.

## 3. Shot dan gerak
- Sekitar 20 shot per 60 s, **±3 s per shot**; framing berganti terus (wide pelabuhan → medium tokoh → close-up tangan,
  biji kopi, ketel).
- Tiap shot klip image-to-video: rambut dan kain bergerak, uap/asap, ombak, kamera dorong pelan; satu aksi kecil per shot.
- Penutup: produk/merek masa kini (botol, krat, logo) sebagai "hasilnya sekarang".

## 4. Teks di layar
- Judul hook besar di awal (lihat 1). Label nama tempat sesekali. Caption narasi tidak terlihat di contact sheet.

## Gaya untuk prompt (dipakai di `musafo/library/channels.json → berakitkehulu.style`)
- `styleAnchor`: blok gaya di awal tiap prompt gambar (film animasi 3D sinematik, Indonesia tempo dulu, chiaroscuro amber/teal).
- `people`: wajah tokoh terlihat dan ekspresif, pakaian zaman itu.
- `clipLook` / `clipKeep`: gaya dan konsistensi tokoh di prompt H3.
- Ingredients di Flow: 1-3 gambar dari `gambar/` (adegan, bukan thumbnail ber-teks).

## Yang belum diukur
- Kecepatan narasi dan jenis suara belum ditranskrip; asumsi sama dengan Musafo (±140 kata/menit) sampai diukur.
- Judul hook di layar belum ada di alur Musafo (yang ada hanya caption); bila perlu, tambahkan sebagai langkah terpisah.

---

# PRESET2 · lukisan cerah (user 2026-11-08)

Sumber: `gambar/PRESET 2/HRNSgbaaUAEqrKD.jpg` (satu still, 16:9) dan `video/PRESET2/ssstwitter.com_1794104713273.mp4`
(16 s, 1920×1080, 30 fps), dibaca dari contact sheet 1 fps. Gaya awal (3D Pixar yang kasar dan pudar) sekarang PRESET1.
Blok gaya di `brand/brand.json → berakitkehulu.looks.preset2`.

## Gambar
- **Ilustrasi film animasi bergaya lukisan**: still-nya seperti lukisan digital buku cerita (sapuan kuas terlihat, detail
  sangat padat), dan videonya menghidupkan gaya yang sama dengan kedalaman 3D. Wajah lembut dan bulat, ekspresi ramah dan
  gembira (tersenyum, tertawa, melambai).
- **Cahaya**: matahari sore keemasan yang terang, bayangan panjang lembut, rim light di tepi atap dan daun, sinar
  menembus pepohonan. Penutup = matahari terbenam di atas lautan atap.
- **Palet jenuh dan hangat**: oker keemasan, terakota oranye, hijau daun, langit biru cerah dengan awan putih, aksen merah.
  Jauh lebih cerah dan bersih dari PRESET1 (tanpa grain, tanpa kabut gelap).
- **Set**: jalan kota tua yang padat dan hidup: atap genteng terakota, dinding plester oker yang lapuk, jendela kayu, balkon,
  pot bunga, pohon berbunga, lampion, burung beterbangan, jemuran. Banyak wide shot yang memamerkan jalan dan kampungnya.

## Gerak
- Sekitar 6 shot dalam 16 s (±2,5 s per shot). Kamera halus dan melayang: dolly mengikuti motor, crane naik dari jalan ke
  atas atap, tracking di belakang anak yang berlari. Burung yang terbang dipakai sebagai jembatan antar shot.
- Close-up benda di antara wide (roda motor), lalu kerumunan yang melambai, lalu wide penutup dari udara.

## Terjemahan ke BKH
- Acuannya kota tua Vietnam dengan bendera Vietnam. Di BKH: ruko, pasar, dan kampung Indonesia tempo dulu; **tidak ada
  bendera Vietnam atau negara lain**; merah putih hanya bila cerita menyebutnya.
- Kisah susah tetap digambar terang: kesusahan lewat ekspresi, baju lusuh, dan benda, bukan lewat cahaya gelap. Malam =
  lampu minyak hangat di jalan yang tetap penuh detail.
- Ingredients Flow: `gambar/PRESET 2/` (baru satu gambar; tambahkan still dari video bila hasilnya melenceng).
