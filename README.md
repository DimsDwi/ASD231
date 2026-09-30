# RuangKerja - Corporate Room Booking & Meeting Management System

Sistem web modern untuk manajemen peminjaman ruang rapat, ruang presentasi, dan pod fokus perkantoran dengan deteksi bentrok jadwal otomatis (*Anti-Conflict Realtime Guard*).

---

## 🚀 Fitur Utama

1. **Jadwal & Kalender Interaktif:**
   - **Tampilan Kalender Bulanan:** Menampilkan agenda pertemuan tiap tanggal lengkap dengan badge warna per ruangan.
   - **Timeline Harian (Matrix View):** Menampilkan perbandingan jadwal jam-per-jam (08:00 - 18:00 WIB) antar ruangan secara visual.
   - **Filter Kalender:** Filter jadwal berdasarkan ruangan tertentu.

2. **Daftar & Manajemen Ruangan Perkantoran:**
   - Katalog foto ruangan modern beresolusi tinggi.
   - Indikator ketersediaan *real-time* (**Tersedia** vs **Sedang Dipakai** dengan animasi denyut).
   - Filter cepat berdasarkan:
     - Tipe Ruangan (Boardroom, Meeting Room, Focus Pod, Ideation Lab, Auditorium).
     - Lantai gedung (Lantai 1 - Lantai 5).
     - Kapasitas peserta (>= 4, 8, 15, 50 orang).
   - Fasilitas lengkap: 4K Smart TV, Logitech Zoom PTZ, Digital Whiteboard, High-Speed WiFi, Soundproof Pod, Coffee Station.

3. **Formulir Peminjaman & Anti-Bentrok Cerdas:**
   - **Pencegahan Tabrakan Jadwal (Conflict Guard):** Sistem otomatis memeriksa ketersediaan slot jam saat pengguna memilih tanggal & jam. Jika bertabrakan dengan agenda lain, sistem langsung memberi peringatan dan melarang pemesanan ganda.
   - Validasi kapasitas: Memastikan jumlah peserta tidak melampaui kapasitas maksimum ruangan.
   - Formulir terstruktur: Nama pemohon, email kantor, departemen, estimasi peserta, dan catatan kebutuhan khusus (kopi, proyektor, kabel HDMI/Type-C).

4. **Riwayat & Manajemen Peminjaman:**
   - Tabel agenda rapat lengkap dengan filter departemen dan status.
   - Detail reservasi & opsi pembatalan peminjaman (*Cancel Booking*).
   - **Ekspor CSV:** Unduh laporan rekap jadwal rapat ke format spreadsheet/Excel.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, CORS, Morgan logger
- **Database:** SQLite (menggunakan driver performa tinggi `better-sqlite3` dengan WAL mode)
- **Frontend:** Single Page Application (HTML5, Tailwind CSS via CDN, Lucide Icons, Vanilla JavaScript)

---

## 🏃 Cara Menjalankan

Aplikasi saat ini telah berjalan di latar belakang pada:
👉 **[http://localhost:3000](http://localhost:3000)**

Jika Anda ingin menjalankan ulang di kemudian hari:

```bash
cd room-booking-app
npm start
```

Akses web browser Anda di: `http://localhost:3000`

---

## 📋 Struktur Direktori

```text
room-booking-app/
├── database.sqlite       # Database SQLite lokal (otomatis dibuat dan diisi data awal)
├── db.js                 # Skema tabel dan seed data awal ruangan & jadwal
├── package.json          # Konfigurasi dependensi npm
├── server.js             # API Express.js (CRUD Peminjaman, Validasi Anti-Bentrok, Ruangan)
└── public/               # Antarmuka Web
    ├── css/
    │   └── custom.css    # Style kustom, animasi pulse, dan grid kalender
    ├── js/
    │   └── app.js        # Logika dinamis client-side (Kalender, Timeline, Live Check)
    └── index.html        # Halaman utama aplikasi
```
