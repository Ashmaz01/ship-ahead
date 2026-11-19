# Ship Ahead: MVP Spec

Nama game: **Ship Ahead**. Map pertama belum dinamakan (cadangan: "Gunung Berapi").

Diilhamkan daripada Numbers Up! Volcanic Panic, tetapi dengan papan dan sistem sendiri. Bukan salinan.

## Konsep
- Game kuiz papan bertema gunung berapi. Pemain berlumba ke kapal untuk lari daripada lava dan abu.
- App mobile dibina dengan Expo (React Native).
- Bahasa UI dan soalan: English. Bahasa Melayu ditambah kemudian dalam settings.

## Pemain dan giliran
- 2 hingga 6 pemain, pass-and-play, bergilir.
- Setiap giliran:
  1. Guna power (pilihan, sebelum baling dadu). Simpanan maksimum 2.
  2. Baling dadu dan bergerak.
  3. Jika mendarat di petak soalan, jawab soalan.

## Papan
- Grid 7 x 7.
- Laluan berbentuk ular, satu arah, dari titik mula ke dua kapal di hujung papan.
- Pemain pertama sampai ke kapal menang.
- Jika pemasa tamat (bila diaktifkan), pemain dengan mata tertinggi menang.
- Lava dan abu bergerak 1 petak setiap giliran ke arah kapal.
- Pemain yang terkena lava atau abu kehilangan satu giliran. Power "selamatkan diri" mencegah kesan ini.
- Anggaran tempoh permainan: 10 hingga 15 minit untuk 2 pemain, 25 hingga 35 minit untuk 4 pemain. Perlu disahkan melalui ujian main.
- Petak power-up: 6 hingga 8, bilangan tetap, diletakkan rawak setiap permainan.
- Warna setiap petak menentukan jenis soalan.

## Power-up
- Tiga jenis:
  - Lompat ke depan beberapa petak.
  - Selamatkan diri daripada satu bahaya.
  - Undur pemain lawan beberapa petak.
- Diperoleh bila mendarat di petak power-up dan jawab betul.
- Digunakan sebelum baling dadu. Simpanan maksimum 2.

## Soalan
- Jenis MVP: aneka pilihan, isi tempat kosong, corak nombor, masalah perkataan.
- Subjek dan sasaran, jumlah sekitar 1,000:
  - Matematik: 600 (dijana dengan skrip)
  - Sains: 150
  - English: 150
  - Bahasa Arab (makna perkataan, aneka pilihan): 100. Tema: keluarga, makanan, sekolah, badan, haiwan.
- Disimpan dalam fail JSON.
- Agama dan fiqh tidak masuk MVP. Ditangguh.

## Tahap kesukaran
| Tahap | Pemasa (saat) | Mata betul | Undur bila salah (petak) |
|-------|---------------|------------|--------------------------|
| Mudah | 30 | 1 | 1 |
| Sederhana | 20 | 2 | 2 |
| Sukar | 15 | 3 | 3 |

## Skrin setup (sebelum main)
- Pilih subjek.
- Pilih jenis soalan.
- Pilih tahap.
- Pemasa on atau off.
- Bilangan pemain (2 hingga 6).
- Avatar setiap pemain. 6 pilihan avatar, tanpa kebolehan khas.

## Penyimpanan
- Tiada simpanan permainan dalam MVP.
- Hanya tetapan setup disimpan.

## Pause
- Menu pause tersedia semasa permainan. Pemasa berhenti.
- Pemain boleh sambung semula dalam sesi yang sama.
- Jika app ditutup, permainan hilang (sejajar dengan tiada simpanan).

## Visual
- Asas arang gelap. Lava oren-merah untuk bahaya. Biru laut untuk kapal. Teks putih.
- Gunung berapi ialah satu elemen yang menonjol. Elak palet krim-terracotta dan kad berbentuk template.
- Butang sekurang-kurangnya 44px.
- Animasi boleh dikurangkan untuk pengguna yang memilihnya.
- Kontras teks mencapai WCAG AA.

## Penceritaan
- Setiap map ada scene ringkas di awal, sebelum skrin setup.
- Format: 2 hingga 3 skrin teks dengan gambar statik. Boleh di-skip.
- Dipaparkan sekali untuk setiap map. Pemain boleh tengok semula dari menu.
- Teks cerita dalam English. Draf oleh saya, semakan oleh awak.

## Di luar MVP (ditangguh)
- Bahasa Melayu dalam settings.
- Soalan agama dan fiqh.
- Statistik pemain.
- Multiplayer dalam talian.
- Watak dengan kebolehan khas.
- Simpan permainan.
- Tema bencana lain.
