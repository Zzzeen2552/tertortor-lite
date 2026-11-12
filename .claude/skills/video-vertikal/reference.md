# Mulai dari video referensi

User menempel link TikTok/Reels/Shorts/YouTube atau mengunggah klip dan bilang "bikin yang kayak gini, tapi tentang X".
Referensi itu **inspirasi, bukan cetakan**. Hasil tahap ini: user tahu persis apa yang ditiru, apa yang diubah,
berapa biayanya, dan seperti apa hasilnya dengan alat yang benar-benar kita punya, **sebelum** naskah ditulis.

Bedakan dari "potong/edit video ini". Itu permintaan mengolah footage milik user, bukan referensi.

## 1. Ukur dulu, jangan menebak

```
npm run ref -- <slug> "<link>"      # unduh lewat yt-dlp, lalu analisis
npm run ref -- <slug>               # analisis file yang sudah diunggah di TERTORTOR
```

Studio sudah menjalankannya otomatis saat link ditempel atau file diunggah (`npm run ref -- status <slug>`).
Unduhan gagal (akun privat, perlu login) → minta user mengunggah filenya. Jangan pernah login atas nama user.

Hasil di `assets/reference/`, per video:

| File | Isi | Cara membaca |
| --- | --- | --- |
| `<nama>.ref.md` | durasi, jumlah shot, rata-rata/median shot, cut di 3 detik pertama, kata/menit, kata di 2 detik pertama, jeda, loudness, tabel shot (gerak + ucapan) | baca seluruhnya |
| `<nama>.shots.png` | satu frame tengah per shot, berurutan | lihat: subjek, framing, teks di layar, warna |
| `<nama>.sheet.png` | 1 tile = 1 detik | lihat ritme |
| `<nama>.ref.json` | data yang sama + kata ber-timestamp | kalau butuh angka persis |

**Gerak per shot diukur, bukan ditebak.** `diam` = foto/kartu/teks; `gerak pelan` = pan/zoom pada still atau gerak
kecil; `gerak` = klip video sungguhan. Ini ambang kasar: cocokkan dengan `shots.png` sebelum menyimpulkan.
Kalau mayoritas `gerak`, referensinya dibangun dari footage; di MOTION itu berarti Commons, footage library, atau
generate Flow (mahal, batas 20 s). Kalau mayoritas `diam`/`gerak pelan`, itu bisa dibuat murah di register
`type`/`drawn`/`screen` plus foto Commons dengan zoom.

Mau lebih dalam per shot (prompt, kamera)? Jalankan juga `/reverse-video-v2` pada file yang sama.

## 2. Tulis `assets/reference/analysis.md`

Tafsiranmu, dalam bahasa Indonesia, dengan label tetap (tahap berikutnya membaca label-label ini):

```
# Analisis referensi: <nama>

**Isi:** 2 kalimat tentang apa videonya.
**Gaya:** 1 kalimat: tempo, perlakuan visual, energi.
**Struktur:** N shot dalam X s, pola (hook → … → CTA), di detik berapa tiap bagian.
**Gerak:** N dari M shot klip video / still dengan zoom / kartu diam (dari ref.md).
**Hook:** kata persis di 2 detik pertama + apa yang terlihat. Kenapa membuat orang berhenti scroll.

## 5 aspek (per shot atau per kelompok shot)
- Subjek: siapa/apa, berapa, ciri; pergantian subjek antar shot. Atau "N/A".
- Gerak subjek: aksi berurutan. Atau "N/A".
- Scene: **overlay ditulis terpisah** (teks, grafik, watermark), lalu POV, latar, waktu, dinamika.
- Framing: ukuran shot (ECU/CU/MS/WS), posisi subjek, kedalaman, dan perubahannya.
- Kamera: kecepatan (real-time/slow-mo/timelapse), lensa, tinggi, sudut, fokus, stabil/handheld, gerak.
Tulis "N/A" secara eksplisit. Aspek yang hilang diam-diam adalah kesalahan paling umum.

**Tipografi & warna:** font (serif/sans, tebal), posisi teks, warna dominan (hex kira-kira).
**Audio:** narator (kata/menit dari ref.md), musik ada/tidak, SFX di cut.
**Kenapa berhasil:** 2-3 hal spesifik (teknik hook, tempo, transisi, gaya narasi).

## Jalur alat yang jujur
| Referensi butuh | Kita punya | Catatan |
| --- | --- | --- |
| … | register mana / Commons / library / Flow / screenshot asli | gap & dampaknya |
```

Jangan menjanjikan sesuatu yang tidak bisa dibuat. Contoh gap yang harus disebut: referensi memakai wajah kreator
(kita tidak), referensi memakai UI tiruan (kita wajib screenshot asli), referensi 100% footage sinematik (kita maks
20 s generate, sisanya Commons/library/drawn).

## 3. Riset ringan (2-3 menit)

Sebelum konsep: cari 3-5 video sejenis di topik user (apa yang sudah basi, sudut apa yang segar) dan 3-5 fakta
spesifik untuk topiknya. Jangan tempel hasil riset mentah; masukkan ke konsep ("kebanyakan video X membuka
dengan Y, kita buka dengan Z").

## 4. Tulis `concepts.json` (2-3 konsep, bukan salinan)

```json
{ "concepts": [
  { "id": "A", "title": "Judul kerja",
    "keeps": "yang ditiru: tempo ±1,8 s/shot, hook pertanyaan, teks besar tengah",
    "changes": "yang diubah: topik, sudut pandang, perlakuan visual",
    "hook": "kalimat pertama persis, menaruh penonton di dalam masalah",
    "visual": "campuran register: 3 beat type, 2 screen asli, 1 footage Commons, 1 footage Flow 8 s",
    "audio": "Gemini TTS speaker Koda, ±150 kata/menit, SFX kit, tanpa musik",
    "duration": 45,
    "cost": [ { "item": "Flow 1 generate × 8 s", "usd": 0.4 }, { "item": "Gemini TTS", "usd": 0 }, { "item": "Commons", "usd": 0 } ],
    "honest": "seperti apa hasilnya sebenarnya, termasuk yang tidak bisa ditiru",
    "recommended": true }
] }
```

- Bedakan dengan jelas. Pola: struktur sama topik lain; topik sama sudut lain; nada sama visual lain; versi
  pendek dari video panjang; tandingan ("kenapa AI *tidak* akan mengganti pekerjaanmu").
- Biaya per baris, angka sungguhan dari `costs.md` dan `brand.json`; gambar Flow gratis, Commons gratis, register
  type/drawn/screen gratis. Kalau tidak tahu harganya, tulis perkiraan dan sebut di `honest`.
- Tepat satu `recommended: true`, dengan alasan di `honest`.
- Semua aturan naskah CLAUDE.md tetap berlaku (hook di dalam masalah, ≤ 179 s, satu CTA, angka diucapkan).

`npm run ref -- check <slug>` sampai hijau. Tampilkan ke user ringkas (judul, ditiru, diubah, biaya, rekomendasi),
lalu **berhenti**. User memilih di tab "Konsep" TERTORTOR, atau bilang di chat → `npm run ref -- pick <slug> <id>`.

## 5. Sesudah dipilih

Isi bagian "Diisi Claude" di `brief.md` dari konsep terpilih, lalu lanjut ke naskah (langkah 2 SKILL.md). Tempo
referensi (rata-rata shot, kata/menit) jadi acuan di rencana beat: catat di brief, misalnya "beat 1,8-2,5 s seperti
referensi". Data referensi tetap menjadi acuan sampai render; cocokkan contact sheet akhir dengan `sheet.png`
referensi.

Beberapa referensi: analisis masing-masing, bandingkan ("A kuat di hook, B kuat di tipografi"), dan sebutkan di
setiap konsep elemen mana dari referensi mana.
