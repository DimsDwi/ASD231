// RuangKerja - Corporate Room Booking & Meeting Management
// Complete Frontend Application Logic with RBAC Authentication & Full CRUD

let currentUser = null;
let authToken = null;

let roomsData = [];
let bookingsData = [];
let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let currentCalendarMode = 'month'; // 'month' or 'timeline'
let selectedBookingDetail = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved credentials
  authToken = localStorage.getItem('rk_token');
  try {
    currentUser = JSON.parse(localStorage.getItem('rk_user'));
  } catch (e) {
    currentUser = null;
  }

  // Setup default form inputs
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('modalDateInput');
  if (dateInput) {
    dateInput.value = todayStr;
    dateInput.min = todayStr;
  }
  const editDateInput = document.getElementById('editModalDateInput');
  if (editDateInput) {
    editDateInput.min = todayStr;
  }
  const timeInput = document.getElementById('timelineDatePicker');
  if (timeInput) {
    timeInput.value = todayStr;
  }

  // Close dropdown when clicked outside
  window.addEventListener('click', (e) => {
    const demoDropdown = document.getElementById('demoDropdownMenu');
    if (demoDropdown && !e.target.closest('#demoDropdownMenu') && !e.target.closest('button[onclick="toggleDemoDropdown()"]')) {
      demoDropdown.classList.add('hidden');
    }
  });

  // Verify authentication with backend
  await checkAuthStatus();
  updateAuthUI();

  // Load data
  await loadRooms();
  await refreshAll();

  // Polling stats
  setInterval(fetchStats, 30000);
});

// Refresh all views
async function refreshAll() {
  await Promise.all([
    fetchStats(),
    loadMonthBookings(),
    loadRooms(),
    loadBookingsTable()
  ]);
  renderCalendar();
  renderDayDetails(selectedDateStr);
  if (window.lucide) lucide.createIcons();
}

// Helper: Get auth headers for API calls
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// ==================== AUTHENTICATION LOGIC ====================

// Check token validity with backend
async function checkAuthStatus() {
  if (!authToken) {
    currentUser = null;
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const json = await res.json();
    if (json.success && json.user) {
      currentUser = json.user;
      localStorage.setItem('rk_user', JSON.stringify(currentUser));
    } else {
      handleLogout(false);
    }
  } catch (err) {
    console.warn('Network issue checking auth:', err);
  }
}

// Update UI according to user login state and role
function updateAuthUI() {
  const userProfileBar = document.getElementById('userProfileBar');
  const guestAuthBar = document.getElementById('guestAuthBar');
  const adminAddRoomBtn = document.getElementById('adminAddRoomBtn');
  const myBookingsFilterWrapper = document.getElementById('myBookingsFilterWrapper');

  if (currentUser && authToken) {
    // Show logged-in view
    userProfileBar.classList.remove('hidden');
    userProfileBar.classList.add('flex');
    guestAuthBar.classList.add('hidden');

    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('userDeptDisplay').textContent = currentUser.department;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

    const roleBadge = document.getElementById('userRoleBadge');
    if (currentUser.role === 'ADMIN') {
      roleBadge.textContent = '👑 ADMIN';
      roleBadge.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-md badge-role-admin';
    } else {
      roleBadge.textContent = '💼 KARYAWAN';
      roleBadge.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-md badge-role-employee';
    }

    // Admin-only controls
    if (currentUser.role === 'ADMIN') {
      if (adminAddRoomBtn) {
        adminAddRoomBtn.classList.remove('hidden');
        adminAddRoomBtn.classList.add('inline-flex');
      }
    } else {
      if (adminAddRoomBtn) {
        adminAddRoomBtn.classList.add('hidden');
        adminAddRoomBtn.classList.remove('inline-flex');
      }
    }

    // Show "Hanya Booking Saya" filter toggle
    if (myBookingsFilterWrapper) {
      myBookingsFilterWrapper.classList.remove('hidden');
      myBookingsFilterWrapper.classList.add('flex');
    }
  } else {
    // Show guest view
    userProfileBar.classList.add('hidden');
    userProfileBar.classList.remove('flex');
    guestAuthBar.classList.remove('hidden');

    if (adminAddRoomBtn) {
      adminAddRoomBtn.classList.add('hidden');
      adminAddRoomBtn.classList.remove('inline-flex');
    }
    if (myBookingsFilterWrapper) {
      myBookingsFilterWrapper.classList.add('hidden');
      myBookingsFilterWrapper.classList.remove('flex');
      const chk = document.getElementById('myBookingsOnlyCheck');
      if (chk) chk.checked = false;
    }
  }

  // Re-render rooms to show/hide Admin CRUD buttons
  renderRoomsList(roomsData);
  if (window.lucide) lucide.createIcons();
}

function toggleDemoDropdown() {
  const menu = document.getElementById('demoDropdownMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// Quick 1-click Demo Login
async function quickLoginDemo(email, password) {
  const demoDropdown = document.getElementById('demoDropdownMenu');
  if (demoDropdown) demoDropdown.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (json.success && json.token) {
      authToken = json.token;
      currentUser = json.user;
      localStorage.setItem('rk_token', authToken);
      localStorage.setItem('rk_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showToast(json.message, 'success');
      await refreshAll();
    } else {
      showToast(json.message || 'Login demo gagal', 'error');
    }
  } catch (err) {
    console.error('Demo login error:', err);
    showToast('Terjadi kesalahan jaringan saat login demo.', 'error');
  }
}

function openAuthModal(defaultTab = 'login') {
  document.getElementById('authModal').classList.remove('hidden');
  switchAuthTab(defaultTab);
  if (window.lucide) lucide.createIcons();
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
}

function switchAuthTab(tab) {
  const btnLogin = document.getElementById('authTabBtn-login');
  const btnRegister = document.getElementById('authTabBtn-register');
  const formLogin = document.getElementById('loginForm');
  const formRegister = document.getElementById('registerForm');

  if (tab === 'login') {
    btnLogin.className = 'flex-1 pb-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition text-center';
    btnRegister.className = 'flex-1 pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent transition text-center';
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    btnRegister.className = 'flex-1 pb-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition text-center';
    btnLogin.className = 'flex-1 pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent transition text-center';
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('loginSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memverifikasi...';

  const payload = {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (res.ok && json.success) {
      authToken = json.token;
      currentUser = json.user;
      localStorage.setItem('rk_token', authToken);
      localStorage.setItem('rk_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showToast(json.message, 'success');
      await refreshAll();
    } else {
      showToast(json.message || 'Email atau password salah.', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Terjadi gangguan jaringan saat login.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Masuk Sekarang';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('regSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Mendaftarkan...';

  const payload = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    department: document.getElementById('regDept').value
  };

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (res.ok && json.success) {
      authToken = json.token;
      currentUser = json.user;
      localStorage.setItem('rk_token', authToken);
      localStorage.setItem('rk_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showToast(json.message, 'success');
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal mendaftar.', 'error');
    }
  } catch (err) {
    console.error('Register error:', err);
    showToast('Terjadi gangguan jaringan saat registrasi.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Buat Akun Karyawan';
  }
}

function handleLogout(showNotice = true) {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('rk_token');
  localStorage.removeItem('rk_user');
  updateAuthUI();
  if (showNotice) {
    showToast('Anda telah berhasil keluar (logout).', 'info');
  }
  refreshAll();
}

function handlePinjamButtonClick() {
  if (!currentUser) {
    showToast('Silakan login terlebih dahulu untuk melakukan reservasi ruangan.', 'error');
    openAuthModal('login');
    return;
  }
  openBookingModal();
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
  const tabs = ['calendar', 'rooms', 'bookings', 'analytics'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    const content = document.getElementById(`tabContent-${t}`);
    if (!btn || !content) return;
    if (t === tabName) {
      btn.className = 'tab-btn active inline-flex items-center py-4 px-1 border-b-2 border-indigo-600 font-semibold text-sm text-indigo-600';
      content.classList.remove('hidden');
    } else {
      btn.className = 'tab-btn inline-flex items-center py-4 px-1 border-b-2 border-transparent font-medium text-sm text-slate-500 hover:text-slate-700 hover:border-slate-300';
      content.classList.add('hidden');
    }
  });

  if (tabName === 'calendar') {
    renderCalendar();
    renderDayDetails(selectedDateStr);
  } else if (tabName === 'rooms') {
    renderRoomsList(roomsData);
  } else if (tabName === 'bookings') {
    loadBookingsTable();
  } else if (tabName === 'analytics') {
    loadAnalyticsData();
  }

  if (window.lucide) lucide.createIcons();
}

// ==================== STATS ====================
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      document.getElementById('statTotalRooms').textContent = json.stats.totalRooms;
      document.getElementById('statBookingsToday').textContent = json.stats.bookingsToday;
      document.getElementById('statOngoing').textContent = json.stats.ongoingMeetings;
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

// ==================== ROOM CRUD LOGIC ====================
async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const json = await res.json();
    if (json.success) {
      roomsData = json.data;

      // Populate filter dropdowns & modal selects
      const modalSelect = document.getElementById('modalRoomSelect');
      const editModalSelect = document.getElementById('editModalRoomSelect');
      const calendarFilter = document.getElementById('calendarRoomFilter');

      const roomOptions = roomsData.map(r => `
        <option value="${r.id}" data-capacity="${r.capacity}">${r.name} (${r.code} - ${r.floor}) - Kapasitas ${r.capacity} Pax</option>
      `).join('');

      if (modalSelect) modalSelect.innerHTML = roomOptions;
      if (editModalSelect) editModalSelect.innerHTML = roomOptions;

      if (calendarFilter) {
        calendarFilter.innerHTML = `<option value="ALL">Semua Ruangan (${roomsData.length})</option>` +
          roomsData.map(r => `<option value="${r.id}">${r.name} (${r.code})</option>`).join('');
      }

      renderRoomsList(roomsData);
      updateModalRoomNotice();
    }
  } catch (err) {
    console.error('Failed to load rooms:', err);
  }
}

function renderRoomsList(rooms) {
  const container = document.getElementById('roomsGridContainer');
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="font-medium text-slate-600">Tidak ada ruangan yang cocok dengan filter yang dipilih.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'ADMIN';

  container.innerHTML = rooms.map(room => {
    const isOccupied = room.is_occupied;
    const facilitiesList = Array.isArray(room.facilities) ? room.facilities : [];

    return `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group">
        <!-- Room Image & Status Badge -->
        <div class="relative h-48 overflow-hidden bg-slate-100">
          <img src="${room.image_url}" alt="${room.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          
          <div class="absolute top-3 left-3">
            <span class="bg-white/95 backdrop-blur-sm text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
              ${room.code} &bull; ${room.floor}
            </span>
          </div>

          <div class="absolute top-3 right-3 flex items-center space-x-1.5">
            ${isAdmin ? `
              <button onclick="openEditRoomModal(${room.id})" title="Edit Ruangan (Admin)" class="p-1.5 bg-white/90 hover:bg-white text-indigo-600 rounded-lg shadow-sm backdrop-blur-sm transition">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="confirmDeleteRoom(${room.id}, '${room.name}')" title="Hapus Ruangan (Admin)" class="p-1.5 bg-white/90 hover:bg-white text-rose-600 rounded-lg shadow-sm backdrop-blur-sm transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}

            ${isOccupied 
              ? `<span class="inline-flex items-center space-x-1.5 bg-rose-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                  <span class="w-2 h-2 rounded-full bg-white pulse-busy"></span>
                  <span>Sedang Dipakai</span>
                 </span>`
              : `<span class="inline-flex items-center space-x-1.5 bg-emerald-500/90 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                  <span class="w-2 h-2 rounded-full bg-white"></span>
                  <span>Tersedia</span>
                 </span>`
            }
          </div>

          <div class="absolute bottom-3 left-3 right-3 text-white">
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-600/80 backdrop-blur-xs mb-1 inline-block">${room.type}</span>
            <h3 class="text-lg font-bold leading-tight drop-shadow-sm">${room.name}</h3>
          </div>
        </div>

        <!-- Room Details Body -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <p class="text-xs text-slate-600 line-clamp-2 mb-3">${room.description || 'Ruang rapat modern dengan fasilitas lengkap.'}</p>
            
            <div class="flex items-center justify-between text-xs py-2 border-y border-slate-100 mb-3">
              <span class="text-slate-500 font-medium">Kapasitas Maksimal:</span>
              <span class="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                <i data-lucide="users" class="w-3.5 h-3.5 mr-1 text-slate-500"></i>
                ${room.capacity} Pax
              </span>
            </div>

            <!-- Facilities Tags -->
            <div>
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Fasilitas Utama:</span>
              <div class="flex flex-wrap gap-1.5">
                ${facilitiesList.map(f => `
                  <span class="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md font-medium">
                    ${f}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Bottom Action -->
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div class="text-xs">
              ${room.current_booking 
                ? `<span class="text-rose-600 font-medium text-[11px] block">Dipakai s/d ${room.current_booking.end_time}</span>` 
                : (room.next_booking ? `<span class="text-amber-600 font-medium text-[11px] block">Jadwal berikutnya: ${room.next_booking.start_time}</span>` : `<span class="text-emerald-600 font-medium text-[11px] block">Kosong sepanjang hari</span>`)
              }
            </div>

            <div class="flex items-center space-x-1.5">
              <a href="/kiosk.html?room=${room.code}" target="_blank" class="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-2 rounded-xl transition" title="Buka Mode Layar Tablet Pintu (Kiosk)">
                <i data-lucide="tablet" class="w-3.5 h-3.5 text-slate-500"></i>
                <span class="hidden sm:inline">Layar Pintu</span>
              </a>
              <button onclick="openBookingModalForRoom(${room.id})" class="inline-flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm">
                <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i>
                <span>Booking</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterRoomsList() {
  const searchTerm = document.getElementById('roomSearchInput').value.toLowerCase();
  const selectedType = document.getElementById('filterRoomType').value;
  const selectedFloor = document.getElementById('filterRoomFloor').value;
  const minCap = document.getElementById('filterRoomCapacity').value;

  const filtered = roomsData.filter(room => {
    const matchSearch = room.name.toLowerCase().includes(searchTerm) ||
      room.code.toLowerCase().includes(searchTerm) ||
      room.facilities.toLowerCase().includes(searchTerm);

    const matchType = selectedType === 'ALL' || room.type === selectedType;
    const matchFloor = selectedFloor === 'ALL' || room.floor === selectedFloor;
    const matchCap = minCap === 'ALL' || room.capacity >= parseInt(minCap, 10);

    return matchSearch && matchType && matchFloor && matchCap;
  });

  renderRoomsList(filtered);
}

// Open Room Form Modal for CREATE
function openCreateRoomModal() {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    showToast('Akses ditolak: Fitur ini hanya untuk Administrator.', 'error');
    return;
  }

  document.getElementById('roomForm').reset();
  document.getElementById('roomFormId').value = '';
  document.getElementById('roomModalBadge').textContent = 'Tambah Ruangan';
  document.getElementById('roomModalTitle').textContent = 'Tambah Ruangan Baru';
  document.getElementById('submitRoomBtnText').textContent = 'Simpan Ruangan Baru';
  document.getElementById('modalRoomColor').value = '#4f46e5';
  document.getElementById('roomModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Open Room Form Modal for EDIT (CRUD: UPDATE)
function openEditRoomModal(roomId) {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    showToast('Akses ditolak: Fitur ini hanya untuk Administrator.', 'error');
    return;
  }

  const room = roomsData.find(r => r.id === roomId);
  if (!room) return;

  document.getElementById('roomFormId').value = room.id;
  document.getElementById('modalRoomName').value = room.name;
  document.getElementById('modalRoomCode').value = room.code;
  document.getElementById('modalRoomType').value = room.type;
  document.getElementById('modalRoomFloor').value = room.floor;
  document.getElementById('modalRoomCapacity').value = room.capacity;
  document.getElementById('modalRoomColor').value = room.color || '#4f46e5';
  document.getElementById('modalRoomImageUrl').value = room.image_url;
  
  const facList = Array.isArray(room.facilities) ? room.facilities.join(', ') : '';
  document.getElementById('modalRoomFacilities').value = facList;
  document.getElementById('modalRoomDesc').value = room.description || '';

  document.getElementById('roomModalBadge').textContent = 'Edit Ruangan';
  document.getElementById('roomModalTitle').textContent = `Perbarui ${room.name}`;
  document.getElementById('submitRoomBtnText').textContent = 'Perbarui Ruangan';
  document.getElementById('roomModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeRoomModal() {
  document.getElementById('roomModal').classList.add('hidden');
  document.getElementById('roomForm').reset();
}

// Submit Room Form (Create or Update)
async function handleRoomFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('roomFormId').value;
  const isEditing = Boolean(id);

  const rawFacilities = document.getElementById('modalRoomFacilities').value;
  const facilitiesArray = rawFacilities.split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    name: document.getElementById('modalRoomName').value.trim(),
    code: document.getElementById('modalRoomCode').value.trim(),
    type: document.getElementById('modalRoomType').value,
    floor: document.getElementById('modalRoomFloor').value,
    capacity: parseInt(document.getElementById('modalRoomCapacity').value, 10),
    color: document.getElementById('modalRoomColor').value,
    image_url: document.getElementById('modalRoomImageUrl').value.trim() || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
    facilities: facilitiesArray,
    description: document.getElementById('modalRoomDesc').value.trim()
  };

  const url = isEditing ? `/api/rooms/${id}` : '/api/rooms';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showToast(json.message, 'success');
      closeRoomModal();
      await loadRooms();
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal menyimpan data ruangan.', 'error');
    }
  } catch (err) {
    console.error('Error saving room:', err);
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// Delete Room (CRUD: DELETE)
async function confirmDeleteRoom(roomId, roomName) {
  if (!currentUser || currentUser.role !== 'ADMIN') {
    showToast('Akses ditolak: Fitur ini hanya untuk Administrator.', 'error');
    return;
  }

  if (!confirm(`Hapus ruangan "${roomName}"? Ruangan ini akan dinonaktifkan dari sistem peminjaman.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadRooms();
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal menghapus ruangan.', 'error');
    }
  } catch (err) {
    console.error('Error deleting room:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  }
}

// ==================== CALENDAR LOGIC ====================
async function loadMonthBookings() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startStr = firstDay.toISOString().split('T')[0];
  const endStr = lastDay.toISOString().split('T')[0];

  try {
    const res = await fetch(`/api/bookings?start_date=${startStr}&end_date=${endStr}`);
    const json = await res.json();
    if (json.success) {
      bookingsData = json.data;
    }
  } catch (err) {
    console.error('Failed to load month bookings:', err);
  }
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;

  const roomFilterVal = document.getElementById('calendarRoomFilter').value;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Previous Month Filler
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell p-2 bg-slate-50/50 text-slate-300 font-medium text-xs select-none';
    cell.innerHTML = `<span>${dayNum}</span>`;
    grid.appendChild(cell);
  }

  // 2. Current Month Days
  for (let day = 1; day <= totalDays; day++) {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const cellDateStr = `${year}-${mStr}-${dStr}`;

    const isToday = cellDateStr === todayStr;
    const isSelected = cellDateStr === selectedDateStr;

    const dayBookings = bookingsData.filter(b => {
      const matchDate = b.date === cellDateStr;
      const matchRoom = roomFilterVal === 'ALL' || String(b.room_id) === String(roomFilterVal);
      return matchDate && matchRoom;
    });

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell p-2 border-b border-r border-slate-100 flex flex-col justify-between cursor-pointer ${
      isSelected ? 'is-selected ring-2 ring-indigo-500 z-10' : ''
    } ${isToday ? 'is-today bg-indigo-50/20' : 'bg-white'}`;

    const headerHtml = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold ${isToday ? 'text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full' : (isSelected ? 'text-indigo-700' : 'text-slate-700')}">
          ${day}
        </span>
        ${dayBookings.length > 0 ? `<span class="text-[10px] font-semibold text-slate-400">${dayBookings.length} rapat</span>` : ''}
      </div>
    `;

    let eventsHtml = '<div class="space-y-1 overflow-hidden">';
    const displayCount = Math.min(dayBookings.length, 2);
    for (let i = 0; i < displayCount; i++) {
      const b = dayBookings[i];
      eventsHtml += `
        <div class="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded text-white shadow-2xs" style="background-color: ${b.room_color || '#4f46e5'}">
          ${b.start_time} ${b.room_code || ''}: ${b.title}
        </div>
      `;
    }
    if (dayBookings.length > 2) {
      eventsHtml += `<div class="text-[10px] font-bold text-slate-500 pl-1">+${dayBookings.length - 2} lagi...</div>`;
    }
    eventsHtml += '</div>';

    cell.innerHTML = headerHtml + eventsHtml;

    cell.onclick = () => {
      selectedDateStr = cellDateStr;
      renderCalendar();
      renderDayDetails(cellDateStr);
      renderTimelineForDate(cellDateStr);
    };

    grid.appendChild(cell);
  }

  // 3. Next month filler cells
  const remainingCells = (7 - ((firstDayIndex + totalDays) % 7)) % 7;
  for (let j = 1; j <= remainingCells; j++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell p-2 bg-slate-50/50 text-slate-300 font-medium text-xs select-none';
    cell.innerHTML = `<span>${j}</span>`;
    grid.appendChild(cell);
  }
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  loadMonthBookings().then(() => {
    renderCalendar();
  });
}

function goToToday() {
  currentDate = new Date();
  selectedDateStr = new Date().toISOString().split('T')[0];
  loadMonthBookings().then(() => {
    renderCalendar();
    renderDayDetails(selectedDateStr);
    renderTimelineForDate(selectedDateStr);
  });
}

function setCalendarMode(mode) {
  currentCalendarMode = mode;
  const monthView = document.getElementById('calendarMonthView');
  const timelineView = document.getElementById('calendarTimelineView');
  const btnMonth = document.getElementById('modeBtnMonth');
  const btnTimeline = document.getElementById('modeBtnTimeline');

  if (mode === 'month') {
    monthView.classList.remove('hidden');
    timelineView.classList.add('hidden');
    btnMonth.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-indigo-600 shadow-sm transition';
    btnTimeline.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition';
  } else {
    monthView.classList.add('hidden');
    timelineView.classList.remove('hidden');
    btnMonth.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 transition';
    btnTimeline.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-indigo-600 shadow-sm transition';
    renderTimelineForDate(selectedDateStr);
  }
}

// ==================== DAY DETAIL DRAWER ====================
function renderDayDetails(dateStr) {
  const container = document.getElementById('dayBookingsList');
  const title = document.getElementById('selectedDateTitle');
  if (!container || !title) return;

  const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  title.textContent = formattedDate;

  const dayBookings = bookingsData.filter(b => b.date === dateStr);

  if (dayBookings.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>
        <p class="text-sm font-semibold text-slate-700">Belum ada rapat yang terjadwal pada hari ini.</p>
        <p class="text-xs text-slate-400 mt-1">Semua ruangan masih bebas dan siap untuk dibooking.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = dayBookings.map(b => {
    const isOwner = currentUser && (b.user_id === currentUser.id || (b.booker_email && b.booker_email.toLowerCase() === currentUser.email.toLowerCase()));
    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    const canManage = isOwner || isAdmin;

    return `
      <div class="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
        <div class="flex items-start space-x-3">
          <div class="w-3 self-stretch rounded-full" style="background-color: ${b.room_color || '#4f46e5'}"></div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-slate-900">${b.title}</span>
              <span class="text-[11px] bg-white border border-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-md">${b.room_name} (${b.room_floor})</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span class="flex items-center space-x-1 font-semibold text-indigo-600">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                <span>${b.start_time} - ${b.end_time} WIB</span>
              </span>
              <span class="flex items-center space-x-1">
                <i data-lucide="user" class="w-3.5 h-3.5"></i>
                <span>${b.booker_name} &bull; ${b.department}</span>
              </span>
              <span class="flex items-center space-x-1">
                <i data-lucide="users" class="w-3.5 h-3.5"></i>
                <span>${b.participants_count} Peserta</span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2 self-end sm:self-center">
          <button onclick="showBookingDetail(${b.id})" class="text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 transition" title="Lihat Detail">
            Detail
          </button>
          ${canManage ? `
            <button onclick="openEditBookingModal(${b.id})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 transition" title="Edit Booking">
              Ubah
            </button>
            <button onclick="confirmCancelBooking(${b.id}, '${b.title}')" class="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition" title="Batalkan Booking">
              Batal
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==================== TIMELINE DAILY MATRIX ====================
function renderTimelineForDate(dateStr) {
  selectedDateStr = dateStr;
  document.getElementById('timelineDatePicker').value = dateStr;
  document.getElementById('timelineSelectedDateText').textContent = new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const container = document.getElementById('timelineRowsContainer');
  if (!container) return;

  const dayBookings = bookingsData.filter(b => b.date === dateStr);

  container.innerHTML = roomsData.map(room => {
    const roomBookings = dayBookings.filter(b => b.room_id === room.id);

    const startHourLimit = 8;
    const endHourLimit = 18;
    const totalHours = endHourLimit - startHourLimit;

    let bookingBlocksHtml = '';
    roomBookings.forEach(b => {
      const [sH, sM] = b.start_time.split(':').map(Number);
      const [eH, eM] = b.end_time.split(':').map(Number);

      const sPos = Math.max(0, (sH - startHourLimit) + (sM / 60));
      const ePos = Math.min(totalHours, (eH - startHourLimit) + (eM / 60));
      const widthPct = Math.max(5, ((ePos - sPos) / totalHours) * 100);
      const leftPct = (sPos / totalHours) * 100;

      bookingBlocksHtml += `
        <div onclick="showBookingDetail(${b.id})" class="absolute top-1 bottom-1 rounded-lg text-[10px] font-semibold text-white px-2 py-1 truncate shadow-xs cursor-pointer hover:brightness-110 transition z-10 flex items-center" style="left: ${leftPct}%; width: ${widthPct}%; background-color: ${room.color || '#4f46e5'}">
          <span class="truncate">${b.start_time}-${b.end_time} &bull; ${b.title}</span>
        </div>
      `;
    });

    return `
      <div class="grid grid-cols-11 py-3 items-center hover:bg-slate-50 transition border-b border-slate-100">
        <div class="col-span-2 pr-3">
          <div class="font-bold text-xs text-slate-800">${room.name}</div>
          <div class="text-[11px] text-slate-400">${room.code} &bull; ${room.capacity} Pax</div>
        </div>
        <div class="col-span-9 relative h-10 bg-slate-100/70 rounded-xl overflow-hidden border border-slate-200/60">
          <div class="absolute inset-0 grid grid-cols-10 divide-x divide-slate-200/50 pointer-events-none">
            <div></div><div></div><div></div><div></div><div></div>
            <div></div><div></div><div></div><div></div><div></div>
          </div>
          ${bookingBlocksHtml}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ==================== LIVE CONFLICT DETECTION ====================
let conflictDebounceTimer = null;

function triggerLiveConflictCheck() {
  clearTimeout(conflictDebounceTimer);
  conflictDebounceTimer = setTimeout(async () => {
    updateModalRoomNotice();

    const roomId = document.getElementById('modalRoomSelect').value;
    const date = document.getElementById('modalDateInput').value;
    const startTime = document.getElementById('modalStartTime').value;
    const endTime = document.getElementById('modalEndTime').value;
    const banner = document.getElementById('liveConflictBanner');
    const submitBtn = document.getElementById('submitBookingBtn');

    if (!roomId || !date || !startTime || !endTime) {
      banner.classList.add('hidden');
      return;
    }

    if (startTime >= endTime) {
      banner.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs block';
      banner.innerHTML = `<span class="font-bold">Peringatan:</span> Jam selesai (${endTime}) harus lebih akhir dari jam mulai (${startTime}).`;
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      return;
    }

    try {
      const res = await fetch('/api/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, date, start_time: startTime, end_time: endTime })
      });
      const data = await res.json();

      if (data.hasConflict) {
        banner.className = 'p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs block';
        banner.innerHTML = `
          <div class="flex items-start space-x-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold">Jadwal Bentrok!</span>
              <p class="mt-0.5">${data.message}</p>
            </div>
          </div>
        `;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        banner.className = 'p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs block';
        banner.innerHTML = `
          <div class="flex items-center space-x-2">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
            <span class="font-bold">Jadwal Tersedia! Ruangan bebas dipakai pada rentang waktu ini.</span>
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Conflict check error:', err);
    }
  }, 250);
}

function updateModalRoomNotice() {
  const select = document.getElementById('modalRoomSelect');
  if (!select) return;
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt) {
    const cap = selectedOpt.getAttribute('data-capacity');
    const notice = document.getElementById('modalRoomCapacityNotice');
    if (notice) notice.textContent = `Maksimal kapasitas ruangan ini: ${cap} Pax.`;
  }
}

// Live conflict check for Edit modal
let editConflictDebounceTimer = null;
function triggerEditConflictCheck() {
  clearTimeout(editConflictDebounceTimer);
  editConflictDebounceTimer = setTimeout(async () => {
    const bookingId = document.getElementById('editBookingId').value;
    const roomId = document.getElementById('editModalRoomSelect').value;
    const date = document.getElementById('editModalDateInput').value;
    const startTime = document.getElementById('editModalStartTime').value;
    const endTime = document.getElementById('editModalEndTime').value;
    const banner = document.getElementById('editConflictBanner');
    const submitBtn = document.getElementById('submitEditBookingBtn');

    if (!roomId || !date || !startTime || !endTime) {
      banner.classList.add('hidden');
      return;
    }

    if (startTime >= endTime) {
      banner.className = 'p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs block';
      banner.innerHTML = `<span class="font-bold">Peringatan:</span> Jam selesai harus lebih akhir dari jam mulai.`;
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      return;
    }

    try {
      const res = await fetch('/api/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          date,
          start_time: startTime,
          end_time: endTime,
          exclude_booking_id: bookingId ? parseInt(bookingId, 10) : null
        })
      });
      const data = await res.json();

      if (data.hasConflict) {
        banner.className = 'p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs block';
        banner.innerHTML = `
          <div class="flex items-start space-x-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
            <div>
              <span class="font-bold">Jadwal Bentrok!</span>
              <p class="mt-0.5">${data.message}</p>
            </div>
          </div>
        `;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        banner.className = 'p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs block';
        banner.innerHTML = `
          <div class="flex items-center space-x-2">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
            <span class="font-bold">Jadwal Tersedia!</span>
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Edit conflict check error:', err);
    }
  }, 250);
}

// ==================== BOOKING CRUD: CREATE ====================
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showToast('Silakan login terlebih dahulu untuk meminjam ruangan.', 'error');
    openAuthModal('login');
    return;
  }

  const submitBtn = document.getElementById('submitBookingBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg> Menyimpan Reservasi...
  `;

  const payload = {
    room_id: parseInt(document.getElementById('modalRoomSelect').value, 10),
    title: document.getElementById('modalTitle').value,
    booker_name: document.getElementById('modalBookerName').value,
    booker_email: document.getElementById('modalBookerEmail').value,
    department: document.getElementById('modalDepartment').value,
    date: document.getElementById('modalDateInput').value,
    start_time: document.getElementById('modalStartTime').value,
    end_time: document.getElementById('modalEndTime').value,
    participants_count: parseInt(document.getElementById('modalParticipants').value, 10) || 1,
    notes: document.getElementById('modalNotes').value
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (res.ok && json.success) {
      showToast('Peminjaman ruangan berhasil dikonfirmasi!', 'success');
      closeBookingModal();
      selectedDateStr = payload.date;
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal menyimpan booking.', 'error');
    }
  } catch (err) {
    console.error('Error submitting booking:', err);
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4"></i>
      <span>Konfirmasi Booking</span>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

// Modal controls for booking
function openBookingModal(roomId = null, date = null) {
  if (!currentUser) {
    showToast('Silakan login terlebih dahulu untuk melakukan reservasi ruangan.', 'error');
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('bookingModal');
  modal.classList.remove('hidden');

  // Pre-fill user data
  document.getElementById('modalBookerName').value = currentUser.name || '';
  document.getElementById('modalBookerEmail').value = currentUser.email || '';
  if (currentUser.department) {
    document.getElementById('modalDepartment').value = currentUser.department;
  }

  if (roomId) {
    document.getElementById('modalRoomSelect').value = roomId;
  }
  if (date) {
    document.getElementById('modalDateInput').value = date;
  }

  triggerLiveConflictCheck();
  if (window.lucide) lucide.createIcons();
}

function openBookingModalForRoom(roomId) {
  openBookingModal(roomId, selectedDateStr);
}

function openBookingModalForSelectedDate() {
  openBookingModal(null, selectedDateStr);
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
  document.getElementById('bookingForm').reset();
  document.getElementById('liveConflictBanner').classList.add('hidden');
}

// ==================== BOOKING CRUD: UPDATE (EDIT) ====================
function openEditBookingModal(bookingId) {
  const booking = bookingsData.find(b => b.id === bookingId);
  if (!booking) return;

  const isOwner = currentUser && (booking.user_id === currentUser.id || (booking.booker_email && booking.booker_email.toLowerCase() === currentUser.email.toLowerCase()));
  const isAdmin = currentUser && currentUser.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    showToast('Akses ditolak: Anda hanya dapat mengubah booking milik Anda sendiri.', 'error');
    return;
  }

  document.getElementById('editBookingId').value = booking.id;
  document.getElementById('editModalRoomSelect').value = booking.room_id;
  document.getElementById('editModalDateInput').value = booking.date;
  document.getElementById('editModalStartTime').value = booking.start_time;
  document.getElementById('editModalEndTime').value = booking.end_time;
  document.getElementById('editModalTitle').value = booking.title;
  document.getElementById('editModalDept').value = booking.department;
  document.getElementById('editModalParticipants').value = booking.participants_count;
  document.getElementById('editModalNotes').value = booking.notes || '';

  // Show status group only for Admin
  const statusGroup = document.getElementById('editStatusGroup');
  if (isAdmin) {
    statusGroup.classList.remove('hidden');
    document.getElementById('editModalStatus').value = booking.status;
  } else {
    statusGroup.classList.add('hidden');
  }

  document.getElementById('bookingEditModal').classList.remove('hidden');
  triggerEditConflictCheck();
  if (window.lucide) lucide.createIcons();
}

function closeEditBookingModal() {
  document.getElementById('bookingEditModal').classList.add('hidden');
  document.getElementById('editConflictBanner').classList.add('hidden');
}

async function handleEditBookingSubmit(e) {
  e.preventDefault();
  const bookingId = document.getElementById('editBookingId').value;
  const submitBtn = document.getElementById('submitEditBookingBtn');
  submitBtn.disabled = true;

  const payload = {
    room_id: parseInt(document.getElementById('editModalRoomSelect').value, 10),
    title: document.getElementById('editModalTitle').value.trim(),
    department: document.getElementById('editModalDept').value,
    date: document.getElementById('editModalDateInput').value,
    start_time: document.getElementById('editModalStartTime').value,
    end_time: document.getElementById('editModalEndTime').value,
    participants_count: parseInt(document.getElementById('editModalParticipants').value, 10) || 1,
    notes: document.getElementById('editModalNotes').value.trim()
  };

  if (currentUser && currentUser.role === 'ADMIN') {
    payload.status = document.getElementById('editModalStatus').value;
  }

  try {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showToast(json.message, 'success');
      closeEditBookingModal();
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal memperbarui reservasi.', 'error');
    }
  } catch (err) {
    console.error('Error editing booking:', err);
    showToast('Terjadi kesalahan jaringan.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ==================== BOOKING CRUD: DETAIL & CANCEL ====================
function showBookingDetail(bookingId) {
  const booking = bookingsData.find(b => b.id === bookingId);
  if (!booking) return;

  selectedBookingDetail = booking;
  document.getElementById('detailModalTitle').textContent = booking.title;
  document.getElementById('detailModalRoom').textContent = `${booking.room_name} (${booking.room_floor})`;
  document.getElementById('detailModalDate').textContent = booking.date;
  document.getElementById('detailModalTime').textContent = `${booking.start_time} - ${booking.end_time} WIB`;
  document.getElementById('detailModalBooker').textContent = `${booking.booker_name} (${booking.booker_email})`;
  document.getElementById('detailModalDept').textContent = booking.department;
  document.getElementById('detailModalParticipants').textContent = `${booking.participants_count} Orang`;

  const statusEl = document.getElementById('detailModalStatus');
  if (booking.status === 'CONFIRMED') {
    statusEl.textContent = 'Terkonfirmasi';
    statusEl.className = 'font-bold px-2 py-0.5 rounded text-[11px] badge-confirmed';
  } else {
    statusEl.textContent = 'Dibatalkan';
    statusEl.className = 'font-bold px-2 py-0.5 rounded text-[11px] badge-cancelled';
  }

  const notesEl = document.getElementById('detailModalNotes');
  const notesContainer = document.getElementById('detailModalNotesContainer');
  if (booking.notes && booking.notes.trim() !== '') {
    notesEl.textContent = booking.notes;
    notesContainer.classList.remove('hidden');
  } else {
    notesContainer.classList.add('hidden');
  }

  // Check-in status display
  const checkinStatusEl = document.getElementById('detailModalCheckinStatus');
  const checkinBtn = document.getElementById('detailModalCheckinBtn');
  const releaseBtn = document.getElementById('detailModalReleaseBtn');

  if (booking.checked_in_at) {
    checkinStatusEl.textContent = `✓ Sudah Check-in (${booking.checked_in_at.slice(11, 16)} WIB)`;
    checkinStatusEl.className = 'font-bold text-[11px] text-emerald-600';
    if (checkinBtn) checkinBtn.classList.add('hidden');
  } else {
    checkinStatusEl.textContent = '⏳ Belum Check-in';
    checkinStatusEl.className = 'font-bold text-[11px] text-amber-600';
    if (checkinBtn) checkinBtn.classList.remove('hidden');
  }

  // Manage buttons based on permission
  const isOwner = currentUser && (booking.user_id === currentUser.id || (booking.booker_email && booking.booker_email.toLowerCase() === currentUser.email.toLowerCase()));
  const isAdmin = currentUser && currentUser.role === 'ADMIN';
  const canManage = isOwner || isAdmin;

  const editBtn = document.getElementById('detailModalEditBtn');
  const cancelBtn = document.getElementById('detailModalCancelBtn');

  if (canManage && booking.status === 'CONFIRMED') {
    editBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    if (releaseBtn) releaseBtn.classList.remove('hidden');
  } else if (canManage && isAdmin) {
    editBtn.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
    if (releaseBtn) releaseBtn.classList.add('hidden');
  } else {
    editBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
    if (checkinBtn) checkinBtn.classList.add('hidden');
    if (releaseBtn) releaseBtn.classList.add('hidden');
  }

  document.getElementById('bookingDetailModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('bookingDetailModal').classList.add('hidden');
  selectedBookingDetail = null;
}

function editBookingFromDetail() {
  if (selectedBookingDetail) {
    const id = selectedBookingDetail.id;
    closeDetailModal();
    openEditBookingModal(id);
  }
}

function cancelBookingFromDetail() {
  if (selectedBookingDetail) {
    confirmCancelBooking(selectedBookingDetail.id, selectedBookingDetail.title);
    closeDetailModal();
  }
}

async function confirmCancelBooking(bookingId, title) {
  if (!confirm(`Apakah Anda yakin ingin membatalkan peminjaman untuk agenda:\n"${title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success) {
      showToast('Peminjaman telah dibatalkan.', 'success');
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal membatalkan reservasi.', 'error');
    }
  } catch (err) {
    console.error('Error cancelling:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  }
}

// ==================== BOOKINGS TABLE LOGIC ====================
async function loadBookingsTable() {
  const dept = document.getElementById('bookingFilterDept').value;
  const status = document.getElementById('bookingFilterStatus').value;
  const myBookingsChk = document.getElementById('myBookingsOnlyCheck');
  const onlyMine = myBookingsChk && myBookingsChk.checked;

  let url = `/api/bookings?department=${dept}&status=${status}`;
  if (onlyMine && currentUser) {
    url += '&my_bookings=true';
  }

  try {
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (json.success) {
      renderBookingsTable(json.data);
    }
  } catch (err) {
    console.error('Failed to load table:', err);
  }
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-10 text-center text-slate-400 text-xs">
          Belum ada data reservasi peminjaman dengan filter yang dipilih.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const isOwner = currentUser && (b.user_id === currentUser.id || (b.booker_email && b.booker_email.toLowerCase() === currentUser.email.toLowerCase()));
    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    const canManage = isOwner || isAdmin;

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800 text-xs">${b.title}</div>
          <div class="text-[11px] text-slate-400">${b.participants_count} Peserta</div>
        </td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center space-x-1.5 text-xs font-semibold px-2 py-0.5 rounded-md" style="background-color: ${b.room_color}15; color: ${b.room_color}">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${b.room_color}"></span>
            <span>${b.room_name}</span>
          </span>
          <div class="text-[10px] text-slate-400 mt-0.5">${b.room_floor}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-slate-700 text-xs">${b.date}</div>
          <div class="text-[11px] text-indigo-600 font-bold">${b.start_time} - ${b.end_time} WIB</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-medium text-slate-800 text-xs">${b.booker_name}</div>
          <div class="text-[11px] text-slate-400">${b.booker_email}</div>
        </td>
        <td class="py-3 px-4">
          <span class="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">${b.department}</span>
        </td>
        <td class="py-3 px-4">
          <span class="text-xs font-bold px-2 py-0.5 rounded-md ${b.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-cancelled'}">
            ${b.status === 'CONFIRMED' ? 'Terkonfirmasi' : 'Dibatalkan'}
          </span>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="showBookingDetail(${b.id})" class="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition" title="Lihat Detail">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>
            ${canManage ? `
              <button onclick="openEditBookingModal(${b.id})" class="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition" title="Ubah Booking">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
            ${canManage && b.status === 'CONFIRMED' ? `
              <button onclick="confirmCancelBooking(${b.id}, '${b.title}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition" title="Batalkan Booking">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function exportBookingsCSV() {
  const dept = document.getElementById('bookingFilterDept').value;
  const status = document.getElementById('bookingFilterStatus').value;

  fetch(`/api/bookings?department=${dept}&status=${status}`, { headers: getAuthHeaders() })
    .then(r => r.json())
    .then(json => {
      if (!json.success || json.data.length === 0) {
        showToast('Tidak ada data peminjaman untuk di-export.', 'error');
        return;
      }

      const rows = [
        ['ID', 'Agenda', 'Ruangan', 'Lantai', 'Tanggal', 'Mulai', 'Selesai', 'Pemohon', 'Email', 'Departemen', 'Peserta', 'Status']
      ];

      json.data.forEach(b => {
        rows.push([
          b.id,
          `"${b.title.replace(/"/g, '""')}"`,
          `"${b.room_name}"`,
          b.room_floor,
          b.date,
          b.start_time,
          b.end_time,
          `"${b.booker_name}"`,
          b.booker_email,
          `"${b.department}"`,
          b.participants_count,
          b.status
        ]);
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Laporan_Peminjaman_Ruangan_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('File laporan CSV berhasil diunduh.', 'success');
    });
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');

  let bgColor = 'bg-slate-900 text-white border-indigo-500';
  let iconName = 'info';

  if (type === 'success') {
    bgColor = 'bg-slate-900 text-white border-emerald-500';
    iconName = 'check-circle';
  } else if (type === 'error') {
    bgColor = 'bg-rose-900 text-white border-rose-500';
    iconName = 'alert-circle';
  }

  toast.className = `${bgColor} pointer-events-auto border-l-4 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold transition-all transform duration-300 translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== CALENDAR SYNC (GOOGLE CALENDAR & .ICS) ====================

// Add to Google Calendar
function addCurrentToGoogleCalendar() {
  if (!selectedBookingDetail) return;
  const b = selectedBookingDetail;

  // Format: YYYYMMDDTHHmm00Z
  const cleanDate = b.date.replace(/-/g, '');
  const cleanStart = b.start_time.replace(/:/g, '') + '00';
  const cleanEnd = b.end_time.replace(/:/g, '') + '00';

  // WIB is UTC+7
  const startDt = `${cleanDate}T${cleanStart}`;
  const endDt = `${cleanDate}T${cleanEnd}`;

  const title = encodeURIComponent(b.title);
  const details = encodeURIComponent(`Peminjam: ${b.booker_name} (${b.department})\nJumlah Peserta: ${b.participants_count} orang\nCatatan: ${b.notes || '-'}`);
  const location = encodeURIComponent(`${b.room_name} (${b.room_floor}), RuangKerja Corporate Hub`);

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&details=${details}&location=${location}&ctz=Asia/Jakarta`;
  window.open(gcalUrl, '_blank');
}

// Download .ICS File for Outlook & Apple Calendar
function downloadCurrentIcsFile() {
  if (!selectedBookingDetail) return;
  const b = selectedBookingDetail;

  const cleanDate = b.date.replace(/-/g, '');
  const cleanStart = b.start_time.replace(/:/g, '') + '00';
  const cleanEnd = b.end_time.replace(/:/g, '') + '00';

  const uid = `booking-${b.id}-${Date.now()}@ruangkerja.internal`;
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RuangKerja Corporate//Room Booking System//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStr}`,
    `DTSTART;TZID=Asia/Jakarta:${cleanDate}T${cleanStart}`,
    `DTEND;TZID=Asia/Jakarta:${cleanDate}T${cleanEnd}`,
    `SUMMARY:${b.title}`,
    `DESCRIPTION:Agenda Rapat oleh ${b.booker_name} (${b.department})\\nRuangan: ${b.room_name} (${b.room_floor})\\nCatatan: ${b.notes || '-'}`,
    `LOCATION:${b.room_name}\\, ${b.room_floor}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `Rapat_${b.date}_${b.room_name.replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('File kalender .ICS berhasil diunduh. Klik untuk memasukkan ke Outlook / Apple Calendar.', 'success');
}

// Check-in Action
async function checkinCurrentBooking() {
  if (!selectedBookingDetail) return;
  const b = selectedBookingDetail;

  try {
    const res = await fetch(`/api/bookings/${b.id}/checkin`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      b.checked_in_at = json.checked_in_at;
      showBookingDetail(b.id);
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal check-in.', 'error');
    }
  } catch (err) {
    showToast('Kesalahan jaringan saat check-in.', 'error');
  }
}

// Release Room Early Action
async function releaseCurrentBookingEarly() {
  if (!selectedBookingDetail) return;
  const b = selectedBookingDetail;

  if (!confirm(`Selesaikan agenda "${b.title}" lebih awal dan bebaskan ruangan sekarang?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/bookings/${b.id}/release`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeDetailModal();
      await refreshAll();
    } else {
      showToast(json.message || 'Gagal melepaskan ruangan.', 'error');
    }
  } catch (err) {
    showToast('Kesalahan jaringan.', 'error');
  }
}

// ==================== ANALYTICS DASHBOARD LOGIC ====================
async function loadAnalyticsData() {
  try {
    const res = await fetch('/api/analytics');
    const json = await res.json();
    if (!json.success) return;

    const { totalConfirmed, totalCancelled, checkInRate, roomStats, deptStats, peakHours } = json.data;

    // Set KPI cards
    document.getElementById('statKpiConfirmed').textContent = totalConfirmed;
    document.getElementById('statKpiCancelled').textContent = totalCancelled;
    document.getElementById('statKpiCheckinRate').textContent = `${checkInRate}%`;
    document.getElementById('statKpiRooms').textContent = roomsData.length;

    renderPeakHoursChart(peakHours);
    renderRoomUtilization(roomStats);
    renderDeptDistribution(deptStats);
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function renderPeakHoursChart(peakHours) {
  const container = document.getElementById('peakHoursBarContainer');
  if (!container) return;

  const maxVal = Math.max(...peakHours.map(p => p.count), 1);

  container.innerHTML = peakHours.map(item => {
    const heightPct = Math.max(12, Math.round((item.count / maxVal) * 100));
    const isPeak = item.count === maxVal && item.count > 0;

    return `
      <div class="flex-1 flex flex-col items-center h-full justify-end group relative">
        <!-- Tooltip -->
        <div class="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
          ${item.hour}: ${item.count} Rapat
        </div>
        <!-- Bar -->
        <div class="w-full max-w-[28px] rounded-t-xl transition-all duration-300 ${isPeak ? 'bg-indigo-600 shadow-md shadow-indigo-200' : (item.count > 0 ? 'bg-indigo-400 hover:bg-indigo-500' : 'bg-slate-100')}" style="height: ${heightPct}%;"></div>
        <!-- Label -->
        <span class="text-[10px] font-semibold text-slate-500 mt-2">${item.hour.slice(0, 2)}</span>
      </div>
    `;
  }).join('');
}

function renderRoomUtilization(roomStats) {
  const container = document.getElementById('roomUtilizationList');
  if (!container) return;

  const maxVal = Math.max(...roomStats.map(r => r.booking_count), 1);

  container.innerHTML = roomStats.map(r => {
    const pct = Math.max(8, Math.round((r.booking_count / maxVal) * 100));
    return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-800 flex items-center space-x-1.5">
            <span class="w-2 h-2 rounded-full" style="background-color: ${r.color}"></span>
            <span>${r.name} (${r.code})</span>
          </span>
          <span class="font-semibold text-slate-500">${r.booking_count} reservasi</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div class="h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${r.color || '#4f46e5'}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDeptDistribution(deptStats) {
  const container = document.getElementById('deptDistributionGrid');
  if (!container) return;

  if (deptStats.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center text-slate-400 text-xs py-4">Belum ada data peminjaman antar divisi.</div>';
    return;
  }

  container.innerHTML = deptStats.map(d => `
    <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
      <div>
        <div class="font-bold text-xs text-slate-800">${d.department}</div>
        <div class="text-[10px] text-slate-400">Departemen Aktif</div>
      </div>
      <span class="text-sm font-extrabold text-indigo-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">${d.count}x</span>
    </div>
  `).join('');
}
