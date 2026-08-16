// Admin Dashboard JavaScript Logic

let currentFeedbacks = [];
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initLoginForm();
});

// Authentication State & UI Initialization
function initAuth() {
  const token = localStorage.getItem('admin_jwt_token');
  const authNavSection = document.getElementById('authNavSection');

  if (!token) {
    showLoginModal();
    if (authNavSection) authNavSection.innerHTML = '';
  } else {
    hideLoginModal();
    const username = localStorage.getItem('admin_username') || 'admin';
    if (authNavSection) {
      authNavSection.innerHTML = `
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          ${username}
        </span>
        <button class="btn btn-secondary btn-sm" onclick="logout()">Logout</button>
      `;
    }
    loadDashboardData();
  }
}

// Login Form Submit Handler
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('admin_username').value.trim();
    const passwordInput = document.getElementById('admin_password').value.trim();
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!usernameInput || !passwordInput) {
      showToast('Please enter both username and password.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('admin_jwt_token', data.token);
        localStorage.setItem('admin_username', data.username);
        showToast('Authenticated successfully!', 'success');
        hideLoginModal();
        initAuth();
      } else {
        showToast(data.error || 'Authentication failed.', 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast('Network error. Could not connect to API server.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Dashboard';
    }
  });
}

function logout() {
  localStorage.removeItem('admin_jwt_token');
  localStorage.removeItem('admin_username');
  showToast('Logged out successfully.', 'info');
  initAuth();
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('show');
}

function hideLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('show');
}

// Authenticated Fetch Helper
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('admin_jwt_token');
  if (!token) {
    showLoginModal();
    throw new Error('No authentication token found');
  }

  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, options);

  if (response.status === 401) {
    localStorage.removeItem('admin_jwt_token');
    showLoginModal();
    showToast('Session expired. Please log in again.', 'error');
    throw new Error('Unauthorized');
  }

  return response;
}

// Load Overall Dashboard Stats & Analytics
async function loadDashboardData() {
  try {
    const resStats = await fetchWithAuth('/api/stats');
    if (resStats.ok) {
      const stats = await resStats.json();
      renderStatsOverview(stats);
      renderDepartmentAnalytics(stats.by_department || []);
      renderCategoryAnalytics(stats.by_type || []);
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  await loadFeedbacks();
}

// Render Overview Cards
function renderStatsOverview(stats) {
  document.getElementById('statTotalCount').textContent = stats.total_count || 0;
  document.getElementById('statAvgRating').textContent = stats.overall_avg_rating ? `${stats.overall_avg_rating} / 5` : 'N/A';
  document.getElementById('statPendingCount').textContent = stats.pending_count || 0;
  document.getElementById('statReviewedCount').textContent = stats.reviewed_count || 0;
}

// Render Department Performance Bars
function renderDepartmentAnalytics(departments) {
  const container = document.getElementById('departmentStatsContainer');
  if (!container) return;

  if (departments.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No department data available.</p>`;
    return;
  }

  container.innerHTML = departments.map(d => {
    // Fill percentage based on 5 star rating (e.g. 4.5 -> 90%)
    const pct = Math.min(100, Math.max(0, (d.avg_rating / 5) * 100));
    return `
      <div>
        <div class="progress-item-label">
          <span>${escapeHtml(d.department)} (${d.count} ${d.count === 1 ? 'entry' : 'entries'})</span>
          <span style="color: var(--primary);">★ ${d.avg_rating}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Feedback Categories Badges
function renderCategoryAnalytics(categories) {
  const container = document.getElementById('categoryStatsContainer');
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No category data available.</p>`;
    return;
  }

  container.innerHTML = categories.map(c => `
    <div class="type-chip">
      <span>${escapeHtml(c.type)}</span>
      <span class="type-chip-count">${c.count}</span>
    </div>
  `).join('');
}

// Load and Render Feedback Table
async function loadFeedbacks() {
  const tbody = document.getElementById('feedbackTableBody');
  if (!tbody) return;

  // Build query string from filters
  const q = document.getElementById('searchInput').value.trim();
  const dept = document.getElementById('filterDept').value;
  const type = document.getElementById('filterType').value;
  const rating = document.getElementById('filterRating').value;
  const status = document.getElementById('filterStatus').value;
  const sortVal = document.getElementById('sortBy').value;

  const [sortBy, order] = sortVal.split('_'); // e.g. created_at, desc

  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (dept !== 'all') params.append('department', dept);
  if (type !== 'all') params.append('feedback_type', type);
  if (rating !== 'all') params.append('rating', rating);
  if (status !== 'all') params.append('status', status);
  params.append('sort_by', sortBy);
  params.append('order', order);

  try {
    const res = await fetchWithAuth(`/api/feedback?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      currentFeedbacks = data.feedbacks || [];
      renderTableRows(currentFeedbacks);
    }
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <p style="color: var(--danger);">Failed to load feedback records. Please try refreshing.</p>
        </td>
      </tr>
    `;
  }
}

// Render Data Table Rows
function renderTableRows(feedbacks) {
  const tbody = document.getElementById('feedbackTableBody');
  const countBadge = document.getElementById('tableCountBadge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${feedbacks.length} ${feedbacks.length === 1 ? 'item' : 'items'}`;
  }

  if (feedbacks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <p>No feedback entries match your search or filter criteria.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = feedbacks.map(item => {
    const isReviewed = item.status === 'Reviewed';
    const statusClass = isReviewed ? 'reviewed' : 'pending';
    
    // Create stars HTML
    const starsHtml = '★'.repeat(item.rating) + `<span class="inactive-star">${'★'.repeat(5 - item.rating)}</span>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-muted);">#${item.id}</td>
        <td>
          <div style="font-weight: 600; color: var(--secondary);">${escapeHtml(item.student_name)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.roll_number)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(item.department)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.course_name)}</div>
        </td>
        <td>
          <span style="background: var(--bg-surface); padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border-color);">
            ${escapeHtml(item.feedback_type)}
          </span>
        </td>
        <td>
          <div class="table-stars" title="${item.rating} out of 5 stars">${starsHtml}</div>
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            <span class="status-dot"></span>
            ${item.status}
          </span>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">
          ${item.created_at ? item.created_at.split(' ')[0] : 'N/A'}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" title="View Full Details" onclick="viewFeedbackDetail(${item.id})">
            👁️ View
          </button>
          <button class="btn ${isReviewed ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="toggleStatus(${item.id}, '${isReviewed ? 'Pending' : 'Reviewed'}')">
            ${isReviewed ? 'Mark Pending' : 'Mark Reviewed'}
          </button>
          <button class="btn btn-danger btn-sm" title="Delete Entry" onclick="confirmDeleteFeedback(${item.id})">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter Control Handlers
function applyFilters() {
  loadFeedbacks();
}

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    applyFilters();
  }, 300);
}

// Toggle Reviewed / Pending Status
async function toggleStatus(id, newStatus) {
  try {
    const res = await fetchWithAuth(`/api/feedback/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Status updated to "${newStatus}"`, 'success');
      loadDashboardData();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch (err) {
    console.error('Status toggle error:', err);
  }
}

// Confirm and Delete Feedback Entry
async function confirmDeleteFeedback(id) {
  if (!confirm(`Are you sure you want to delete feedback #${id}? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`/api/feedback/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || `Feedback #${id} deleted`, 'success');
      closeDetailModal();
      loadDashboardData();
    } else {
      showToast(data.error || 'Failed to delete feedback', 'error');
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

// View Feedback Detail Modal
function viewFeedbackDetail(id) {
  const item = currentFeedbacks.find(f => f.id === id);
  if (!item) return;

  const modalBody = document.getElementById('detailModalBody');
  const modalFooter = document.getElementById('detailModalFooter');
  if (!modalBody) return;

  const isReviewed = item.status === 'Reviewed';
  const starsHtml = '★'.repeat(item.rating) + `<span class="inactive-star">${'★'.repeat(5 - item.rating)}</span>`;

  modalBody.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
      <div>
        <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--secondary);">${escapeHtml(item.student_name)}</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Roll Number: <strong>${escapeHtml(item.roll_number)}</strong></p>
      </div>
      <span class="status-badge ${isReviewed ? 'reviewed' : 'pending'}">
        <span class="status-dot"></span> ${item.status}
      </span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 0.88rem;">
      <div>
        <div style="color: var(--text-muted); font-size: 0.78rem;">DEPARTMENT</div>
        <div style="font-weight: 600;">${escapeHtml(item.department)}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.78rem;">COURSE / SUBJECT</div>
        <div style="font-weight: 600;">${escapeHtml(item.course_name)}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.78rem;">CATEGORY</div>
        <div style="font-weight: 600;">${escapeHtml(item.feedback_type)}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.78rem;">RATING</div>
        <div class="table-stars">${starsHtml} (${item.rating}/5)</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.78rem;">SUBMITTED AT</div>
        <div style="font-weight: 500;">${item.created_at || 'N/A'}</div>
      </div>
    </div>

    <div style="background: var(--bg-surface); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <div style="color: var(--text-muted); font-size: 0.78rem; font-weight: 600; margin-bottom: 6px;">FEEDBACK MESSAGE</div>
      <p style="font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; color: var(--text-main);">${escapeHtml(item.message)}</p>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-danger" onclick="confirmDeleteFeedback(${item.id})">Delete</button>
    <button class="btn ${isReviewed ? 'btn-outline' : 'btn-primary'}" onclick="toggleStatus(${item.id}, '${isReviewed ? 'Pending' : 'Reviewed'}'); closeDetailModal();">
      ${isReviewed ? 'Mark as Pending' : 'Mark as Reviewed'}
    </button>
    <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
  `;

  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('show');
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('show');
}

// Utility HTML escaper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem; line-height:1;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
