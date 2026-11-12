# Unduhan dari Google Flow dan RunningHub lewat Claude in Chrome (PC ini)

Catatan 2026-11-04, dari proyek `timelapse-bali`.

## Hasil

Di PC ini, klik Download yang dilakukan Claude **tidak memicu unduhan sama sekali**: tidak ada file di `Downloads`,
tidak ada `.crdownload`, dan tidak ada entri di `chrome://downloads` (Ctrl+J). Klik oleh user sendiri selalu berhasil.

| Percobaan Claude | Hasil |
| --- | --- |
| Flow: ikon Download di panel kanan (ref dan koordinat) | Tidak ada unduhan |
| Flow: ⋮ → Download → 2K / 1K (koordinat dari screenshot) | Tidak ada unduhan; uji bersih 16.43 dipantau 3 menit, `chrome://downloads` kosong |
| Flow: setelah user set **Automatic downloads: Allow** | Tetap tidak ada |
| RunningHub: tombol Download di bawah player (agen; lalu Claude dengan koordinat) | Tidak ada unduhan dari klik Claude |
| Flow → Studio lokal (`localhost:4321`) dari halaman Flow, izin **Local network access** Allow | Timeout 3× |
| RunningHub: ambil alamat MP4 dari halaman lalu unduh lewat shell | Alamat disembunyikan pengaman ekstensi; tidak diakali |

Sempat disangka berhasil (file `pw_00001_alpyp_….mp4` dan `Drone_viewing_Garuda_Wisnu_statue_… (1).jpg`), tetapi file
itu ternyata diunduh user sendiri. Uji bersih (user tidak menyentuh Chrome) membuktikan klik Claude tidak memicu apa pun.

## Diagnosa di PC ini (2026-11-04 17.10)

| Dugaan | Cek | Hasil |
| --- | --- | --- |
| Kebijakan Chrome | Registry `HKLM/HKCU\SOFTWARE\Policies\Google\Chrome` | Tidak ada kebijakan → **gugur** |
| Setelan unduhan | `Profile 1` (akun yang dipakai): `Preferences` | Ask where to save: mati; folder `C:\Users\Administrator\Downloads`; Automatic downloads flow.google.com & runninghub.ai: **Allow** → **gugur** |
| Cara klik | Klik ref, klik koordinat, dan unduhan file teks kecil dibuat langsung oleh JavaScript di tab Flow | Ketiganya tidak menghasilkan file → bukan soal tombol situs → **gugur** |
| Kode ekstensi | Ekstensi `fcoeoabgfenejglbffodgkkbkcdhcgfn` 1.0.104 & 1.0.105: cari `downloads.cancel/erase`, `setDownloadBehavior` | Tidak ada kode yang memblokir; API unduhan hanya untuk ekspor GIF |
| Versi ekstensi | Folder ekstensi | 1.0.104 (08.31) lalu **1.0.105 terpasang 13.28 hari ini**, sebelum semua percobaan |

Riwayat unduhan Chrome (`Profile 1/History`, tabel `downloads`) tidak berisi satu pun entri pada jam percobaan Claude
(14.56, 16.43, 17.09), termasuk entri gagal/diblokir: unduhan tidak pernah sampai ke pengelola unduhan Chrome.

**Penyebab yang paling cocok (dokumentasi resmi):** Claude in Chrome selalu meminta persetujuan sebelum mengunduh file,
juga di situs yang di-set "Always allow actions on this site" (pilihan: Allow this action / Always allow / Decline;
https://support.claude.com/en/articles/12902446-manage-claude-in-chrome-permissions). Bila kartu persetujuan itu tidak
dijawab atau tidak terlihat, unduhan tidak pernah dimulai. Dokumentasi tidak menyebut di mana kartunya muncul dan apakah
ada batas waktu. Di PC lain kemungkinan kartu itu dijawab "Allow".

**Uji terakhir (19.22, setelah ekstensi tersambung ulang):** klik ⋮ → Download → 1K, pantau 90 detik: tidak ada file,
dan **tidak muncul kartu izin apa pun** (dicek user di Chrome dan di app). Jadi persetujuan yang menurut dokumentasi
harus diminta tidak pernah ditampilkan, dan unduhan tidak dimulai. Ini kemungkinan bug di Claude in Chrome / app Claude
di PC ini; draf laporan: `docs/laporan-bug-unduhan.md`.

Dugaan sebelumnya: lapisan yang mengendalikan tab (Claude in Chrome 1.0.105 dan/atau aplikasi Claude
yang terhubung ke ekstensi lewat native messaging) menahan unduhan dari tab yang sedang dikendalikan, sebagai pengaman.
Ini tidak diakali.

## Perbandingan dengan PC lain

Di PC lain (agen lain, ekstensi yang sama) klik Download dengan koordinat **berhasil** (MP4 H3 Singapore, PNG key visual
Jakarta). Jadi penyebabnya khas PC ini, bukan sifat umum ekstensi. Yang belum dicek:

1. **Versi ekstensi** Claude in Chrome di `chrome://extensions` pada kedua PC.
2. **Kebijakan Chrome / antivirus** di PC ini (`chrome://policy`, mis. `DownloadRestrictions`).
3. Setelan `chrome://settings/downloads` ("Ask where to save", Location) — kecil kemungkinannya, karena
   `chrome://downloads` kosong (unduhan tidak pernah dimulai).

**Uji di PC utama (graef, 2026-11-05, ekstensi 1.0.105):** Claude klik Download di RunningHub My Results dengan
koordinat; MP4 17 MB masuk `C:\Users\graef\Downloads` dalam ±5 detik, user tidak menyentuh Chrome. Jadi versi 1.0.105
bukan penyebabnya.

## Alur yang dipakai sekarang

1. Claude generate di Flow (gambar) dan menjalankan H3 di RunningHub (video).
2. **Claude klik Download dulu** (koordinat), cek `~/Downloads` sampai 90 s. Bila tidak ada file (PC Administrator),
   **user klik Download sendiri**: gambar lewat ⋮ → Download → 1K/2K, video lewat tombol Download di bawah player.
3. Claude mencocokkan tiap file dari isinya (grid frame), `npm run timelapse -- add`, membuang audio, lalu menyalin ke
   `~/Downloads/citytimelapse` dengan nama Adobe Stock.

Bila penyebabnya ditemukan dan klik Claude jadi bisa mengunduh, langkah 2 kembali dikerjakan Claude (klik koordinat,
lalu cek `~/Downloads` sampai 3 menit).
