const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./db');

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

// 1. GET /api/stats - Dashboard summary metrics
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

    res.json({
      success: true,
      stats: {
        totalRooms,
        bookingsToday,
        ongoingMeetings: ongoingQuery.count,
        upcomingBookings: upcomingCount,
        serverTime: nowTime,
        serverDate: today
      }
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat statistik sistem.' });
  }
});

// 2. GET /api/rooms - List all rooms with current availability status
app.get('/api/rooms', (req, res) => {
  try {
    const { type, floor, minCapacity } = req.query;
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

    query += ' ORDER BY capacity ASC, name ASC';
    const rooms = db.prepare(query).all(...params);

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);

    // Check currently occupied status and next booking for each room
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

// 3. GET /api/rooms/:id - Detail single room
app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Ruangan tidak ditemukan.' });
    }
    room.facilities = JSON.parse(room.facilities || '[]');

    const today = new Date().toISOString().split('T')[0];
    const upcomingBookings = db.prepare(`
      SELECT * FROM bookings 
      WHERE room_id = ? AND date >= ? AND status = 'CONFIRMED'
      ORDER BY date ASC, start_time ASC
      LIMIT 10
    `).all(room.id, today);

    res.json({ success: true, data: { ...room, upcomingBookings } });
  } catch (err) {
    console.error('Error fetching room detail:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail ruangan.' });
  }
});

// 4. GET /api/bookings - Filter bookings (by room, date range)
app.get('/api/bookings', (req, res) => {
  try {
    const { room_id, date, start_date, end_date, department, status } = req.query;
    let query = `
      SELECT b.*, r.name as room_name, r.code as room_code, r.floor as room_floor, r.color as room_color, r.type as room_type, r.capacity as room_capacity
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
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
    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    } else {
      query += " AND b.status = 'CONFIRMED'";
    }

    query += ' ORDER BY b.date ASC, b.start_time ASC';

    const bookings = db.prepare(query).all(...params);
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat data peminjaman.' });
  }
});

// 5. POST /api/check-conflict - Proactive collision check before submission
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

// 6. POST /api/bookings - Create new room booking with rigorous anti-clash validation
app.post('/api/bookings', (req, res) => {
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
    if (!room_id || !title || !booker_name || !booker_email || !department || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi semua kolom wajib (Ruangan, Judul Agenda, Nama Pemohon, Email, Departemen, Tanggal, Jam Mulai & Selesai).'
      });
    }

    // Time sequence validation
    if (start_time >= end_time) {
      return res.status(400).json({
        success: false,
        message: 'Jam selesai harus lebih akhir daripada jam mulai.'
      });
    }

    // Verify room exists
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

    // Insert new booking
    const insertStmt = db.prepare(`
      INSERT INTO bookings (room_id, title, booker_name, booker_email, department, date, start_time, end_time, participants_count, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
    `);

    const info = insertStmt.run(
      room_id,
      title.trim(),
      booker_name.trim(),
      booker_email.trim(),
      department.trim(),
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

// 7. DELETE /api/bookings/:id - Cancel booking
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Peminjaman tidak ditemukan.' });
    }

    // Soft delete / cancel
    db.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?").run(req.params.id);

    res.json({
      success: true,
      message: `Peminjaman agenda "${booking.title}" berhasil dibatalkan.`
    });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ success: false, message: 'Gagal membatalkan peminjaman.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Corporate Room Booking System Server Running!      `);
  console.log(` URL: http://localhost:${PORT}                      `);
  console.log(`====================================================`);
});
