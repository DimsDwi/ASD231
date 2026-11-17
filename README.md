# RuangKerja - Corporate Room Booking & Meeting Management System

Sistem web modern untuk manajemen peminjaman ruang rapat, ruang presentasi, dan pod fokus perkantoran dengan deteksi bentrok jadwal otomatis (*Anti-Conflict Realtime Guard*), **Autentikasi Pengguna & Role-Based Access Control (RBAC)**, serta **CRUD Lengkap** untuk Ruangan dan Peminjaman.

---

## 🚀 Fitur Utama

### 1. 🔐 Autentikasi Pengguna & RBAC (Role-Based Access Control)
- **Registrasi Akun:** Karyawan dapat mendaftar dengan Nama, Email Kantor, Password, dan Departemen.
- **Login Terenkripsi:** Menggunakan kriptografi hashing `scrypt` dan JSON Web Token (JWT) standar RFC 7519.
- **Dua Peran (Roles):**
  - 👑 **ADMIN (Administrator):**
    - Hak penuh CRUD Ruangan (Tambah ruang, Edit spesifikasi & fasilitas, Hapus/nonaktifkan ruang).
    - Hak mengedit atau membatalkan seluruh reservasi ruangan dari departemen mana pun.
    - Mengubah status reservasi secara langsung.
  - 💼 **EMPLOYEE (Karyawan / User):**
    - Melakukan peminjaman ruangan dengan form yang otomatis terisi identitasnya.
    - Mengubah (Update/Edit) jadwal peminjaman miliknya sendiri.
    - Membatalkan (Cancel) reservasi miliknya sendiri.
    - Filter tampilan "Hanya Booking Saya".
- **⚡ 1-Click Demo Login:** Tombol cepat di navigasi untuk langsung masuk sebagai Admin atau Karyawan tanpa perlu mengetik manual.

### 2. 🏢 CRUD Lengkap Data Ruangan (Room Management)
- **Create:** Admin dapat menambahkan ruangan baru lengkap dengan kode, tipe, lantai gedung, kapasitas, palet warna, foto, fasilitas, dan deskripsi.
- **Read:** Menampilkan katalog ruangan responsif dengan indikator ketersediaan real-time (*Tersedia* vs *Sedang Dipakai*). Filter instan berdasarkan tipe ruang, lantai, dan kapasitas.
- **Update:** Admin dapat mengedit ruangan kapan saja.
- **Delete:** Admin dapat menonaktifkan ruangan dengan aman.

### 3. 📅 CRUD Lengkap Peminjaman (Booking Management)
- **Create:** Reservasi ruangan dengan pencegahan tabrakan jadwal (*Anti-Conflict Engine*).
- **Read:** Kalender interaktif bulanan, Timeline harian matrix jam 08:00 - 18:00, serta tabel agenda komprehensif.
- **Update:** Mengubah jam, tanggal, jumlah peserta, atau catatan agenda dengan validasi bentrok jadwal real-time.
- **Delete / Cancel:** Pembatalan reservasi oleh pemilik atau administrator.

### 4. 📊 Ekspor & Laporan
- **Ekspor CSV:** Unduh rekapitulasi data seluruh jadwal rapat ke format spreadsheet / Excel.

---

## 🔑 Akun Demo Bawaan

| Role | Email | Password | Hak Akses |
|---|---|---|---|
| 👑 **Administrator** | `admin@corporate.com` | `admin123` | Akses penuh: Tambah/Edit/Hapus Ruangan, Kelola semua booking |
| 💼 **Karyawan 1** | `budi.santoso@corporate.com` | `user123` | Buat reservasi, Edit & Batal booking miliknya sendiri |
| 💼 **Karyawan 2** | `dewi.lestari@corporate.com` | `user123` | Buat reservasi, Edit & Batal booking miliknya sendiri |

---

## 🛠️ Tech Stack & Arsitektur

- **Backend:** Node.js, Express.js, CORS, Morgan logger
- **Security & Auth:** Built-in `crypto` (scrypt password hashing & HMAC-SHA256 JWT tokens)
- **Database:** SQLite (driver `better-sqlite3` dengan WAL mode & relasi foreign key)
- **Frontend:** Single Page Application (HTML5, Tailwind CSS via CDN, Lucide Icons, Vanilla JavaScript)

---

## 📡 Dokumentasi Endpoint API

### Autentikasi
- `POST /api/auth/register` — Pendaftaran akun karyawan baru
- `POST /api/auth/login` — Autentikasi dan penerbitan token JWT
- `GET /api/auth/me` — Info profil pengguna login saat ini (memerlukan Bearer token)
- `GET /api/users` — Daftar seluruh user terdaftar (Admin only)

### CRUD Ruangan
- `GET /api/rooms` — Mengambil daftar ruangan aktif beserta status ketersediaan
- `GET /api/rooms/:id` — Mengambil detail spesifikasi dan agenda ruangan
- `POST /api/rooms` — Menambah ruangan baru (Admin only)
- `PUT /api/rooms/:id` — Mengubah data ruangan (Admin only)
- `DELETE /api/rooms/:id` — Menonaktifkan ruangan (Admin only)

### CRUD Peminjaman
- `GET /api/bookings` — Mengambil data booking (Filter: date, room, dept, my_bookings)
- `GET /api/bookings/:id` — Detail booking tunggal
- `POST /api/check-conflict` — Pengecekan tabrakan slot waktu secara proaktif
- `POST /api/bookings` — Membuat reservasi ruangan baru
- `PUT /api/bookings/:id` — Mengubah reservasi yang sudah ada (Owner atau Admin)
- `DELETE /api/bookings/:id` — Membatalkan reservasi (Owner atau Admin)

---

## 🏃 Cara Menjalankan

```bash
cd room-booking-app
npm start
```

Buka browser Anda dan akses:
👉 **`http://localhost:3000`**
