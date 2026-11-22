---
name: reverse-video-v2
description: Reverse Video Skill v2 — saat user upload video dan minta analisis, reverse engineering, atau prompt dari video itu, ekstrak semua frame lalu tulis prompt terstruktur (Analisis, Subject, Setting, Shot, Audio) maks 4000 karakter.
---

# Reverse Video Skill v2

Pakai skill ini setiap kali user mengupload video dan meminta analisis, reverse engineering, atau pembuatan prompt dari video tersebut. Jalankan seluruh workflow secara otomatis tanpa perlu konfirmasi dan tanpa menunggu instruksi tambahan dari user.

Kalau user menulis kata **"minimax"**, pakai skill `h3-prompt-writing` untuk format prompt-nya (struktur field MiniMax H3), tapi tetap jalankan langkah 1–4 di bawah untuk analisis video.

## Workflow

### 1. Ekstrak metadata
Pakai ffprobe untuk mengambil durasi, resolusi, FPS, dan aspect ratio.

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,display_aspect_ratio:format=duration \
  -of default=noprint_wrappers=1 "INPUT.mp4"
```

### 2. Ekstrak frame
Tentukan fps sesuai durasi:

| Durasi video | fps ekstraksi |
|---|---|
| Under 10s | 2 |
| 10–30s | 1 |
| Over 30s | 0.5 |

Di proyek MOTION: simpan ke `videos/<slug>/assets/reference/frames_<nama-video>/` (video referensi dari TERTORTOR ada di `assets/reference/`). Di luar MOTION: folder scratchpad sesi.

```bash
REF="videos/<slug>/assets/reference/<video>.mp4"
OUT="videos/<slug>/assets/reference/frames_$(basename "$REF" .mp4)"
mkdir -p "$OUT"
ffmpeg -i "$REF" -vf fps=FPS,scale=540:-2 "$OUT/frame_%03d.jpg"
```

### 3. View SEMUA frame
Buka setiap frame yang diekstrak satu per satu dengan tool Read. Jangan skip satu frame pun.

### 4. Identifikasi struktur video
- Jumlah shot dan timestamp tiap shot
- Format/tipe video (Cinematic, Fashion Lookbook, Outfit Reveal, Reaction Meme, POV, dll)
- Subjek, setting, lighting, camera movement, transisi, efek khusus

### 5. Tulis prompt
Maksimal 4000 karakter, dengan format berikut:

```
---
**Analisis Video:**
[Durasi, format, aspect ratio, jumlah shot, subjek, setting, tipe video]

**Prompt:**

[ASPECT_RATIO], [DURASI]-second [KUALITAS] [TIPE_VIDEO], [STRUKTUR_SHOT], no subtitles, no logos, no text overlays.

**Subject:** [Deskripsi fisik detail — usia, etnis, rambut, wajah, pakaian dengan warna/material/potongan, aksesori, alas kaki]

**Setting:** [Lokasi — interior/eksterior, arsitektur, props, furnitur, pencahayaan, waktu, atmosfer]

**Shot [N] ([TIMESTAMP]):** [Angle kamera + jarak] + [Aksi/pose subjek] + [Detail visual kunci] + [Catatan lighting] + [Gerakan kamera]

[Technical quality tags]: Hyper-real texture, natural physics, lighting style, subtle film grain, depth of field, premium quality, emotional tone.

**Audio:** [Genre musik] + [Ambient sounds] + [Sound effects spesifik] + [Bagaimana audio berkembang]
---
```

Setelah prompt jadi, hitung jumlah karakternya. Kalau lebih dari 4000, padatkan.

## Format khusus

### OUTFIT REVEAL / TRANSITION
- **Fase 1 (Tease):** Deskripsikan gerakan fake-pull berulang yang makin lama makin cepat, ekspresi yang makin intens
- **Fase 2 (Hard Pull):** Tarikan terakhir yang cepat dan tegas sebagai titik transisi
- **Fase 3 (Reveal):** Outfit baru muncul, pose percaya diri, transisi seamless

### REACTION MEME
- **Shot 1:** Setup dramatis yang memuncak tepat sebelum cut
- **Shot 2:** Hard cut ke subjek dengan ekspresi "reaksi", kontras komedi adalah punchline-nya

### FASHION LOOKBOOK
- Dokumentasi setiap shot angle (full-body, 3/4, profil, close-up, wide, selfie, action)
- Deskripsi lighting secara spesifik (window backlight, golden hour, softbox, mixed)

### AI CINEMATIC FANTASY
- **Shot 1:** Detail intim/mikro dari elemen magis
- **Shot 2:** Ekspansi mid-scale, kamera mulai dinamis
- **Shot 3:** Reveal makro penuh, skala dan spektakel maksimum

## Aturan kualitas (selalu)
- JANGAN skip frame apapun
- Deskripsi pakaian harus sangat spesifik (warna, material, potongan, fit)
- Namai setiap gerakan kamera secara eksplisit
- Selalu sertakan bagian Audio
- Beri timestamp untuk setiap shot
- Sesuaikan tone bahasa prompt dengan energi video aslinya

## Di proyek MOTION (TERTORTOR)

Opsional di langkah 1 skill `video-vertikal` (lihat `video-vertikal/reference.md`). `npm run ref` sudah membuat
`<video>.sheet.png` (1 tile = 1 detik), `<video>.shots.png` (satu frame per shot) dan `<video>.ref.md` (shot, gerak,
transkrip); pakai untuk mengecek jumlah shot, tapi tetap buka **semua** frame seperti di atas.

1. Tulis hasil lengkap (Analisis + Prompt, ≤ 4000 karakter) ke `videos/<slug>/assets/reference/analysis.md`.
2. Tambahkan bagian **"Untuk video kita"** di file yang sama: rata-rata panjang shot dan tempo cut, bentuk hook (detik 0-2),
   gaya tipografi/caption, palet, transisi, dan pola audio yang ditiru. Juga tulis eksplisit apa yang **tidak** ditiru:
   isi/klaim video aslinya, orang/wajah yang bisa dikenali, logo, merek, watermark, dan UI aplikasi.
3. Prompt hasil reverse adalah **acuan gaya**, bukan perintah membuat ulang video itu. Saat dipakai untuk `flow.json`,
   aturan footage MOTION menang: wajah tidak teridentifikasi, layar ponsel mati, tanpa teks, tanpa nama alat kamera
   ("tripod", "gimbal"), dan lolos `npm run flow -- check`.
4. Skill `h3-prompt-writing` (format MiniMax) belum terpasang di proyek ini. Bila user menulis "minimax", beri tahu dan
   pakai format standar di atas.
