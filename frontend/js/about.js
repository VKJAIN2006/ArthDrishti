/* About/contact page. */
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      subject: document.getElementById('subject').value.trim(),
      message: document.getElementById('message').value.trim(),
    };
    ['name', 'email', 'subject', 'message'].forEach((f) => {
      document.getElementById(`err-${f}`).textContent = '';
    });
    try {
      const res = await api.contact(payload);
      ui.toast(res.message || 'Message sent', 'success');
      form.reset();
    } catch (error) {
      if (error.details && Array.isArray(error.details)) {
        error.details.forEach((d) => {
          const el = document.getElementById(`err-${d.field}`);
          if (el) el.textContent = d.message;
        });
      }
      ui.toast(error.message || 'Could not send message', 'error');
    }
  });
})();
