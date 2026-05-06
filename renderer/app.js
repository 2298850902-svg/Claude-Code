let schedules = [];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;

const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const today = new Date();
today.setHours(0,0,0,0);
const todayStr = formatDate(today);
const eventColors = ['#0984e3', '#00b894', '#e17055', '#6c5ce7', '#fdcb6e', '#00cec9', '#fd79a8'];

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthEl = document.getElementById('current-month');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const selectedDateEl = document.getElementById('selected-date');
const eventList = document.getElementById('event-list');
const form = document.getElementById('event-form');
const formTitle = document.getElementById('form-title');
const titleInput = document.getElementById('event-title');
const startInput = document.getElementById('event-start');
const endInput = document.getElementById('event-end');
const descInput = document.getElementById('event-desc');
const editIdInput = document.getElementById('edit-id');
const saveBtn = document.getElementById('btn-save');
const cancelBtn = document.getElementById('btn-cancel');
const addBtn = document.getElementById('btn-add');

async function init() {
  schedules = await window.api.loadSchedules() || [];
  selectedDate = todayStr;
  refreshUI();
  bindEvents();
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}

function refreshUI() {
  renderCalendar();
  renderDetail();
}

function navigateMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

function renderCalendar() {
  currentMonthEl.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;

  const headers = calendarGrid.querySelectorAll('.weekday');
  calendarGrid.innerHTML = '';
  headers.forEach(h => calendarGrid.appendChild(h));

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  // Chinese calendar: Monday first → Sunday = 0 → shift to 6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  const datesWithEvents = new Set();
  schedules.forEach(s => datesWithEvents.add(s.date));

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    addDay(day, true);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    addDay(d, false);
  }

  // Next month leading days (fill up to 42 cells = 6 rows)
  const totalCells = startOffset + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7 || (totalCells <= 35 ? 7 : 0);
  for (let d = 1; d <= remaining; d++) {
    addDay(d, true);
  }

  function addDay(day, isOther) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    if (isOther) el.classList.add('other-month');

    const dateObj = new Date(isOther
      ? (currentMonth === 0 ? currentYear-1 : currentYear),
      isOther ? (currentMonth === 0 ? 11 : currentMonth - 1) : currentMonth,
      day
    );
    const dateStr = formatDate(dateObj);
    el.textContent = day;

    if (!isOther && dateStr === todayStr) el.classList.add('today');
    if (dateStr === selectedDate) el.classList.add('selected');
    if (datesWithEvents.has(dateStr)) el.classList.add('has-event');

    el.dataset.date = dateStr;
    el.addEventListener('click', () => selectDate(dateStr));
    calendarGrid.appendChild(el);
  }
}

function selectDate(dateStr) {
  selectedDate = dateStr;
  refreshUI();
}

function renderDetail() {
  if (!selectedDate) return;
  const d = parseDate(selectedDate);
  selectedDateEl.textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 日程`;

  const daySchedules = schedules
    .filter(s => s.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (daySchedules.length === 0) {
    eventList.innerHTML = '<div class="empty-state">暂无日程，点击下方添加</div>';
  } else {
    eventList.innerHTML = daySchedules.map(s => `
      <div class="event-item" style="border-left-color: ${s.color || '#0984e3'}">
        <div class="event-time">${s.startTime || '全天'}${s.endTime ? ' - '+s.endTime : ''}</div>
        <div class="event-body">
          <div class="event-title">${escapeHtml(s.title)}</div>
          ${s.desc ? '<div class="event-desc">'+escapeHtml(s.desc)+'</div>' : ''}
        </div>
        <div class="event-actions">
          <button class="btn-edit" onclick="editEvent('${s.id}')">编辑</button>
          <button class="btn-delete" onclick="deleteEvent('${s.id}')">删除</button>
        </div>
      </div>
    `).join('');
  }

  resetForm();
}

const _escapeDiv = document.createElement('div');
function escapeHtml(text) {
  _escapeDiv.textContent = text;
  return _escapeDiv.innerHTML;
}

function resetForm() {
  form.classList.add('hidden');
  cancelBtn.classList.add('hidden');
  formTitle.textContent = '添加日程';
  titleInput.value = '';
  startInput.value = '09:00';
  endInput.value = '10:00';
  descInput.value = '';
  editIdInput.value = '';
}

function showForm() {
  form.classList.remove('hidden');
  titleInput.focus();
}

async function saveSchedule() {
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }

  const start = startInput.value;
  const end = endInput.value;
  const desc = descInput.value.trim();
  const editId = editIdInput.value;

  if (editId) {
    const idx = schedules.findIndex(s => s.id === editId);
    if (idx !== -1) {
      schedules[idx] = { ...schedules[idx], title, startTime: start, endTime: end, desc };
    }
  } else {
    const newEvent = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      date: selectedDate,
      title,
      startTime: start,
      endTime: end,
      desc,
      color: eventColors[Math.floor(Math.random() * eventColors.length)],
    };
    schedules.push(newEvent);
  }

  await window.api.saveSchedules(schedules);
  refreshUI();
}

function editEvent(id) {
  const s = schedules.find(e => e.id === id);
  if (!s) return;
  editIdInput.value = s.id;
  formTitle.textContent = '编辑日程';
  titleInput.value = s.title;
  startInput.value = s.startTime || '';
  endInput.value = s.endTime || '';
  descInput.value = s.desc || '';
  form.classList.remove('hidden');
  cancelBtn.classList.remove('hidden');
  titleInput.focus();
}

async function deleteEvent(id) {
  if (!confirm('确定删除此日程？')) return;
  schedules = schedules.filter(s => s.id !== id);
  await window.api.saveSchedules(schedules);
  refreshUI();
}

function bindEvents() {
  prevBtn.addEventListener('click', () => navigateMonth(-1));
  nextBtn.addEventListener('click', () => navigateMonth(1));
  saveBtn.addEventListener('click', saveSchedule);
  cancelBtn.addEventListener('click', resetForm);
  addBtn.addEventListener('click', showForm);

  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveSchedule();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') resetForm();
  });
}

init();
