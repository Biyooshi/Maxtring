const API_URL = "https://script.google.com/macros/s/AKfycbxSSBfQ9p8cyagtyT9WlQ2HY67BuujR0TfGwvNzhGgrp1Gniox_z8sPBKS6Todm16PeYA/exec";
const SECRET_TOKEN = "maxtring2026";

// ============================================
// TAB NAME CONSTANTS — Single source of truth
// Update these when moving to a new month.
// Matrix tab name & Content Bank tab name differ!
// ============================================
const MATRIX_MONTH_TAB       = "Content JUNI";  // Exact tab name in Matrix All-Marketing
const CONTENT_BANK_MONTH_PREFIX = "JULI";  // Prefix bulan aktif — backend otomatis gabungkan JULI, JULI (2), JULI (3), dst
// ============================================
// DATE PARSING (format Indonesia: DD/MM/YYYY atau DD/MM/YY)
// ============================================
function parseIndonesianDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;

  let [day, month, year] = parts.map(p => parseInt(p, 10));
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 100) year += 2000;

  const parsed = new Date(year, month - 1, day);
  if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) {
    return null; // tanggal tidak valid (misal 32/13/2026)
  }
  return parsed;
}

// ============================================
// OVERALL STATUS — dihitung di frontend, TIDAK menyentuh spreadsheet asli
// ============================================
function computeOverallStatus(row) {
  const statusSMS = (row['Status Upload SMS'] || '').toLowerCase();
  if (statusSMS === 'posted') return 'DONE';

  const jenisContentLower = (row['Jenis Content'] || '').toLowerCase();
  const hasBrief  = !!row['Brief CW'];
  const hasDesign = !!row['Design GD'];
  const hasVideo  = !!row['LINK VIDEO'];
  const needsVideo = jenisContentLower === 'reels';

  const allAssetsReady = needsVideo
    ? (hasBrief && hasDesign && hasVideo)
    : (hasBrief && hasDesign);

  if (allAssetsReady) return 'DONE';
  if (hasBrief || hasDesign || hasVideo) return 'ON PROCESS';
  return 'PENDING';
}

function computeMyTaskStatus(row, user) {
  if (user.role === 'CMO') return computeOverallStatus(row);

  switch (user.role) {
    case 'CW':
      return row['Brief CW'] ? 'Submitted' : 'Not Started';
    case 'GD':
      return row['Design GD'] ? 'Submitted' : 'Not Started';
    case 'Talent':
      return row['LINK VIDEO'] ? 'Submitted' : 'Not Started';
    case 'SMS':
      return (row['Status Upload SMS'] || '').toLowerCase() === 'posted' ? 'Posted' : 'Not Started';
    default:
      return 'Not Started';
  }
}

function getPICColumnForRole(role) {
  const map = { 'CW': 'PJ CW', 'GD': 'PJ GD', 'SMS': 'PJ SMS', 'Talent': 'PJ TALENT' };
  return map[role] || null;
}

function filterTasksForUser(allTasks, user) {
  if (user.role === 'CMO') return allTasks;

  const picCol = getPICColumnForRole(user.role);
  if (!picCol) return allTasks;

  if (user.type === 'head') {
    return allTasks.filter(row => !!(row[picCol] || '').trim());
  }

  return allTasks.filter(row => (row[picCol] || '').trim().toLowerCase() === user.name.trim().toLowerCase());
}


// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('maxtring_theme');

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('maxtring_theme', newTheme);
      toggleBtn.innerHTML = newTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
  }
}

// ============================================
// API CALLS
// ============================================
async function callApi(action, data = {}) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('active');

  try {
    const payload = {
      token: SECRET_TOKEN,
      action: action,
      ...data
    };

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      }
    });

    const result = await response.json();
    if (loader) loader.classList.remove('active');

    if (result.error) {
      console.error("API Error:", result.error);
      // Removed alert popup as per user request to fail silently on missing tabs
      return result;
    }

    return result;
  } catch (error) {
    if (loader) loader.classList.remove('active');
    console.error("Network Error:", error);
    alert("Koneksi gagal. Periksa jaringan Anda.");
    return { error: error.message };
  }
}

function showLoading() {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('active');
}

function hideLoading() {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('active');
}

async function callApiWithTimeout(action, data = {}, timeoutMs = 15000) {
  return Promise.race([
    callApi(action, data),
    new Promise((resolve) => setTimeout(() => resolve({ error: "Timeout: request lebih dari 15 detik, kemungkinan backend hang atau data terlalu besar." }), timeoutMs))
  ]);
}

// ============================================
// AUTH & ROUTING
// ============================================
function checkAuth(requireRole = null) {
  const user = JSON.parse(localStorage.getItem('maxtring_user'));
  if (!user) {
    window.location.href = '/';
    return null;
  }

  if (requireRole && user.role !== requireRole && user.role !== 'CMO') {
    alert("Akses Ditolak: Anda tidak memiliki izin untuk halaman ini.");
    window.location.href = '/dashboard';
    return null;
  }

  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user.name;

  const userRoleEl = document.getElementById('user-role');
  if (userRoleEl) {
    let roleText = user.role;
    if (user.type === 'head') roleText = "Head of " + roleText;
    else if (user.type === 'staff') roleText = roleText + " Staff";
    userRoleEl.textContent = roleText;
  }

  // Adjust Navbar for roles
  const navContentBank = document.getElementById('nav-content-bank');
  if (navContentBank && (user.role === 'SMS' || user.role === 'CMO')) {
    navContentBank.style.display = 'flex';
  }

  return user;
}

function logout() {
  localStorage.removeItem('maxtring_user');
  window.location.href = '/';
}

// ============================================
// MODAL & UTILS
// ============================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function getBadgeClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'PENDING' || s === 'NOT STARTED') return 'badge-ns';
  if (s === 'DONE' || s === 'POSTED' || s === 'APPROVED') return 'badge-app';
  if (s === 'ON PROCESS' || s === 'SUBMITTED' || s === 'SCHEDULED') return 'badge-prog';
  if (s === 'REVISI') return 'badge-rev';
  if (s === 'ACCEPTED') return 'badge-sub';
  return 'badge-ns';
}

// ============================================
// SLA & DEADLINE CALCULATION
// ============================================
function calculateInternalDeadline(uploadDeadlineStr, division) {
  const uploadDate = parseIndonesianDate(uploadDeadlineStr);
  if (!uploadDate) return null;

  const bufferDays = {
    'CW': 3,
    'GD': 2,
    'Talent': 2,
    'QC': 1
  };

  const buffer = bufferDays[division] ?? 1;
  const internalDate = new Date(uploadDate);
  internalDate.setDate(internalDate.getDate() - buffer);
  return internalDate;
}

function calculateSLA(deadlineStrOrDate) {
  const deadline = deadlineStrOrDate instanceof Date ? new Date(deadlineStrOrDate) : parseIndonesianDate(deadlineStrOrDate);
  if (!deadline) return { text: "No SLA", color: "var(--text-muted)", progress: 0 };
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  
  const diffTime = deadline - now;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: `Overdue ${Math.abs(diffDays)} hari`, color: "var(--danger)", progress: 100 };
  if (diffDays === 0) return { text: "Due Today", color: "var(--danger)", progress: 95 };
  if (diffDays <= 2) return { text: `Sisa ${diffDays} hari`, color: "var(--status-prog)", progress: 80 };
  return { text: `Sisa ${diffDays} hari`, color: "var(--status-app)", progress: 30 };
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
});
