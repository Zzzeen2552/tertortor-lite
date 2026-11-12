---
name: paket-ide
description: Lima prinsip ide dan kemasan (Paddy Galloway, 2026-11-02) yang diterapkan ke setiap konten MOTION/TERTORTOR. Dipakai di langkah memilih kisah/konsep, menulis storyline + hooks.json, naskah, judul layar, dan caption posting, terutama Storytelling (Musafo, Miracle of Hajj, Berakit ke Hulu) dan juga Video Explainer. Pakai juga saat user bertanya kenapa video sepi atau minta judul/hook/cover yang lebih kuat.
---

# Paket ide: lima prinsip sebelum menulis

Sumber: artikel X Paddy Galloway (@PaddyG96), "5 Principles That Helped Me Generate 50 Billion Views", 2 November 2026
(https://x.com/PaddyG96/status/2117334892375896413). Ia strategis YouTube; angkanya adalah perkiraan dan pengalamannya
sendiri, untuk video panjang dengan judul + thumbnail. Di bawah ini prinsipnya ditulis ulang dan diterjemahkan ke video
vertikal MOTION, di mana "kemasan" = kalimat hook + gambar pertama + judul layar/cover + caption posting.

Skill ini **tidak** menggantikan alur `/musafo`, `/berakit-ke-hulu`, atau `/video-vertikal`. Ia dijalankan di dalam
langkah mereka (lihat "Kapan dipakai"). Kalau ada yang bertentangan dengan CLAUDE.md atau skill alur, aturan proyek
menang (lihat "Konflik").

## Kapan dipakai

| Langkah | Skill alur | Prinsip yang dicek |
| --- | --- | --- |
| Memilih kisah dari bahan / Library Cerita, menulis konsep (`concepts.json`) | semua | 1, 3, 4 |
| `storyline.md` + `hooks.json` | `/musafo`, `/berakit-ke-hulu` | 1-4 |
| Naskah (`musafo.json` / `script.md`) | semua | 2, 4 |
| Judul layar hook (BKH), cover, judul + caption posting | semua | 2, 3 |
| User bilang videonya sepi / "algoritma" | semua | 5 |

## 1. Ide + kemasan = separuh hasil, beri waktu yang sepadan

Galloway memperkirakan ide, judul, dan thumbnail menentukan setidaknya separuh performa video, padahal kreator biasanya
cuma menghabiskan sekitar 5% waktunya di situ. Kliennya membuat 10+ thumbnail per video dan bisa menyaring ratusan ide
untuk satu yang kuat.

Di MOTION teks itu gratis, jadi tidak ada alasan berhemat di sini:
- **Sudut cerita.** Sebelum menulis storyline, tulis minimal **8 sudut** untuk bahan yang sama (dibuka dari mana, tokoh
  siapa yang dipegang, detail apa yang jadi pusat). Untuk Library Cerita: bandingkan kisah juga dari kekuatan kemasannya,
  bukan cuma skornya.
- **Hook.** Tulis minimal **10 calon kalimat hook** lintas jenis (`cold open`, `pertanyaan`, `kutipan`), lalu saring jadi
  tepat 3 untuk `hooks.json` (`checkHooks` mewajibkan tepat 3, beda jenis).
- Simpan daftar panjangnya di `videos/<slug>/paket.md` (berkas kerja, tidak ditunjukkan ke user kecuali diminta; di
  ringkasan cukup satu baris "dari N sudut / N hook, ini 3 terbaik"). Yang disaring: lolos prinsip 2-4 di bawah.

## 2. Uji sekilas (glance test)

Kreator mengira penonton memberi 5 detik untuk membaca kemasan; menurut Galloway yang sebenarnya kira-kira sepersepuluhnya.
Ujinya: bisakah orang asing paham **apa** videonya dan **kenapa harus peduli** dalam kurang dari 1 detik? Kalau tidak,
sederhanakan terus.

Ukuran yang dipakai (dari artikel, disesuaikan ke 9:16):
- **Gambar pertama** (`image` hook / frame 0): 1-3 titik fokus saja. Tokoh/benda utama terbaca dalam 0,3 s (sama dengan
  aturan hero CLAUDE.md). Cek interaksinya: subjek tidak tenggelam di latar, sepertiga bawah tetap kosong untuk caption.
- **Teks di cover / judul layar hook**: ≤ 5 kata (contoh acuan BKH "MALU ATAU MAJU" sudah lolos).
- **Judul posting**: ≤ 60 karakter. Lebih panjang hanya kalau memang perlu.
- **Satu kalimat**: tulis di `paket.md` satu kalimat "video ini tentang ___, dan kamu peduli karena ___". Kalau kalimat
  itu susah ditulis, masalahnya di ide, bukan di polesan.

## 3. Pegang keunggulan yang tidak dimiliki channel lain

Setiap channel punya sesuatu yang tidak bisa diucapkan semua orang. Filter Galloway untuk tiap ide kurang lebih: bisakah
semua orang mengatakan ini? Kalau bisa, itu bukan parit.

Keunggulan MOTION yang boleh diandalkan (semuanya sudah ada di alur, jangan mengarang yang baru):
- **Musafo / Miracle of Hajj**: kisah diambil dari halaman buku yang nyata, dalil dikutip persis dan dicek kata per kata,
  gaya ilustrasi 3D golden hour yang konsisten. Pakai **detail spesifik dari `bahan.md`** (benda, kalimat tokoh, tempat)
  sebagai pusat hook, bukan nasihat umum yang bisa diucapkan akun dakwah mana pun.
- **Berakit ke Hulu**: asal-usul merek Indonesia dari biografi/sejarah, kutipan pendiri yang terverifikasi, latar
  Indonesia tempo dulu yang detail. Hook dari momen spesifik pendirinya, bukan "rahasia sukses" generik.
- **Explainer**: screenshot asli dari device asli, benda asli dari Commons, langkah yang bisa langsung diikuti.

Uji tiap calon hook dan sudut: kalau kalimatnya bisa ditempel di video channel lain tanpa diubah, ganti dengan detail
yang hanya ada di bahan ini.

## 4. Selalu ada taruhannya

Penonton harus merasa ada yang dipertaruhkan supaya mau memberi waktunya. Galloway menyebut dua cara yang bisa dipasang
di topik apa pun: **akibat** (apa bedanya kalau ini terjadi atau tidak) dan **lawan** (siapa/apa yang menghalangi).
Video tanpa taruhan terasa mati.

Di MOTION:
- `storyline.md` menulis satu baris **Taruhan:** apa yang bisa hilang/didapat tokoh, dan kenapa itu menyentuh penonton.
  Taruhan itu sudah terasa di hook atau paling lambat di kalimat kedua.
- Lawan dalam kisah = keadaan, nafsu, rasa takut, kemiskinan, penjajah, pesaing, waktu; **hanya yang ada di bahan**.
- Explainer: taruhannya sudah wajib di aturan hook (penonton di dalam masalah); pastikan akibatnya disebut dengan fakta
  yang benar, bukan dibesar-besarkan.

## 5. Ganti "algoritma" dengan "penonton"

Saran yang Galloway dapat dari orang yang bekerja di algoritma YouTube: setiap kali mau menyalahkan algoritma, ganti
katanya dengan "penonton", biasanya jawabannya ketemu. "Algoritma menghukum video ini" jadi "penonton tidak tertarik";
"algoritma tidak suka cover baru" jadi "penonton tidak mengekliknya".

Saat user bilang video sepi atau minta revisi karena performa:
- Diagnosis dalam bahasa perilaku penonton: berhenti di frame pertama? (prinsip 2, kemasan) Pergi di detik ke berapa?
  (re-hook, taruhan) Tidak paham apa videonya? (satu kalimat di prinsip 2).
- Minta angka retensi dari user bila ada; jangan menebak angka.
- Catat pelajarannya ke `.claude/skills/video-vertikal/LESSONS.md` sebagai perilaku penonton, bukan mitos algoritma.

## Konflik dengan aturan proyek (aturan proyek menang)

- **Fakta tidak dikarang.** Contoh taruhan di artikel memakai angka buatan dan "lawan" ala bank yang menyembunyikan
  sesuatu. Di MOTION: tidak ada angka, tahun, nama, kejadian, ayat, atau hadis yang tidak ada di bahan; tidak ada framing
  konspirasi ("mereka tidak mau kamu tahu") atau musuh yang dibuat-buat. Musafo tidak menjadikan kelompok mana pun musuh.
- **Hook selesai dalam 2 detik / ≤ 12 kata.** Lebih ketat dari uji sekilas di artikel; yang dipakai aturan proyek.
- **Musafo dan BKH: satu video utuh sampai 179 s** (user 2026-11-07), user memendekkannya sendiri. Taruhan dan sudut yang lebih kuat tidak boleh dibeli dengan
  menambah durasi.
- **Tepat 3 hook di `hooks.json`.** Ratusan ide versi artikel diterjemahkan jadi daftar panjang di `paket.md`; user tetap
  hanya memilih dari 3.
- **Thumbnail YouTube ≠ feed vertikal.** Di Reels/TikTok/Shorts video langsung main, jadi "thumbnail" yang paling penting
  adalah gambar pertama + kalimat pertama; cover dan judul posting tetap diuji, tapi sesudahnya.
- **Jangan memalsukan UI dan jangan meniru isi channel lain**, walau "keunggulan" orang lain terlihat menarik.
- Semua teks yang ditunjukkan ke user (sudut, hook, judul, caption) tetap lewat `/humanizer`. Kata jualan ala thumbnail
  ("RAHASIA", "SHOCKING", "pasti") dibuang humanizer; taruhan harus terasa dari isi, bukan dari kata sifat.
