# Pasang TERTORTOR LITE di PC lain (Windows)

## Sebelum mulai (manual, ±5 menit)

1. Pasang **Claude desktop app** (tab Code) dan login dengan akun Claude yang dipakai di PC itu.
2. **Akses repo private** `Zzzeen2552/tertortor-lite`. Pilih salah satu:
   - login GitHub sebagai `Zzzeen2552` di PC itu, atau
   - undang akun GitHub lain sebagai collaborator (repo → Settings → Collaborators).
3. Di Chrome: pasang ekstensi **Claude in Chrome**, lalu login sendiri ke **Google Flow**, **Google AI Studio**, dan
   **RunningHub**. Claude tidak boleh mengetik password untukmu.
4. Buka Claude Code dengan folder kerja `Documents`.

## Prompt untuk Claude Code (tempel apa adanya)

```text
Siapkan TERTORTOR LITE di PC Windows ini. Kerjakan berurutan, cek tiap langkah, dan berhenti lalu tanya saya kalau ada yang butuh login, password, API key, atau izin admin. Jangan pernah mengetik password atau API key untuk saya.

1. Cek prasyarat: git, Node.js 22 atau lebih baru, ffmpeg + ffprobe di PATH. Yang belum ada, pasang lewat winget (Git.Git, OpenJS.NodeJS, Gyan.FFmpeg), buka shell baru, lalu cek versinya lagi.
2. Clone https://github.com/Zzzeen2552/tertortor-lite.git ke %USERPROFILE%\Documents\TERTORTOR-LITE. Repo-nya private: kalau Git minta login GitHub, minta saya login sendiri. Kalau foldernya sudah ada, cukup git pull.
3. Di folder TERTORTOR-LITE: npm install, lalu npx hyperframes skills (memasang skill HyperFrames ke ~/.claude/skills).
4. Bangun kit efek suara: node tools/sfx.mjs.
5. Pasang whisper.cpp: unduh rilis Windows resmi whisper-bin-x64.zip dari github.com/ggml-org/whisper.cpp/releases, ekstrak sehingga ada tools/bin/whisper/Release/whisper-cli.exe. Sebutkan ukuran file sebelum mengunduh. Folder tools/bin tidak ikut git.
6. Buat file .env kosong di root (tidak ikut git) dengan baris GEMINI_API_KEY= dan ELEVENLABS_API_KEY=. Saya yang mengisi nilainya sendiri.
7. Buat shortcut Desktop: powershell -NoProfile -ExecutionPolicy Bypass -File tools\install-shortcut.ps1
8. Uji: npm run studio, buka http://localhost:4331 di browser pane. Pastikan "Buat video" hanya punya 3 kategori: Video Explainer (Hyperframe, SNAPCN, VOX), Storytelling (Berakit ke Hulu, BumiDiPijak), Advertisement (Flashcut, BRI, App Demo). Jalankan juga npx hyperframes --version. Catatan: videos/uji-hyperframe di git tidak membawa suara dan footage, jadi npm run check di proyek itu boleh gagal karena file suara tidak ada. Itu bukan error pemasangan.
9. Baca CLAUDE.md, README.md, .claude/skills/video-vertikal/SKILL.md, .claude/skills/video-vertikal/LESSONS.md, .claude/skills/berakit-ke-hulu/SKILL.md, .claude/skills/bumidipijak/SKILL.md, dan .claude/skills/flashcut/SKILL.md supaya paham alur dan aturan proyek ini.
10. Simpan ke memori proyek ini:
   (a) Gambar di Google Flow gratis (0 kredit): generate gambar tanpa minta izin. Video Flow dan semua run RunningHub: laporkan biaya/kredit/koin dan catat di costs.md. Default video Flow: Omni 1.1 Flash 10 s. Kalau Flow menolak dengan "unusual activity", jangan retry otomatis; serahkan ke saya.
   (b) Thumbnail semua channel dan headline layar: setiap kata diawali huruf kapital (Title Case).
   (c) Naskah Berakit ke Hulu selalu memakai 10 shot dan ditutup dengan pencapaian merek hari ini.
   (d) TERTORTOR LITE hanya jalan lokal (Studio port 4331). Tidak ada web app/relay: tombol Bagikan, Buffer, dan akses dari HP memang tidak aktif. Jangan deploy apa pun.
   (e) Jangan publish, upload, atau kirim ke Buffer/platform mana pun tanpa izin eksplisit saya per video.
   (f) Jawab saya dalam bahasa Indonesia santai.
11. Laporkan: versi tiap alat, apa yang terpasang, apa yang gagal, dan apa yang masih harus saya lakukan sendiri (isi .env, login Chrome ke Flow/AI Studio/RunningHub).

Catatan: proyek videos/ lama, footage, suara, key visual, dan video acuan tidak ada di git. Jangan anggap itu error. Kalau saya butuh proyek lama, saya salin sendiri folder videos/<slug>/ dari laptop utama.
```
