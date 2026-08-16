// Student Feedback Form JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDateDisplay();
  initStarRating();
  initFormValidation();
  initLiveSentiment();
});

let currentRating = 0;

// Theme Toggle System
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

// Auto fill current date
function initDateDisplay() {
  const dateInput = document.getElementById('submission_date_display');
  if (dateInput) {
    const today = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    dateInput.value = today.toLocaleDateString('en-US', options);
  }
}

// Rating Labels Map
const ratingLabels = {
  1: '1 Star - Poor 😞',
  2: '2 Stars - Below Average 😐',
  3: '3 Stars - Average 🙂',
  4: '4 Stars - Very Good 😊',
  5: '5 Stars - Excellent! 🌟'
};

// Interactive 5-Star Rating Handler
function initStarRating() {
  const starContainer = document.getElementById('starRating');
  if (!starContainer) return;

  const stars = starContainer.querySelectorAll('.star');
  const ratingInput = document.getElementById('rating');
  const ratingText = document.getElementById('ratingText');

  stars.forEach(star => {
    star.addEventListener('mouseover', () => {
      const val = parseInt(star.getAttribute('data-value'));
      highlightStars(stars, val);
      ratingText.textContent = ratingLabels[val] || '';
    });

    star.addEventListener('mouseout', () => {
      highlightStars(stars, currentRating);
      if (currentRating > 0) {
        ratingText.textContent = ratingLabels[currentRating];
      } else {
        ratingText.textContent = 'Click stars to rate (1 to 5)';
      }
    });

    star.addEventListener('click', () => {
      currentRating = parseInt(star.getAttribute('data-value'));
      ratingInput.value = currentRating;
      highlightStars(stars, currentRating);
      ratingText.textContent = ratingLabels[currentRating];

      const ratingGroup = document.getElementById('group-rating');
      if (ratingGroup) ratingGroup.classList.remove('has-error');

      updateLiveSentiment();
    });
  });
}

function highlightStars(stars, count) {
  stars.forEach(star => {
    const val = parseInt(star.getAttribute('data-value'));
    if (val <= count) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// Live Sentiment Analysis Preview
function initLiveSentiment() {
  const messageInput = document.getElementById('message');
  if (messageInput) {
    messageInput.addEventListener('input', updateLiveSentiment);
  }
}

function updateLiveSentiment() {
  const messageInput = document.getElementById('message');
  const badge = document.getElementById('liveSentimentBadge');
  if (!messageInput || !badge) return;

  const text = messageInput.value.trim().toLowerCase();
  if (text.length < 5) {
    badge.style.display = 'none';
    return;
  }

  badge.style.display = 'inline-flex';

  const posWords = ['excellent', 'great', 'good', 'awesome', 'helpful', 'clear', 'best', 'love', 'fantastic', 'practical'];
  const negWords = ['poor', 'bad', 'hard', 'difficult', 'slow', 'late', 'freeze', 'broken', 'issue', 'problem', 'unhelpful'];

  let posCount = 0;
  let negCount = 0;

  posWords.forEach(w => { if (text.includes(w)) posCount++; });
  negWords.forEach(w => { if (text.includes(w)) negCount++; });

  if (currentRating >= 4 || posCount > negCount) {
    badge.className = 'badge-sentiment badge-positive';
    badge.textContent = 'Sentiment: Positive 😄';
  } else if (currentRating <= 2 || negCount > posCount) {
    badge.className = 'badge-sentiment badge-negative';
    badge.textContent = 'Sentiment: Negative 🙁';
  } else {
    badge.className = 'badge-sentiment badge-neutral';
    badge.textContent = 'Sentiment: Neutral 😐';
  }
}

// Quick Topic Tag Appender
function appendTag(tag) {
  const messageInput = document.getElementById('message');
  if (!messageInput) return;

  const currentVal = messageInput.value.trim();
  if (currentVal.includes(tag)) return;

  messageInput.value = currentVal ? `${currentVal} ${tag}` : tag;
  messageInput.focus();
  updateLiveSentiment();
}

// Form Submission & Client-Side Validation
function initFormValidation() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;

  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if (group) group.classList.remove('has-error');
    });
    input.addEventListener('change', () => {
      const group = input.closest('.form-group');
      if (group) group.classList.remove('has-error');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the errors in the form before submitting.', 'error');
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalBtnContent = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      Analyzing & Submitting...
    `;

    const formData = {
      student_name: document.getElementById('student_name').value.trim(),
      roll_number: document.getElementById('roll_number').value.trim(),
      department: document.getElementById('department').value,
      course_name: document.getElementById('course_name').value.trim(),
      feedback_type: document.getElementById('feedback_type').value,
      rating: parseInt(document.getElementById('rating').value),
      message: document.getElementById('message').value.trim()
    };

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showToast('Feedback submitted and analyzed successfully!', 'success');
        showSuccessModal(result.feedback);
        
        form.reset();
        currentRating = 0;
        document.getElementById('rating').value = '';
        highlightStars(document.querySelectorAll('.star'), 0);
        document.getElementById('ratingText').textContent = 'Click stars to rate (1 to 5)';
        document.getElementById('liveSentimentBadge').style.display = 'none';
        initDateDisplay();
      } else {
        const errorMsg = result.error || (result.details ? result.details.join(' ') : 'Failed to submit feedback.');
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Network error. Unable to connect to the server.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
    }
  });
}

function validateForm() {
  let isValid = true;

  if (!document.getElementById('student_name').value.trim()) { setError('group-student_name'); isValid = false; }
  if (!document.getElementById('roll_number').value.trim()) { setError('group-roll_number'); isValid = false; }
  if (!document.getElementById('department').value) { setError('group-department'); isValid = false; }
  if (!document.getElementById('course_name').value.trim()) { setError('group-course_name'); isValid = false; }
  if (!document.getElementById('feedback_type').value) { setError('group-feedback_type'); isValid = false; }

  const ratingVal = parseInt(document.getElementById('rating').value);
  if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) { setError('group-rating'); isValid = false; }

  const msgInput = document.getElementById('message');
  if (!msgInput.value.trim() || msgInput.value.trim().length < 5) { setError('group-message'); isValid = false; }

  return isValid;
}

function setError(groupId) {
  const group = document.getElementById(groupId);
  if (group) group.classList.add('has-error');
}

function showSuccessModal(data) {
  document.getElementById('summaryName').textContent = data.student_name;
  document.getElementById('summaryRoll').textContent = data.roll_number;
  document.getElementById('summaryDept').textContent = data.department;
  document.getElementById('summaryType').textContent = data.feedback_type;
  document.getElementById('summaryRating').textContent = '★'.repeat(data.rating) + ' (' + data.rating + '/5)';

  const sentimentSpan = document.getElementById('summarySentiment');
  if (sentimentSpan) {
    const s = data.sentiment || 'Neutral';
    sentimentSpan.textContent = `${s} ${s === 'Positive' ? '😄' : s === 'Negative' ? '🙁' : '😐'}`;
    sentimentSpan.className = `badge-sentiment badge-${s.toLowerCase()}`;
  }

  const modal = document.getElementById('successModal');
  if (modal) modal.classList.add('show');
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.classList.remove('show');
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

const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
