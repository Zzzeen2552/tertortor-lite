# TERTORTOR hibrida: Studio di web, kerja berat di laptop

Status (2026-11-06): disetujui user; relay, worker, banner Studio, dan file deploy sudah dibangun dan lulus uji lokal
(lihat "Hasil uji lokal"). **Belum di-deploy ke VPS** dan image Docker belum di-build (Docker tidak ada di laptop).

Perubahan dari rencana awal: tidak ada endpoint snapshot. Saat laptop online, GET juga diteruskan langsung ke laptop
dan relay menyimpan jawaban terakhirnya; cache itulah yang dipakai saat laptop offline. Jadi tidak ada balapan
"proyek baru belum ada di snapshot", dan worker tidak perlu tahu daftar halaman.

## Tujuan

Studio bisa dibuka dari HP atau laptop lain. Semua pekerjaan berat (new.mjs, ref.mjs, stories.mjs, cues.mjs, ffmpeg,
render, Claude Code, Chrome yang sudah login) tetap jalan di laptop. Alur gratis lewat UI tidak berubah.

## Ide utama: web = relay + cache, laptop = Studio yang sekarang

Daripada memecah `server.mjs` jadi puluhan jenis job, laptop tetap menjalankan `npm run studio` persis seperti sekarang
(127.0.0.1:4321, tanpa login, tidak terlihat dari internet). Di VPS jalan program kecil baru, **relay**:

```
HP / laptop lain ──HTTPS + cookie──▶ Caddy ──▶ relay (VPS, container sendiri, network Docker `tertortor`)
                                                  ▲  cache: snapshot JSON, index.html, thumbnail, preview MP4
                                                  │  antrean: permintaan tulis + unggahan sementara
                                 HTTPS keluar,    │
                                 token, long-poll │
                                                  │
                     laptop: tools/worker.mjs ────┘──▶ http://127.0.0.1:4321 (server.mjs yang sekarang)
                                                         └▶ tools/*.mjs, .events.jsonl, wait-event, Claude
```

- **Baca (GET `/api/...`)**: diteruskan ke laptop seperti tulis, dan jawabannya disimpan relay. Saat laptop mati,
  relay menjawab dari simpanan itu (header `x-relay-cache`) dan sidebar menunjukkan "Web · laptop offline, terakhir …".
- **Tulis (POST/PUT/DELETE)**: relay menaruhnya di antrean; worker (long-poll) mengambilnya, memutar ulang permintaan
  itu ke `127.0.0.1:4321`, lalu mengirim balik status + body. Relay menahan respons ke browser sampai 20 s, jadi
  bila laptop online, rasanya sama seperti sekarang (±1–2 s).
- **Event Claude tidak berubah sama sekali**: `server.mjs` di laptop yang menerima permintaan ulang itu, jadi ia sendiri
  yang menulis `.events.jsonl`, dan `wait-event.mjs` + skill `/musafo`, `/berakit-ke-hulu`, `/video-vertikal`,
  `/flashcut` bangun seperti biasa.
- **Sumber kebenaran tetap folder di laptop** (`videos/`, `musafo/library/`, `library/`, `presets/`). VPS hanya cache
  yang boleh dihapus kapan saja.

Kenapa bukan "mode web" di `server.mjs` + jenis job per tindakan (usulan awal di serah terima): itu menyentuh setiap
route yang menulis file (±20 tempat) dan menduplikasi logika; tiap fitur Studio baru harus dibuat dua kali. Dengan relay,
`server.mjs` dan semua `tools/*.mjs` praktis tidak berubah, dan spawn memang tidak pernah terjadi di VPS karena kodenya
tidak ada di sana.

## Antrean, dan saat laptop offline

| Permintaan | Laptop online | Laptop offline |
| --- | --- | --- |
| GET `/api/...` | diteruskan, jawaban disimpan | jawaban terakhir yang disimpan; halaman yang belum pernah dibuka = 503 |
| Keputusan kecil: `approve`, `storyline-approve`, `concept`, `preset`, `voice`, `flow/<shot>`, `ref` | diputar ulang, hasil langsung | **diantrekan**, UI bilang "menunggu laptop"; dijalankan saat laptop nyala |
| Buat proyek / sub (`POST /api/videos`, `/api/subs`) + unggahan sesudahnya, `stories/*` | diputar ulang, hasil langsung | ditolak dengan pesan jelas (alurnya butuh `slug` dari laptop untuk unggahan berikutnya) |

Yang dibangun: permintaan langsung hanya di memori (browser menunggunya); antrean offline, sesi, dan antrean yang gagal
di file JSON kecil di `DATA_DIR` (`queue.json`, `sessions.json`, `failed.json`), tanpa SQLite. Job yang diambil worker
tapi tidak dijawab 10 menit: yang dari antrean dikembalikan ke antrean, yang langsung dijawab 504. Laptop dianggap
online bila worker sedang long-poll, terlihat < 5 s lalu, atau sedang mengerjakan job.

## Unggahan dan media

- **Unggahan user** (foto produk, PDF, video referensi, file acuan sub): relay menyimpannya sementara di
  `/data/inbox/<job>`, worker menariknya lalu PUT ke Studio lokal, lalu relay **menghapusnya**. Batas per file 500 MB
  (diatur di relay dan Caddy).
- **`/files/...`** (gambar, klip, render): relay melayani dari cache. Bila belum ada, relay meminta worker mengirim file
  itu (job `file`), lalu menyimpannya di cache dengan batas total (default 3 GB, yang paling lama tidak dibuka dihapus).
- **Preview video**: untuk `out/<slug>.mp4` dan klip library, worker mengirim versi kecil (ffmpeg di laptop: 540×960,
  ±1,2 Mbps, ±10× lebih kecil), bukan file penuh. Contact sheet dan frame dikirim apa adanya (gambar kecil).
- Media penuh tidak pernah menumpuk di VPS. Object storage tidak dipakai dulu (bisa ditambah nanti tanpa mengubah
  laptop).

## Login

- Pemilik: password dari env `STUDIO_PASSWORD_HASH` (scrypt, `node tools/relay.mjs hash` untuk membuatnya), login
  dengan `ADMIN_EMAIL` atau tanpa email.
- **User undangan** (2026-11-09): admin mengundang lewat email di halaman User. Env relay: `ADMIN_EMAIL`, `PUBLIC_URL`
  (dasar link, default `VAPID_SUBJECT`), `INVITE_HOURS` (72), `RESEND_API_KEY`, `MAIL_FROM` (alamat di domain yang sudah
  diverifikasi di Resend, mis. `TERTORTOR <undangan@redactor.my.id>`), `MAIL_DRY=1` (uji: tidak mengirim). Link
  `/join/<token>` (publik, sekali pakai, token hanya disimpan sebagai sha256) → nama + password sendiri (≥ 10) → langsung
  login. Peran admin/editor/viewer dibaca ulang setiap permintaan; viewer ditolak 403 untuk semua tulis. Route:
  `GET /api/relay/me`, `GET /api/users`, `POST /api/users/invite`, `POST /api/users/<email>/(role|revoke|restore)`,
  `DELETE /api/users/<email>`, `DELETE /api/users/invite/<id>` (di allowlist, dijawab relay sendiri, admin saja); laptop
  memakai `/worker/users…` dengan token worker.
- Sesi cookie `HttpOnly; Secure; SameSite=Strict`, 30 hari, disimpan di DB (bisa dicabut). Halaman login sederhana.
- Rate limit login: 5 gagal / 15 menit per IP.
- Worker memakai token terpisah (`RELAY_WORKER_TOKEN`, header `Authorization: Bearer`), hanya boleh ke `/worker/*`.
- Relay hanya meneruskan **allowlist** route yang dipakai `index.html` (method + regex, persis daftar di bawah). Route
  lain = 404, jadi lubang baru di `server.mjs` tidak otomatis terbuka ke internet.

## Endpoint

Untuk browser (semua butuh cookie, kecuali `/login`):

| Route | Perilaku di relay |
| --- | --- |
| `GET /` | `index.html` dari laptop (UI ikut versi laptop tanpa redeploy), disimpan untuk saat offline |
| `GET/POST /login`, `POST /logout` | sesi |
| `GET /api/videos`, `/api/videos/<slug>`, `/api/structure`, `/api/presets`, `/api/voices`, `/api/library`, `/api/audio`, `/api/stories` | diteruskan + disimpan |
| `POST /api/videos`, `/api/subs`, `/api/stories/{channel,source,scan,use}` | relay langsung (laptop wajib online) |
| `POST /api/videos/<slug>/{approve,storyline-approve,concept,ref,preset,voice,ready,flow/<shot>}`, `DELETE …/approve` | relay, atau antre bila offline |
| `PUT /api/videos/<slug>/upload`, `/api/stories/upload`, `/api/subs/<cat>/<id>/upload` | inbox → relay |
| `GET /api/videos/<slug>/thumb/<id>.jpg`, `GET /files/...` | cache, atau job `file` |
| `GET /api/relay/status` | laptop online/offline, kapan terakhir terlihat, isi antrean |

Untuk worker (token):

| Route | Fungsi |
| --- | --- |
| `GET /worker/next?wait=25` | long-poll: job berikutnya `{ id, method, path, type, body (base64), blob, ifMtime }` |
| `GET /worker/blob/<job>` | ambil unggahan dari inbox |
| `POST /worker/result/<job>` | header `x-status`, `x-type`, `x-mtime` + body jawaban (file langsung di-stream ke cache; 304 = cache masih sama) |

## Perubahan per file

| File | Perubahan |
| --- | --- |
| `tools/relay.mjs` (baru, ±300 baris) | relay: login, allowlist, cache jawaban + file, antrean offline, inbox. Tidak meng-import apa pun dari `tools/` dan tidak pernah spawn. |
| `tools/worker.mjs` (baru, ±130 baris) | 4 long-poll paralel, putar ulang ke `127.0.0.1:4321`, `/files/…` dibaca langsung dari disk; video > 8 MB dikirim sebagai preview (ffmpeg, cache di `.preview/` per versi file). `.env`: `RELAY_URL`, `RELAY_WORKER_TOKEN`. |
| `tools/studio/index.html` (kecil) | kaki sidebar "Web · laptop online/offline" dari `/api/relay/status` (di lokal 404 → tetap "Lokal"); `202` → toast antrean; `401` → `/login`. |
| `tools/studio/server.mjs` | tidak berubah. |
| `package.json` | `"relay"`, `"worker"`. Tanpa dependensi baru. |
| `deploy/studio/Dockerfile`, `compose.yml`, `Caddyfile.snippet`, `.env.example` (baru) | lihat bawah |
| `.gitignore` | `.relay/`, `.preview/` |

## Hasil uji lokal (2026-11-06)

Studio 4321 + relay 4330 (data di scratchpad) + worker, semuanya di laptop:

- tanpa cookie: `/` → 303 `/login`, `/api/videos` → 401; password salah 401; login 303 + cookie.
- 8 GET API lewat relay identik byte per byte dengan Studio langsung; `index.html` ikut versi laptop.
- PNG 2 MB utuh; MP4 render 92 MB → preview 540×960 13,9 MB (14 s pertama kali, lalu dari cache); range 206; thumbnail.
- buat proyek explainer + unggah key visual: file sampai identik, inbox kosong lagi (proyek uji sudah dihapus).
- worker mati: GET dari cache (`x-relay-cache`), file dari cache, buat proyek 503, ganti preset 202 masuk antrean;
  worker nyala lagi → antrean dijalankan (meta.json berubah). `.events.jsonl` tidak tersentuh (17 → 17 baris).
- `/files/../.env`, `..%2F`, route di luar allowlist → 404; POST lintas origin 403; token worker salah 401.
- browser pane: login, Ruang Produksi, editor video memutar preview, "Web · laptop online", tanpa error console.
| `CLAUDE.md` | bagian "TERTORTOR dari web" dengan gaya file itu |

## Uji lokal (sebelum menyentuh VPS)

1. `npm run studio` (4321, seperti biasa).
2. `STUDIO_PASSWORD_HASH='…' RELAY_WORKER_TOKEN=… DATA_DIR=<scratch> PORT=4330 npm run relay` (hash pakai kutip tunggal: isinya `$`).
3. `RELAY_URL=http://127.0.0.1:4330 npm run worker`.
4. Buka `http://localhost:4330`: login, buka daftar video, putar render (preview), pilih konsep / setujui storyline di
   proyek uji → cek baris baru di `.events.jsonl`, buat proyek Flashcut uji dengan foto → cek file masuk ke `videos/`.
5. Matikan worker: Studio tetap terbuka dengan banner offline, persetujuan masuk antrean, nyalakan worker → dijalankan.
6. Coba tanpa cookie, cookie salah, route di luar allowlist, path `/files/../.env` → semua ditolak.

## Deploy ke VPS REDACTOR (setiap langkah ditunjukkan dan minta izin dulu)

Domain: **`tertortor.redactor.my.id`** (user 2026-11-06). DNS `redactor.my.id` di Cloudflare (domain utama DNS only →
43.156.105.51). VPS `ubuntu@43.156.105.51`; Caddy REDACTOR jalan **di Docker** (service `caddy` di
`~/redactor/docker-compose.yml`, Caddyfile dari repo REDACTOR), dan `~/redactor` diganti utuh setiap deploy REDACTOR.

1. DNS: A record `tertortor` → 43.156.105.51, DNS only (abu-abu), di dashboard Cloudflare.
2. Baca saja: `df -h`, `free -m`, `docker ps`, `docker network ls`.
3. Salin isi `deploy/studio/` + `tools/relay.mjs` ke `~/tertortor/` (bukan `~/redactor`, yang tertimpa saat deploy
   REDACTOR); `.env` dari `.env.example`, `chmod 600`.
4. `docker network create tertortor`, lalu `docker compose -p tertortor up -d --build`. Container `tertortor-relay`
   tidak mem-publish port sama sekali (non-root, read-only, 256 MB, 0,5 CPU).
5. Di **repo REDACTOR** (proyek lain, perubahan kecil, butuh izin user): Caddyfile + blok dari
   `deploy/studio/Caddyfile.snippet`, dan `docker-compose.yml` service `caddy` ikut network eksternal `tertortor`.
   Deploy lewat cara REDACTOR biasa ("Commit, push & VPS") atau salin dua file itu saja; reload Caddy
   (`docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`), lalu cek `https://tertortor.redactor.my.id`
   → halaman login dan REDACTOR tetap jalan.
6. Di laptop: `.env` + `RELAY_URL=https://tertortor.redactor.my.id` dan `RELAY_WORKER_TOKEN`, lalu `npm run worker`.
   Opsional: jalan otomatis saat login Windows (Task Scheduler).

### Hasil deploy (2026-11-06)

- `~/tertortor` + network `tertortor`, container `tertortor-relay` (uid node, ±15 MB, tanpa port host).
- Repo REDACTOR: blok `tertortor.redactor.my.id` di `Caddyfile`, service `caddy` ikut network `tertortor` (belum di-commit
  saat ditulis). Di VPS file lama dicadangkan `*.bak-tertortor`.
- **Pelajaran:** Caddyfile di-mount sebagai satu file; `scp` menggantinya dengan inode baru, jadi `caddy reload` tetap
  memuat config lama ("config is unchanged"). Setelah mengganti Caddyfile, buat ulang containernya
  (`docker compose up -d caddy`, REDACTOR mati beberapa detik) dan cek `docker exec redactor-caddy-1 grep … /etc/caddy/Caddyfile`.
- Cek: `https://tertortor.redactor.my.id` → 303 `/login`, sertifikat Let's Encrypt, `/worker/next` tanpa token 401,
  `/api/videos` tanpa login 401, port 4330 tertutup dari luar, REDACTOR tetap 307 seperti sebelumnya.
- Hash password memakai `scrypt:<salt>:<hash>`: `$` di `.env` diekspansi docker compose.

## Pisah dari REDACTOR: Cloudflare Tunnel (2026-11-07)

User: TERTORTOR dan REDACTOR harus terpisah dan tidak saling mengganggu. Menumpang di Caddy REDACTOR berarti deploy
REDACTOR bisa memutus Studio web dan perubahan TERTORTOR harus membuat ulang Caddy REDACTOR. Port lain (8443) tidak bisa:
firewall Sumopod hanya membuka 22, 80, 443 (diuji dari luar: semua port lain timeout). Jadi:

- `deploy/studio/compose.yml`: `tertortor-relay` + `tertortor-tunnel` (`cloudflare/cloudflared`, `tunnel --no-autoupdate
  run`, `TUNNEL_TOKEN` dari `cf.env`, gitignored). Koneksi keluar ke Cloudflare, tanpa port di VPS.
- Cloudflare dashboard → Networking → Tunnels → `tertortor` (id `c05fbacd-…`) → route *Published application*
  `tertortor.redactor.my.id` → `http://relay:4330`. Cloudflare membuat CNAME ke `<id>.cfargotunnel.com` (record A lama
  dihapus dulu). Alamat tidak berubah, jadi `RELAY_URL` worker dan bookmark HP tetap.
- Batas Cloudflare (paket gratis): body request maks 100 MB → `MAX_UPLOAD_MB=95` di relay dan `MAX_FILE` 95 MB di worker;
  permintaan > 100 s diputus (524), cukup ulangi (laptop tetap menyelesaikan dan relay menyimpan hasilnya).
- Relay membaca IP pengunjung dari `cf-connecting-ip` (rate limit login per orang, bukan per container cloudflared).
- Versi cloudflared dipin; dashboard menandai versi yang > 1 tahun sebagai Unsupported, jadi naikkan berkala.
- Setelah tunnel jalan: blok tertortor dilepas dari Caddyfile dan `docker-compose.yml` REDACTOR (kembali ke
  `*.bak-tertortor`), commit REDACTOR yang menambahkannya dibuang, dan network `tertortor` jadi milik proyek ini saja.

## Web Push (2026-11-07)

- Laptop: `tools/progress.mjs` melihat proses yang berjalan (event Studio tanpa file hasil yang lebih baru); Studio
  memeriksanya tiap 5 s dan, saat selesai, POST `${RELAY_URL}/worker/notify` (token worker).
- Relay: simpan notice (20 terakhir), kirim push tanpa payload ke setiap langganan (JWT ES256 VAPID, `crypto` bawaan);
  langganan yang 404/410 dibuang. `sw.js` mengambil `/api/relay/notices` dengan cookie dan menampilkan yang terbaru.
- PWA publik tanpa login: `/manifest.webmanifest`, `/sw.js`, `/pwa/*.png` (dari `tools/studio/pwa`, ikut di image relay).
- HP: buka Studio web → lonceng di kaki sidebar → izinkan → tekan lagi untuk tes. iPhone: wajib "Add to Home Screen"
  dulu (iOS 16.4+), lalu buka dari ikon itu.
- Deploy: salin `tools/relay.mjs` dan `tools/studio/pwa/` ke `~/tertortor/` (folder `pwa`), `.env` yang sudah berisi VAPID,
  lalu `docker compose -p tertortor up -d --build`.

## Bagikan lewat link (2026-11-07)

- Studio "Bagikan" / `node tools/share.mjs <slug>`: render dikompres ke `out/share.mp4` (H.264 CRF 23, maks 3,5 Mbit/s,
  faststart, ±50 MB per 2 menit) + `out/share.jpg`, lalu diunggah ke relay: POST `/worker/share` (token baru atau lama),
  PUT `/worker/share/<token>/video|poster`. Relay menyimpannya di volume (`/data/shares/<token>/`).
- Publik tanpa login: `/v/<token>` (halaman putar, noindex) dan `/v/<token>/video.mp4` (range). Tetap jalan saat laptop
  mati. Token 22 karakter acak, tidak didaftar di mana pun. "Cabut link" = DELETE `/worker/share/<token>`.
- `videos/<slug>/share.json` (gitignored: berisi token) mencatat link dan render yang dipakai; Studio menandai link yang
  masih memutar render lama dan menawarkan "Perbarui ke render terbaru" (token tetap sama).

## Keputusan user (2026-11-06)

Relay disetujui; offline = keputusan kecil diantrekan, buat proyek ditolak; cache VPS 3 GB + preview 540p; login
password + cookie; domain `tertortor.redactor.my.id`.
