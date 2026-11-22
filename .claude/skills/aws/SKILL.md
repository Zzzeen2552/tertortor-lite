---
name: aws
description: AWS (Cinematic) di MOTION/TERTORTOR. Video rekap sinematik + motion graphic visualisasi data dari brief klien (contoh: rekap acara klien) - footage asli di-grade, angka besar dihitung naik, funnel, papan Top 20, timeline, kartu logo, teks Thai + subtitle Inggris, master 16:9 + 9:16 + 1:1, plus paket After Effects yang bisa diedit. Pakai untuk "/aws <slug>", event cinematic-new dengan look aws, atau proyek dengan meta.json type "cinematic" look "aws".
---

# AWS

Aturan lengkap: **`cinematic/aws/style.md`** (baca dulu).

**Alur ini hanya untuk gaya AWS** (user 2026-11-22). Gaya Cinematic lain (`engine: "story"` di `cinematic/looks.json`, proyek
`type: "cinestory"`) memakai alur cerita seperti Berakit ke Hulu: skill `/cinestory`. Proyek lama `type: "cinematic"` dengan
`look` selain `aws` (dibuat sebelum 2026-11-22) tetap dikerjakan dengan alur ini.
Engine: `tools/aws.mjs` (build/check/formats), `tools/aws-ae.mjs` (paket After Effects).

## Langkah

1. **Baca brief**: `request.json → idea`, file di `assets/reference/` (docx: buka dengan python zipfile, teks di
   `word/document.xml`). Catat angka, alur per detik, logo, bahasa, format, dan hal yang masih terbuka.
2. **`aws.json`**: `/paket-ide` untuk sudut dan hook (2 detik pertama = orang sungguhan, bukan logo). `data` = setiap angka
   (`value: null` bila TBC, `th`, `en`, `note`, `prefix`/`suffix`), `scenes` mengikuti alur brief (kind open/stat/funnel/
   montage/end, `dur` di kelipatan 0,5 s), slot footage dengan `need` yang jelas untuk klien. Teks Inggris lewat `/humanizer`.
3. `node tools/aws.mjs check <slug>` sampai gerbang lolos; snapshot tiap adegan (`npx hyperframes snapshot videos/<slug>
   --at …`) dan perbaiki tabrakan. Laporkan: daftar slot footage, angka TBC, logo yang kurang, teks Thai perlu dicek native.
4. Saat footage/angka/logo masuk: perbarui `aws.json`, `check`, lalu render (`npm run finish -- <slug> --no-thumbnail`), baca
   `out/contact-sheet.png`.
5. **9:16 + 1:1**: `node tools/aws.mjs formats <slug>` lalu `finish` tiap `<slug>-9x16`/`<slug>-1x1`, cek contact sheet
   masing-masing.
6. **After Effects**: `node tools/aws-ae.mjs <slug>` (dua render ProRes, beberapa menit; jalankan di background) → `out/ae/`.
   Sampaikan font yang perlu dipasang (Kanit, IBM Plex Sans Thai, JetBrains Mono).

Footage dari klien hanya yang tercakup persetujuan PDPA. Jangan mengarang angka, jangan menggambar logo, jangan kirim/publish
tanpa izin eksplisit.
