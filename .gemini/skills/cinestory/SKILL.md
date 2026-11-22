---
name: cinestory
description: Cinematic gaya cerita di TERTORTOR LITE (user 2026-11-22). Setiap gaya Cinematic selain AWS (mis. Sport Strava dan semua gaya baru dari "+ Tambah gaya") membuat video cerita bernarasi vertikal 9:16 dengan alur seperti Berakit ke Hulu: storyline → naskah → tokoh/character sheet → Production (suara + key visual) → klip video → persetujuan musik → editing. Pakai untuk "/cinestory <slug>", event cinestory-new, atau proyek dengan meta.json type "cinestory".
---

# /cinestory <slug>

Jenis proyek `cinestory` (user 2026-11-22): **AWS tetap alur AWS** (`/aws`); **semua gaya Cinematic lain** memakai alur
ini. Mesinnya mesin Storytelling (`tools/musafo.mjs`, state `videos/<slug>/musafo.json`), sama dengan Berakit ke Hulu:
**ikuti langkah 0-6 di `.gemini/skills/musafo/SKILL.md` dan alur di `.gemini/skills/berakit-ke-hulu/SKILL.md`**, dengan
perbedaan di bawah. Agen proyek (Claude atau Antigravity) mengerjakan langkah di bawah. Bahasa jawaban: Indonesia santai.

## Gaya = channel proyek
- `meta.json → channel` = id gaya Cinematic (`cinematic/looks.json`, `engine: "story"`). Gaya dibaca dari:
  1. `cinematic/<gaya>/style.md` (gaya gambar, tokoh, narasi, musik, Hindari) + `cinematic/<gaya>/brief.md` dan `reference/`;
  2. `brand.json → <gaya>` (styleAnchor, clipLook, clipKeep, voice, music) di atas `brand.json → cinestory` (dasar semua gaya);
  3. caption: `presets/<gaya>/` (turunan `presets/musafo`).
- Gaya masih `draft` (style.md berisi "_belum diisi_")? **Desain gayanya dulu** dari brief dan acuan (event `channel-new`
  atau sebelum storyline pertama): isi style.md, tulis blok `brand.json → <gaya>` (styleAnchor ≥ 40 kata dalam bahasa
  Inggris, clipLook, clipKeep, voice.speaker, music), sesuaikan warna/font caption di `presets/<gaya>/preset.json`, lalu
  hapus `draft` dari `cinematic/looks.json`. Tanyakan yang belum jelas ke user.

## Alur per video
1. **Bahan** (event `cinestory-new`): brief/ide/link/teks dari formulir "Buat video" Cinematic → `storyline.md` +
   `hooks.json` (3 pilihan hook + re-hook) **tanpa tahap Draft**, seperti BKH. Lebih dari 2 menit = series.
2. **User mengedit dan menyetujui storyline** di Studio (tab Storyline).
3. **Tokoh** (tab Tokoh, event `characters`): user mengunggah **foto tokoh atau character sheet yang sudah jadi**
   (`assets/reference/tokoh/`).
   - Gambar yang **sudah berupa character sheet** (beberapa sudut/ekspresi satu tokoh) dipakai langsung:
     `node tools/musafo.mjs add <slug> character <id> <file>`.
   - Foto biasa → buat character sheet per usia/tokoh di **Google Flow** (Nano Banana, gratis), seperti § Tokoh di skill
     BKH, dengan styleAnchor gaya ini. `musafo.json → characters[].desc` hanya wajah dan tubuh (baju boleh ganti per shot).
4. **Naskah per shot** (event `storyline-approved`): `musafo.json` → `node tools/musafo.mjs build|check`, lewat `/humanizer`,
   lalu user menyetujui naskah. Narasi bahasa Indonesia, caption Indonesia + Inggris, 9:16.
5. **Production** (tombol Production, event `production`): suara satu take Gemini TTS (speaker dari `request.json` atau
   `brand.json → <gaya>.voice`), build, lalu **key visual** semua shot di **Google Flow** (gratis), 9:16, dengan
   character sheet sebagai acuan wajah. Laporkan; klip menunggu keputusan user.
6. **Klip video**: prompt dari `node tools/musafo.mjs muse <slug> [s01,s02]` (jangan menulis prompt klip sendiri),
   image-to-video di **Meta Muse** lewat muse4ai (`node tools/muse.mjs video`; Flow cadangan; adegan kena review → RunningHub H3). `add <slug> clip …` memotong 0,5 s
   morphing awal klip Muse otomatis. Cek rasio hasil pertama (harus 9:16).
7. **Musik — perlu persetujuan user** (tab Musik di Studio): musik latar dikomposisi otomatis setiap `build`
   (`tools/story-music.mjs`, mood `brand.json → <gaya>.music` di atas `cinestory`). User mendengarkan lalu **Setujui
   musik**, minta **Buat ulang**, atau **mengunggah lagunya sendiri** (dipotong sepanjang video + fade,
   `story-music.mjs --track`, lisensi tanggung jawab user). Persetujuan terikat ke file musik persis: musik berubah =
   persetujuan gugur. **Jangan merender final sebelum musik disetujui.**
8. **Editing / render**: `npm run check` hijau, contact sheet lewat `frame-checker`, thumbnail disimpan; user menekan
   **Setujui & render video** di Studio (ditolak bila musik belum disetujui). Kirim MP4 + caption.

## Event dari Studio
`cinestory-new` (proyek baru → storyline), `characters` (foto/sheet tokoh baru), `storyline-approved` (character sheet bila
ada foto, lalu `series` bila perlu, lalu naskah), `script-approved` (`node tools/script-edit.mjs list <slug>` lalu berhenti),
`production` (suara + key visual). Musik dan render dipicu user di Studio, bukan event.

## Biaya
Meta Muse (muse4ai): catat kuota tiap generate di `costs.md`. Flow: gambar gratis, video kredit dilaporkan. RunningHub: koin dilaporkan.

## Feedback
Setiap koreksi user → satu baris di `.gemini/skills/video-vertikal/LESSONS.md` dengan asal `cinestory/<gaya>/<slug>`.
