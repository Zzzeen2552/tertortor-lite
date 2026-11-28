# TERTORTOR LITE — mesin video vertikal versi ramping (Claude Code + HyperFrames)

Duplikat ramping dari MOTION (`Documents/MOTION`), dibuat 2026-11-12. Folder, git, Studio, dan antrean event-nya
**terpisah total** dari MOTION: jangan menyalin balik ke MOTION, jangan menyentuh `.events.jsonl` MOTION. Studio LITE
dijalankan **lokal** di tiap komputer; repo GitHub hanya untuk memasangnya di komputer lain (README). **Tidak ada web
app/relay** (user 2026-11-12): jangan deploy apa pun dan jangan menyentuh VPS.

## Otak (agen) yang bekerja: `.env → AGENT` (user 2026-11-23)

Satu repo, otaknya dipilih per komputer di `.env`: **`AGENT=claude`** (default, Claude Code: `CLAUDE.md`, `.claude/skills/`,
chat Studio = `claude -p`) atau **`AGENT=antigravity`** (Google Antigravity: `GEMINI.md`, `.gemini/skills/`, chat Studio =
Gemini API, butuh `GEMINI_API_KEY`). `tools/agent.mjs` membaca pilihan itu; Studio, label progres, dan brief menyebut nama
otak yang dipilih (teks sumber boleh menulis "Claude" atau "Antigravity", server menggantinya). Skill ditulis di
`.claude/skills/` dan `.gemini/skills/` dengan isi sama: ubah keduanya bersamaan. Jangan pernah mengganti default ke otak lain
di repo; pilihan hanya lewat `.env` di komputer masing-masing.

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
| **Cinematic** | `cinematic` (AWS) / `cinestory` (gaya lain) | gaya (`look`) `cinematic/looks.json` | **AWS = alur AWS; setiap gaya lain = alur cerita** (user 2026-11-22, menggantikan "semua gaya alur AWS" 2026-11-21): gaya dengan `engine: "story"` membuat proyek **`cinestory`** (channel = id gaya) yang dikerjakan seperti Berakit ke Hulu: storyline → naskah bernarasi → tokoh (foto atau character sheet) → Production (suara + key visual) → klip → **persetujuan musik** (tab Musik) → editing, **vertikal 9:16**, skill **`/cinestory`**. "+ Tambah gaya" membuat `presets/<look>/` (turunan `presets/musafo`, caption), `cinematic/<look>/style.md` (template alur cerita) dan entri `looks.json` (`engine: "story"`, `draft: true` sampai gayanya didesain dari `brief.md`, event `channel-new`). Sport Strava sudah dipindah ke alur cerita. Gaya AWS: **AWS** (skill `/aws`, engine `tools/aws.mjs`, aturan `cinematic/aws/style.md`, preset `presets/aws`): rekap sinematik + motion graphic **visualisasi data** dari brief klien (rekap acara klien): **footage asli** klien di-grade lewat `media-treatment`, angka besar dihitung naik, funnel, titik/kurva, papan Top 20, timeline, kartu logo; teks **Thai + Inggris** (font OFL Inter + IBM Plex Sans Thai, `unicode-range` di `fontFaces`) + `out/<slug>.en.srt`; tanpa narasi, HyperFrames. `aws.json` → satu `compositions/film.html`; slot footage kosong = slate berlabel, angka `null` = kotak TBC (animatic sebelum bahan klien datang). **Master 16:9 + 9:16 + 1:1** dari data yang sama (`node tools/aws.mjs formats <slug>` → proyek `<slug>-9x16`/`-1x1`). **Paket After Effects** (`node tools/aws-ae.mjs <slug>` → `out/ae/`: plate ProRes 422 HQ, grafis alpha ProRes 4444, stem audio, `.jsx` dengan setiap teks dan angka sebagai text layer yang bisa diedit). Tab **AWS** di editor: angka/TBC, unggah footage per slot (`upload?kind=footage&slot=<adegan>:<n>`), logo, lagu, tombol Render / 9:16 + 1:1 / Paket After Effects (`/api/videos/<slug>/aws-render|formats|ae`). Formulir `#/baru/cinematic/aws`. File Amazon Ember berlisensi hanya di laptop (`presets/aws/fonts/ember/`), **tidak pernah di-commit** (repo publik); begitu juga footage, logo, musik, dan brief klien. |

Tidak ada di LITE: preset explainer lain (Kolase, Berkas, Docucine), channel Musafo dan Miracle of Hajj, gaya
Cinematic selain AWS (Escapement, Sandekala), Cinema Clone, Animation, dan City timelapse/stok Adobe (STOKER). Bila user memintanya, arahkan ke MOTION.

**Mesin bersama Storytelling.** BKH dan BDP memakai engine Musafo: `tools/musafo.mjs` (state `musafo.json`), blok dasar
`brand.json → musafo` (suara, klip, caption), preset `presets/musafo` (caption BKH), dan langkah teknis 0–6 di skill
`/musafo`. Di LITE skill `/musafo` hanya manual teknis engine itu; jangan membuat proyek `type: "musafo"`.

## Pintu masuk: Studio LITE

`npm run studio` → **http://localhost:4331** (MOTION memakai 4321; keduanya boleh jalan bersamaan).
"Buat video" memilih kategori, lalu sub (`#/baru/<kategori>/<sub>`), lalu formulirnya; Studio membuat `videos/<slug>/`
dan menampilkan perintah untuk Claude. Ruang Produksi dan sidebar mengelompokkan video per kategori. Pohon kategori dari
`tools/categories.mjs` (`/api/structure`). Halaman `#/s/<kategori>/<sub>` punya tab Video, Library footage, dan
(Storytelling) Library cerita. Footage: `npm run library -- add … --for <kategori>/<sub>` (selalu isi `--for`).
**Tampilan** (user 2026-11-21, acuan editor video Clideo): **tema gelap default** (`tt_theme` di localStorage, tombol bulan
untuk terang), panel membulat lembut (radius 12-22 px), tombol pil, tombol utama gradasi teal `#19C2CD → #2BDDB0`, ikon rel
editor dalam lingkaran (aktif = gradasi), logo tulisan tangan "Tertortor." (user 2026-11-21: mask PNG transparen di `.ttlogo`, warnanya ikut tema, plus label kecil LITE). Token di `:root` /
`[data-theme="dark"]` dan blok "Gaya Clideo" di akhir `<style>` `tools/studio/index.html` (menimpa gaya Swiss lama di atasnya); komponen baru ikut token itu. Kartu video mengikuti rasio videonya (`ratio`
dari server → `--ar`), kartu tanpa thumbnail memakai `poster.jpg` kecil (bukan `<video preload>`). `/api/videos` di-cache
per folder (berubah = dihitung ulang) dan pindah menu menggambar dari daftar yang sudah dimuat lalu menyegarkan di belakang.
**Layout satu halaman** (user 2026-11-20): tanpa sidebar. Baris atas = logo + tombol "Buat video" (dropdown: tipe video →
preset/channel/product, plus link "Library" ke `#/s/<kategori>/<sub>`); ikon Sampah/tema di kanan. **Editor video bergaya aplikasi edit video** (user 2026-11-21, acuan Clideo):
rel ikon kiri (Naskah, Suara, Beat, Aset, Publikasi = Thumbnail + Tebar dalam satu panel) membuka satu panel samping; klik ikon yang sama atau × menyembunyikan
panel (diingat di `localStorage tt_panel`); video besar di tengah setinggi layar dengan timeline beat di bawahnya, menu ⋮ di
kanan atas pemutar (link, ubah format, unduh, hapus). Kartu Naskah berisi tab tahap lain; Suara, Beat, Aset (`CARD_TABS`),
dan Publikasi masing-masing panel sendiri. Tombol **Production** juga muncul di tab Naskah setelah naskah disetujui
(Storytelling: event `production`; Explainer: event `explainer-production`). Di bawah video selalu ada
HyperFrames Studio proyek itu dalam iframe (`/api/videos/<slug>/hf-preview`, GET status / POST nyalakan `npx hyperframes preview --background`).

**Video referensi** dianalisis `npm run ref` (yt-dlp, shot, gerak, transkrip). Claude menulis `analysis.md` dan 2-3 konsep
di `concepts.json`; user memilih di tab "Konsep" sebelum naskah. Alurnya di `.claude/skills/video-vertikal/reference.md`.

**Watermark, thumbnail** (semua kategori):
- **Watermark**: `<subDir>/logo.png` per channel/preset/product, kiri atas tiap video (`tools/brandmark.mjs`, `brand.json → watermark`).
  Matikan per video: `meta.json → watermark: false`.
- **Thumbnail**: `node tools/thumbnail.mjs options|render|auto|sync <slug>`, `out/thumbnail.png`, di depan video
  **default 1 s** (0,3 s terlalu singkat; per video 0,5-3 s di tab Thumbnail → `thumbnail.json → seconds`;
  "Di depan video" dimatikan = `cover: false` + `coverOff`). Judul tiap kata huruf kapital. **Headline + sub headline dibuat
  bersamaan dengan naskah**: `musafo.mjs build` dan simpan "Edit naskah" menjalankan `sync` (5 opsi baru bila isi naskah
  berubah, `optionsFor`; headline yang diketik user tetap); explainer: `node tools/thumbnail.mjs sync <slug>` setiap selesai
  menulis `script.md`. Saklar **teks** dan **bayangan** (`text`/`shade`; iklan key visual seperti BRI default keduanya mati).
  Latar: key visual, **frame dari video** (penggeser → `assets/thumbs/frame.jpg`, `bgTime`), atau **gambar upload user**
  (`assets/thumbs/upload-N.*`). **Warna**: picker/kode hex di tab Thumbnail → `accent` (`*kata*` + label episode) dan
  `subColor`; kosong = aksen preset. Dalam series warnanya berlaku untuk semua bagian (centang default; bagian lain dirender
  ulang di latar), `""` = bagian itu sengaja default. Label episode melanjutkan label bagian sebelumnya. Jangan render video
  sebelum user menyetujui thumbnail lewat tombol **Setujui & render video** di tab Thumbnail.
- **Cover gaya**: `<subDir>/cover.jpg`, `node tools/sub-covers.mjs [--force|<sub>]`, tidak pernah dari media acuan pihak ketiga.
- **Hapus video**: dipindah ke `videos/.trash/`, dipulihkan dari menu **Sampah**. Claude tidak menghapus video user tanpa izin.
- **Ubah format** (user 2026-11-13): tombol "Ubah format" di bawah video editor. **Tidak pernah otomatis**: hanya rasio yang
  user centang yang dibuat (4:5 1080×1350, 1:1 1080×1080, 16:9; 9:16 untuk video lebar), **dibuat ulang di HyperFrames,
  tidak pernah dipotong dari render lama atau diberi latar blur**. `tools/variant.mjs` menyalin proyek ke
  `videos/<slug>-<kind>/` (`meta.json → format` feed/square/horizontal/vertical, `variantOf`, `FORMAT.md`), lalu event
  `format-new`. Konversi file dari render (ProRes, WebM, GIF, 720p): `node tools/formats.mjs <slug> --only …`.
- **Tebar = satu-satunya jalur kirim** (ikut MOTION: Tebar 2026-11-14, Buffer dihapus 2026-11-16; tebar.app, REST
  `api.tebar.app/v1`): `node tools/tebar.mjs keys|accounts <sub>|send <slug> [--at ISO]|status <slug>`. Render
  `out/<slug>.mp4` **diunggah langsung** (bertahap, maks 300 MB), tanpa relay. Kunci per sub di `.tebar-keys.json`
  (gitignored, ditempel user di panel Tebar halaman sub) atau `.env TEBAR_API_KEY_<SUB>`; akun tujuan + label AI per sub di
  `<subDir>/tebar.json` (belum disimpan = semua akun dicentang); daftar akun diingat 5 menit. Tombol "Kirim ke Tebar" di
  editor: caption, judul YouTube, sekarang/jadwal, "untuk anak", label konten AI (default nyala); kirim berjalan sebagai job
  di laptop dengan progres unggah, log `videos/<slug>/tebar.json` (badge PUBLISHED di kartu). Claude tidak pernah mengisi
  key dan tidak mengirim tanpa izin eksplisit per video.
- **Caption posting** (`tools/caption.mjs`, `node tools/caption.mjs <slug>`): saat naskah disetujui (di latar) dan saat
  dialog Tebar dibuka tanpa caption, agen menulis caption + judul YouTube ke `caption.md` (Gemini, cadangan Claude haiku;
  100-220 karakter, hook dari 6 mekanisme, dua baris ajakan: follow + "Colek temanmu…", 3-5 hashtag, tanpa baris "dibuat
  dengan AI"); `credits.md` ditempel di bawahnya. Caption yang disimpan user tidak ditimpa. `videos/<slug>/buffer.json` lama
  hanya dibaca untuk badge PUBLISHED.
- **Bagikan, undangan user, Web Push** butuh relay web, yang tidak dipakai di LITE. Kodenya masih ada; jangan menyiapkan
  relay tanpa permintaan user. Claude tidak pernah mengisi key dan tidak mengirim/memublikasikan tanpa izin.

**Pop-up proses**: klik setujui memunculkan apa yang Claude kerjakan dan perkiraan waktunya (`tools/progress.mjs`,
`.process-times.json`). Langkah baru yang dipicu klik → tambahkan ke `PROCESSES` di `tools/progress.mjs`.

**Pemicu dari Studio.** Klik user ditulis ke `.events.jsonl` **di folder LITE ini**. Setiap kali sesi menunggu keputusan
user, jalankan `node tools/wait-event.mjs` di background (run_in_background); saat bangun, tangani tiap event lalu jalankan
lagi penunggunya. Timeout (4 jam, exit 2) = jalankan lagi bila masih menunggu.

| Event | Lanjutkan |
| --- | --- |
| `explainer-new` (Video Explainer baru dari "Buat video", user 2026-11-22) | skill `/video-vertikal <slug>` langkah 1: lengkapi bagian "Diisi Claude" di `brief.md`. Dengan video referensi: `npm run ref` → `assets/reference/analysis.md` → `concepts.json`, lalu berhenti sampai user memilih (event `concept`). Tanpa referensi: naskah `script.md` → `/humanizer` → minta persetujuan. Studio menghitung progres dari file-file itu |
| `concept` (explainer) | isi brief dari konsep → naskah → `/humanizer` → minta persetujuan |
| `script-approved` (explainer) | `flow.json` (langkah 2b); `node tools/thumbnail.mjs sync <slug>` bila `script.md` berubah |
| `explainer-production` (tombol Production di tab Naskah) | skill `/video-vertikal` § Event `explainer-production`: dari langkah yang belum selesai, suara → beat → scene → aset gratis → `check` hijau → `preview`; **tanpa render** (menunggu thumbnail disetujui); laporkan yang menunggu user |
| `berakitkehulu-new` | skill `/berakit-ke-hulu <slug>`: tanpa draft, langsung `storyline.md` (series bila > 2 menit) → user mengedit dan menyetujui storyline |
| `bumidipijak-new` | skill `/bumidipijak <slug>`: tanpa draft, langsung `storyline.md` series → user mengedit dan menyetujui storyline |
| `storyline-approved` (BKH/BDP) | BKH: character sheet per usia bila ada foto tokoh; `series` bila perlu; `musafo.json` (naskah per shot) → build → minta persetujuan naskah |
| `script-approved` (BKH/BDP) | `node tools/script-edit.mjs list <slug>`, lalu berhenti: suara dan gambar menunggu tombol Production |
| `production` (BKH/BDP) | 1. suara Gemini TTS satu take, 2. key visual per shot, lalu laporkan; klip menunggu keputusan user |
| `format-new` (versi rasio lain, `of`, `kind`) | **master plate dulu**: satu gambar lebar 16:9 (subjek di tengah, area tenang di semua sisi), satu klip 16:9 (Flow, unduh upscale 1080p; upscale lagi di RunningHub bila jendela 9:16/4:5 butuh lebih tajam) di `videos/<asli>/assets/master/`; tiap rasio = jendela potong dari master itu (Flow video hanya 16:9 dan 9:16). Area tenang di tempat judul dan footer, potongan orang/penutup per frame bila dipakai, tata letak tiap scene disusun ulang → `check` → still → `finish` → contact sheet → laporkan |
| `characters` (BKH) | foto tokoh baru di tab Tokoh: buat/ulang character sheet usia yang terdampak, laporkan |
| `channel-new` (sub baru, `category` + `dir`) | baca `<dir>/brief.md` + `<dir>/reference/`, tanya user yang belum jelas, desain sub itu, hapus `draft`. **Cinematic** (gaya cerita, skill `/cinestory` § Gaya): isi `cinematic/<look>/style.md`, blok `brand.json → <look>` (styleAnchor, clipLook, clipKeep, voice, music) dan caption `presets/<look>/`; alurnya tetap alur cerita |
| `ad-new` (advertisement) | `flashcut`: skill `/flashcut <slug>` (`ad.json` → `node tools/ad.mjs check` → `finish`). `bri`: `advertisement/bri/style.md`. `appdemo`: `advertisement/appdemo/style.md` (`node tools/appdemo.mjs info|check`, `finish --no-thumbnail`). Selalu baca contact sheet, kirim MP4, minta persetujuan |
| `cinestory-new` (Cinematic gaya cerita, proyek baru) | skill `/cinestory <slug>`: storyline + 3 hook tanpa Draft (seperti BKH); event berikutnya `characters`, `storyline-approved`, `script-approved`, `production` seperti BKH; musik disetujui user di tab Musik sebelum render |
| `cinematic-new` (gaya AWS) | skill `/aws <slug>` (gaya: `cinematic/<look>/style.md` + `presets/<look>/` bila ada, alur dari `cinematic/aws/style.md`): baca brief (`request.json` + `assets/reference/`, docx lewat zipfile) → `/paket-ide` → `aws.json` (data angka, `null` = TBC; adegan open/stat/funnel/montage/end; slot footage dengan `need`) → `node tools/aws.mjs check` → snapshot tiap adegan → laporkan slot footage, angka TBC, logo kurang, teks Thai perlu dicek native. Render, 9:16 + 1:1, dan paket After Effects lewat tombol di tab AWS (atau CLI di `cinematic/aws/style.md`) |

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
baca/cari, `npm run`, `node tools/`, `npx hyperframes`, git hanya baca; commit/push/`tebar.mjs send`/publish/`wait-event`
ditolak. Butuh Claude Code CLI terpasang dan sudah login di PC ini (`claude --version`). Route `/api/chat*` hanya dari localhost.

## Jenis proyek

- **Kerangka** (`"draft": true`) tampil sebagai "belum didesain" dan tidak bisa membuat proyek, **kecuali gaya Cinematic**:
  setiap gaya Cinematic baru langsung memakai **alur cerita `/cinestory`** (user 2026-11-22; AWS tetap alur AWS; lihat Isi LITE → Cinematic). Jangan diisi warna, font,
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
  atau tahun yang dikarang; logo merek asli hanya ditempel di shot penutup. Skill `/berakit-ke-hulu`. Default alat BKH:
  gambar di ChatGPT, klip di Meta Muse (Flow/RunningHub cadangan). **Prompt Muse = `node tools/musafo.mjs muse <slug>
  [s01,s02]`** (satu adegan per generate, identitas tokoh disebut persis, tanpa close-up wajah); adegan berorang sesudah cut =
  gambar `assets/frames/<shot>-b.png` + generate sendiri, disambung `node tools/musafo.mjs join <slug> <shot> a.mp4 b.mp4`
  (mengisi `scenes[].clipAt`). Tokoh yang berulang ganti baju per shot/episode: `characters[].desc` hanya wajah.
  **Setiap klip Muse morphing di ±0,5 s awal**: `add clip` dan `join` memotong 0,5 s awal tiap generate otomatis bila
  `videoTool` berisi "Muse" (`--head <s>` bila lebih lama, `--head 0` untuk klip Flow/RunningHub); di luar engine itu potong
  manual dengan `node tools/prep-footage.mjs <in> <out> --start 0.5`.
- **BumiDiPijak** (BDP, `type: "bumidipijak"`): sejarah dan legenda Jawa dari Babad Tanah Jawa (Library Cerita BDP).
  Engine Musafo, **lebih dari 2 menit = series**, preset `presets/bumidipijak` (Merriweather, Inggris italic terakota), suara
  default **Kira**, gaya lukisan minyak gelap (`brand.json → bumidipijak`), isi adegan dari `/babad-tanah-jawa-prompt`
  (selalu 9:16). Skill `/bumidipijak`; struktur cerita dari skill `/struktur-babad` (hanya dari babad, pelan jadi series,
  tabel `## Celah yang diisi` untuk tiap loncatan babad).
- **Aturan engine Storytelling (BKH/BDP)**: maks ±10 s narasi per shot (batas kata = 10 s × kecepatan suara; `check` dan tab
  Naskah menandai shot yang lewat, Edit naskah punya penghitung), panjang shot dibuat rata. Klip yang lebih pendek dari
  shot-nya **diperlambat** sampai pas (maks ×1,8, `<shot>.slow.mp4`), bukan dibekukan; klip multi-adegan di-retime per
  adegan (`scenes[].clipAt` untuk klip di luar `clips[]`). `musafo.mjs build` membuat musik latar otomatis begitu suara ada
  (`tools/story-music.mjs`, `music.json → mode: "story"`; `mode: "off"` = dimatikan user).
- Library Cerita (`npm run stories`): PDF/link/teks → Gemini mencatat tiap kisah → "Jadikan video".
- **Advertisement** (`type: "advertisement"`, tanpa narasi, timing per shot dalam detik di `ad.json`):
  - **Flashcut** (`/flashcut`, `tools/ad.mjs`): foto produk ≥ 2 angle, logo, model/CTA opsional → ±11 s, kilatan dari logo
    produk sendiri. Aturan: ≤ 15 s, produk utuh sebelum 2 s, end card ≥ 1,8 s, semua aset di `sources.txt`. Produk tidak
    boleh digambar ulang AI; klaim hanya yang terlihat di foto atau dari user.
  - **BRI** (`advertisement/bri/style.md`, preset `presets/bri`): iklan promo ±13 s dari KV klien, judul kinetik di belakang
    orang, angka promo odometer, end frame persis KV, lalu **scene penutup putih**: logo Danantara, 131, BRI + disclaimer
    LPS/OJK/BI (logo itu tidak tampil di keyframe; rounded square selalu persegi di semua rasio, boleh mengecil
    proporsional; `style.md § Aturan tetap`, user 2026-11-13). **Durasi 8 beat** diatur di tab Beat Studio → `beats.json`
    (`kv: true`) → `node advertisement/bri/scripts/retime.mjs <slug>` (waktu, potongan orang, celah bingkai, SFX, musik,
    `build/timeline.json`; cut di ketukan 0,3 s). File After Effects untuk klien: `node advertisement/bri/scripts/ae-export.mjs
    <slug>` (`style.md` langkah 6). Thumbnail default gambar KV saja, tidak di depan video.
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
- **Clone suara** (ikut MOTION 2026-11-17): panel "Clone suara" di tab Suara (atau `node tools/voice-clone.mjs add "<Nama>"
  <file…> --consent`) membuat suara dari 1-3 menit rekaman bersih lewat ElevenLabs Instant Voice Cloning; daftar di
  `library/voices/clones.json` (gitignored), sampel `library/voices/clone-<id>.mp3`. Dipilih per video seperti speaker
  (`request.json → voiceSpeaker "clone:<id>"`, juga di pilihan suara formulir Buat video). **Bila speaker berawalan
  `clone:`**, take tidak dibuat di AI Studio: `npm run voice -- <slug> --force` (satu take eleven_v3 dengan waktu kata), dan
  `npm run swap` membuat ulang satu kalimat dengan suara yang sama. Hanya suara user sendiri atau dengan izin pemiliknya
  (centang persetujuan wajib); `ELEVENLABS_API_KEY` diisi user sendiri (paket Starter ke atas); biaya karakter di `costs.md`.
  Default brand tetap speaker Gemini.
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
- Gerak (timing, easing, koreografi, stagger, prinsip Disney): skill `/motion-design` (LottieFiles, MIT,
  `.claude/skills/motion-design/`) sebagai acuan saat menulis timeline GSAP scene; batas durasi dan bagian Hindari di
  `style.md` preset tetap menang. Hook `UserPromptSubmit` (`.claude/settings.json` → `tools/hooks/motion-graphic.mjs`)
  mengingatkan Claude memuat skill itu setiap kali prompt menyebut "motion graphic".

## Gerbang

`npm run check` wajib hijau sebelum render. Setelah render, **baca `out/contact-sheet.png`** dan peringatan black-frame.
Render sukses tidak membuktikan apa-apa.

## Jangan

- Jangan generate footage untuk layar aplikasi, konsep, atau teks; jangan menggambar tiruan UI.
- Jangan menampilkan identitas orang lain di screenshot.
- Jangan mempercepat suara. Jangan menyerahkan video tanpa melihat contact sheet.
- Jangan mem-publish atau mengunggah ke platform tanpa izin eksplisit.
- Jangan memasukkan rahasia (API key, token, password) ke repo; `.env`, `.tebar-keys.json`, dan `library/voices/clones*` gitignored.

## Dari MOTION (sinkron 2026-11-28)

Perubahan TERTORTOR (MOTION) 2026-11-23 sampai 2026-11-28 yang dibawa ke LITE:
- **Editor bergaya aplikasi edit video**: tab di tengah baris atas (Naskah, Suara, Beat, Aset, Publikasi), tiga kolom (panel tab,
  video, kolom kanan Suara narasi + Gaya visual), panel **Timeline** selebar halaman (trek Video/Audio/Caption, playhead), aksen oranye.
  Token di blok "Editor gaya aplikasi edit video" paling akhir `<style>` `tools/studio/index.html`. Kartu pemberitahuan polos, tanpa garis warna di tepi.
- **Langkah = tab**: bar langkah `#flowDock` di atas kolom kiri editor (selebar panel); klik langkah membuka tab/panelnya, langkah satu baris tanpa nomor (hijau selesai, oranye berjalan), Naskah · Suara · Beat · Aset = tab di kepala card kiri, baris tab lama hanya untuk proyek tanpa langkah; bar + persen saat agent bekerja. Sebelumnya: bar langkah: satu tombol besar untuk langkah yang menunggu user (`flowSteps`). Tombol yang belum
  aktif tetap menjawab saat diklik: agent bekerja → pop-up progres (spinner + perkiraan waktu); hook belum dipilih → tab Storyline
  dibuka di daftar hook. Proses sampingan (character sheet dari foto baru) tidak mengunci persetujuan.
- **Job line per peran**: `node tools/jobline.mjs <slug> <Peran> "<keputusan>"` → `videos/<slug>/joblines.jsonl`, tampil di halaman video.
- **Reviewer mata segar**: `node tools/review-pack.mjs <slug>` → agen `video-reviewer` baru tiap ronde, PASS hanya bila semua skor ≥ 8,
  maks. 3 ronde (kecuali Berakit ke Hulu: cukup contact sheet).
- **Runner event** (`tools/event-runner.mjs`): klik Studio yang tidak diambil sesi mana pun dalam 45 s dijalankan `claude -p` headless.
  Hanya menyala bila `.env AGENT=claude`; dengan `AGENT=antigravity` klik menunggu agent di IDE seperti sebelumnya.
- **Suara satu take lewat Gemini API**: `node tools/gemini-take.mjs <slug>`.
- **Scene sheet sebelum klip** (Storytelling): `node tools/scene-sheet.mjs <slug>` → `out/scene-sheet.png`, tunggu persetujuan user.
- **Series**: bagian 2 dst. punya hook sendiri (`hooks.json → parts.<n>`), disetujui tanpa memilih hook.
- **Muse4AI dihapus** (`tools/muse.mjs`, `local-proxy.mjs`): Meta Muse hanya lewat muse.ai di Chrome.
- **Enam preset explainer baru** dari galeri lemo-opuscar: Manga Panels, Satellite Briefing, Risograph, Line-Art Cutaway,
  Pictogram Motion, Spy Titles (`presets/<id>/style.md`).
