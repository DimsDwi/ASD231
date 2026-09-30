const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    floor TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    facilities TEXT NOT NULL,
    color TEXT NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    booker_name TEXT NOT NULL,
    booker_email TEXT NOT NULL,
    department TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    participants_count INTEGER DEFAULT 1,
    notes TEXT,
    status TEXT DEFAULT 'CONFIRMED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );
`);

// Seed initial rooms if empty
const countRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get();

if (countRooms.count === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (name, code, type, floor, capacity, facilities, color, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRooms = [
    {
      name: 'Executive Boardroom',
      code: 'RM-501',
      type: 'Boardroom',
      floor: 'Lantai 5',
      capacity: 20,
      facilities: JSON.stringify(['Dual Screen 4K Zoom', 'Soundbar PTZ Camera', 'Digital Whiteboard', 'High-Speed Wi-Fi', 'Kopi & Snack Station']),
      color: '#4f46e5', // indigo-600
      image_url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=800&q=80',
      description: 'Ruang rapat eksekutif premium dengan meja kayu jati oval, fasilitas video conference mutakhir untuk rapat dewan direksi dan klien penting.'
    },
    {
      name: 'Meeting Room Alpha',
      code: 'RM-301',
      type: 'Meeting Room',
      floor: 'Lantai 3',
      capacity: 10,
      facilities: JSON.stringify(['Smart TV 75 inch', 'Logitech MeetUp Mic', 'Glass Whiteboard', 'High-Speed Wi-Fi', 'Wireless Presenter']),
      color: '#0284c7', // sky-600
      image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      description: 'Ruang rapat tim menengah ideal untuk sprint planning, weekly sync, dan presentasi klien dengan audio-visual jernih.'
    },
    {
      name: 'Meeting Room Beta',
      code: 'RM-302',
      type: 'Meeting Room',
      floor: 'Lantai 3',
      capacity: 8,
      facilities: JSON.stringify(['Smart TV 65 inch', 'Polycom Speakerphone', 'Magnetic Whiteboard', 'High-Speed Wi-Fi']),
      color: '#0d9488', // teal-600
      image_url: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=800&q=80',
      description: 'Ruang meeting serbaguna untuk kolaborasi antar divisi, interview kandidat, dan sesi kerja kelompok kecil.'
    },
    {
      name: 'Creative & Brainstorming Lab',
      code: 'RM-405',
      type: 'Ideation Lab',
      floor: 'Lantai 4',
      capacity: 14,
      facilities: JSON.stringify(['Full Wall Whiteboard', 'Interactive Ultra-Short Projector', 'Modular Rolling Desks', 'Bean Bags', 'Post-it Kit']),
      color: '#d97706', // amber-600
      image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
      description: 'Ruang kerja kreatif santai dengan dinding papan tulis penuh dan meja fleksibel untuk workshop, design sprint, dan ideation.'
    },
    {
      name: 'Quiet Focus Pod A',
      code: 'POD-201',
      type: 'Focus Pod',
      floor: 'Lantai 2',
      capacity: 2,
      facilities: JSON.stringify(['Acoustic Soundproofing', 'Webcam 4K UltraHD', 'Ring Light', 'Dual Monitors USB-C', 'Ventilated Air']),
      color: '#7c3aed', // violet-600
      image_url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80',
      description: 'Pod kedap suara nyaman untuk 1-2 orang, sempurna untuk panggilan video 1-on-1, evaluasi performa, atau fokus kerja tanpa distraksi.'
    },
    {
      name: 'Quiet Focus Pod B',
      code: 'POD-202',
      type: 'Focus Pod',
      floor: 'Lantai 2',
      capacity: 3,
      facilities: JSON.stringify(['Acoustic Soundproofing', 'Smart Screen 43 inch', 'Wireless Microphone', 'USB-C Docking Station']),
      color: '#db2777', // pink-600
      image_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80',
      description: 'Pod diskusi privat kedap suara untuk sesi mentoring, panggilan vendor, dan konsultasi rahasia.'
    },
    {
      name: 'Townhall & All-Hands Auditorium',
      code: 'AUD-101',
      type: 'Auditorium',
      floor: 'Lantai 1',
      capacity: 80,
      facilities: JSON.stringify(['Stage Podium & Lighting', 'Dual Laser Projector', 'Surround Sound Audio System', 'Wireless Handheld Mics (4x)', 'Live Streaming Rig']),
      color: '#e11d48', // rose-600
      image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      description: 'Auditorium berskala besar untuk rapat akbar perusahaan (All-Hands), peluncuran produk, pelatihan akbar internal, dan seminar eksternal.'
    }
  ];

  const seedRoomsTx = db.transaction((rooms) => {
    for (const r of rooms) {
      insertRoom.run(r.name, r.code, r.type, r.floor, r.capacity, r.facilities, r.color, r.image_url, r.description);
    }
  });

  seedRoomsTx(initialRooms);
  console.log('Seeded 7 initial corporate meeting rooms.');

  // Seed sample bookings for today & tomorrow
  const today = new Date();
  const getFormattedDate = (offsetDays = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const insertBooking = db.prepare(`
    INSERT INTO bookings (room_id, title, booker_name, booker_email, department, date, start_time, end_time, participants_count, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
  `);

  const sampleBookings = [
    {
      room_id: 1, // Boardroom
      title: 'Q3 Executive Strategy & Budget Review',
      booker_name: 'Budi Santoso',
      booker_email: 'budi.santoso@corporate.com',
      department: 'Board of Directors',
      date: getFormattedDate(0),
      start_time: '09:00',
      end_time: '11:30',
      participants_count: 15,
      notes: 'Mohon siapkan proyektor ganda dan kopi hangat untuk tamu direksi.'
    },
    {
      room_id: 2, // Meeting Room Alpha
      title: 'Sprint Planning & Backlog Refinement',
      booker_name: 'Dewi Lestari',
      booker_email: 'dewi.lestari@corporate.com',
      department: 'IT & Engineering',
      date: getFormattedDate(0),
      start_time: '10:00',
      end_time: '12:00',
      participants_count: 8,
      notes: 'Membutuhkan HDMI adapter dan remote Zoom Room.'
    },
    {
      room_id: 3, // Meeting Room Beta
      title: 'Weekly Marketing Campaign Sync',
      booker_name: 'Ahmad Fauzi',
      booker_email: 'ahmad.fauzi@corporate.com',
      department: 'Marketing & Growth',
      date: getFormattedDate(0),
      start_time: '14:00',
      end_time: '15:30',
      participants_count: 6,
      notes: 'Review materi visual dan jadwal peluncuran promo.'
    },
    {
      room_id: 5, // Focus Pod A
      title: '1-on-1 Performance Check-in',
      booker_name: 'Siti Rahma',
      booker_email: 'siti.rahma@corporate.com',
      department: 'Human Resources',
      date: getFormattedDate(0),
      start_time: '13:00',
      end_time: '14:00',
      participants_count: 2,
      notes: 'Sesi privat evaluasi berkala.'
    },
    {
      room_id: 1, // Boardroom
      title: 'Investor Pitch & Partnership Discussion',
      booker_name: 'Reza Pratama',
      booker_email: 'reza.p@corporate.com',
      department: 'Board of Directors',
      date: getFormattedDate(1),
      start_time: '14:00',
      end_time: '16:00',
      participants_count: 12,
      notes: 'Tamu VIP dari Jakarta Investment Group.'
    },
    {
      room_id: 4, // Ideation Lab
      title: 'Design Sprint: New Mobile Experience',
      booker_name: 'Maya Putri',
      booker_email: 'maya.putri@corporate.com',
      department: 'Product & Design',
      date: getFormattedDate(1),
      start_time: '09:30',
      end_time: '12:00',
      participants_count: 10,
      notes: 'Sediakan sticky notes warna-warni dan spidol whiteboard.'
    },
    {
      room_id: 7, // Auditorium
      title: 'Monthly Company All-Hands Meeting',
      booker_name: 'Agus Wijaya',
      booker_email: 'agus.wijaya@corporate.com',
      department: 'General Affairs',
      date: getFormattedDate(2),
      start_time: '15:00',
      end_time: '17:00',
      participants_count: 70,
      notes: 'Pengaturan panggung hybrid dengan live streaming YouTube Private.'
    }
  ];

  const seedBookingsTx = db.transaction((bookings) => {
    for (const b of bookings) {
      insertBooking.run(b.room_id, b.title, b.booker_name, b.booker_email, b.department, b.date, b.start_time, b.end_time, b.participants_count, b.notes);
    }
  });

  seedBookingsTx(sampleBookings);
  console.log('Seeded sample bookings.');
}

module.exports = db;
