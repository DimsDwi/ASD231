// Corporate Room Booking System - Frontend Application Logic

let roomsData = [];
let bookingsData = [];
let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let currentCalendarMode = 'month'; // 'month' or 'timeline'
let selectedBookingDetail = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  // Set default date input min to today
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('modalDateInput').value = todayStr;
  document.getElementById('modalDateInput').min = todayStr;
  document.getElementById('timelineDatePicker').value = todayStr;

  await loadRooms();
  await refreshAll();

  // Polling stats every 30 seconds
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

// ----------------- TAB SWITCHING -----------------
function switchTab(tabName) {
  const tabs = ['calendar', 'rooms', 'bookings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    const content = document.getElementById(`tabContent-${t}`);
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
  }

  if (window.lucide) lucide.createIcons();
}

// ----------------- STATS -----------------
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

// ----------------- ROOMS -----------------
async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const json = await res.json();
    if (json.success) {
      roomsData = json.data;

      // Populate filter dropdowns & modal selects
      const modalSelect = document.getElementById('modalRoomSelect');
      const calendarFilter = document.getElementById('calendarRoomFilter');

      modalSelect.innerHTML = roomsData.map(r => `
        <option value="${r.id}" data-capacity="${r.capacity}">${r.name} (${r.code} - ${r.floor}) - Kapasitas ${r.capacity} Org</option>
      `).join('');

      calendarFilter.innerHTML = `<option value="ALL">Semua Ruangan (${roomsData.length})</option>` +
        roomsData.map(r => `<option value="${r.id}">${r.name} (${r.code})</option>`).join('');

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

          <div class="absolute top-3 right-3">
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
            <p class="text-xs text-slate-600 line-clamp-2 mb-3">${room.description}</p>
            
            <div class="flex items-center justify-between text-xs py-2 border-y border-slate-100 mb-3">
              <span class="text-slate-500 font-medium">Kapasitas Maksimal:</span>
              <span class="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                <i data-lucide="users" class="w-3.5 h-3.5 mr-1 text-slate-500"></i>
                ${room.capacity} Orang
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

            <button onclick="openBookingModalForRoom(${room.id})" class="inline-flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm">
              <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i>
              <span>Booking</span>
            </button>
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

// ----------------- CALENDAR LOGIC -----------------
async function loadMonthBookings() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month and last day of month
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

  // Update Month Title header
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;

  const roomFilterVal = document.getElementById('calendarRoomFilter').value;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Previous Month Filler Days
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

    // Filter bookings for this day
    const dayBookings = bookingsData.filter(b => {
      const matchDate = b.date === cellDateStr;
      const matchRoom = roomFilterVal === 'ALL' || String(b.room_id) === String(roomFilterVal);
      return matchDate && matchRoom;
    });

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell p-2 border-b border-r border-slate-100 flex flex-col justify-between cursor-pointer ${
      isSelected ? 'is-selected ring-2 ring-indigo-500 z-10' : ''
    } ${isToday ? 'is-today bg-indigo-50/20' : 'bg-white'}`;

    // Top: day number & today badge
    const headerHtml = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold ${isToday ? 'text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full' : (isSelected ? 'text-indigo-700' : 'text-slate-700')}">
          ${day}
        </span>
        ${dayBookings.length > 0 ? `<span class="text-[10px] font-semibold text-slate-400">${dayBookings.length} rapat</span>` : ''}
      </div>
    `;

    // Badges of events (max 2 previewed, then +N more)
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

  // 3. Next month filler cells to complete 7 cols
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

// ----------------- DAY DETAIL PREVIEW DRAWER -----------------
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

  container.innerHTML = dayBookings.map(b => `
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
        <button onclick="showBookingDetail(${b.id})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-indigo-50 transition">
          Detail
        </button>
        <button onclick="confirmCancelBooking(${b.id}, '${b.title}')" class="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition">
          Batal
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------- TIMELINE DAILY MATRIX -----------------
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

    // Build timeline blocks (08:00 to 18:00 = 10 hours)
    // 08:00 is col index 0, 18:00 is col index 10
    const startHourLimit = 8;
    const endHourLimit = 18;
    const totalHours = endHourLimit - startHourLimit; // 10

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
          <!-- Hour markers background lines -->
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

// ----------------- LIVE CONFLICT CHECK -----------------
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
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt) {
    const cap = selectedOpt.getAttribute('data-capacity');
    document.getElementById('modalRoomCapacityNotice').textContent = `Maksimal kapasitas ruangan ini: ${cap} orang.`;
  }
}

// ----------------- SUBMIT BOOKING -----------------
async function handleBookingSubmit(e) {
  e.preventDefault();

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
      headers: { 'Content-Type': 'application/json' },
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

// ----------------- MODAL CONTROLS -----------------
function openBookingModal(roomId = null, date = null) {
  const modal = document.getElementById('bookingModal');
  modal.classList.remove('hidden');

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

// ----------------- BOOKING DETAILS & CANCEL -----------------
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

  const notesEl = document.getElementById('detailModalNotes');
  const notesContainer = document.getElementById('detailModalNotesContainer');
  if (booking.notes && booking.notes.trim() !== '') {
    notesEl.textContent = booking.notes;
    notesContainer.classList.remove('hidden');
  } else {
    notesContainer.classList.add('hidden');
  }

  document.getElementById('bookingDetailModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('bookingDetailModal').classList.add('hidden');
  selectedBookingDetail = null;
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
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
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

// ----------------- BOOKINGS TABLE -----------------
async function loadBookingsTable() {
  const dept = document.getElementById('bookingFilterDept').value;
  const status = document.getElementById('bookingFilterStatus').value;

  try {
    const res = await fetch(`/api/bookings?department=${dept}&status=${status}`);
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

  tbody.innerHTML = bookings.map(b => `
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
        <div class="flex items-center justify-end space-x-2">
          <button onclick="showBookingDetail(${b.id})" class="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100" title="Lihat Detail">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          ${b.status === 'CONFIRMED' ? `
            <button onclick="confirmCancelBooking(${b.id}, '${b.title}')" class="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100" title="Batalkan">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function exportBookingsCSV() {
  const dept = document.getElementById('bookingFilterDept').value;
  const status = document.getElementById('bookingFilterStatus').value;

  fetch(`/api/bookings?department=${dept}&status=${status}`)
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

// ----------------- TOAST NOTIFICATIONS -----------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');

  const bgColor = type === 'success' ? 'bg-slate-900 text-white border-emerald-500' : 'bg-rose-900 text-white border-rose-500';
  const iconName = type === 'success' ? 'check-circle' : 'alert-circle';

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
