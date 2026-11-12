# Preset: VOX (kolase editorial)

Dibuat dari referensi user (`presets/vox/reference/`, 10 screenshot + 4 video; analisis di `reference/analysis.md`,
tidak di-commit). Yang ditiru hanya bahasa visualnya. **Jangan pernah** memakai logo, wordmark, nama "Vox", atau merek
klien di referensi (Verizon, Vanguard, Pepsico).

Intinya: **kertas + fotokopi + spidol.** Semua tampak seperti bahan fisik yang ditempel di meja: kertas, potongan
foto hitam-putih, selotip, stabilo, coretan tangan. Warna keras hanya di tepi potongan, stabilo, dan coretan.

## Bahan (kelas siap pakai dari `preset.json → css`)
- `.vox-world` di `#<id>-world` (dunia kamera, lihat Gerak): kertas putih keabu-abuan kusut yang meluas jauh ke luar frame. `.vox-world.grid` = kertas grafik (untuk beat data/langkah). `.vox-paper` tetap ada untuk elemen yang tidak ikut kamera.
- `.vox-copy`: foto jadi fotokopi B/W kontras tinggi. Tambah `<div class="vox-dots">` di atasnya untuk titik halftone.
  **Jangan** pakai `.vox-copy` pada screenshot aplikasi: screenshot tampil apa adanya.
- `.vox-cut`: potongan bertepi sobek berwarna. Warna tepi lewat `style="--edge: var(--green)"` (default merah).
  Isinya `<img>`, `<video>`, atau `<div class="vox-fill">`.
- `.vox-marker`: sapuan stabilo di belakang kata (`--hl` untuk warna, `--hl-x` 0→1 untuk animasi tarikan).
- `.vox-tape`: label League Gothic kapital di selotip krem.
- `.vox-tag`: kotak warna penuh dengan serif italic putih (tanggal, kategori, "Langkah 2 · 2/4").
- Warna: `--ink` hitam, `--accent` stabilo kuning, `--alert` merah poster, `--green`, `--blue`, `--pink`, `--neon`.
  Satu video maksimal **dua** warna keras + kuning stabilo. Hook boleh merah, langkah hijau/biru.

## Tipografi
- **Judul / hero:** Playfair Display 900, hitam, 96-150 px, kapitalisasi kalimat (bukan semua kapital), line-height
  0,98, tracking -0,02em. Satu-dua kata kunci diberi `.vox-marker`.
- **Dek / penjelas:** EB Garamond italic 44-52 px, `--muted` atau hitam, maksimal 2 baris.
- **Label / kategori:** `.vox-tape` (League Gothic 60-90 px), miring -3° lewat wrapper.
- **Angka besar:** Playfair Display 900 180-260 px, atau League Gothic 260+ px; satuan di dek italic.
- **Caption:** Montserrat 700 putih di kotak hitam, kata aktif kotak kuning (otomatis dari preset).

## Grafik
- Lingkaran spidol: path SVG tidak tertutup sempurna (ujungnya melewati awal), stroke 7-9 px merah/hitam,
  `stroke-linecap: round`, digambar dengan `stroke-dashoffset` + `ease: "steps(8)"`.
- Panah melengkung: satu kurva + dua garis kepala, stroke hitam 7 px, digambar 0,4 s.
- Titik/bintang dekorasi (kuning neon, merah) boleh, maksimal 3 per frame, ditempel dengan `steps(2)`.
- Garis putus-putus untuk jalur antar objek.
- Objek konsep = ikon/objek SVG sederhana diisi warna datar + bayangan keras (`drop-shadow(6px 8px 0 var(--shadow))`).
- **Jangan meniru UI aplikasi.** Layar hanya dari screenshot asli, dibingkai `.vox-cut` dengan tepi `--card` atau warna.

## Gerak
- **Stop-motion:** elemen masuk dengan `ease: "steps(4)"`–`steps(6)` (posisi/rotasi melompat, bukan meluncur halus).
- Tempelan: dari y +60 px, rotasi ±6° → posisi akhir, `steps(4)`, 0,2-0,3 s. Hero tetap terbaca ≤ 0,3 s.
- **Boil:** label/cutout bergoyang ±0,6° bolak-balik (`steps(1)`, beberapa kali dengan jarak 0,25 s; tanpa `repeat: -1`).
- Stabilo ditarik kiri→kanan (`--hl-x` 0→1) 0,25 s, `steps(5)`, di mark kata.
- Hook mengikuti tempo referensi cepat: beat 1-3 s, cut keras, satu tempelan baru per cut.

### Kamera: menjelajah satu meja kolase (referensi v1)
Frame **tidak pernah diam di satu tempat**. Kertas adalah meja besar dan kamera bergerak di atasnya: pan dari satu
elemen ke elemen berikutnya, dorong masuk ke hero tepat di kata mark-nya, tarik mundur untuk membuka susunan. Objek
tetap stop-motion (`steps()`); kameranya yang halus (eased). Kontras itu yang membuatnya terasa seperti referensi.

- Struktur (sudah ada di keempat stub): `#root` → `#<id>-hand.vox-hand` (goyang tangan) → `#<id>-world.vox-world`
  (kamera; kelas ini melebarkan tekstur kertas jauh ke luar frame, `.vox-world.grid` untuk kertas grafik) →
  `#<id>-stage` (isi, koordinat layar biasa 1080×1920). Jangan taruh `.vox-paper` di `#root` lagi.
- `cam("#<id>-world", keys)`: tiap key `[t, fx, fy, scale, rotasi°, ease]` artinya titik dunia (fx, fy) jatuh di
  layar (540, 760), tengah pita aman. `[t, 540, 760, 1, 0]` = layout persis seperti digambar. `t` boleh cue (`C.slam`).
  Key berikutnya di-ease dari key sebelumnya tanpa jeda: kamera selalu bergerak.
- Pola per beat (variasikan, jangan sama dua beat berturut-turut):
  - **Masuk:** key 0 sedikit meleset (offset 60-150 px atau scale ±0,04-0,1), mendarat dalam 0,4-0,5 s
    `power2.out`. Hero tetap terbaca di 0,3 s.
  - **Pan/track:** ikuti apa yang sedang disebut (deret amplop, baris breadcrumb, panah HP kamu → HP penipu), geser
    fx 120-250 px di scale 1-1,06.
  - **Push-in di mark:** `["C.mark - 0.1", …]` lalu `["C.mark + 0.15", fx, fy, 1.08-1.18, ±1, "power3.out"]` (atau
    `power4.out` untuk slam).
  - **Pull-out reveal:** mulai rapat di satu detail (scale 1,1-1,25) lalu buka ke susunan penuh, atau tutup beat di
    scale 0,92-0,97.
- **Sambung antar cut:** arah gerak di akhir beat diteruskan beat berikutnya (akhir turun → beat berikut mulai dari
  atas dan turun; akhir dorong masuk → beat berikut mulai sedikit lebih jauh lalu masuk). Cut terasa seperti satu
  kamera yang terus jalan.
- **Batas:** rotasi ≤ 1,5°, scale 0,92-1,25. Saat push-in hitung `y' = 760 + (y - fy) × scale` untuk teks: hero
  harus tetap di 168-1330 px; label kecil boleh keluar atas hanya di akhir beat. Lint pita aman hanya membaca `top:`
  statis, jadi cek manual lewat snapshot di awal +0,3 s dan akhir beat.
- **Goyang tangan:** `#<id>-hand` diset tiap 1/6 s dari tabel tetap ±3 px / ±0,12° (`tl.set`, tanpa `Math.random`,
  tanpa `repeat: -1`).

## Adegan berlapis (gaya dokumenter, user 2026-11-11)
Sumber: panduan Naomi Metzger "Vox-Style Reels" (PDF dari user). Mode kedua VOX untuk beat yang bercerita tentang
orang, tempat, atau kejadian, terutama sejarah. Kolase kertas di atas tetap dipakai untuk beat data, langkah, dan
layar. Satu video boleh mencampur keduanya, tapi pergantiannya ditaruh di cut, tidak di tengah beat.

Ada lima hal yang membedakannya dari edit AI biasa yang terasa "halus, datar, seperti kertas":

1. **Lapisan, bukan satu gambar datar.** Jangan generate satu kolase lalu memotongnya. Tiap adegan disusun seperti
   Photoshop: latar → kata di belakang subjek → subjek → benda depan → kata depan / coretan → grain + vignette.
   Kamera bergerak dan tiap lapisan ikut dengan kecepatannya sendiri, jadi muncul **parallax**.
2. **Semua orang dan benda di-generate di atas green screen**, lalu dipotong dengan `node tools/cutout.mjs <file>`
   (chroma key + buang pinggiran hijau + crop ke subjek → PNG transparan). Hanya latar yang di-generate utuh.
3. **Grain dan tekstur selalu ada.** `.vox-grain` bergeser 12 kali per detik dari tabel tetap, ditambah `.vox-vignette`.
   Foto memakai `.vox-doc` (hitam-putih agak sepia). `.vox-doc.warm` dipakai untuk satu beat yang perlu warna kusam.
4. **Gerak terasa stop-motion.** Kamera parallax dikuantisasi ke 12 fps (`on12`, "on twos"), dan goyang tangan 6 fps.
   Benda masuk satu per satu dengan `steps()` dan jeda 0,1-0,3 s, tidak pernah bersamaan.
5. **Teks hidup di dalam adegan.** Ada empat bentuk dari contoh di panduan:
   - kata di atas kertas (`.vox-word.dark` di atas `.vox-paper`);
   - coretan tangan putih di sekitar subjek (`.vox-scrawl`, misalnya not balok, garis, atau bintang);
   - kata yang dilingkari spidol putih (`.vox-scrawl` mengelilingi `.vox-word`);
   - kata kecil di dalam adegan di samping tokoh (`.vox-word` 56-72 px), atau kata besar di **belakang** subjek supaya
     tubuhnya menutupi sebagian huruf (`.vox-word.big`, lapisan `backl`).

   Font kata adegan adalah Playfair Display italic 400 (`--font-word`), tipis dan kontras tinggi, beda dari judul yang 900. Font berbayar boleh dipasang lewat `fontFaces` bila user membelinya, seperti di panduan.

**Stub:** `presets/vox/scenes/layered.html`. Di `beats.json` tulis `"register": "footage", "stub": "layered"`. `cues` memakai
stub itu hanya untuk scene baru. Gambar disimpan di `assets/layers/<beat>-bg.jpg|-subj.png|-fg.png`, dan tiap gambar punya
satu baris di `sources.txt`. Kedalaman lapisan di `par()`: latar 0,35, kata belakang 0,6, subjek 1, kata depan 1,1,
benda depan 1,6. Kamera boleh bergerak 100-200 px dan scale 1,02-1,15 per beat. Arah geraknya diteruskan ke beat berikutnya.

**Prompt gambar** (Meta Muse = `node tools/muse.mjs image`, atau Flow). Latar ditulis utuh tanpa orang. Subjek dan benda
memakai pola berikut, kalimat green-screen jangan diubah:
> A young woman in an 1820s concert dress seen from behind and to the side, … her whole body in shot, soft light from the
> upper left, realistic photograph, fine film grain, in full colour, on a completely flat solid pure chroma green screen
> background (#00FF00), even green with no shadows or gradient on it, no green on the woman or her dress, no white
> background, no text.

Arah cahaya di latar dan semua potongan harus sama, misalnya "soft light from the upper left". Seluruh tubuh atau benda
harus masuk frame supaya bisa ditempatkan bebas. Wajah boleh dibelakangi.

**Jumlah gambar.** Editor sungguhan memakai 30-60 gambar untuk satu video. Hitungannya: tiap beat berlapis butuh 2-4
gambar (latar + 1-3 potongan), dan cut tiap 2-4 s. Tanyakan dulu ke user gambar apa saja yang dibutuhkan, dalam bentuk
daftar per beat, sebelum generate.

**Urutan kerja** untuk mode ini (di atas alur explainer biasa):
1. Ide dan sudut cerita dari user. Claude tidak memilih ide sendiri karena ide yang dipilih AI dipakai banyak orang (`/paket-ide`).
2. Suara satu take dulu. Semua scene ditimbang dari `words.json`.
3. Daftar gambar per beat → generate → `cutout`.
4. **Storyboard sebelum render.** Ambil still tiap beat di +0,3 s dan di akhir beat (`npm run preview`), lalu tunjukkan ke user.
5. **Render draf murah dulu.** Pakai `npx hyperframes render videos/<slug> --start <s> --end <s> -o …` per potongan, baru render penuh.
6. Bila ada yang terasa salah, taruh frame kita di samping frame acuan dan tanyakan "apa bedanya, apa yang kurang?". Claude
   melihat video per frame, jadi gerak yang terasa salah harus dijelaskan user dengan kata-kata.

## Footage
- Footage generated tampil sebagai **potongan foto** `.vox-cut` di atas kertas (60-80 % lebar), boleh `.vox-copy` +
  `.vox-dots` supaya menyatu dengan kolase. Untuk beat ancaman paling keras boleh hampir full-bleed (inset 40 px) dengan
  tepi sobek merah dan label selotip di atasnya.
- Prompt Flow untuk preset ini: subjek jelas di depan latar polos/kontras supaya terbaca sebagai potongan; warna tidak
  penting (akan dijadikan B/W).

## Hindari

Gaya default Claude yang diam-diam masuk kalau tidak dilarang. Sebut satu per satu, jangan cuma "hindari tampilan AI".

- **Halus digital:** easing mulus pada objek (objek selalu `steps()`, hanya kamera yang eased), fade-in, blur masuk, scale-pop `back.out`.
- **Bentuk:** kartu putih rapi bersudut bulat, bayangan lembut buram (bayangan selalu keras dan offset), garis tepi rapi, glassmorphism.
- **Warna:** gradien apa pun, neon dipakai sebagai latar, lebih dari dua warna keras + kuning stabilo dalam satu video, foto berwarna penuh (foto selalu `.vox-copy`).
- **Tipografi:** sans-serif geometris untuk judul, semua kapital pada judul serif, stabilo yang menutupi seluruh kalimat (maks 1–2 kata).
- **Grafik:** ikon garis tipis gaya UI, lingkaran spidol yang tertutup sempurna, panah lurus kaku, ilustrasi vektor flat bergaya "corporate Memphis", emoji.
- **Kamera:** frame diam lebih dari satu beat, rotasi > 1,5°, zoom > 1,25.
- **Adegan berlapis:** satu gambar datar yang di-zoom (Ken Burns) tanpa lapisan; semua lapisan bergerak dengan kecepatan sama (tidak ada parallax); potongan dengan pinggiran hijau atau tepi putih; cahaya potongan yang berlawanan arah dengan latar; semua benda muncul bersamaan; kata adegan dalam sans-serif; foto berwarna penuh tanpa grain.
- **Batas:** tempelan 200–300 ms, stabilo 250 ms, kamera mendarat 400–500 ms.
