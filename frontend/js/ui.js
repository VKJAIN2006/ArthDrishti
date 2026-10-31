/* Shared UI helpers: toasts, mobile menu, formatting, CSV, charts fallback. */
(function () {
  // ------------------------------------------------------------- toasts
  function toastRegion() {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(message, type = 'info', title = '') {
    const region = toastRegion();
    const icons = { success: '✓', error: '!', info: 'i' };
    const titles = { success: 'Success', error: 'Something went wrong', info: 'Heads up' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || 'i'}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title || titles[type] || '')}</div>
        <div>${escapeHtml(message || '')}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss">×</button>`;
    region.appendChild(el);
    const remove = () => el.remove();
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, type === 'error' ? 7000 : 4500);
  }

  // ------------------------------------------------------------- helpers
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(value, digits = 0) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function currency(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  function riskBadge(level) {
    const map = { High: 'badge-high', Medium: 'badge-medium', Safe: 'badge-safe', Overstocked: 'badge-over' };
    const cls = map[level] || 'badge-neutral';
    return `<span class="badge ${cls}">${escapeHtml(level)}</span>`;
  }

  function riskRowClass(level) {
    return { High: 'row-high', Medium: 'row-medium', Safe: 'row-safe', Overstocked: 'row-over' }[level] || '';
  }

  function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // ------------------------------------------------------------- mobile nav
  function initNav() {
    // Highlight the current page
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav-links a[href]').forEach((link) => {
      const target = (link.getAttribute('href') || '').split('?')[0].split('#')[0].toLowerCase();
      if (target && target === here) link.classList.add('active');
    });

    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => {
          links.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        })
      );
    }

    // If a session exists, turn the "Sign in" action into "Sign out".
    const authLink = document.querySelector('.nav-actions a');
    if (authLink && localStorage.getItem('token')) {
      authLink.textContent = 'Sign out';
      authLink.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          if (window.api) await api.logout();
        } catch (_) {
          /* ignore */
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
      });
    }
  }

  function setYear() {
    document.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  // ------------------------------------------------------------- CSV export
  function downloadCsv(filename, columns, rows) {
    const escapeCell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => escapeCell(c.label)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escapeCell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','))
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${filename}`, 'success', 'Export ready');
  }

  // ------------------------------------------------------- chart fallback
  // Renders a simple HTML bar chart when Chart.js is unavailable (offline).
  function fallbackBars(container, items, { labelKey = 'label', valueKey = 'value' } = {}) {
    if (!container) return;
    const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
    container.innerHTML = `<div class="chart-fallback">${items
      .map((i) => {
        const value = Number(i[valueKey]) || 0;
        const pct = Math.round((value / max) * 100);
        return `<div class="bar-row">
          <span>${escapeHtml(i[labelKey])}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${i.color || 'var(--primary)'}"></span></span>
          <span>${num(value)}</span>
        </div>`;
      })
      .join('')}</div>`;
  }

  function init() {
    initNav();
    setYear();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.ui = {
    toast,
    escapeHtml,
    num,
    currency,
    riskBadge,
    riskRowClass,
    queryParam,
    downloadCsv,
    fallbackBars,
  };
})();
