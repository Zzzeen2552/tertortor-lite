# Preset: Hyperframe

Gaya default MOTION. Tegas, cepat, mendesak, tapi **luwes**: teks selalu bergerak per kata, kamera tidak pernah diam.
(Dirombak 2026-11-06: user bilang font dan animasi lama "terlalu kaku"; Archivo Black kapital + slam satu blok diganti.
Lalu "maunya lebih rich secara visual, ada videonya, ada infografisnya, ada motion graphicnya": lapisan dunia + blok
infografis dari video acuan user, catatan di `reference/analysis.md`.)

## Dunia per beat (wajib)

Teks tidak pernah melayang di latar polos. Tiap beat berdiri di satu **dunia** (`.hf-layer` + satu kelas), dan dua beat
berurutan tidak boleh memakai dunia yang sama:

| Dunia | Kelas | Dipakai stub | Isi |
| --- | --- | --- | --- |
| HUD | `.hf-hud` + `.hf-grid` | type, screen | gelap, grid 90 px yang bergeser pelan, pudar ke tepi |
| Lantai | `.hf-floor` | screen | grid kuning perspektif 66° yang bergulir ke arah penonton |
| Dinding kata | `.hf-wall` | type (otomatis saat hero pendek/angka) | hero diulang League Gothic 6 % opasitas, baris ganjil/genap bergeser berlawanan, satu kata menyala di mark |
| Kertas | `.hf-paper` + `.hf-form` | drawn | kertas terang (`--paper`) dengan formulir bergaris, kontras setelah beat gelap |
| Lampu sorot | `.hf-spot` | (blok) | kerucut cahaya dari atas, untuk satu beat "reveal" |
| Footage | klip + `.hf-grid` tipis | footage | klip penuh layar di bawah HUD yang sama |

**Sudut HUD** (`.hf-corners`: 4 siku garis rambut + 4 label mono 28 px) ada di semua dunia gelap. Labelnya ditulis ulang
per video (nama seri, "Live", "Rec", "Dramatisation" di footage AI) dan **tidak memuat angka** (setiap angka di layar harus
diucapkan). Siku kanan bawah menjauh dari rail kanan (150 px).

## Demo ponsel (stub screen)

Dari video acuan kedua user (promo aplikasi, 2026-11-06): ponsel yang meyakinkan, isinya tangkapan asli, kamera bermain
di sekitarnya. `.hf-phone` = bodi CSS (bingkai titanium, dynamic island, tombol samping, kilau), **layarnya selalu
screenshot atau rekaman layar asli** (`assets/screens/<beat>.png|.mp4`). Tidak pernah UI yang digambar atau di-generate.

- **Masuk:** ponsel naik dengan miring 3D yang mendarat (`back.out(1.2)`), lalu melayang pelan.
- **Tap + callout** (mark `tap`): cincin kuning di baris yang dibahas, lalu **potongan baris yang sama dari tangkapan yang
  sama** terangkat keluar ponsel (`.hf-callout`, background-image + posisi = baris itu, scale 1.24). Atur `ROW` di script.
- **Menyelam** (mark `dive`, opsional): kamera terbang masuk ke layar sampai tangkapan memenuhi frame (x2.62). Beat
  berikutnya bisa langsung melanjutkan isi layar itu full-bleed (rekaman layar → footage, seperti acuan).
- **Rekaman layar** (`.mp4`) lebih hidup dari screenshot: rekam langsung dari ponsel (Screen Recording), crop, tanpa notifikasi
  atau identitas orang.
- Blok tambahan: **tumpukan ponsel** (tiga tangkapan: varian / sebelum-sesudah / tiga langkah) dan **bento** (kartu fitur
  dari kalimat naskah) di `blocks.html`.

## Blok infografis (`blocks.html`)

Potongan siap tempel (markup + baris GSAP), dipakai di beat mana pun yang butuh lebih dari satu kalimat:
**monitor** (klip di dalam beat grafik: video + infografis dalam satu frame), **ring timer** (ring yang terkuras mengitari
satu angka yang diucapkan), **bars** (perbandingan), **checklist** di kertas (centang/coret per cue), **terminal** (perintah
diketik huruf per huruf, kursor berkedip jumlah tetap), **path text** (kalimat meluncur di garis lengkung), **lampu sorot**.
Satu beat = satu hero; blok adalah hero itu atau penopangnya, bukan tambahan dekorasi.

- **Warna:** hampir hitam (`--ground`), kartu abu tua (`--card`), kertas (`--paper`) untuk beat kontras, kuning (`--accent`)
  untuk kata kunci, lantai, dan ring; merah (`--alert`) hanya titik Rec dan coretan.
- **Tipografi (campur):**
  - Kalimat/judul: `.hf-head` = **Outfit 800**, sentence case, 96-128 px, tracking −0.035em, baris 0.98.
  - Angka dan kata pendek: `.hf-head.big` = **League Gothic** kapital 300-420 px (`--font-num`). Stub type dan footage
    memasangnya otomatis bila hero ≤ 10 karakter atau berisi angka ("5 DETIK", "STOP.", "Rp0").
  - Kicker: `.hf-kicker` = Outfit 700 kapital kuning dengan garis kuning di kiri, disapu masuk.
  - Caption: Outfit 800 kapital, pill gelap, kata aktif kuning.
- **Kata kunci:** bungkus satu kata dengan `<em>` di hero (kalau tidak ada, kata terakhir). Kata itu kuning, lalu di mark
  (`slam` / `tap` / `check`) dihantam **kotak kuning** yang disapu dari kiri sementara hurufnya jadi hitam dan mengecil
  dari 1.22 → 1. Satu kata kunci per beat.

## Gerak (kinetic per kata)

| Gerak | Isi | GSAP |
| --- | --- | --- |
| word slide | tiap kata naik dari balik topeng (`.w` overflow hidden, `<b>` yPercent 115 → 0, rotate 8° → 0) | `power4.out` 0,36-0,38 s, stagger ≤ 50 ms, kata terakhir mulai ≤ 0,25 s |
| key hit | kotak kuning disapu di belakang kata kunci + punch scale | `power4.out` 0,3 s di mark |
| punch kamera | seluruh frame 1 → 1.045 → 1.015 di mark | 0,08 s `power2.out` lalu 0,4 s `power3.out` |
| drift kamera | frame mendekat 1 → 1.05 dan geser 20 px selama beat | `none` |
| pop objek | ponsel/ikon masuk dengan sedikit overshoot | `back.out(1.3-1.7)` 0,45-0,55 s |
| ring tap | cincin kuning menutup + gelombang keluar | `back.out(2.5)` 0,24 s + wave 0,45 s |

- Hero tetap terbaca ≤ 0,3 s. Penekanan datang di kata cue (mark), bukan di awal beat.
- **Beat pertama video:** set `const FIRST = true` di scene type/footage-nya: hero sudah tampil di frame 0 (thumbnail), tanpa slide masuk; gerak datang dari kotak kunci di mark.
- **Grafik:** ikon SVG garis tebal (stroke 7-8) digambar dengan dash, lingkaran tipis di latar yang membesar pelan.
  Tanpa tiruan UI aplikasi.
- **Footage:** gelap, diberi scrim, kamera mundur pelan, grid HUD tipis + sudut Rec di atasnya; teks besar di atas dengan
  kilatan terang singkat di mark. Klip kedua dalam beat grafik → blok **monitor**, bukan full-bleed lagi.

## Hindari

Gaya default Claude yang diam-diam masuk kalau tidak dilarang. Sebut satu per satu, jangan cuma "hindari tampilan AI".

- **Warna:** gradien ungu-biru/neon, glow berwarna di belakang teks, latar abu terang. Hanya `--ground`, `--card`, `--paper`, kuning, merah.
- **Latar:** beat dengan latar polos tanpa dunia, dua beat berurutan di dunia yang sama, label sudut berisi angka/timecode palsu.
- **Bentuk:** glassmorphism (kartu blur transparan), sudut sangat bulat (> 24 px kecuali ponsel), bayangan lembut berlapis, garis tepi tipis abu.
- **Tipografi:** Outfit di bawah 700, semua kapital untuk kalimat Outfit (kapital hanya League Gothic dan kicker), teks rata tengah > 3 baris, tanda seru, emoji, lebih dari satu kata kunci kuning.
- **Ikon:** emoji sebagai ikon, ikon garis tipis gaya dashboard, ilustrasi orang/maskot, gembok 3D mengilap.
- **Gerak:** seluruh judul masuk sebagai satu blok, fade-in pelan sebagai satu-satunya gerak, elastic/bounce besar (`back.out` > 2.5), typewriter untuk judul (mengetik hanya di blok terminal), partikel/bokeh melayang, rotasi 3D kartu, loop dekoratif, frame yang diam total.
- **Batas:** kata masuk 300-400 ms, kotak kunci ≤ 300 ms, punch kamera ≤ 1.05, overshoot hanya pada objek (bukan teks).
