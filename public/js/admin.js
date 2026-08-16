// Admin Dashboard JavaScript Logic

let currentFeedbacks = [];
let selectedFeedbackIds = new Set();
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
  initLoginForm();
});

// Theme System
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    updateThemeIcon('☀️');
  } else {
    document.body.classList.remove('dark-theme');
    updateThemeIcon('🌙');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-theme');
  const isDark = document.body.classList.contains('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark ? '☀️' : '🌙');
}

function updateThemeIcon(icon) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = icon;
}

// Authentication Initialization
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

// Login Handler
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
      renderRatingDistributionChart(stats.rating_distribution || {}, stats.total_count || 0);
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

  const total = stats.total_count || 0;
  const posCount = (stats.sentiment_breakdown && stats.sentiment_breakdown.Positive) ? stats.sentiment_breakdown.Positive : 0;
  const posPct = total > 0 ? Math.round((posCount / total) * 100) : 0;

  document.getElementById('statPositivePct').textContent = `${posPct}%`;
}

// Render Department Scorecards
function renderDepartmentAnalytics(departments) {
  const container = document.getElementById('departmentStatsContainer');
  if (!container) return;

  if (departments.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No department data available.</p>`;
    return;
  }

  container.innerHTML = departments.map(d => {
    const pct = Math.min(100, Math.max(0, (d.avg_rating / 5) * 100));
    let gradeClass = 'grade-badge-a';
    if (d.grade === 'A+') gradeClass = 'grade-badge-aplus';
    else if (d.grade === 'B+' || d.grade === 'B') gradeClass = 'grade-badge-b';
    else if (d.grade === 'C') gradeClass = 'grade-badge-c';

    return `
      <div>
        <div class="progress-item-label">
          <span>${escapeHtml(d.department)} (${d.count} ${d.count === 1 ? 'entry' : 'entries'})</span>
          <span>
            <span class="grade-badge ${gradeClass}">GRADE ${d.grade}</span>
            <span style="color: var(--primary); margin-left: 6px; font-weight: 700;">★ ${d.avg_rating}</span>
          </span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Rating Distribution Bar Chart
function renderRatingDistributionChart(dist, total) {
  const container = document.getElementById('ratingChartContainer');
  if (!container) return;

  const stars = [5, 4, 3, 2, 1];
  container.innerHTML = stars.map(s => {
    const count = dist[str(s)] || dist[s] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    return `
      <div class="chart-bar-row">
        <span class="chart-star-label">★ ${s} Star</span>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width: ${pct}%;"></div>
        </div>
        <span style="width: 45px; text-align: right; color: var(--text-muted); font-size: 0.78rem;">${count} (${pct}%)</span>
      </div>
    `;
  }).join('');
}

function str(val) { return String(val); }

// Load Feedbacks with Filter Parameters
async function loadFeedbacks() {
  const tbody = document.getElementById('feedbackTableBody');
  if (!tbody) return;

  const q = document.getElementById('searchInput').value.trim();
  const dept = document.getElementById('filterDept').value;
  const type = document.getElementById('filterType').value;
  const sentiment = document.getElementById('filterSentiment') ? document.getElementById('filterSentiment').value : 'all';
  const priority = document.getElementById('filterPriority') ? document.getElementById('filterPriority').value : 'all';
  const sortVal = document.getElementById('sortBy').value;

  const parts = sortVal.split('_');
  const order = parts.pop();
  const sortBy = parts.join('_');

  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (dept !== 'all') params.append('department', dept);
  if (type !== 'all') params.append('feedback_type', type);
  if (sentiment !== 'all') params.append('sentiment', sentiment);
  if (priority !== 'all') params.append('priority', priority);
  params.append('sort_by', sortBy);
  params.append('order', order);

  try {
    const res = await fetchWithAuth(`/api/feedback?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      currentFeedbacks = data.feedbacks || [];
      selectedFeedbackIds.clear();
      updateBulkBar();
      renderTableRows(currentFeedbacks);
    }
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <p style="color: var(--danger);">Failed to load feedback records. Please try refreshing.</p>
        </td>
      </tr>
    `;
  }
}

// Render Table Rows
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
        <td colspan="10" class="empty-state">
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
    const isChecked = selectedFeedbackIds.has(item.id);

    const s = item.sentiment || 'Neutral';
    const sentimentClass = s === 'Positive' ? 'badge-positive' : s === 'Negative' ? 'badge-negative' : 'badge-neutral';
    const sentimentIcon = s === 'Positive' ? '😄' : s === 'Negative' ? '🙁' : '😐';

    const p = item.priority || 'Medium';
    const priorityClass = p === 'High' ? 'priority-high' : p === 'Medium' ? 'priority-medium' : 'priority-low';
    const priorityIcon = p === 'High' ? '🚨' : p === 'Medium' ? '⚠️' : 'ℹ️';

    const starsHtml = '★'.repeat(item.rating) + `<span class="inactive-star">${'★'.repeat(5 - item.rating)}</span>`;

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="row-checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} onchange="toggleRowSelect(${item.id}, this.checked)">
        </td>
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
          <div class="table-stars">${starsHtml}</div>
        </td>
        <td>
          <span class="badge-sentiment ${sentimentClass}">
            ${sentimentIcon} ${s}
          </span>
        </td>
        <td>
          <span class="priority-flag ${priorityClass}">
            ${priorityIcon} ${p}
          </span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            <span class="status-dot"></span> ${item.status}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" title="View & Resolve" onclick="viewFeedbackDetail(${item.id})">
            👁️ Detail
          </button>
          <button class="btn ${isReviewed ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="toggleStatus(${item.id}, '${isReviewed ? 'Pending' : 'Reviewed'}')">
            ${isReviewed ? 'Pending' : 'Reviewed'}
          </button>
          <button class="btn btn-danger btn-sm" title="Delete Entry" onclick="confirmDeleteFeedback(${item.id})">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Bulk Selection Actions
function toggleSelectAll(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    const id = parseInt(cb.value);
    if (masterCheckbox.checked) selectedFeedbackIds.add(id);
    else selectedFeedbackIds.delete(id);
  });
  updateBulkBar();
}

function toggleRowSelect(id, isChecked) {
  if (isChecked) selectedFeedbackIds.add(id);
  else selectedFeedbackIds.delete(id);

  const master = document.getElementById('selectAllCheckbox');
  if (master) master.checked = (selectedFeedbackIds.size === currentFeedbacks.length && currentFeedbacks.length > 0);

  updateBulkBar();
}

function updateBulkBar() {
  const bulkBar = document.getElementById('bulkBar');
  const countSpan = document.getElementById('selectedCount');
  if (!bulkBar) return;

  if (selectedFeedbackIds.size > 0) {
    bulkBar.style.display = 'flex';
    if (countSpan) countSpan.textContent = selectedFeedbackIds.size;
  } else {
    bulkBar.style.display = 'none';
  }
}

async function executeBulkAction(action) {
  const ids = Array.from(selectedFeedbackIds);
  if (ids.length === 0) return;

  if (action === 'delete' && !confirm(`Are you sure you want to delete ${ids.length} selected items?`)) {
    return;
  }

  try {
    const res = await fetchWithAuth('/api/feedback/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, ids: ids })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Bulk action executed', 'success');
      loadDashboardData();
    } else {
      showToast(data.error || 'Bulk action failed', 'error');
    }
  } catch (err) {
    console.error('Bulk action error:', err);
  }
}

// Filters & Debounce
function applyFilters() { loadFeedbacks(); }
function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => { applyFilters(); }, 300);
}

// Single Status Toggle
async function toggleStatus(id, newStatus) {
  try {
    const res = await fetchWithAuth(`/api/feedback/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      showToast(`Status updated to "${newStatus}"`, 'success');
      loadDashboardData();
    }
  } catch (err) {
    console.error('Status toggle error:', err);
  }
}

// Delete Confirmation
async function confirmDeleteFeedback(id) {
  if (!confirm(`Are you sure you want to delete feedback #${id}?`)) return;

  try {
    const res = await fetchWithAuth(`/api/feedback/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Feedback #${id} deleted`, 'success');
      closeDetailModal();
      loadDashboardData();
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

// Detail & Resolution Modal View
function viewFeedbackDetail(id) {
  const item = currentFeedbacks.find(f => f.id === id);
  if (!item) return;

  const modalBody = document.getElementById('detailModalBody');
  const modalFooter = document.getElementById('detailModalFooter');
  if (!modalBody) return;

  const isReviewed = item.status === 'Reviewed';
  const starsHtml = '★'.repeat(item.rating) + `<span class="inactive-star">${'★'.repeat(5 - item.rating)}</span>`;

  modalBody.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
      <div>
        <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--secondary);">${escapeHtml(item.student_name)}</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Roll Number: <strong>${escapeHtml(item.roll_number)}</strong></p>
      </div>
      <span class="status-badge ${isReviewed ? 'reviewed' : 'pending'}">
        <span class="status-dot"></span> ${item.status}
      </span>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; font-size: 0.88rem;">
      <div>
        <div style="color: var(--text-muted); font-size: 0.75rem;">DEPARTMENT</div>
        <div style="font-weight: 600;">${escapeHtml(item.department)}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.75rem;">COURSE / SUBJECT</div>
        <div style="font-weight: 600;">${escapeHtml(item.course_name)}</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.75rem;">CATEGORY & SENTIMENT</div>
        <div style="font-weight: 600;">${escapeHtml(item.feedback_type)} (${item.sentiment || 'Neutral'})</div>
      </div>
      <div>
        <div style="color: var(--text-muted); font-size: 0.75rem;">RATING & PRIORITY</div>
        <div class="table-stars">${starsHtml} | <span style="color: var(--danger);">${item.priority || 'Medium'} Priority</span></div>
      </div>
    </div>

    <div style="background: var(--bg-surface); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 18px;">
      <div style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700; margin-bottom: 6px;">STUDENT FEEDBACK COMMENT</div>
      <p style="font-size: 0.92rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-main);">${escapeHtml(item.message)}</p>
    </div>

    <div class="form-group">
      <label for="resolutionNotesInput" class="form-label">Admin Resolution / Action Notes</label>
      <textarea id="resolutionNotesInput" class="form-control" placeholder="Log administrative actions taken (e.g. Notified instructor, scheduled lab maintenance)...">${escapeHtml(item.resolution_notes || '')}</textarea>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-danger" onclick="confirmDeleteFeedback(${item.id})">Delete</button>
    <button class="btn btn-success" onclick="saveResolutionNotes(${item.id})">Save Resolution & Mark Reviewed</button>
    <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
  `;

  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.add('show');
}

async function saveResolutionNotes(id) {
  const notesInput = document.getElementById('resolutionNotesInput');
  const notes = notesInput ? notesInput.value.trim() : '';

  try {
    const res = await fetchWithAuth(`/api/feedback/${id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_notes: notes })
    });

    if (res.ok) {
      showToast('Resolution notes logged successfully!', 'success');
      closeDetailModal();
      loadDashboardData();
    }
  } catch (err) {
    console.error('Save resolution error:', err);
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('show');
}

// CSV Export Generator
function exportCSV() {
  if (currentFeedbacks.length === 0) {
    showToast('No feedback entries to export.', 'error');
    return;
  }

  const headers = ['ID', 'Student Name', 'Roll Number', 'Department', 'Course Name', 'Category', 'Rating', 'Sentiment', 'Priority', 'Status', 'Resolution Notes', 'Date'];
  const rows = currentFeedbacks.map(f => [
    f.id,
    `"${f.student_name.replace(/"/g, '""')}"`,
    `"${f.roll_number.replace(/"/g, '""')}"`,
    `"${f.department.replace(/"/g, '""')}"`,
    `"${f.course_name.replace(/"/g, '""')}"`,
    `"${f.feedback_type.replace(/"/g, '""')}"`,
    f.rating,
    f.sentiment || 'Neutral',
    f.priority || 'Medium',
    f.status,
    `"${(f.resolution_notes || '').replace(/"/g, '""')}"`,
    f.created_at || ''
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Student_Feedback_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV export downloaded successfully!', 'success');
}

// Executive Printable Summary Report Generator
function printExecutiveReport() {
  window.print();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

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
  setTimeout(() => { toast.remove(); }, 4000);
}
