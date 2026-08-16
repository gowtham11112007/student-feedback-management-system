// Student Feedback Form JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  initStarRating();
  initFormValidation();
});

let currentRating = 0;

// Auto fill current date in readable format
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
    // Mouseover highlight
    star.addEventListener('mouseover', () => {
      const val = parseInt(star.getAttribute('data-value'));
      highlightStars(stars, val);
      ratingText.textContent = ratingLabels[val] || '';
    });

    // Mouseout restore active state
    star.addEventListener('mouseout', () => {
      highlightStars(stars, currentRating);
      if (currentRating > 0) {
        ratingText.textContent = ratingLabels[currentRating];
      } else {
        ratingText.textContent = 'Click stars to rate (1 to 5)';
      }
    });

    // Click select rating
    star.addEventListener('click', () => {
      currentRating = parseInt(star.getAttribute('data-value'));
      ratingInput.value = currentRating;
      highlightStars(stars, currentRating);
      ratingText.textContent = ratingLabels[currentRating];

      // Remove error state if any
      const ratingGroup = document.getElementById('group-rating');
      if (ratingGroup) {
        ratingGroup.classList.remove('has-error');
      }
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

// Form Submission & Client-Side Validation
function initFormValidation() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;

  // Clear errors on input
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
    
    // Set Loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
      Submitting...
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showToast('Feedback submitted successfully!', 'success');
        showSuccessModal(result.feedback);
        
        // Reset form & stars
        form.reset();
        currentRating = 0;
        document.getElementById('rating').value = '';
        highlightStars(document.querySelectorAll('.star'), 0);
        document.getElementById('ratingText').textContent = 'Click stars to rate (1 to 5)';
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

  // Student Name
  const nameInput = document.getElementById('student_name');
  if (!nameInput.value.trim()) {
    setError('group-student_name');
    isValid = false;
  }

  // Roll Number
  const rollInput = document.getElementById('roll_number');
  if (!rollInput.value.trim()) {
    setError('group-roll_number');
    isValid = false;
  }

  // Department
  const deptInput = document.getElementById('department');
  if (!deptInput.value) {
    setError('group-department');
    isValid = false;
  }

  // Course Name
  const courseInput = document.getElementById('course_name');
  if (!courseInput.value.trim()) {
    setError('group-course_name');
    isValid = false;
  }

  // Feedback Type
  const typeInput = document.getElementById('feedback_type');
  if (!typeInput.value) {
    setError('group-feedback_type');
    isValid = false;
  }

  // Rating
  const ratingVal = parseInt(document.getElementById('rating').value);
  if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
    setError('group-rating');
    isValid = false;
  }

  // Message
  const msgInput = document.getElementById('message');
  if (!msgInput.value.trim() || msgInput.value.trim().length < 5) {
    setError('group-message');
    isValid = false;
  }

  return isValid;
}

function setError(groupId) {
  const group = document.getElementById(groupId);
  if (group) {
    group.classList.add('has-error');
  }
}

// Modal helper
function showSuccessModal(data) {
  document.getElementById('summaryName').textContent = data.student_name;
  document.getElementById('summaryRoll').textContent = data.roll_number;
  document.getElementById('summaryDept').textContent = data.department;
  document.getElementById('summaryType').textContent = data.feedback_type;
  document.getElementById('summaryRating').textContent = '★'.repeat(data.rating) + ' (' + data.rating + '/5)';

  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.add('show');
  }
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('show');
  }
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

// Spinner CSS animation keyframes dynamically injected
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
