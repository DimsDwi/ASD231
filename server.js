const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./auth-utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to check if two time ranges overlap (HH:MM format)
function isTimeOverlapping(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

// ==================== AUTHENTICATION MIDDLEWARES ====================

// Mandatory Authentication
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Autentikasi diperlukan. Silakan masuk (login) terlebih dahulu.'
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Token otentikasi tidak valid atau telah kedaluwarsa. Silakan login kembali.'
    });
  }

  // Fetch current user from DB to ensure still active
  const user = db.prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?').get(payload.id);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Pengguna tidak ditemukan dalam sistem.'
    });
  }

  req.user = user;
  next();
}

// Optional Authentication (sets req.user if token provided, but doesn't block)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (payload) {
      const user = db.prepare('SELECT id, name, email, role, department, created_at FROM users WHERE id = ?').get(payload.id);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

// Require Admin Role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator.'
    });
  }
  next();
}

// ==================== AUTHENTICATION ROUTES ====================

// POST /api/auth/register - Register new user
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi seluruh kolom pendaftaran (Nama, Email, Password, Departemen).'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal harus 6 karakter.' });
    }

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email tersebut sudah terdaftar. Silakan gunakan email lain atau langsung login.'
      });
    }

    const { hash, salt } = hashPassword(password);
    const insertStmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, department)
      VALUES (?, ?, ?, ?, 'EMPLOYEE', ?)
    `);

    const result = insertStmt.run(name.trim(), cleanEmail, hash, salt, department.trim());
    const newUser = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      email: cleanEmail,
      role: 'EMPLOYEE',
      department: department.trim()
    };

    const token = signToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Selamat datang di RuangKerja.',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat registrasi.' });
  }
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password yang Anda masukkan salah.'
      });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password yang Anda masukkan salah.'
      });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    const token = signToken(userPayload);

    res.json({
      success: true,
      message: `Login berhasil! Selamat datang kembali, ${user.name}.`,
      token,
      user: userPayload
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat login.' });
  }
});

// GET /api/auth/me - Get current logged-in user details
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// GET /api/users - List all users (Admin only)
app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, department, created_at FROM users ORDER BY name ASC').all();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar pengguna.' });
  }
});

// ==================== DASHBOARD STATS ====================

// GET /api/stats - Dashboard summary metrics
app.get('/api/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM

    const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE is_active = 1').get().count;
    const bookingsToday = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE date = ? AND status = 'CONFIRMED'").get(today).count;
    
    // Ongoing meetings right now
    const ongoingQuery = db.prepare(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE date = ? AND status = 'CONFIRMED' AND start_time <= ? AND end_time > ?
    `).get(today, nowTime, nowTime);

    // Total upcoming bookings from today onwards
    const upcomingCount = db.prepare(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE (date > ? OR (date = ? AND end_time >= ?)) AND status = 'CONFIRMED'
    `).get(today, today, nowTime).count;

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    res.json({
      success: true,
      stats: {
        totalRooms,
        bookingsToday,
        ongoingMeetings: ongoingQuery.count,
        upcomingBookings: upcomingCount,
        totalUsers,
        serverTime: nowTime,
        serverDate: today
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat statistik sistem.' });
  }
});

// ==================== ROOM CRUD ROUTES ====================

// 1. GET /api/rooms - Read all active rooms with search & filter
app.get('/api/rooms', (req, res) => {
  try {
    const { type, floor, minCapacity, search } = req.query;
    let query = 'SELECT * FROM rooms WHERE is_active = 1';
    const params = [];

    if (type && type !== 'ALL') {
      query += ' AND type = ?';
      params.push(type);
    }
    if (floor && floor !== 'ALL') {
      query += ' AND floor = ?';
      params.push(floor);
    }
    if (minCapacity && !isNaN(minCapacity)) {
      query += ' AND capacity >= ?';
      params.push(parseInt(minCapacity, 10));
    }
    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ? OR facilities LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY capacity ASC, name ASC';
    const rooms = db.prepare(query).all(...params);

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);

    const checkStmt = db.prepare(`
      SELECT * FROM bookings 
      WHERE room_id = ? AND date = ? AND status = 'CONFIRMED'
      ORDER BY start_time ASC
    `);

    const enhancedRooms = rooms.map(room => {
      let facilities = [];
      try {
        facilities = JSON.parse(room.facilities);
      } catch (e) {
        facilities = [];
      }

      const todayBookings = checkStmt.all(room.id, today);
      const currentBooking = todayBookings.find(b => b.start_time <= nowTime && b.end_time > nowTime);
      const nextBooking = todayBookings.find(b => b.start_time > nowTime);

      return {
        ...room,
        facilities,
        is_occupied: Boolean(currentBooking),
        current_booking: currentBooking || null,
        next_booking: nextBooking || null,
        today_bookings_count: todayBookings.length
      };
    });

    res.json({ success: true, data: enhancedRooms });
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar ruangan.' });
  }
});

// 2. GET /api/rooms/:id - Read single room detail
app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }
    try {
      room.facilities = JSON.parse(room.facilities || '[]');
    } catch (e) {
      room.facilities = [];
    }

    const today = new Date().toISOString().split('T')[0];
    const upcomingBookings = db.prepare(`
      SELECT b.*, u.name as booker_user_name
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.room_id = ? AND b.date >= ? AND b.status = 'CONFIRMED'
      ORDER BY b.date ASC, b.start_time ASC
      LIMIT 10
    `).all(room.id, today);

    res.json({ success: true, data: { ...room, upcomingBookings } });
  } catch (err) {
    console.error('Error fetching room detail:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail ruangan.' });
  }
});

// 3. POST /api/rooms - CREATE room (Admin Only)
app.post('/api/rooms', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, code, type, floor, capacity, facilities, color, image_url, description } = req.body;

    if (!name || !code || !type || !floor || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Mohon isi kolom wajib ruangan (Nama, Kode, Tipe, Lantai, Kapasitas).'
      });
    }

    // Check uniqueness of room code
    const existing = db.prepare('SELECT id FROM rooms WHERE code = ?').get(code.trim().toUpperCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Kode ruangan "${code}" sudah digunakan oleh ruangan lain.`
      });
    }

    const facilitiesJson = Array.isArray(facilities) 
      ? JSON.stringify(facilities) 
      : (typeof facilities === 'string' ? facilities : JSON.stringify([]));

    const insertStmt = db.prepare(`
      INSERT INTO rooms (name, code, type, floor, capacity, facilities, color, image_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      name.trim(),
      code.trim().toUpperCase(),
      type.trim(),
      floor.trim(),
      parseInt(capacity, 10),
      facilitiesJson,
      color || '#4f46e5',
      image_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      description ? description.trim() : ''
    );

    const newRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
    newRoom.facilities = JSON.parse(newRoom.facilities);

    res.status(201).json({
      success: true,
      message: `Ruangan "${newRoom.name}" (${newRoom.code}) berhasil ditambahkan!`,
      data: newRoom
    });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat membuat ruangan.' });
  }
});

// 4. PUT /api/rooms/:id - UPDATE room (Admin Only)
app.put('/api/rooms/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const roomId = req.params.id;
    const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }

    const { name, code, type, floor, capacity, facilities, color, image_url, description, is_active } = req.body;

    if (!name || !code || !type || !floor || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Mohon isi seluruh kolom wajib ruangan.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const duplicate = db.prepare('SELECT id FROM rooms WHERE code = ? AND id != ?').get(cleanCode, roomId);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Kode ruangan "${cleanCode}" sudah digunakan oleh ruangan lain.`
      });
    }

    const facilitiesJson = Array.isArray(facilities) 
      ? JSON.stringify(facilities) 
      : (typeof facilities === 'string' ? facilities : existing.facilities);

    const updateStmt = db.prepare(`
      UPDATE rooms 
      SET name = ?, code = ?, type = ?, floor = ?, capacity = ?, facilities = ?, color = ?, image_url = ?, description = ?, is_active = ?
      WHERE id = ?
    `);

    updateStmt.run(
      name.trim(),
      cleanCode,
      type.trim(),
      floor.trim(),
      parseInt(capacity, 10),
      facilitiesJson,
      color || existing.color,
      image_url || existing.image_url,
      description ? description.trim() : '',
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      roomId
    );

    const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    updatedRoom.facilities = JSON.parse(updatedRoom.facilities);

    res.json({
      success: true,
      message: `Ruangan "${updatedRoom.name}" berhasil diperbarui!`,
      data: updatedRoom
    });
  } catch (err) {
    console.error('Error updating room:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data ruangan.' });
  }
});

// 5. DELETE /api/rooms/:id - DELETE room (Admin Only)
app.delete('/api/rooms/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const roomId = req.params.id;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }

    // Hard delete or Soft delete depending on query
    if (req.query.hard === 'true') {
      db.prepare('DELETE FROM bookings WHERE room_id = ?').run(roomId);
      db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
      return res.json({
        success: true,
        message: `Ruangan "${room.name}" berserta riwayatnya berhasil dihapus secara permanen.`
      });
    }

    // Default: Soft delete (is_active = 0)
    db.prepare('UPDATE rooms SET is_active = 0 WHERE id = ?').run(roomId);

    res.json({
      success: true,
      message: `Ruangan "${room.name}" berhasil dinonaktifkan.`
    });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus ruangan.' });
  }
});

// ==================== BOOKING CRUD ROUTES ====================

// 1. GET /api/bookings - Read bookings with filters
app.get('/api/bookings', optionalAuth, (req, res) => {
  try {
    const { room_id, date, start_date, end_date, department, status, my_bookings } = req.query;
    let query = `
      SELECT b.*, 
             r.name as room_name, r.code as room_code, r.floor as room_floor, r.color as room_color, r.type as room_type, r.capacity as room_capacity,
             u.name as user_account_name, u.role as user_account_role
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (room_id && room_id !== 'ALL') {
      query += ' AND b.room_id = ?';
      params.push(room_id);
    }
    if (date) {
      query += ' AND b.date = ?';
      params.push(date);
    }
    if (start_date && end_date) {
      query += ' AND b.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    if (department && department !== 'ALL') {
      query += ' AND b.department = ?';
      params.push(department);
    }
    if (status && status !== 'ALL') {
      query += ' AND b.status = ?';
      params.push(status);
    } else if (!status) {
      query += " AND b.status = 'CONFIRMED'";
    }

    // If requested only current user's bookings
    if (my_bookings === 'true' && req.user) {
      query += ' AND (b.user_id = ? OR b.booker_email = ?)';
      params.push(req.user.id, req.user.email);
    }

    query += ' ORDER BY b.date ASC, b.start_time ASC';

    const bookings = db.prepare(query).all(...params);
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data peminjaman.' });
  }
});

// 2. GET /api/bookings/:id - Read single booking detail
app.get('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, 
             r.name as room_name, r.code as room_code, r.floor as room_floor, r.color as room_color, r.type as room_type, r.capacity as room_capacity,
             u.name as user_account_name, u.role as user_account_role
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Error fetching booking detail:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail peminjaman.' });
  }
});

// 3. POST /api/check-conflict - Proactive collision check before submission
app.post('/api/check-conflict', (req, res) => {
  try {
    const { room_id, date, start_time, end_time, exclude_booking_id } = req.body;

    if (!room_id || !date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Parameter tidak lengkap untuk pengecekan.' });
    }

    let query = `
      SELECT b.*, r.name as room_name 
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.room_id = ? AND b.date = ? AND b.status = 'CONFIRMED'
    `;
    const params = [room_id, date];

    if (exclude_booking_id) {
      query += ' AND b.id != ?';
      params.push(exclude_booking_id);
    }

    const existingBookings = db.prepare(query).all(...params);

    const conflictingBooking = existingBookings.find(b =>
      isTimeOverlapping(start_time, end_time, b.start_time, b.end_time)
    );

    if (conflictingBooking) {
      return res.json({
        hasConflict: true,
        conflict: conflictingBooking,
        message: `Jadwal bertabrakan dengan agenda "${conflictingBooking.title}" (${conflictingBooking.start_time} - ${conflictingBooking.end_time}) oleh ${conflictingBooking.booker_name} (${conflictingBooking.department}).`
      });
    }

    return res.json({ hasConflict: false, message: 'Jadwal ruangan tersedia!' });
  } catch (err) {
    console.error('Error checking conflict:', err);
    res.status(500).json({ success: false, message: 'Gagal memeriksa ketersediaan jadwal.' });
  }
});

// 4. POST /api/bookings - CREATE new booking (Authenticated)
app.post('/api/bookings', authenticate, (req, res) => {
  try {
    const {
      room_id,
      title,
      booker_name,
      booker_email,
      department,
      date,
      start_time,
      end_time,
      participants_count,
      notes
    } = req.body;

    // Basic Validation
    if (!room_id || !title || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi semua kolom wajib (Ruangan, Judul Agenda, Tanggal, Jam Mulai & Selesai).'
      });
    }

    // Default booker details from logged in user if not provided
    const finalName = (booker_name || req.user.name).trim();
    const finalEmail = (booker_email || req.user.email).trim();
    const finalDept = (department || req.user.department).trim();

    // Time sequence validation
    if (start_time >= end_time) {
      return res.status(400).json({
        success: false,
        message: 'Jam selesai harus lebih akhir daripada jam mulai.'
      });
    }

    // Verify room exists and active
    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(room_id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan yang dipilih tidak ditemukan atau non-aktif.' });
    }

    // Check capacity limit
    const pCount = parseInt(participants_count, 10) || 1;
    if (pCount > room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Kapasitas ruangan ${room.name} maksimal ${room.capacity} orang (Anda menginput ${pCount} peserta). Silakan pilih ruangan yang lebih besar.`
      });
    }

    // ANTI-COLLISION CHECK
    const existingBookings = db.prepare(`
      SELECT b.*, r.name as room_name 
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.room_id = ? AND b.date = ? AND b.status = 'CONFIRMED'
    `).all(room_id, date);

    const collision = existingBookings.find(b =>
      isTimeOverlapping(start_time, end_time, b.start_time, b.end_time)
    );

    if (collision) {
      return res.status(409).json({
        success: false,
        isConflict: true,
        message: `Jadwal bentrok! Ruangan "${room.name}" sudah dibooking pada jam ${collision.start_time} - ${collision.end_time} untuk agenda "${collision.title}" (${collision.booker_name} - ${collision.department}). Silakan pilih slot jam lain atau ruangan alternatif.`,
        conflictDetails: collision
      });
    }

    // Insert new booking with user_id
    const insertStmt = db.prepare(`
      INSERT INTO bookings (room_id, user_id, title, booker_name, booker_email, department, date, start_time, end_time, participants_count, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
    `);

    const info = insertStmt.run(
      room_id,
      req.user.id,
      title.trim(),
      finalName,
      finalEmail,
      finalDept,
      date,
      start_time,
      end_time,
      pCount,
      notes ? notes.trim() : ''
    );

    const newBooking = db.prepare(`
      SELECT b.*, r.name as room_name, r.code as room_code, r.floor as room_floor, r.color as room_color, r.type as room_type
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `).get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: `Peminjaman ruangan "${room.name}" berhasil dikonfirmasi!`,
      data: newBooking
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat menyimpan peminjaman.' });
  }
});

// 5. PUT /api/bookings/:id - UPDATE booking (Owner or Admin)
app.put('/api/bookings/:id', authenticate, (req, res) => {
  try {
    const bookingId = req.params.id;
    const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    // Authorization: only the owner OR an Admin can edit
    const isOwner = (existing.user_id && existing.user_id === req.user.id) || (existing.booker_email.toLowerCase() === req.user.email.toLowerCase());
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda hanya dapat mengubah peminjaman yang Anda buat sendiri.'
      });
    }

    const {
      room_id = existing.room_id,
      title = existing.title,
      department = existing.department,
      date = existing.date,
      start_time = existing.start_time,
      end_time = existing.end_time,
      participants_count = existing.participants_count,
      notes = existing.notes,
      status = existing.status
    } = req.body;

    if (start_time >= end_time) {
      return res.status(400).json({
        success: false,
        message: 'Jam selesai harus lebih akhir daripada jam mulai.'
      });
    }

    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND is_active = 1').get(room_id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }

    const pCount = parseInt(participants_count, 10) || 1;
    if (pCount > room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Kapasitas ruangan ${room.name} maksimal ${room.capacity} orang (Anda menginput ${pCount} peserta).`
      });
    }

    // Collision check excluding current booking
    const existingBookings = db.prepare(`
      SELECT b.*, r.name as room_name 
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.room_id = ? AND b.date = ? AND b.status = 'CONFIRMED' AND b.id != ?
    `).all(room_id, date, bookingId);

    const collision = existingBookings.find(b =>
      isTimeOverlapping(start_time, end_time, b.start_time, b.end_time)
    );

    if (collision) {
      return res.status(409).json({
        success: false,
        isConflict: true,
        message: `Jadwal bentrok dengan agenda "${collision.title}" (${collision.start_time} - ${collision.end_time}).`,
        conflictDetails: collision
      });
    }

    // Only Admin can change status through PUT
    const finalStatus = (isAdmin && status) ? status : existing.status;

    const updateStmt = db.prepare(`
      UPDATE bookings 
      SET room_id = ?, title = ?, department = ?, date = ?, start_time = ?, end_time = ?, participants_count = ?, notes = ?, status = ?
      WHERE id = ?
    `);

    updateStmt.run(
      room_id,
      title.trim(),
      department.trim(),
      date,
      start_time,
      end_time,
      pCount,
      notes ? notes.trim() : '',
      finalStatus,
      bookingId
    );

    const updated = db.prepare(`
      SELECT b.*, r.name as room_name, r.code as room_code, r.floor as room_floor, r.color as room_color, r.type as room_type
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `).get(bookingId);

    res.json({
      success: true,
      message: `Peminjaman "${updated.title}" berhasil diperbarui!`,
      data: updated
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui peminjaman.' });
  }
});

// 6. DELETE /api/bookings/:id - Cancel or Delete booking (Owner or Admin)
app.delete('/api/bookings/:id', authenticate, (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    const isOwner = (booking.user_id && booking.user_id === req.user.id) || (booking.booker_email.toLowerCase() === req.user.email.toLowerCase());
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda tidak berhak membatalkan reservasi ini.'
      });
    }

    // Hard delete if Admin specifically queries ?hard=true
    if (isAdmin && req.query.hard === 'true') {
      db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
      return res.json({
        success: true,
        message: `Peminjaman agenda "${booking.title}" telah dihapus secara permanen.`
      });
    }

    // Default: Soft delete / Cancel
    db.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?").run(bookingId);

    res.json({
      success: true,
      message: `Peminjaman agenda "${booking.title}" berhasil dibatalkan.`
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ success: false, message: 'Gagal membatalkan peminjaman.' });
  }
});

// 7. POST /api/bookings/:id/checkin - Check-in ke ruangan saat rapat mulai (Anti-Ghost Meeting)
app.post('/api/bookings/:id/checkin', authenticate, (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'Peminjaman ini sudah dibatalkan.' });
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('UPDATE bookings SET checked_in_at = ? WHERE id = ?').run(now, bookingId);

    res.json({
      success: true,
      message: `Check-in berhasil untuk agenda "${booking.title}". Selamat berdiskusi!`,
      checked_in_at: now
    });
  } catch (err) {
    console.error('Error checkin booking:', err);
    res.status(500).json({ success: false, message: 'Gagal melakukan check-in ruangan.' });
  }
});

// 8. POST /api/bookings/:id/release - Selesai lebih awal & bebaskan ruangan (Early Release)
app.post('/api/bookings/:id/release', authenticate, (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    const isOwner = (booking.user_id && booking.user_id === req.user.id) || (booking.booker_email.toLowerCase() === req.user.email.toLowerCase());
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const nowTime = new Date().toTimeString().slice(0, 5); // HH:MM
    // Set end_time to nowTime if nowTime is between start_time and end_time
    if (nowTime > booking.start_time && nowTime < booking.end_time) {
      db.prepare('UPDATE bookings SET end_time = ? WHERE id = ?').run(nowTime, bookingId);
    }

    res.json({
      success: true,
      message: `Ruangan telah berhasil dilepas lebih awal! Slot jam sekarang terbuka kembali untuk rekan kerja lainnya.`
    });
  } catch (err) {
    console.error('Error early releasing booking:', err);
    res.status(500).json({ success: false, message: 'Gagal melepaskan ruangan lebih awal.' });
  }
});

// ==================== ANALYTICS & KIOSK APIS ====================

// GET /api/analytics - Statistik utilisasi ruangan, jam sibuk, dan divisi
app.get('/api/analytics', (req, res) => {
  try {
    const totalConfirmed = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'CONFIRMED'").get().count;
    const totalCancelled = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'CANCELLED'").get().count;
    const totalCheckins = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE checked_in_at IS NOT NULL").get().count;

    // Room utilization stats
    const roomStats = db.prepare(`
      SELECT r.id, r.name, r.code, r.color, r.capacity, r.type,
             COUNT(b.id) as booking_count
      FROM rooms r
      LEFT JOIN bookings b ON r.id = b.room_id AND b.status = 'CONFIRMED'
      WHERE r.is_active = 1
      GROUP BY r.id
      ORDER BY booking_count DESC
    `).all();

    // Department breakdown
    const deptStats = db.prepare(`
      SELECT department, COUNT(*) as count
      FROM bookings
      WHERE status = 'CONFIRMED'
      GROUP BY department
      ORDER BY count DESC
    `).all();

    // Peak hours analysis (from 08:00 to 18:00)
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const confirmedBookings = db.prepare("SELECT start_time, end_time FROM bookings WHERE status = 'CONFIRMED'").all();
    
    const peakHours = hours.map(h => {
      const count = confirmedBookings.filter(b => b.start_time <= h && b.end_time > h).length;
      return { hour: h, count };
    });

    res.json({
      success: true,
      data: {
        totalConfirmed,
        totalCancelled,
        totalCheckins,
        checkInRate: totalConfirmed > 0 ? Math.round((totalCheckins / totalConfirmed) * 100) : 0,
        roomStats,
        deptStats,
        peakHours
      }
    });
  } catch (err) {
    console.error('Error generating analytics:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat analitik.' });
  }
});

// GET /api/kiosk/:code - Live room signage data for tablets/kiosk
app.get('/api/kiosk/:code', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = db.prepare('SELECT * FROM rooms WHERE code = ? AND is_active = 1').get(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }

    try {
      room.facilities = JSON.parse(room.facilities);
    } catch (e) {
      room.facilities = [];
    }

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);

    const todayBookings = db.prepare(`
      SELECT * FROM bookings
      WHERE room_id = ? AND date = ? AND status = 'CONFIRMED'
      ORDER BY start_time ASC
    `).all(room.id, today);

    const currentBooking = todayBookings.find(b => b.start_time <= nowTime && b.end_time > nowTime) || null;
    const upcomingBookings = todayBookings.filter(b => b.start_time > nowTime);

    res.json({
      success: true,
      data: {
        room,
        isOccupied: Boolean(currentBooking),
        currentBooking,
        upcomingBookings,
        serverTime: nowTime,
        serverDate: today
      }
    });
  } catch (err) {
    console.error('Error fetching kiosk data:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data layar ruangan.' });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Corporate Room Booking System with Auth & CRUD!    `);
  console.log(` URL: http://localhost:${PORT}                      `);
  console.log(`====================================================`);
});
