# TERTORTOR LITE

Versi ramping dari MOTION/TERTORTOR (dibuat 2026-11-12). Studio jalan lokal di tiap komputer; repo GitHub hanya untuk
memasangnya di komputer lain. Tidak ada web app/relay.

- **Video Explainer**: Hyperframe, VOX, SNAPCN
- **Storytelling**: Berakit ke Hulu, BumiDiPijak
- **Advertisement**: Flashcut, BRI, App Demo

```bash
npm install
node tools/sfx.mjs      # kit efek suara (dibuat dari matematika, tidak ikut git)
npm run studio          # http://localhost:4331 (MOTION memakai 4321)
```

Lalu di Claude Code (folder kerja `TERTORTOR-LITE`) jalankan skill yang ditunjukkan Studio, mis. `/video-vertikal <slug>`,
`/berakit-ke-hulu <slug>`, `/bumidipijak <slug>`, `/flashcut <slug>`. Aturan lengkap di [CLAUDE.md](CLAUDE.md).

## Pasang di komputer lain (Windows)

1. Pasang Git, Node.js 22+, dan ffmpeg (mis. `winget install Git.Git OpenJS.NodeJS Gyan.FFmpeg`), plus Claude desktop app.
2. Clone repo ini ke `Documents\TERTORTOR-LITE`, lalu `npm install` dan `npx hyperframes skills` (skill HyperFrames ke `~/.claude/skills`).
3. `node tools/sfx.mjs`.
4. whisper.cpp untuk transkripsi suara: unduh `whisper-bin-x64.zip` dari github.com/ggml-org/whisper.cpp/releases, ekstrak
   sehingga ada `tools/bin/whisper/Release/whisper-cli.exe` (tidak ikut git).
5. Buat `.env` sendiri (tidak ikut git): `GEMINI_API_KEY` untuk thumbnail, caption, dan Library Cerita; opsional
   `ELEVENLABS_API_KEY`. Kunci Buffer ditempel sendiri di panel Buffer halaman sub.
6. Opsional shortcut Desktop: `powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-shortcut.ps1`.
7. `npm run studio` → http://localhost:4331.

Di Chrome, login sendiri ke Google Flow, Google AI Studio, dan RunningHub; Claude tidak mengetik password.

## Yang tidak ikut git

Proyek `videos/` (render, suara, footage, key visual), klip `library/footage/`, audio stok `library/audio/`, kit
`library/sfx/`, video acuan pihak ketiga, `tools/bin/`, `.env`, `.buffer-keys.json`, dan token apa pun. Bila butuh proyek
lama, salin folder `videos/<slug>/` secara manual.

## Fitur yang butuh web (tidak aktif di LITE)

Buka Studio dari HP, tombol "Bagikan" (`/v/<token>`), kirim ke Buffer (video dikirim sebagai link relay), undangan user,
dan Web Push butuh relay (`tools/relay.mjs` + `npm run worker`). Kodenya masih ada, tapi LITE sengaja tidak memakainya.
Bila suatu hari dibutuhkan: relay sendiri (bukan relay MOTION), `.env` dengan `RELAY_URL` + `RELAY_WORKER_TOKEN`, contoh
deploy di `deploy/studio/`, rincian di [docs/hybrid-plan.md](docs/hybrid-plan.md).
