const API_URL = "https://script.google.com/macros/s/AKfycby_PLACEHOLDER/exec"; // Harus diganti dengan URL Web App Apps Script setelah di-deploy
const SECRET_TOKEN = "maxtring2026";

// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('maxtring_theme');
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if(toggleBtn) toggleBtn.innerHTML = '☀️';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if(toggleBtn) toggleBtn.innerHTML = '🌙';
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('maxtring_theme', newTheme);
      toggleBtn.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
    });
  }
}

// ============================================
// API CALLS
// ============================================
async function callApi(action, data = {}) {
  const loader = document.getElementById('loader');
  if(loader) loader.classList.add('active');
  
  try {
    const payload = {
      token: SECRET_TOKEN,
      action: action,
      ...data
    };
    
    // Karena ini vanilla JS & Google Apps Script butuh POST body berupa text plain jika tidak pakai form data
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      }
    });
    
    const result = await response.json();
    if(loader) loader.classList.remove('active');
    
    if(result.error) {
      console.error("API Error:", result.error);
      alert("Terjadi kesalahan: " + result.error);
      return null;
    }
    
    return result;
  } catch (error) {
    if(loader) loader.classList.remove('active');
    console.error("Network Error:", error);
    // Untuk development lokal yang belum terhubung, kita return mock data sementara
    console.warn("Menggunakan MOCK DATA karena gagal terhubung ke API");
    return mockApiFallback(action, data);
  }
}

// ============================================
// MOCK DATA (Untuk Development/Preview)
// ============================================
function mockApiFallback(action, data) {
  if (action === 'login') {
    if (data.username === 'cmo' && data.password === 'biyooshi24!!') {
      return { success: true, role: 'CMO', type: 'cmo', team: [{nama: "Muhammad Nurul Qolbi"}] };
    }
    return { success: true, role: 'CW', type: 'staff', team: [{nama: "Ben"}, {nama: "Rida"}] };
  }
  if (action === 'getMatrixData') {
    return { success: true, data: [
      { "Task ID": "TASK-001", "Judul": "Tips Interview", "Overall Status": "On Process", "CW Status": "Approved", "GD Status": "Not Started" },
      { "Task ID": "TASK-002", "Judul": "Info Loker BUMN", "Overall Status": "Posted", "CW Status": "Approved", "GD Status": "Approved" }
    ]};
  }
  return { success: false, error: "Mock data not available for this action" };
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
  
  // Jika halaman butuh role khusus (misal content bank untuk SMS/CMO)
  if (requireRole && user.role !== requireRole && user.role !== 'CMO') {
    alert("Anda tidak memiliki akses ke halaman ini");
    window.location.href = 'dashboard.html';
    return null;
  }
  
  // Set user info di UI jika ada
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user.name;
  
  const userRoleEl = document.getElementById('user-role');
  if (userRoleEl) userRoleEl.textContent = user.role + (user.type === 'head' ? ' (Head)' : '');
  
  return user;
}

function logout() {
  localStorage.removeItem('maxtring_user');
  window.location.href = 'index.html';
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
});
