/* Login page. */
(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
    };
    ['email', 'password'].forEach((f) => (document.getElementById(`err-${f}`).textContent = ''));
    try {
      const res = await api.login(payload);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      ui.toast(res.message || 'Signed in', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 600);
    } catch (error) {
      if (error.details && Array.isArray(error.details)) {
        error.details.forEach((d) => {
          const el = document.getElementById(`err-${d.field}`);
          if (el) el.textContent = d.message;
        });
      }
      ui.toast(error.message || 'Login failed', 'error');
    }
  });
})();
