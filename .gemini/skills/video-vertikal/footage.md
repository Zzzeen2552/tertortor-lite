# Footage: library dulu, lalu Wikimedia Commons, lalu Google Flow, lalu stock gratis

Footage hanya untuk beat register `footage` (ancaman, kejadian nyata, momen yang harus terasa). Total ≤ 20 s per video.

## 1. Cari di library (gratis, selalu dulu)

```bash
npm run library -- search malam tangan hp
npm run library -- use <id> <slug> <beat> [--start s] [--dur s]   # potongan 1080x1920/30fps/bisu + baris sources.txt
```

Clip yang cocok secara makna (bukan harus identik) dipakai ulang. Itu inti library: generate sekali, pakai berkali-kali.

## 1b. Wikimedia Commons (gratis, rekaman asli)

Untuk tempat, objek, atau peristiwa nyata yang spesifik, rekaman asli lebih meyakinkan daripada versi AI.

```bash
npm run commons -- search "traffic roundabout" --type video
npm run commons -- use <slug> <beat> "File:<judul>" [--start s] [--dur s]   # 1080x1920/30fps/bisu + kredit
```

Hanya domain publik, CC0, CC BY. Kredit di `credits.md` wajib ikut di caption posting.

## Prompt Flow (`flow.json`), ditulis setelah naskah disetujui

**Satu generate = sampai 10 detik** (`brand.json → flow.maxClipSeconds`). Pakai seluruhnya: satu prompt berisi
**beberapa cut bertimecode** yang melayani beberapa beat sekaligus (misal hook shot A, B, C). Lebih murah per detik
terpakai, dan cut-nya otomatis satu dunia (malam, cahaya, grain, pakaian yang sama). Prompt ditulis untuk naskah yang
sudah disetujui (hash-nya dicatat); kalau naskah berubah, prompt basi dan ditulis ulang. Tampil di Studio, tab "Prompt Flow".

```json
{
  "scriptHash": "<dari: npm run flow -- status <slug>>",
  "model": "Omni 1.1 Flash (Flow)",
  "shots": [
    {
      "id": "hook-seq",
      "purpose": "satu generate 10 s, tiga hard cut yang membangun pencurian",
      "seconds": 10,
      "mode": "frames",
      "keyvisual": "assets/keyvisuals/kafe.jpg",
      "firstFrame": "Vertical 9:16 still frame from a fixed outdoor security camera ... The phone screen is completely black, dead and switched off. Faces indistinct and not identifiable. No text, no watermark.",
      "motion": "Vertical 9:16, one continuous night, same hooded figure, same grain and orange streetlight in every cut. Faces indistinct and not identifiable in every cut. Every phone screen is completely black, dead and switched off for the whole clip. No text, no watermark, no captions.\n[0-3.3s] Fixed security camera, completely locked off, never pans or zooms: the figure lifts the phone off the table.\n[3.3-6.4s] Hard cut to a close-up, slight handheld shake: gloved hands press the side button; the black screen stays black.\n[6.4-10s] Hard cut to a narrow alley, camera locked off on a tripod: the figure from behind walks away into the dark.",
      "cuts": [
        { "from": 0,   "to": 3.3, "beat": "hook",   "cue": "dicuri",  "desc": "CCTV: HP diambil",   "asset": "hook" },
        { "from": 3.3, "to": 6.4, "beat": "threat", "cue": "mematikan", "desc": "tangan mematikan HP" },
        { "from": 6.4, "to": 10,  "beat": "threat", "cue": "hilang",  "desc": "gang, pelaku pergi" }
      ],
      "status": "draft"
    }
  ]
}
```

**Resep prompt multi-cut**
1. Kalimat pembuka = aturan yang berlaku untuk **semua** cut: "Vertical 9:16", kontinuitas ("same night, same wardrobe, same grain in every cut"), wajah tak teridentifikasi, layar ponsel mati, "No text, no watermark, no captions".
2. Satu baris per cut, diawali timecode `[a-bs]`, cut ke-2 dst. diawali **"Hard cut to"**, masing-masing dengan arah kamera sendiri (locked off / handheld / tripod) dan satu aksi saja.
3. 2-4 cut per generate, tiap cut ≥ 1,5 s (ideal 2,5-3,5 s). Isi sampai ±10 s; sisa detik = bayar tanpa dipakai.
4. Urutan cut = urutan di video, supaya satu generate bisa langsung menutup beberapa beat berturut-turut.
5. `cuts[].cue` = kata di naskah tempat aksi cut itu harus mendarat. `asset` opsional (default: nama beat; beat dengan beberapa cut jadi `<beat>-1`, `<beat>-2`).

`npm run flow -- check <slug>` menolak: > 10 s, cut tidak bersambung / < 1,5 s, jumlah timecode < jumlah cut, tanpa "hard cut to",
tanpa kalimat kontinuitas, tanpa "vertical 9:16", tanpa "no text", tanpa arah kamera, layar yang tidak dinyatakan mati,
orang yang wajahnya tidak dinyatakan tak teridentifikasi. Memberi peringatan bila generate dipakai < 8 s.

**Setelah diunduh:**
```bash
npm run library -- add "<Downloads>/<file>.mp4" --source google-flow --model "Omni 1.1 Flash" --prompt "<motion prompt>" --tags "malam,cctv,hp,pencurian" --for explainer/<preset video>
npm run flow -- cut <slug> <shotId> <clipId>   # potong per cut (di-snap ke pergantian scene asli) -> assets/footage/<asset>.mp4 + sources.txt
```

## 2. Generate di Google Flow (akun user, lewat Claude in Chrome)

User menyetujui cara ini: Claude yang generate dan mengunduh hasilnya sendiri.

1. Muat tool Claude in Chrome (skill `chrome-browser`), buka tab baru ke `https://labs.google/fx/tools/flow`. User sudah login di Chrome-nya sendiri; jangan pernah login/logout atau mengetik password. Kalau belum login, minta user login dulu.
2. **Tidak perlu izin kredit** (user 2026-11-06): langsung generate, lalu laporkan jumlah generate dan kredit (tampil di Flow, "Generating will use N credits") dan catat di `costs.md`.
   **Model default: Omni 1.1 Flash** (`brand.json → flow.model`, user 2026-11-06), Video, 9:16, 720p, 10 s (12 kredit).
   Veo 3.1 Fast hanya 8 s dan 20 kredit, jadi prompt 10 s multi-cut tidak muat; pakai hanya bila user minta.
3. Per shot:
   - Ada key visual / first frame → mode *Frames to Video* (unggah gambar dari `assets/keyvisuals/` atau `assets/frames/`). Tidak ada → *Text to Video*.
   - Rasio **9:16 portrait** bila tersedia; kalau tidak, 16:9 lalu di-crop tengah (beri ruang di prompt: "subject centered").
   - Prompt: kamera, bukan sinematik (rig, lensa, sensor, grain). Gerak dikunci: "camera completely locked off, never pans or zooms" atau "slight handheld shake". Layar HP selalu "completely black, switched off, no interface". Tangan nyata, wajah tidak teridentifikasi, tanpa teks/watermark.
   - Baca halaman (`read_page`/`get_page_text`) untuk menemukan tombol; UI Flow berubah-ubah, jangan menebak koordinat.
   - Tunggu render, pilih hasil terbaik dari variasi, unduh MP4 (resolusi asli; upscale 1080p tidak perlu untuk b-roll).
4. File unduhan masuk ke folder Downloads user. Masukkan ke library dengan metadata lengkap:

```bash
npm run library -- add "C:/Users/<user>/Downloads/<file>.mp4" --source google-flow --model "<model di Flow>" --prompt "<prompt persis>" --tags "malam,tangan,hp,sofa,dalam ruangan" --for explainer/<preset video>
npm run library -- use <id> <slug> <beat>
```

Tag: 4-8 kata benda/suasana dalam bahasa Indonesia + Inggris bila perlu (untuk dicari ulang dan untuk stock). Catat di `costs.md`: jumlah generate dan kredit.

5. Di scene, ganti placeholder dengan `<video id="<beat>-clip" src="assets/footage/<beat>.mp4" muted playsinline></video>`, lalu `npm run check`.

### Membuat footage terbaca nyata

- Deskripsikan kamera, bukan keindahan: rig ("kamera CCTV terpasang tinggi"), optik ("wide, distorsi barrel, agak soft"), sensor ("noise low-light, shadow hancur, highlight lampu jalan pecah"), register ("realisme dokumenter, bukan sinematik"), keamanan ("wajah tidak teridentifikasi", "tanpa teks/watermark"), frame ("vertikal 9:16").
- Layar ponsel di shot: tempel kalimat ini setiap kali: "The phone screen is completely black, dead and switched off for the entire shot; no clock, icons, text, lock screen or interface ever appears on it."
- Gerak: "Fixed camera, completely locked off; the camera never moves, pans or zooms." (atau handheld ringan bila memang shot tangan).
- Iterasi di **prompt**, jangan re-roll prompt yang sama berharap hasil lebih baik. Satu generate, lihat, perbaiki prompt.
- Plate yang sudah ada juga sumber still: `ffmpeg -ss <t> -i clip.mp4 -frames:v 1 still.png` sebelum generate baru.
- Hook multi-shot (2-3 shot, tiap shot ±2-3 s), cut di kata, dunia konsisten (malam yang sama, pakaian sama, grain sama).

### Batas yang tidak bisa ditawar

- Tidak pernah orang nyata yang bisa dikenali, publik figur, atau kreator/brand tertentu.
- Tidak pernah sesuatu yang bisa dianggap rekaman kejadian nyata (tempat/tanggal nyata sebagai fakta). Chrome kamera (timestamp, REC) hanya HTML dekoratif, tidak dibakar ke plate.
- Tidak pernah UI.
- `<video>` di scene: `muted`, punya `id`, tidak disembunyikan di CSS dan tidak di-fade GSAP (fade wrapper-nya). Lint menolak bila salah, karena render jadi hitam diam-diam.

## 3. Stock gratis (cadangan)

Bila Flow tidak tersedia atau user minta: cari di Pexels, Pixabay, atau Mixkit lewat browser (portrait, ≥ 720p). Simpan dengan `--source stock --license "<nama lisensi>" --url "<halaman sumber>"`. Clip stock **tidak pernah** diekspor untuk dijual.

## 4. Jual sebagai stock video

`npm run library -- export` menulis `library/stock-export.csv` hanya untuk clip generate milik user (judul, keyword, deskripsi, resolusi, label AI-generated). Unggah ke platform stock dilakukan user sendiri; patuhi aturan platform soal konten AI dan cek syarat Google Flow tentang penggunaan komersial hasil generate.

## Stok gratis: Coverr, Mixkit, Freesound (`npm run stock`)

Lisensi dicek 2026-11-05. Video MOTION publik dan bisa komersial (iklan), jadi hanya lisensi yang membolehkan itu.
`tools/stock.mjs` menolak lisensi NonCommercial / Restricted / personal / no-derivatives.

| Sumber | Untuk | Lisensi | Cara masuk |
| --- | --- | --- | --- |
| Coverr | video | gratis untuk komersial dan iklan, tanpa kredit; jangan re-upload apa adanya; logo di footage tidak dilisensikan; Premium/sponsor (Shutterstock, iStock) bukan lisensi Coverr | API: `COVERR_API_KEY` di `.env` (minta lewat email ke team@coverr.co) → `npm run stock -- coverr search <kata>` → `coverr add <id> --for <kategori>/<sub>` |
| Mixkit | video, musik, SFX | hanya item **Free License** (Stock Video / Music / Sound Effects Free); Restricted = personal | **tanpa API, dan Terms melarang unduh pakai skrip**: user mengunduh di mixkit.co, lalu `npm run stock -- add <file> --kind … --source mixkit --url <halaman item> --license "Mixkit … Free License"` |
| Freesound | SFX | per suara: CC0 (tanpa kredit) atau Attribution (kredit otomatis ke `credits.md`); Attribution NonCommercial ditolak | API Freesound gratis hanya non-komersial, jadi **tidak dipakai**: user mengunduh dari freesound.org, lalu `stock add … --source freesound` |
| Pixabay Music | musik, SFX | Pixabay Content License: boleh komersial (termasuk video yang menjual/mempromosikan produk) tanpa kredit, asal jadi bagian karya, tidak dijual/dibagikan sebagai file lepas, tidak untuk merek dagang atau iklan politik. Lagu berikon **perisai** terdaftar Content ID: bisa kena klaim otomatis walau legal | user mengunduh manual dari pixabay.com (API Pixabay tidak punya audio, scraping dilarang Terms s.8), lalu `stock add … --source pixabay --license "Pixabay Content License"`. Utamakan lagu **tanpa perisai**; simpan link halaman + "Download certificate" untuk sengketa klaim (dicek 2026-11-06) |
| TheAudioDB | (bukan audio) | hanya metadata musik (artis, album, lagu, artwork, link video musik); tidak ada file audio atau hak pakai lagu. Paket gratis "untuk development", artwork wajib kredit; tidak jelas untuk iklan | **tidak dipakai** sebagai sumber musik (dicek 2026-11-05). Musik iklan = tambah di aplikasi, atau file berlisensi dari user di formulir Flashcut |
| Life of Vids | video | belum dicek: situs tidak bisa dibuka (2026-11-05) | - |

- Video stok masuk ke library footage (`library/footage.json`, pakai `npm run library -- use`); musik dan SFX ke
  `library/audio.json` (pakai `npm run stock -- use <id> <slug>` → `assets/audio/`). Keduanya tampil di halaman
  channel/preset/product di TERTORTOR (tab Library footage). Selalu isi `--for`.
- Setiap pemakaian menulis baris `sources.txt`; lisensi Attribution juga menulis `credits.md` (wajib ikut caption).
- Jangan pernah mengambil musik dari video acuan, dan jangan memakai lagu tanpa lisensi yang jelas. Alternatif aman untuk
  iklan: SFX dari kit + musik dari library komersial platform (Shopee Video, TikTok Commercial Music, Meta Sound
  Collection) saat upload.
