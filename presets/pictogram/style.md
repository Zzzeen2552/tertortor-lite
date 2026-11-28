# Preset: Pictogram Motion (rambu & ikon)

Dibuat dari pengamatan film demo "Pictogram Motion" di galeri lemo-opuscar (user 2026-11-23). Yang diambil hanya
**idenya** (dibaca dari gambar film demo). Teks `STYLE.md` mereka berlisensi CC BY-NC 4.0 dan **tidak disalin**; kode
preset ini ditulis sendiri. Jangan memakai cerita, judul, atau benda dari demo itu (payung di bus).

Intinya: **kartu kilat yang jatuh di ketukan, dibuat dari tiga bahan saja**: pola ubin persegi yang bergeser,
piktogram geometris (batang berujung bulat + kepala bulat), dan huruf sans tebal. Seperti rambu stasiun dan papan
layanan publik yang bercerita. Cocok untuk aturan, layanan publik, kisah kota, tips keselamatan, dan explainer yang
bisa diceritakan lewat orang, kendaraan, cuaca, rambu, dan benda.

## Alur yang cocok
1. **Hook (0-2 s)**: `type`, judul dua-tiga kata + satu piktogram besar di dalam cakram (benda inti masalahnya).
2. **Skala**: `drawn` = **grid hitung**: puluhan piktogram sama, satu beraksen ("satu dari sekian"). Angka di judul
   wajib diucapkan; grid sendiri tanpa angka.
3. **Bukti nyata**: `footage` = foto/klip Commons (atau dramatisasi) di dalam satu ubin besar, diwarnai bidang,
   dengan lencana piktogram yang menamai isinya.
4. **Langkah / aplikasi**: `screen` = screenshot **asli** di bingkai ponsel putih tebal, cincin aksen + tangan piktogram.
5. **Rute / urutan**: blok peta jalur (`blocks.html` § 5): halte menyala satu per satu di setiap kata.
6. **Penutup**: `type` dengan judul pelajaran + piktogram yang sama dengan hook (benda yang sama, keadaan berbeda).

## Bahan (kelas dari `preset.json → css`, sumber di `preset.css`, lalu `node presets/pictogram/build.mjs`)
- Bidang: `.pg-world` (kobalt) + `.pg-teal` / `.pg-red` / `.pg-night`. **Ganti bidang tiap beat**, satu warna per bab.
  `--f2`/`--f3` = nada terang/gelap bidang untuk pola.
- `.pg-tiles`: pola ubin 180 px (`t0`-`t7`: seperempat lingkaran, setengah lingkaran, titik, garis, cincin, ubin gelap,
  matahari kecil, kotak kuartal). Diisi skrip scene dengan hash tetap dari id beat (sama tiap render).
- `.pg-band`: pita polos warna bidang di belakang judul supaya huruf tidak bertabrakan dengan pola.
- `.pg-title`: Montserrat 900 kapital, putih, ukuran dihitung dari kata terpanjang; kata `<em>` = **tag aksen** (latar
  aksen, teks `--on-accent`), terbaca di semua bidang. `.pg-sub` kalimat pendek, `.pg-label` label mono di sudut.
- `.pg-ico`: piktogram SVG. `.s` batang putih berujung bulat, `.f` isian putih, `.d`/`.ds` detail malam, `.a`/`.as`
  **satu bagian aksen** = benda yang dibahas. `.pg-ico.hot` = ikon beraksen di grid hitung. `.pg-disc` = cakram gelap.
- `.pg-win` + `.tint`: ubin besar berisi footage (grayscale di bawah warna bidang). `.pg-phone` + `.pg-ring`: ponsel.
- `.pg-line` + `.pg-stop` (`.on`): peta jalur berhalte.
- Pustaka piktogram: `presets/pictogram/blocks.html` (orang berdiri/jalan/duduk/berdua, bus, motor + helm, mobil,
  rumah, koin, jam, ponsel layar mati, perisai, struk, kunci, matahari, awan hujan, peringatan, dilarang masuk, panah).

## Warna
Empat bidang tetap (kobalt `#2448A6`, tosca `#0F7A72`, merah `#E4552E`, malam `#141B3C`), putih untuk semua piktogram
dan huruf, dan **satu aksen** yang bisa diganti (Color tone: Kuning default, Hijau limau, Merah muda, Biru langit,
Oranye). Aksen hanya untuk satu hal per frame: benda inti, kata kunci, ikon yang dihitung, halte yang dicapai.

## Tipografi
- Montserrat 900 kapital untuk judul (160-190 px, rapat), Montserrat 800 untuk kalimat dan caption, Space Mono untuk
  label sudut (30 px, kapital, renggang). Label sudut hanya kata; angka di layar wajib diucapkan.
- Caption: kotak malam bersudut 10 px, teks putih 64 px, kata aktif aksen, maks. tiga kata, di y 1190.

## Gerak
- Kepribadian: **energik dan jatuh di ketukan** (kartu kilat). Masuk 0,2-0,3 s `power3.out`; piktogram dan cakram
  `back.out(1.6-2)` (overshoot kecil); tidak ada gerak yang lebih lama dari 0,32 s kecuali gerak ambien.
- Tiga lapis gerak: **primer** = judul naik per kata + piktogram muncul; **sekunder** = cakram, lencana, kaki berjalan
  (ayun 0,25 s); **ambien** = pola ubin bergeser satu ubin sepanjang beat (`ease: "none"`), arahnya beda tiap register.
- Transisi = ubin membalik masuk mengikuti diagonal (stagger total 0,22 s) di awal setiap beat.
- Grid hitung: ikon muncul baris demi baris (total ≤ 0,3 s); di mark `hit` yang lain meredup ke 32 % dan satu ikon
  melompat dengan halo aksen. Mark `pop` = benda aksen melompat; `slam` = lencana footage berdenyut; `tap` = tangan
  menekan + cincin; `stop` = halte menyala.
- **Setiap cut di ketukan** (`node tools/music.mjs`, skor otomatis 110-128 BPM); SFX preset: `tick` di cut, `pop` di
  `pop`/`tap`, `tick` di `hit`/`stop`, `hit` di `slam`.

## Footage
- Commons dulu (foto halte, jalan, gedung, kendaraan asli), generate hanya untuk dramatisasi. Selalu di dalam `.pg-win`
  dengan tint bidang; tidak pernah full-bleed berwarna asli. Wajah tidak menjadi pusat.

## Hindari
- **Ikon gaya lain**: garis tipis ala UI, ikon outline Material/Feather, emoji, ikon 3D/gradien, maskot, wajah pada
  piktogram. Semua piktogram dibuat dari batang tebal berujung bulat dan bentuk penuh.
- **Gradien, bayangan lembut, glow, tekstur kertas**: semuanya datar seperti rambu cetak.
- **Grafik batang/pie** untuk angka sederhana: pakai grid hitung atau angka besar.
- **UI aplikasi atau chat yang digambar**: layar hanya screenshot asli; tanpa screenshot = ponsel layar mati dari blok.
- **Lebih dari satu aksen per frame**, dua beat berurutan dengan bidang sama, pola ubin yang diam.
- **Teks**: italic, serif, huruf tangan, judul lebih dari empat kata, label sudut berisi angka yang tidak diucapkan.
- **Batas**: judul 220 ms, piktogram 280 ms, cakram 300 ms, jendela footage 300 ms, ponsel 320 ms, cincin 200 ms,
  ubin 180 ms per ubin; stagger total ≤ 300 ms.
