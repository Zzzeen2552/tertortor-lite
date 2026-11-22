# TERTORTOR LITE — mesin video vertikal versi ramping (Antigravity + HyperFrames)

Duplikat ramping dari MOTION (`Documents/MOTION`), dioptimalkan untuk **Google Antigravity**. Folder, git, Studio, dan antrean event-nya
**terpisah total** dari MOTION: jangan menyalin balik ke MOTION, jangan menyentuh `.events.jsonl` MOTION. Studio LITE
dijalankan **lokal** di tiap komputer; repo GitHub hanya untuk memasangnya di komputer lain (README). **Tidak ada web
app/relay**: jangan deploy apa pun dan jangan menyentuh VPS.

Pabrik video 9:16 (1080×1920, 30 fps, 30–179 s). Prinsipnya: **AI menulis kode, bukan piksel.** Video adalah HTML +
timeline GSAP yang dirender HyperFrames ke MP4. Uang hanya dikeluarkan untuk suara dan beberapa detik footage/klip.

Skill resmi HyperFrames (`/hyperframes`, `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`) dan skill proyek TERTORTOR
ada di `.gemini/skills/` (dan `~/.claude/skills/`) dan menjadi acuan format komposisi; aturan di file ini menimpa default mereka (selalu 1080×1920).
Default `media-use` (HeyGen, katalog musik/stok) tidak berlaku: suara Gemini TTS, SFX dari `library/sfx/`, biaya di `costs.md`.
HyperFrames dipin di `package.json` (0.9.15). `npx hyperframes render videos/<slug> --start <s> --end <s> -o …` merender satu potongan.

## Isi LITE

| Kategori | `type` | Sub | Isi |
| --- | --- | --- | --- |
| **Video Explainer** | (kosong) | preset `presets/<id>` | **Hyperframe** (default, `brand.json → defaultPreset`), **VOX** (kolase kertas + adegan berlapis, `presets/vox/style.md`), **SNAPCN** |
| **Storytelling** | `berakitkehulu` / `bumidipijak` | channel `musafo/library/channels.json` | **Berakit ke Hulu** (BKH), **BumiDiPijak** (BDP) |
| **Advertisement** | `advertisement` | product `advertisement/products.json` | **Flashcut**, **BRI** (`form: "kv"`), **App Demo** (`form: "appdemo"`) |
| **Cinematic** | `cinematic` (AWS) / `cinestory` (gaya lain) | gaya (`look`) `cinematic/looks.json` | **AWS = alur AWS; setiap gaya lain = alur cerita** (user 2026-11-22, menggantikan "semua gaya alur AWS" 2026-11-21): gaya dengan `engine: "story"` membuat proyek **`cinestory`** (channel = id gaya) yang dikerjakan seperti Berakit ke Hulu: storyline → naskah bernarasi → tokoh (foto atau character sheet) → Production (suara + key visual) → klip → **persetujuan musik** (tab Musik) → editing, **vertikal 9:16**, skill **`/cinestory`**. "+ Tambah gaya" membuat `presets/<look>/` (turunan `presets/musafo`, caption), `cinematic/<look>/style.md` (template alur cerita) dan entri `looks.json` (`engine: "story"`, `draft: true` sampai gayanya didesain dari `brief.md`, event `channel-new`). Sport Strava sudah dipindah ke alur cerita. Gaya AWS: **AWS** (skill `/aws`, engine `tools/aws.mjs`, aturan `cinematic/aws/style.md`, preset `presets/aws`): rekap sinematik + motion graphic **visualisasi data** dari brief klien (rekap acara klien): **footage asli** klien di-grade lewat `media-treatment`, angka besar dihitung naik, funnel, titik/kurva, papan Top 20, timeline, kartu logo; teks **Thai + Inggris** (font OFL Inter + IBM Plex Sans Thai, `unicode-range` di `fontFaces`) + `out/<slug>.en.srt`; tanpa narasi, HyperFrames. `aws.json` → satu `compositions/film.html`; slot footage kosong = slate berlabel, angka `null` = kotak TBC (animatic sebelum bahan klien datang). **Master 16:9 + 9:16 + 1:1** dari data yang sama (`node tools/aws.mjs formats <slug>` → proyek `<slug>-9x16`/`-1x1`). **Paket After Effects** (`node tools/aws-ae.mjs <slug>` → `out/ae/`: plate ProRes 422 HQ, grafis alpha ProRes 4444, stem audio, `.jsx` dengan setiap teks dan angka sebagai text layer yang bisa diedit). Tab **AWS** di editor: angka/TBC, unggah footage per slot (`upload?kind=footage&slot=<adegan>:<n>`), logo, lagu, tombol Render / 9:16 + 1:1 / Paket After Effects (`/api/videos/<slug>/aws-render|formats|ae`). Formulir `#/baru/cinematic/aws`. File Amazon Ember berlisensi hanya di laptop (`presets/aws/fonts/ember/`), **tidak pernah di-commit** (repo publik); begitu juga footage, logo, musik, dan brief klien. |

Tidak ada di LITE: preset explainer lain (Kolase, Berkas, Docucine), channel Musafo dan Miracle of Hajj, gaya
Cinematic selain AWS (Escapement, Sandekala), Cinema Clone, Animation, dan City timelapse/stok Adobe (STOKER). Bila user memintanya, arahkan ke MOTION.

**Mesin bersama Storytelling.** BKH dan BDP memakai engine Musafo: `tools/musafo.mjs` (state `musafo.json`), blok dasar
`brand.json → musafo` (suara, klip, caption), preset `presets/musafo` (caption BKH), dan langkah teknis 0–6 di skill
`/musafo`. Di LITE skill `/musafo` hanya manual teknis engine itu; jangan membuat proyek `type: "musafo"`.

## Pintu masuk: Studio LITE

`npm run studio` → **http://localhost:4331** (MOTION memakai 4321; keduanya boleh jalan bersamaan).
"Buat video" memilih kategori, lalu sub (`#/baru/<kategori>/<sub>`), lalu formulirnya; Studio membuat `videos/<slug>/`
dan menampilkan perintah untuk Antigravity. Ruang Produksi dan sidebar mengelompokkan video per kategori. Pohon kategori dari
`tools/categories.mjs` (`/api/structure`). Halaman `#/s/<kategori>/<sub>` punya tab Video, Library footage, dan
(Storytelling) Library cerita. Footage: `npm run library -- add … --for <kategori>/<sub>` (selalu isi `--for`).

**Video referensi** dianalisis `npm run ref` (yt-dlp, shot, gerak, transkrip). Antigravity menulis `analysis.md` dan 2-3 konsep
di `concepts.json`; user memilih di tab "Konsep" sebelum naskah. Alurnya di `.gemini/skills/video-vertikal/reference.md`.

**Watermark, thumbnail** (semua kategori):
- **Watermark**: `<subDir>/logo.png` per channel/preset/product, kiri atas tiap video (`tools/brandmark.mjs`, `brand.json → watermark`). Matikan per video: `meta.json → watermark: false`.
- **Thumbnail**: `node tools/thumbnail.mjs options|render|auto|sync <slug>`, `out/thumbnail.png`, di depan video **default 1 s**. Judul tiap kata huruf kapital. **Headline + sub headline dibuat bersamaan dengan naskah**: `musafo.mjs build` dan simpan "Edit naskah" menjalankan `sync`.
- **Hapus video**: dipindah ke `videos/.trash/`, dipulihkan dari menu **Sampah**. Antigravity tidak menghapus video user tanpa izin.
- **Ubah format**: tombol "Ubah format" di bawah video editor. Hanya rasio yang dicentang user yang dibuat di HyperFrames.
- **Tebar**: satu-satunya jalur kirim video ke platform sosial (`node tools/tebar.mjs ...`). Antigravity tidak pernah mengisi key dan tidak mengirim tanpa izin eksplisit per video.
- **Caption posting** (`tools/caption.mjs`, `node tools/caption.mjs <slug>`): dibuat di latar saat naskah disetujui (Gemini API).

**Pemicu dari Studio.** Klik user ditulis ke `.events.jsonl` **di folder LITE ini**. Setiap kali sesi menunggu keputusan
user, jalankan `node tools/wait-event.mjs` di background; saat bangun, tangani tiap event lalu jalankan
lagi penunggunya.

| Event | Lanjutkan |
| --- | --- |
| `explainer-new` (Video Explainer baru dari "Buat video") | skill `/video-vertikal <slug>` langkah 1: lengkapi bagian "Diisi Antigravity" di `brief.md`. Dengan video referensi: `npm run ref` → `assets/reference/analysis.md` → `concepts.json`, lalu berhenti sampai user memilih (event `concept`). Tanpa referensi: naskah `script.md` → `/humanizer` → minta persetujuan. Studio menghitung progres dari file-file itu |
| `concept` (explainer) | isi brief dari konsep → naskah → `/humanizer` → minta persetujuan |
| `script-approved` (explainer) | `flow.json` (langkah 2b); `node tools/thumbnail.mjs sync <slug>` bila `script.md` berubah |
| `explainer-production` (tombol Production di tab Naskah) | skill `/video-vertikal` § Event `explainer-production`: dari langkah yang belum selesai, suara → beat → scene → aset gratis → `check` hijau → `preview`; **tanpa render** (menunggu thumbnail disetujui); laporkan yang menunggu user |
| `berakitkehulu-new` | skill `/berakit-ke-hulu <slug>`: tanpa draft, langsung `storyline.md` (series bila > 2 menit) → user mengedit dan menyetujui storyline |
| `bumidipijak-new` | skill `/bumidipijak <slug>`: tanpa draft, langsung `storyline.md` series → user mengedit dan menyetujui storyline |
| `storyline-approved` (BKH/BDP) | BKH: character sheet per usia bila ada foto tokoh; `series` bila perlu; `musafo.json` (naskah per shot) → build → minta persetujuan naskah |
| `script-approved` (BKH/BDP) | `node tools/script-edit.mjs list <slug>`, lalu berhenti: suara dan gambar menunggu tombol Production |
| `production` (BKH/BDP) | 1. suara Gemini TTS satu take, 2. key visual per shot, lalu laporkan; klip menunggu keputusan user |
| `format-new` (versi rasio lain, `of`, `kind`) | buat master plate 16:9, susun ulang tata letak scene di HyperFrames |
| `characters` (BKH) | foto tokoh baru di tab Tokoh: buat/ulang character sheet usia yang terdampak |
| `channel-new` (sub baru, `category` + `dir`) | baca `<dir>/brief.md` + `<dir>/reference/`, tanya user yang belum jelas, desain sub itu, hapus `draft`. **Cinematic** (gaya cerita, skill `/cinestory` § Gaya): isi `cinematic/<look>/style.md`, blok `brand.json → <look>` (styleAnchor, clipLook, clipKeep, voice, music) dan caption `presets/<look>/`; alurnya tetap alur cerita |
| `ad-new` (advertisement) | `flashcut`: skill `/flashcut <slug>`. `bri`: `advertisement/bri/style.md`. `appdemo`: `advertisement/appdemo/style.md` |
| `cinestory-new` (Cinematic gaya cerita, proyek baru) | skill `/cinestory <slug>`: storyline + 3 hook tanpa Draft (seperti BKH); event berikutnya `characters`, `storyline-approved`, `script-approved`, `production` seperti BKH; musik disetujui user di tab Musik sebelum render |
| `cinematic-new` (gaya AWS) | skill `/aws <slug>` (gaya: `cinematic/<look>/style.md` + `presets/<look>/` bila ada, alur dari `cinematic/aws/style.md`): baca brief (`request.json` + `assets/reference/`, docx lewat zipfile) → `/paket-ide` → `aws.json` (data angka, `null` = TBC; adegan open/stat/funnel/montage/end; slot footage dengan `need`) → `node tools/aws.mjs check` → snapshot tiap adegan → laporkan slot footage, angka TBC, logo kurang, teks Thai perlu dicek native. Render, 9:16 + 1:1, dan paket After Effects lewat tombol di tab AWS (atau CLI di `cinematic/aws/style.md`) |

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

## Aturan naskah
- Kalimat pertama menaruh penonton **di dalam masalah**; hook selesai dalam 2 detik.
- Tulis untuk telinga, campur kalimat pendek dan panjang. Jangan pernah mengarang angka.
- **Paket ide dulu**: skill `/paket-ide` sebelum storyline/konsep/naskah.
- Setiap naskah, teks layar, dan caption posting lewat `/humanizer` sebelum ditunjukkan ke user.
- **Setiap angka di layar harus diucapkan.** Batas keras 2:59. Bahasa Indonesia lisan, orang kedua.

## Gerbang
`npm run check` wajib hijau sebelum render. Setelah render, **baca `out/contact-sheet.png`** dan peringatan black-frame.

## Jangan
- Jangan generate footage untuk layar aplikasi, konsep, atau teks; jangan menggambar tiruan UI.
- Jangan menampilkan identitas orang lain di screenshot.
- Jangan mempercepat suara. Jangan menyerahkan video tanpa melihat contact sheet.
- Jangan mem-publish atau mengunggah ke platform tanpa izin eksplisit.
- Jangan memasukkan rahasia (API key, token, password) ke repo.
