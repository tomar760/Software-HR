/***********************************************************************************
 * PANCHHI HR PRO — Common JavaScript
 * GSheet-only | No localStorage | Real-time sync | Activity logging
 ***********************************************************************************/

const CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbyNMxedcbi_zHA8ma8sc3TncVGuB3lcKie44y36eVAoA2jVW7eZRhfrIgKFJjY4IV9S/exec', // ← Paste Apps Script Web App URL
  COMPANY: 'House of Panchhi',
  VERSION: 'v3.0.0'
};

const MODULE_META = {
  dashboard:  { label: 'Dashboard', icon: 'fa-th-large', color: '#6c47ff' },
  employees:  { label: 'Employees', icon: 'fa-users', color: '#10b981' },
  attendance: { label: 'Attendance', icon: 'fa-calendar-check', color: '#f59e0b' },
  gatepass:   { label: 'Gate Pass', icon: 'fa-door-open', color: '#ec4899' },
  leave:      { label: 'Leave', icon: 'fa-calendar-days', color: '#3b82f6' },
  salary:     { label: 'Salary', icon: 'fa-money-bill-wave', color: '#8b5cf6' },
  store:      { label: 'Store', icon: 'fa-boxes-stacked', color: '#06b6d4' },
  analytics:  { label: 'Analytics', icon: 'fa-chart-line', color: '#14b8a6' },
  teams:      { label: 'Teams', icon: 'fa-people-group', color: '#f97316' },
  settings:   { label: 'Settings', icon: 'fa-sliders', color: '#64748b' },
  profile:    { label: 'Profile', icon: 'fa-user-circle', color: '#6c47ff' },
  users:      { label: 'Users', icon: 'fa-user-shield', color: '#ef4444' }
};
const ALL_MODULES = Object.keys(MODULE_META);

const App = {
  currentPage: 'dashboard',
  currentUser: { name: 'User', role: 'User', initials: 'U', modules: [] },
  data: {},
  lastSync: null
};

const Auth = {
  SESSION_KEY: 'phr_session',
  LOCAL_KEY: 'phr_session_local',
  RETURN_URL: 'phr_return_url',

  useLocal() {
    return document.getElementById('rememberMe')?.checked === true;
  },

  save(user) {
    if (this.useLocal()) {
      localStorage.setItem(this.LOCAL_KEY, JSON.stringify(user));
      sessionStorage.removeItem(this.SESSION_KEY);
    } else {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
      localStorage.removeItem(this.LOCAL_KEY);
    }
  },

  get() {
    try {
      return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)) ||
             JSON.parse(localStorage.getItem(this.LOCAL_KEY)) || null;
    } catch { return null; }
  },

  clear() {
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.LOCAL_KEY);
    sessionStorage.removeItem(this.RETURN_URL);
  },

  isLoggedIn() { return !!this.get(); },
  isAdmin() { const u = this.get(); return u && (u.role === 'Super Admin' || u.role === 'Director'); },
  hasAccess(module) {
    const u = this.get();
    if (!u) return false;
    if (u.role === 'Super Admin' || u.role === 'Director') return true;
    return (u.modules || []).includes(module);
  },

  logout() { this.clear(); window.location.href = 'login.html'; },

  updateName(name) {
    const u = this.get();
    if (u) { u.name = name; this.save(u); this.refreshUI(); }
  },

  updatePhoto(photo) {
    const u = this.get();
    if (u) { u.photo = photo; this.save(u); this.refreshUI(); }
  },

  refreshUI() {
    const u = this.get();
    if (!u) return;
    App.currentUser = { ...u, initials: initials(u.name) };

    document.querySelectorAll('#sidebarAvatar').forEach(el => {
      if (!el) return;
      if (u.photo) {
        el.innerHTML = `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
      } else {
        el.textContent = initials(u.name);
        el.style.background = avatarColor(u.name);
      }
    });
    document.querySelectorAll('#headerAvatar').forEach(el => {
      if (!el) return;
      if (u.photo) {
        el.innerHTML = `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`;
      } else {
        el.textContent = initials(u.name);
        el.style.background = avatarColor(u.name);
      }
    });
    document.querySelectorAll('#sidebarName').forEach(el => { if (el) el.textContent = u.name; });
    document.querySelectorAll('.badge-role').forEach(el => { if (el) el.textContent = u.role; });
    document.querySelectorAll('#profileName').forEach(el => { if (el && !el.value) el.value = u.name; });
    document.querySelectorAll('#profileEmail').forEach(el => { if (el && !el.value) el.value = u.email; });
    document.querySelectorAll('#profilePhone').forEach(el => { if (el && !el.value) el.value = u.phone || ''; });
  }
};

function checkSession() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = path === 'login.html';
  const moduleMap = {
    'employees.html': 'employees', 'attendance.html': 'attendance', 'gatepass.html': 'gatepass',
    'leave.html': 'leave', 'salary.html': 'salary', 'store.html': 'store',
    'analytics.html': 'analytics', 'teams.html': 'teams', 'users.html': 'users'
  };
  const module = moduleMap[path];

  if (!Auth.isLoggedIn()) {
    if (!isLoginPage) {
      sessionStorage.setItem(Auth.RETURN_URL, window.location.href);
      window.location.replace('login.html');
    }
    return false;
  }
  if (isLoginPage) { window.location.replace('index.html'); return false; }
  if (module && !Auth.hasAccess(module)) {
    showToast('error', 'Access Denied', 'Redirecting to dashboard...');
    setTimeout(() => window.location.href = 'index.html', 1000);
    return false;
  }
  Auth.refreshUI();
  applySidebarPermissions();
  return true;
}

function applySidebarPermissions() {
  document.querySelectorAll('.nav-link[data-module]').forEach(el => {
    const mod = el.getAttribute('data-module');
    if (!Auth.hasAccess(mod)) el.style.display = 'none';
  });
  document.querySelectorAll('.nav-sub').forEach(sub => {
    const visible = [...sub.children].filter(c => c.style.display !== 'none');
    if (!visible.length) {
      const parent = sub.previousElementSibling;
      if (parent && parent.classList.contains('has-sub')) parent.style.display = 'none';
      sub.style.display = 'none';
    }
  });
}

// ===================== GOOGLE SHEETS =====================
const GSheet = {
  async send(sheet, data, action = 'INSERT') {
    try {
      const params = new URLSearchParams();
      params.append('sheet', sheet);
      params.append('action', action);
      params.append('data', JSON.stringify(data));
      await fetch(CONFIG.WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: params });
      return true;
    } catch (e) {
      console.error('GSheet send error', e);
      return false;
    }
  },

  async sendBatch(sheet, dataArr) {
    const BATCH = 50;
    for (let i = 0; i < dataArr.length; i += BATCH) {
      const chunk = dataArr.slice(i, i + BATCH);
      await this.send(sheet, chunk, 'INSERT');
      await sleep(800);
    }
    return true;
  },

  async read(sheet, filter = '') {
    try {
      const url = CONFIG.WEB_APP_URL + '?sheet=' + sheet + (filter ? '&filter=' + filter : '');
      const res = await fetch(url);
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      console.error('GSheet read error', e);
      return [];
    }
  }
};

// ===================== DRIVE UPLOAD =====================
async function uploadToDrive(fileInput, folder = 'General') {
  return new Promise((resolve) => {
    const file = fileInput.files[0];
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const data = {
        sheet: 'DriveUpload',
        action: 'UPLOAD',
        data: { folder, base64, mimeType: file.type, fileName: file.name }
      };
      await fetch(CONFIG.WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({ sheet: 'DriveUpload', action: 'UPLOAD', data: JSON.stringify(data.data) })
      });
      resolve({ name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  });
}

async function uploadBase64ToDrive(base64, fileName, mimeType, folder = 'General') {
  try {
    const params = new URLSearchParams();
    params.append('sheet', 'DriveUpload');
    params.append('action', 'UPLOAD');
    params.append('data', JSON.stringify({ folder, base64, mimeType, fileName }));
    await fetch(CONFIG.WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: params });
    return { success: true, fileName };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===================== ACTIVITY LOG =====================
async function logActivity(action, module, details) {
  const u = Auth.get();
  if (!u) return;
  await GSheet.send('ActivityLog', {
    user: u.name, role: u.role, action, module: module || App.currentPage, details
  });
}

// ===================== LOGIN PAGE =====================
async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim().toLowerCase();
  const pass = document.getElementById('loginPass')?.value;
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  if (!email || !pass) { if (err) { err.textContent = 'Enter email and password'; err.style.display = 'block'; } return; }
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner spin"></i> Signing In...';
  if (err) err.style.display = 'none';

  try {
    await GSheet.send('Auth', { email, password: pass }, 'LOGIN');
    await sleep(1000);
    let user = null;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(CONFIG.WEB_APP_URL + '?sheet=Auth&action=GET_USER&email=' + encodeURIComponent(email));
      const j = await res.json();
      if (j.success && j.user) { user = j.user; break; }
      await sleep(700);
    }
    if (!user) throw new Error('Login failed. Check credentials.');
    if (user.status?.toUpperCase() !== 'ACTIVE') throw new Error('Account inactive.');
    Auth.save(user);
    const returnUrl = sessionStorage.getItem(Auth.RETURN_URL) || 'index.html';
    sessionStorage.removeItem(Auth.RETURN_URL);
    window.location.replace(returnUrl);
  } catch (e) {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('forgotEmail')?.value?.trim().toLowerCase();
  const msg = document.getElementById('forgotMsg');
  const btn = document.getElementById('forgotBtn');
  if (!email) { msg.textContent = 'Enter email'; msg.className = 'forgot-msg error'; return; }
  btn.innerHTML = '<i class="fas fa-spinner spin"></i> Sending...';
  try {
    await GSheet.send('Auth', { email }, 'FORGOT_OTP');
    msg.textContent = 'OTP sent! Check your email.';
    msg.className = 'forgot-msg success';
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = 'block';
  } catch (e) {
    msg.textContent = 'Failed to send OTP';
    msg.className = 'forgot-msg error';
  }
}

async function handleResetPassword() {
  const email = document.getElementById('forgotEmail')?.value?.trim().toLowerCase();
  const otp = document.getElementById('resetOTP')?.value?.trim();
  const newPass = document.getElementById('resetPass')?.value;
  const confirm = document.getElementById('resetConfirm')?.value;
  const msg = document.getElementById('forgotMsg');
  if (!otp || !newPass || !confirm) { msg.textContent = 'Fill all fields'; msg.className = 'forgot-msg error'; return; }
  if (newPass !== confirm) { msg.textContent = 'Passwords do not match'; msg.className = 'forgot-msg error'; return; }
  if (newPass.length < 6) { msg.textContent = 'Min 6 characters'; msg.className = 'forgot-msg error'; return; }
  try {
    await GSheet.send('Auth', { email, otp, password: newPass }, 'RESET_PASS');
    msg.textContent = 'Password reset! Redirecting...';
    msg.className = 'forgot-msg success';
    setTimeout(() => showForgot(false), 1500);
  } catch (e) {
    msg.textContent = 'Reset failed';
    msg.className = 'forgot-msg error';
  }
}

function showForgot(show) {
  document.getElementById('loginForm').style.display = show ? 'none' : 'block';
  document.getElementById('forgotForm').style.display = show ? 'block' : 'none';
  if (!show) {
    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
  }
}

// ===================== UI UTILITIES =====================
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const clockEl = document.getElementById('liveClock');
  if (clockEl) clockEl.textContent = timeStr;
  const h = now.getHours();
  let greeting = 'Good Morning';
  if (h >= 12 && h < 17) greeting = 'Good Afternoon';
  else if (h >= 17 && h < 21) greeting = 'Good Evening';
  else if (h >= 21) greeting = 'Good Night';
  const name = Auth.get()?.name || 'User';
  const greetEl = document.getElementById('greetingText');
  if (greetEl) greetEl.textContent = `${greeting}, ${name}! 👋`;
  const dateEl = document.getElementById('greetingDate');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function showToast(type = 'info', title = '', message = '', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || 'fa-bell'}"></i></div>
    <div class="toast-body"><h4>${title}</h4>${message ? `<p>${message}</p>` : ''}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showModal(id) {
  const m = document.getElementById('modal-' + id);
  if (m) m.classList.add('show');
}
function closeModal(id) {
  const m = document.getElementById('modal-' + id);
  if (m) m.classList.remove('show');
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

function btnLoading(btn, text = 'Processing...') {
  const original = btn.innerHTML;
  btn.innerHTML = `<i class="fas fa-spinner spin"></i> ${text}`;
  btn.disabled = true;
  return (doneText = 'Done', fn) => {
    btn.innerHTML = `<i class="fas fa-check"></i> ${doneText}`;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; if (fn) fn(); }, 900);
  };
}

function confirmAction(message, onConfirm, type = 'danger') {
  const icons = { danger: 'fa-trash-alt', warning: 'fa-exclamation-triangle', info: 'fa-question-circle' };
  const modal = document.getElementById('modal-confirm');
  if (!modal) return;
  modal.querySelector('.modal-confirm-icon').className = `modal-confirm-icon ${type}`;
  modal.querySelector('.modal-confirm-icon i').className = 'fas ' + (icons[type] || icons.danger);
  modal.querySelector('.modal-confirm p').textContent = message;
  modal.querySelector('.btn-confirm-ok').onclick = () => { closeModal('confirm'); onConfirm(); };
  showModal('confirm');
}

// ===================== HELPERS =====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function genId(prefix = '') { return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowTimeStr() { return new Date().toTimeString().slice(0, 5); }
function formatDate(dateStr) { if (!dateStr) return '—'; const d = new Date(dateStr); return isNaN(d) ? dateStr : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatTime(timeStr) { if (!timeStr) return '—'; const [h, m] = timeStr.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2, '0')} ${ampm}`; }
function timeDiffMinutes(t1, t2) { if (!t1 || !t2) return 0; const [h1, m1] = t1.split(':').map(Number); const [h2, m2] = t2.split(':').map(Number); return (h2 * 60 + m2) - (h1 * 60 + m1); }
function minutesToHHMM(minutes) { if (minutes <= 0) return '0 min'; const h = Math.floor(Math.abs(minutes) / 60); const m = Math.abs(minutes) % 60; if (h === 0) return `${m} min`; if (m === 0) return `${h} hr`; return `${h} hr ${m} min`; }
function formatINR(amount) { if (amount === '' || amount == null || isNaN(amount)) return '—'; return '₹' + Number(amount).toLocaleString('en-IN'); }
function initials(name = '') { const parts = name.trim().split(' ').filter(Boolean); if (!parts.length) return '?'; if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); }

function avatarColor(name = '') {
  const colors = ['#6c47ff', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316'];
  let hash = 0; for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function downloadCSV(filename, rows, headers) {
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'Downloaded', filename);
}

function filterTable(inputId, tableId) {
  const q = document.getElementById(inputId)?.value?.toLowerCase() || '';
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setInterval(updateClock, 1000);
  updateClock();
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('loginEmail')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPass')?.focus(); });
  document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); }));
});

console.log('%c🪶 Panchhi HR Pro loaded', 'color:#6c47ff;font-weight:bold;font-size:14px;');
