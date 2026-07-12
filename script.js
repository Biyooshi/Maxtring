const API_URL = "https://script.google.com/macros/s/AKfycbxSSBfQ9p8cyagtyT9WlQ2HY67BuujR0TfGwvNzhGgrp1Gniox_z8sPBKS6Todm16PeYA/exec";
const SECRET_TOKEN = "maxtring2026";

// ============================================
// TAB NAME CONSTANTS — Single source of truth
// Update these when moving to a new month.
// Matrix tab name & Content Bank tab name differ!
// ============================================
const MATRIX_MONTH_TAB       = "Content JUNI";  // Exact tab name in Matrix All-Marketing
const CONTENT_BANK_MONTH_TAB = "Juni";          // Exact tab name in SMS Content Bank


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
      alert("Terjadi kesalahan: " + result.error);
      return null;
    }

    return result;
  } catch (error) {
    if (loader) loader.classList.remove('active');
    console.error("Network Error:", error);
    alert("Koneksi gagal. Periksa jaringan Anda.");
    return null;
  }
}

// ============================================
// AUTH & ROUTING
// ============================================
function checkAuth(requireRole = null) {
  const user = JSON.parse(localStorage.getItem('maxtring_user'));
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  if (requireRole && user.role !== requireRole && user.role !== 'CMO') {
    alert("Akses Ditolak: Anda tidak memiliki izin untuk halaman ini.");
    window.location.href = 'dashboard.html';
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
  window.location.href = 'index.html';
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
  if (!status || status === 'Not Started') return 'badge-ns';
  if (status === 'Approved') return 'badge-app';
  if (status === 'Submitted' || status === 'On Process' || status === 'Scheduled') return 'badge-prog';
  if (status === 'Revisi') return 'badge-rev';
  if (status === 'Posted') return 'badge-post';
  if (status === 'Accepted') return 'badge-sub';
  return 'badge-ns';
}

// ============================================
// SLA CALCULATION
// ============================================
function calculateSLA(deadlineStr) {
  if (!deadlineStr) return { text: "No SLA", color: "var(--text-muted)", progress: 0 };
  
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
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
