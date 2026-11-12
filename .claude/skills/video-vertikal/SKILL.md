---
name: video-vertikal
description: Produksi video vertikal 9:16 (Reels/TikTok/Shorts, 30-179 detik) dari ide sampai MP4 dengan HyperFrames di proyek MOTION. Gunakan saat user minta membuat, merevisi, atau me-render video vertikal/explainer pendek, termasuk "buat video tentang X" atau "/video-vertikal <slug>" dari TERTORTOR.
---

# /video-vertikal <slug | topik>

Ikuti `CLAUDE.md` proyek ini (aturan naskah, register, tata letak, gerbang). **Baca `LESSONS.md` di folder skill ini sebelum mulai**: itu feedback user dari video-video sebelumnya, dan menimpa kebiasaan default. Baca juga skill `/hyperframes` (`references/types/vertical.md`, `references/captions.md`) sebelum menulis scene pertama.

## Langkah

Setiap kali berhenti menunggu user (pilih konsep, setujui naskah), jalankan `node tools/wait-event.mjs` di background: klik di TERTORTOR membangunkan sesi (CLAUDE.md § Pemicu dari TERTORTOR).

1. **Brief.**
   - Argumen berupa slug yang sudah ada (dibuat di TERTORTOR, `npm run studio`) → baca `videos/<slug>/brief.md` dan `request.json`. Ide/storyline user adalah sumber utama; lengkapi bagian "Diisi Claude".
   - Argumen berupa topik → `npm run new -- <slug> "<topik>"`, isi `brief.md`.
   - **Video referensi** (`assets/reference/` atau `request.json → refLink`): ikuti **`reference.md`** di folder skill ini. Ringkasnya: `npm run ref -- <slug> [link]` mengukur shot, gerak, transkrip, dan tempo bicara → kamu menulis `assets/reference/analysis.md` (5 aspek + apa yang membuatnya berhasil + jalur alat yang jujur) → tulis 2-3 konsep di `concepts.json`, `npm run ref -- check <slug>` → **berhenti sampai user memilih konsep** (tombol di tab "Konsep" TERTORTOR, atau di chat lalu `npm run ref -- pick <slug> <id>`). Naskah ditulis dari konsep yang dipilih. Tiru tempo, cara buka hook, gaya, dan pola audio; jangan meniru isinya, orang, atau mereknya.
   - **Key visual** (`assets/keyvisuals/`): lihat setiap gambar. Tentukan perannya: first frame footage (Flow *Frames to Video*), gambar yang tampil di scene, atau acuan palet (perbarui variabel warna video bila perlu).
   - **Paket ide**: konsep (`concepts.json`) dan sudut naskah melewati skill **`/paket-ide`** dulu (sudut dan calon hook di `paket.md`, uji sekilas, keunggulan yang tidak bisa diucapkan channel lain, taruhan). Judul + caption posting juga diuji di sana (judul ≤ 60 karakter, teks cover ≤ 5 kata).
2. **Naskah → humanizer → persetujuan.** Tulis `script.md` sesuai target durasi di brief (±150 kata/menit). Kalimat pertama = penonton di dalam masalah. Setiap angka di layar diucapkan. Lalu jalankan skill **`/humanizer`** pada draf (embedded mode: hasilnya hanya teks akhir) dengan catatan naskah lisan di bawah, baca hasilnya keras-keras, dan pastikan tidak ada fakta/angka yang bertambah atau hilang. Tampilkan naskah ke user dan **berhenti sampai disetujui**: user menekan "Setujui naskah" di TERTORTOR, atau bilang setuju di chat (lalu jalankan `npm run flow -- approve <slug>`). Cek dengan `npm run flow -- status <slug>`. User juga bisa mengedit naskahnya sendiri di Studio ("Edit naskah", per paragraf): setiap kali `script-approved` datang, jalankan `node tools/script-edit.mjs list <slug>`; kata-kata user tidak ditulis ulang, hanya diberi catatan bila melanggar aturan (angka tidak diucapkan, > 2:59). Bila suara sudah ada, swap per kalimat yang berubah, lalu `node tools/script-edit.mjs done <slug>`.
   Catatan humanizer untuk naskah lisan bahasa Indonesia (berlaku juga untuk teks di layar dan caption posting):
   - Pola §1 "bukan X, tapi Y" dalam bahasa Indonesia ("bukan sekadar…, tapi…", "ini bukan soal…"). Boleh **hanya** bila bagian "bukan"-nya membantah sesuatu yang memang dipercaya penonton (contoh sah: "Itu bukan undangan. Itu aplikasi palsu.").
   - Penutup dramatis §2: "Ingat itu.", "Camkan baik-baik.", "Simpel, kan?", "Serius." Buang kecuali membawa fakta baru.
   - Pembuka panggung §4: "Jujur ya?", "Dengar baik-baik", "Nah, ini dia", "Faktanya adalah". Langsung ke isinya.
   - Kata AI §12/§16 versi Indonesia: krusial, esensial, signifikan, solusi terbaik, tak tergantikan, era digital, di tengah maraknya, sangat penting untuk. Ganti dengan klaim spesifik.
   - Tanpa tanda pisah (—, –) di naskah: pakai titik atau koma. Juga lebih aman untuk TTS.
   - Yang **tidak** diubah humanizer: kalimat hook di dalam masalah, struktur langkah (nomor → alasan → jalur menu → hasil), angka yang diucapkan, satu CTA. Kalimat pendek yang membawa fakta baru tetap boleh.
2b. **Prompt Google Flow** (langsung setelah naskah disetujui, sebelum suara). Tentukan shot footage dari naskah: hanya momen ancaman / kejadian nyata / yang harus terasa di badan. **Maksimalkan setiap generate sampai 10 s dengan prompt multi-cut** (2-4 hard cut bertimecode yang melayani beberapa beat berurutan, satu dunia), resep di `footage.md` § Prompt Flow. Setelah diunduh: `library add`, lalu `npm run flow -- cut <slug> <shot> <clip>`. Cek library dulu (`npm run library -- search ...`); shot yang sudah ada tidak ditulis ulang. Tulis `videos/<slug>/flow.json` sesuai format di **`footage.md` § Prompt Flow**, lalu `npm run flow -- check <slug>` sampai hijau. Prompt langsung tampil di tab "Prompt Flow" di Studio dengan tombol salin. Lalu tanya user: generate sendiri di Flow, atau Claude yang generate lewat Claude in Chrome (sebutkan jumlah shot dan perkiraan kredit).
3. **Suara.** Sesuai pilihan di brief:
   - rekam sendiri → beri panduan rekaman, lalu `npm run voice -- <slug> --audio <file>` (transkripsi lokal whisper.cpp);
   - ElevenLabs → `npm run voice -- <slug>` (butuh `ELEVENLABS_API_KEY`);
   - nanti → `npm run voice -- <slug> --provider estimate` (timing estimasi, audio bisu) agar visual bisa jalan dulu.
   - **Gemini TTS (default)**: speaker = `request.json → voiceSpeaker` (dipilih user di TERTORTOR, tab Suara), kalau kosong `brand.json → voice.gemini.speaker`; style = `voiceStyle` / `voice.gemini.style`. Lewat Claude in Chrome: buka `brand.json → voice.gemini.page`, "Create new dialog", pilih speaker `voice.gemini.speaker` (belum ada? buat 2-3 sampel kalimat hook dengan suara kandidat, simpan di `voice/samples/`, minta user memilih, lalu catat di brand.json), isi Style dari `voice.gemini.style`, tempel **seluruh naskah sebagai satu blok** (satu take), Run, unduh WAV dari player bar. Lalu `npm run voice -- <slug> --audio "<Downloads>/Generated Audio ….wav" --source gemini-tts`. Pilih elemen lewat `find`/ref, bukan koordinat: panel Speaker settings menutupi tombol Run.
4. **Rencana beat.** Sebelum menulis kode, jawab: *apa yang bergerak di detik pertama?*  Tulis `beats.json`: satu beat tiap 2-5 s (ikuti tempo referensi bila ada), dengan `cue`, `job`, `hero`, `register`, `framing`, `marks`. Tampilkan tabel beat ringkas ke user.
5. **Scene.** Preset `oneTake` (Docucine): tidak ada scene per beat. Tunjukkan **beat table** (waktu → narasi → satu hero → teks layar) dan tunggu persetujuan user, lalu bangun satu `compositions/world.html` (benda + `SHOTS` per beat) menurut `presets/docucine/style.md`, termasuk cek still tiap beat dan urutan frame tiap perjalanan kamera sebelum render. Preset lain: baca dulu `presets/<preset>/style.md` (preset video ada di `meta.json`, lihat CLAUDE.md § Preset gaya) dan desain sesuai aturannya; stub per register juga diambil dari preset itu. `npm run cues -- <slug>` membuat stub per register. Ubah tiap `compositions/<beat>.html` jadi desain sebenarnya: hero terbaca dalam 0,3 s, animasi pada `C.<mark>`, teks di pita 168-1330 px. Cari di registry dulu (`npx hyperframes catalog --json`) sebelum membuat efek sendiri.
6. **Aset.**
   - `screen`: screenshot asli → `assets/screens/<beat>.png`, crop ke baris yang dibahas, tanpa identitas orang lain. Bila user belum memberi, minta dengan daftar layar yang jelas (atau ambil dari emulator Android yang bersih). Catat asalnya di `sources.txt`. **Jangan pernah menggambar atau men-generate UI** untuk mengisi kekosongan.
   - **Benda/tempat/peristiwa nyata** (register apa pun): cari dulu di Wikimedia Commons, `npm run commons -- search "<kata kunci Inggris>" [--type image|video|audio]`, pilih file yang benar-benar menunjukkan benda itu, lalu `npm run commons -- use <slug> <beat> "File:…"` (foto → `assets/commons/<beat>.<ext>`, video → `assets/footage/<beat>.mp4` sudah 1080×1920/30 fps/bisu). Hanya PD/CC0/CC BY; kredit otomatis di `sources.txt` dan `credits.md` (tempel ke caption posting). Di scene, foto Commons boleh di-crop/di-zoom tapi jangan diubah isinya.
   - `footage`: shot-nya sudah ditulis di `flow.json` (langkah 2b). Generate/unduh sesuai **`footage.md`**, masukkan ke library, `library use` ke beat-nya, lalu ubah status shot jadi `library`. Setiap clip baru masuk library.
   - `drawn`/`type`: SVG & CSS, gratis.
6b. **Musik.** `node tools/music.mjs <slug>` (skor otomatis yang men-snap setiap cut ke ketukan) atau `--track <file>` untuk lagu berlisensi dari user. Tandai satu beat solusi/produk `"drop": true`. Video lambat/serius boleh tanpa musik (`--off`).
7. **Gerbang.** `npm run check -- <slug>` sampai hijau. Perbaiki error, timbang tiap warning.
8. **Lihat.** `npm run preview -- <slug>`: baca snapshot tiap beat dan perbaiki yang jelek sebelum user melihatnya.
9. **Render.** Setelah user setuju (atau minta file langsung): `npm run finish -- <slug>`. Baca `out/contact-sheet.png` dan peringatan black-frame. Laporkan path MP4, durasi, loudness, biaya (`costs.md`). Video muncul di tab "Video" TERTORTOR.

## Feedback → skill (wajib)

Setiap kali user mengoreksi atau memberi feedback tentang hasil (warna, tempo, hook, caption, gaya footage, apa pun), dan setiap kali kamu sendiri menemukan masalah lewat snapshot/contact sheet:
1. perbaiki di video itu;
2. tulis aturannya ke `LESSONS.md` (satu baris, bisa langsung dipakai, dengan asal);
3. bila aturannya berlaku umum dan bisa dicek mesin, tambahkan ke `tools/lint-video.mjs` atau ke template di `templates/vertical/scenes/`, dan sebutkan ke user apa yang berubah.

## Revisi

- Ubah satu kalimat: `npm run swap -- <slug> --find "…" --replace "…" --dry-run`, lalu tanpa `--dry-run` (rekaman sendiri: `--audio baris.wav`). Pakai kata-kata user persis, jangan "diperbaiki". Lalu `cues` (re-cue beat yang kata cue-nya hilang), audit beat di kiri-kanannya, `check`, `finish`.
- "Visualnya salah": cek **register** dulu, baru poles. "Hook kurang nendang": biasanya register, bukan polesan.
- "Videonya sepi" / "kena algoritma": diagnosis sebagai perilaku penonton (`/paket-ide` § 5), mulai dari kemasan dan detik penonton pergi.
- Reproduksi keluhan dulu: ambil frame di detik yang dimaksud (`npx hyperframes snapshot --at`) sebelum mengubah apa pun.
- Cue hilang ("cue X not found"): pilih kata baru di `beats.json` untuk beat itu.
- Terlalu panjang: potong satu langkah di naskah, jangan percepat suara.
- Ganti gaya: pilih preset lain di TERTORTOR (atau `meta.json → preset`), lalu `cues`. Warna/font/caption langsung ikut; scene yang sudah didesain perlu didesain ulang untuk gaya penuh. Preset baru: CLAUDE.md § Preset gaya.
