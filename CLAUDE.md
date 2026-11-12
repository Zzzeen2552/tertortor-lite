# TERTORTOR LITE — mesin video vertikal versi ramping (Claude Code + HyperFrames)

Duplikat ramping dari MOTION (`Documents/MOTION`), dibuat 2026-11-12. Folder, git, Studio, dan antrean event-nya
**terpisah total** dari MOTION: jangan menyalin balik ke MOTION, jangan menyentuh `.events.jsonl` MOTION. Studio LITE
dijalankan **lokal** di tiap komputer; repo GitHub hanya untuk memasangnya di komputer lain (README). **Tidak ada web
app/relay** (user 2026-11-12): jangan deploy apa pun dan jangan menyentuh VPS.

Pabrik video 9:16 (1080×1920, 30 fps, 30–179 s). Prinsipnya: **AI menulis kode, bukan piksel.** Video adalah HTML +
timeline GSAP yang dirender HyperFrames ke MP4. Uang hanya dikeluarkan untuk suara dan beberapa detik footage/klip.

Skill resmi HyperFrames (`/hyperframes`, `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`) ada di
`~/.claude/skills` dan menjadi acuan format komposisi; aturan di file ini menimpa default mereka (selalu 1080×1920).
Default `media-use` (HeyGen, katalog musik/stok) tidak berlaku: suara Gemini TTS, SFX dari `library/sfx/`, biaya di `costs.md`.
HyperFrames dipin di `package.json` (0.9.15). `npx hyperframes render videos/<slug> --start <s> --end <s> -o …` merender satu potongan.

## Isi LITE

| Kategori | `type` | Sub | Isi |
| --- | --- | --- | --- |
| **Video Explainer** | (kosong) | preset `presets/<id>` | **Hyperframe** (default, `brand.json → defaultPreset`), **VOX** (kolase kertas + adegan berlapis, `presets/vox/style.md`), **SNAPCN** |
| **Storytelling** | `berakitkehulu` / `bumidipijak` | channel `musafo/library/channels.json` | **Berakit ke Hulu** (BKH), **BumiDiPijak** (BDP) |
| **Advertisement** | `advertisement` | product `advertisement/products.json` | **Flashcut**, **BRI** (`form: "kv"`), **App Demo** (`form: "appdemo"`) |

Tidak ada di LITE: preset explainer lain (Kolase, Berkas, Docucine), channel Musafo dan Miracle of Hajj, kategori
Cinematic, Cinema Clone, Animation, dan City timelapse/stok Adobe (STOKER). Bila user memintanya, arahkan ke MOTION.

**Mesin bersama Storytelling.** BKH dan BDP memakai engine Musafo: `tools/musafo.mjs` (state `musafo.json`), blok dasar
`brand.json → musafo` (suara, klip, caption), preset `presets/musafo` (caption BKH), dan langkah teknis 0–6 di skill
`/musafo`. Di LITE skill `/musafo` hanya manual teknis engine itu; jangan membuat proyek `type: "musafo"`.

## Pintu masuk: Studio LITE

`npm run studio` → **http://localhost:4331** (MOTION memakai 4321; keduanya boleh jalan bersamaan).
"Buat video" memilih kategori, lalu sub (`#/baru/<kategori>/<sub>`), lalu formulirnya; Studio membuat `videos/<slug>/`
dan menampilkan perintah untuk Claude. Ruang Produksi dan sidebar mengelompokkan video per kategori. Pohon kategori dari
`tools/categories.mjs` (`/api/structure`). Halaman `#/s/<kategori>/<sub>` punya tab Video, Library footage, dan
(Storytelling) Library cerita. Footage: `npm run library -- add … --for <kategori>/<sub>` (selalu isi `--for`).

**Video referensi** dianalisis `npm run ref` (yt-dlp, shot, gerak, transkrip). Claude menulis `analysis.md` dan 2-3 konsep
di `concepts.json`; user memilih di tab "Konsep" sebelum naskah. Alurnya di `.claude/skills/video-vertikal/reference.md`.

**Watermark, thumbnail** (semua kategori):
- **Watermark**: `<subDir>/logo.png` per channel/preset/product, kiri atas tiap video (`tools/brandmark.mjs`, `brand.json → watermark`).
  Matikan per video: `meta.json → watermark: false`.
- **Thumbnail**: `node tools/thumbnail.mjs options|render|auto <slug>`, `out/thumbnail.png`, 0,3 s di depan video
  (`thumbnail.json → cover: false` mematikannya). Judul tiap kata huruf kapital. Jangan render video sebelum user
  menyetujui thumbnail lewat tombol **Setujui & render video** di tab Thumbnail.
- **Cover gaya**: `<subDir>/cover.jpg`, `node tools/sub-covers.mjs [--force|<sub>]`, tidak pernah dari media acuan pihak ketiga.
- **Hapus video**: dipindah ke `videos/.trash/`, dipulihkan dari menu **Sampah**. Claude tidak menghapus video user tanpa izin.
- **Bagikan, Buffer, undangan user, Web Push** butuh relay web, yang tidak dipakai di LITE. Kodenya masih ada; jangan
  menyiapkan relay tanpa permintaan user. Claude tidak pernah mengisi key dan tidak mengirim/memublikasikan tanpa izin.

**Pop-up proses**: klik setujui memunculkan apa yang Claude kerjakan dan perkiraan waktunya (`tools/progress.mjs`,
`.process-times.json`). Langkah baru yang dipicu klik → tambahkan ke `PROCESSES` di `tools/progress.mjs`.

**Pemicu dari Studio.** Klik user ditulis ke `.events.jsonl` **di folder LITE ini**. Setiap kali sesi menunggu keputusan
user, jalankan `node tools/wait-event.mjs` di background (run_in_background); saat bangun, tangani tiap event lalu jalankan
lagi penunggunya. Timeout (4 jam, exit 2) = jalankan lagi bila masih menunggu.

| Event | Lanjutkan |
| --- | --- |
| `concept` (explainer) | isi brief dari konsep → naskah → `/humanizer` → minta persetujuan |
| `script-approved` (explainer) | `flow.json` (langkah 2b) |
| `berakitkehulu-new` | skill `/berakit-ke-hulu <slug>`: tanpa draft, langsung `storyline.md` (series bila > 2 menit) → user mengedit dan menyetujui storyline |
| `bumidipijak-new` | skill `/bumidipijak <slug>`: tanpa draft, langsung `storyline.md` series → user mengedit dan menyetujui storyline |
| `storyline-approved` (BKH/BDP) | BKH: character sheet per usia bila ada foto tokoh; `series` bila perlu; `musafo.json` (naskah per shot) → build → minta persetujuan naskah |
| `script-approved` (BKH/BDP) | `node tools/script-edit.mjs list <slug>`, lalu berhenti: suara dan gambar menunggu tombol Production |
| `production` (BKH/BDP) | 1. suara Gemini TTS satu take, 2. key visual per shot, lalu laporkan; klip menunggu keputusan user |
| `characters` (BKH) | foto tokoh baru di tab Tokoh: buat/ulang character sheet usia yang terdampak, laporkan |
| `channel-new` (sub baru, `category` + `dir`) | baca `<dir>/brief.md` + `<dir>/reference/`, tanya user yang belum jelas, desain sub itu, hapus `draft` |
| `ad-new` (advertisement) | `flashcut`: skill `/flashcut <slug>` (`ad.json` → `node tools/ad.mjs check` → `finish`). `bri`: `advertisement/bri/style.md`. `appdemo`: `advertisement/appdemo/style.md` (`node tools/appdemo.mjs info|check`, `finish --no-thumbnail`). Selalu baca contact sheet, kirim MP4, minta persetujuan |

**Edit naskah dari Studio** (tab Naskah): Studio menulis `musafo.json`/`script.md`, persetujuan lama gugur, log di
`script-edits.json`. Setiap `script-approved`: `node tools/script-edit.mjs list <slug>` dulu. Kata-kata user tidak ditulis
ulang; bila suara sudah ada, kalimat yang berubah dibuat ulang lewat `npm run swap`, lalu `node tools/script-edit.mjs done <slug>`.
Caption Inggris kosong diterjemahkan otomatis (`autoEn`): periksa ejaan nama dan istilahnya.

Footage generate disimpan sekali di `library/` lalu dipakai ulang (`npm run library -- search|use|add|export`). Stok gratis
berlisensi lewat `npm run stock` (lisensi non-komersial ditolak, kredit ke `credits.md`). Feedback user dicatat ke
`.claude/skills/video-vertikal/LESSONS.md`.

**Chat Claude di Studio** (user 2026-11-13): tombol bulat kanan bawah membuka laci chat. Tiap pesan menjalankan Claude Code
headless di folder ini (`tools/studio-chat.mjs`: `claude -p --output-format stream-json`, lanjut dengan `--resume`, satu
proses sekaligus, pesan berikutnya antre), riwayat di `.studio-chat.json` (gitignored; "Baru" mengarsipkan ke `.studio-chat/`).
Konteks halaman (slug video, tab) ikut di awal pesan. Tanpa jendela izin, jadi alatnya dibatasi: edit file (acceptEdits),
baca/cari, `npm run`, `node tools/`, `npx hyperframes`, git hanya baca; commit/push/`buffer.mjs send`/publish/`wait-event`
ditolak. Butuh Claude Code CLI terpasang dan sudah login di PC ini (`claude --version`). Route `/api/chat*` hanya dari localhost.

## Jenis proyek

- **Kerangka** (`"draft": true`) tampil sebagai "belum didesain" dan tidak bisa membuat proyek. Jangan diisi warna, font,
  atau alur tebakan: tunggu acuan dianalisis (`npm run ref` + `/reverse-video-v2`) dan keputusan user.
- **Tambah sub baru dari Studio** (`#/tambah/<kategori>`): draft di `presets/<id>/`, `musafo/channels/<id>/`, atau
  `advertisement/<id>/` berisi `brief.md` (kata-kata user, jangan diubah) + `reference/`, plus event `channel-new`.
- **Video explainer** (default): alur di bawah, skill `/video-vertikal`.
- **Berakit ke Hulu** (BKH, `type: "berakitkehulu"`): kisah asal-usul merek dan pendiri usaha Indonesia. Engine Musafo,
  **lebih dari 2 menit = series** (`berakitkehulu.maxSeconds` 120), selalu 10 shot dan ditutup pencapaian merek hari ini.
  Gaya film animasi 3D Indonesia tempo dulu, wajah tokoh terlihat; dua look (`meta.json → look`, `node tools/musafo.mjs look
  <slug> <id>`): PRESET1 3D Pixar, **PRESET2 3D cerah ala tanah liat (default)**, blok gaya di `brand.json → berakitkehulu.looks`.
  Formulir menerima link artikel (`assets/reference/bahan.md`) dan foto tokoh (`assets/reference/tokoh/`) → character sheet
  per usia (`musafo.json → characters`). Prompt gambar: skill `/berakitkehulu-prompt` (selalu 9:16). Tidak ada fakta, angka,
  atau tahun yang dikarang; logo merek asli hanya ditempel di shot penutup. Skill `/berakit-ke-hulu`.
- **BumiDiPijak** (BDP, `type: "bumidipijak"`): sejarah dan legenda Jawa dari Babad Tanah Jawa (Library Cerita BDP).
  Engine Musafo, **lebih dari 2 menit = series**, preset `presets/bumidipijak` (Merriweather, Inggris italic terakota), suara
  default **Kira**, gaya lukisan minyak gelap (`brand.json → bumidipijak`), isi adegan dari `/babad-tanah-jawa-prompt`
  (selalu 9:16). Skill `/bumidipijak`.
- Library Cerita (`npm run stories`): PDF/link/teks → Gemini mencatat tiap kisah → "Jadikan video".
- **Advertisement** (`type: "advertisement"`, tanpa narasi, timing per shot dalam detik di `ad.json`):
  - **Flashcut** (`/flashcut`, `tools/ad.mjs`): foto produk ≥ 2 angle, logo, model/CTA opsional → ±11 s, kilatan dari logo
    produk sendiri. Aturan: ≤ 15 s, produk utuh sebelum 2 s, end card ≥ 1,8 s, semua aset di `sources.txt`. Produk tidak
    boleh digambar ulang AI; klaim hanya yang terlihat di foto atau dari user.
  - **BRI** (`advertisement/bri/style.md`, preset `presets/bri`): iklan promo ±13 s dari KV klien, judul kinetik di belakang
    orang, angka promo odometer, end frame persis KV dengan logo asli (`advertisement/bri/kit/`).
  - **App Demo** (`advertisement/appdemo/style.md`, `tools/appdemo.mjs`, preset `presets/appdemo`): demo aplikasi dari
    **screenshot UI asli** (crop, tidak pernah digambar ulang), headline Lora, shade biru BRI, musik + SFX dari kode, $0.
- Agen `runninghub-operator` dan `frame-checker` (`.claude/agents/`) menghemat token untuk RunningHub dan pengecekan frame.

## Alur video explainer (satu video = satu folder `videos/<slug>/`)

| # | Langkah | Perintah | Hasil |
| --- | --- | --- | --- |
| 1 | Brief | `npm run new -- <slug> "Topik" [--preset vox]` | `brief.md`, `script.md`, `beats.json`, `index.html` |
| 2 | Naskah lisan → **disetujui user** | `script.md`; user klik "Setujui naskah" (atau `npm run flow -- approve <slug>`) | ±150 kata/menit |
| 2b | Prompt Google Flow | `flow.json`, `npm run flow -- check <slug>` | generate ≤ 10 s, multi-cut; setelah unduh: `npm run flow -- cut` |
| 3 | Suara + timestamp kata | Gemini TTS → `npm run voice -- <slug> --audio <wav> --source gemini-tts` | **satu take** → `voice.wav` + `words.json` |
| 4 | Rencana beat | `beats.json` | job, hero, register, framing, cue kata |
| 5 | Scene | `npm run cues -- <slug>` lalu edit `compositions/<beat>.html` | stub per register + SFX otomatis |
| 6 | Gerbang | `npm run check -- <slug>` | cues → lint retensi → `hyperframes check` |
| 7 | Lihat | `npm run preview -- <slug>` | snapshot tiap beat |
| 8 | Render + finishing | `npm run finish -- <slug>` | `out/<slug>.mp4` −14 LUFS, `out/contact-sheet.png` |

Revisi satu kalimat = `npm run swap -- <slug> --find "lama" --replace "baru" --dry-run`, lalu tanpa `--dry-run`, lalu
`cues` → `check` → `finish`. Jangan pernah membuat suara per paragraf/per scene, jangan rekam ulang seluruh naskah untuk
satu kalimat, jangan pernah mempercepat audio.

## Aturan naskah

- Kalimat pertama menaruh penonton **di dalam masalah**; hook selesai dalam 2 detik. Tidak ada "di video ini", logo, atau maskot di 2 detik pertama.
- Janji N di hook = N dibayar di isi. 3–4 langkah bernomor, satu CTA.
- Tulis untuk telinga, campur kalimat pendek dan panjang. Jangan pernah mengarang angka.
- **Paket ide dulu**: skill `/paket-ide` sebelum storyline/konsep/naskah.
- Setiap naskah, teks layar, dan caption posting lewat `/humanizer` sebelum ditunjukkan ke user.
- **Setiap angka di layar harus diucapkan.** Batas keras 2:59. Bahasa Indonesia lisan, orang kedua.

## Rencana beat (`beats.json`)

```json
{ "id": "step1", "cue": "langkah satu", "job": "langkah 1: aktifkan X", "hero": "toggle X",
  "register": "screen", "framing": "medium", "character": false,
  "marks": { "tap": "aktifkan", "slam": "hilang+0.3" } }
```

- `cue` dicari setelah cue sebelumnya; tidak pernah detik manual. `marks` → `C.tap`, `C.slam`, `C.dur` di scene.
- Satu hero per beat. Dua beat berurutan dengan register+framing sama = gagal.

## Register

| Beat berisi | Register | Biaya |
| --- | --- | --- |
| Tempat, objek, peristiwa nyata yang spesifik | foto/klip **Wikimedia Commons** (PD, CC0, CC BY; `npm run commons`) | $0 |
| Ancaman, kejadian nyata | `footage` (fotoreal generated, total ≤ 20 s) | ±$0,10–0,40/shot |
| Aplikasi, setting, layar | `screen` (screenshot asli, crop) | $0 |
| Perasaan, konsep | `drawn` (SVG) | $0 |
| Kalimat kunci / angka | `type` (kinetic type) | $0 |

**Jangan pernah memalsukan UI.** Screenshot asli, atau tidak ada layar sama sekali; di footage layar ponsel selalu mati.
**Asal-usul tercatat** di `videos/<slug>/sources.txt` (footage AI: "AI-generated dramatisation, not a real incident").
Biaya di `costs.md`. Footage dinormalkan lewat `node tools/prep-footage.mjs` (otomatis lewat `library use`).

## Suara, SFX, musik

- Default **Gemini TTS** (Google AI Studio, satu blok naskah, speaker dari tab Suara → `request.json → voiceSpeaker`,
  cadangan `brand.json → voice.gemini.speaker`). Sampel: `node tools/voice-samples.mjs` (`library/voices/`).
- Alternatif ElevenLabs (`ELEVENLABS_API_KEY`), atau rekaman sendiri `npm run voice -- <slug> --audio rekaman.wav`.
  Transkripsi lokal memakai whisper.cpp di `tools/bin/whisper/` (tidak ikut git).
- SFX otomatis dari `library/sfx/` (dibuat dari matematika: `node tools/sfx.mjs`).
- Musik di ketukan: `node tools/music.mjs <slug>` setelah `cues` (skor otomatis, `--track <file>`, `--off`).

## Preset gaya (`presets/<id>/`)

`preset.json` (warna, font, captions, css, fontFaces, tones), `style.md` (**wajib dibaca sebelum mendesain scene**),
`scenes/<register>.html`. Scene tidak pernah menulis hex aksen: pakai `var(--accent)`, `var(--on-accent)`, `ACC`/`ON`.

## Tata letak 9:16

- 0–168 px kosong. Teks & produk di pita **168–1330 px**; di bawahnya hanya tekstur.
- Caption terbakar y≈1180, maks 3 kata/grup. Teks ≥ 28 px; judul ≥ 72 px.

## Aturan teknis HyperFrames

- Scene = `compositions/<beat>.html` di `<template>`, root `#root` dengan `data-composition-id` = id beat. Prefiks id dengan id beat.
- Satu timeline paused per scene di `window.__timelines["<id>"]`. `fromTo`, bukan `from`.
- Tidak ada `Date.now()`, `Math.random()`, fetch, timer, `repeat: -1`; jangan tween `display`/`visibility`.
- `index.html` dan `captions.html` dikelola tool. Warna/font hanya lewat variabel CSS preset.

## Gerbang

`npm run check` wajib hijau sebelum render. Setelah render, **baca `out/contact-sheet.png`** dan peringatan black-frame.
Render sukses tidak membuktikan apa-apa.

## Jangan

- Jangan generate footage untuk layar aplikasi, konsep, atau teks; jangan menggambar tiruan UI.
- Jangan menampilkan identitas orang lain di screenshot.
- Jangan mempercepat suara. Jangan menyerahkan video tanpa melihat contact sheet.
- Jangan mem-publish atau mengunggah ke platform tanpa izin eksplisit.
- Jangan memasukkan rahasia (API key, token, password) ke repo; `.env` dan `.buffer-keys.json` gitignored.
