---
name: struktur-babad
description: Struktur cerita BumiDiPijak (BDP) yang disetujui user 2026-11-16 ("struktur ceritanya udah bagus, penonton gampang paham"), dari series Siyungwanara. Kisah babad diceritakan pelan dalam beberapa bagian, hanya dari Babad Tanah Jawa, dan celah tempat babad meloncat diisi narator supaya penonton paham. Pakai setiap menulis storyline.md, hooks.json, atau naskah (musafo.json) BDP, juga kisah babad/hikayat/silsilah lain yang meloncat-loncat.
---

# Struktur cerita babad (BDP)

Dipakai di dalam `/bumidipijak` (langkah storyline dan naskah), sesudah `/paket-ide`. Contoh lengkap:
`videos/siyungwanara-dan-raden-susuruh-membangun/storyline.md` dan `musafo.json` (Bagian 1).

## 1. Satu sumber: babadnya saja
- Hanya Babad Tanah Jawa (teks di `assets/reference/bahan.md` dan Library Cerita). **Tidak dicampur versi lain**: versi
  Sunda, Pararaton, prasasti, tradisi lokal, atau "banyak yang meyakini" (arahan user 2026-11-16: "keduanya gak perlu
  digabung, cukup dari babad tanah jawa saja").
- Yang boleh dari luar hanya **arti istilah** (ajar, patih, karya/cacah, lungguh, paseban) dalam setengah kalimat.

## 2. Pelan, jadi series
- "Jangan buru-buru" (user 2026-11-15). Satu kisah babad dibagi ke beberapa bagian, masing-masing ±70-95 s (BDP > 2 menit =
  series). Satu bagian = satu peristiwa besar, tidak dua.
- Tiap bagian: hook (≤ 12 kata, dari benda/kejadian janggal di babad) → pengingat satu kalimat dari bagian sebelumnya →
  pembuka di tempat kejadian → konflik → titik balik → re-hook (25-70% durasi, sebaiknya di titik balik) → cliffhanger +
  "Bersambung." Bagian terakhir: renungan satu kalimat dari isi kisah itu sendiri + ajakan komentar pendek.
- Bagian 1 dibuka kalimat jembatan dari kisah babad sebelumnya ("Ini halaman berikutnya dari Babad Tanah Jawa. Puluhan
  keturunan setelah …"), tanpa angka waktu yang tidak ada di buku ("berabad-abad" dilarang bila buku tidak menulisnya).

## 3. Isi celah tempat babad meloncat
Babad sering melompat: tokoh muncul tanpa dikenalkan, istilah tidak dijelaskan, dua kejadian yang berhubungan dipisah
berparagraf-paragraf, alasan tidak ditulis. Sebelum naskah, baca alur asli butir demi butir dan tanyakan "di mana penonton
akan bingung?", lalu tulis tabel **`## Celah yang diisi`** di storyline:

| Celah | Bagian | Babad meloncat di mana | Cara mengisinya (diucapkan narator) | Dasar (¶ buku / istilah) |

Cara mengisi, urut dari yang paling aman:
1. **Kenalkan tokoh lebih awal dari silsilah.** Tokoh yang baru berperan di bagian 5 disebut di bagian 1 ("Ingat nama
   Susuruh."). Penonton tidak bertanya "siapa dia?" saat ia muncul.
2. **Hubungkan dua kejadian yang berjauhan** dengan paragraf buku yang sama: ramalan A dan ramalan B, bayi yang dibuang dan
   pemuda yang kembali, "raja Pajajaran" yang ternyata tokoh yang sudah kita kenal.
3. **Sebut hubungan keluarga yang tersirat** di babad (saudara satu ayah, nenek buyut), dan bahwa tokohnya tidak tahu.
4. **Jelaskan istilah** setengah kalimat ("seorang ajar, pertapa gunung"; "patih, tangan kanan raja").
5. **Bila babad diam soal alasan**, narator mengatakannya ("Babad tidak menulis alasannya."), lalu boleh satu dugaan yang
   diturunkan dari urutan kejadian di babad sendiri, selalu dengan penanda "mungkin": "Raja sudah telanjur menertawakannya,
   lalu terbukti salah, di depan patih dan selirnya sendiri. Mungkin ia malu." Tidak pernah alasan yang dikarang tanpa dasar.
6. **Bila babad tidak menceritakan nasib tokoh**, narator tidak menambahkan apa pun (tidak ada adegan mati/tenggelam).

## 4. Kalimat narator yang membuat penonton paham
- "Ingat nama …" untuk tokoh yang akan kembali; "simpan janji ini" untuk ramalan/janji yang dibayar di bagian lain.
- Dramatic irony yang memang ada di babad: "Waktu itu belum ada seorang pun bernama Siyungwanara." / "Raja tidak tahu siapa
  yang ia angkat jadi anak."
- Kutipan tokoh dari buku diucapkan utuh dalam tanda kutip, tidak diringkas.
- Satu ide per kalimat, kalimat 3 kata dicampur kalimat 12-15 kata, register dalang (tenang, berwibawa, ada jeda).

## 5. Catat di storyline
- `## Alur asli` (butir bernomor dengan ¶ buku), `## Storyline` per `## Bagian k`, `## Celah yang diisi`,
  `## Beda dari alur asli` (setiap kalimat narator yang tidak ada di buku disebut di sini), `## Tokoh`, `## Dari bahan /
  tambahan`. Bahan dari luar yang ditolak user dicatat di "Tidak dipakai".
- Naskah (`musafo.json`) mengikuti storyline butir demi butir; pengisi celah masuk di tempat yang ditandai tabel.
