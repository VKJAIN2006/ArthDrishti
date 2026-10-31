/* Focused risk report page with tabs. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let all = [];
  let active = 'all';

  function getParams() {
    return {
      horizon: $('#horizon').value,
      category: $('#category').value,
      search: $('#search').value,
      level: active === 'all' ? '' : active,
    };
  }

  function render(data, level) {
    const body = $('#tbody');
    all = data.items || [];
    $('#cntAll').textContent = data.summary.total_products;
    $('#cntHigh').textContent = data.summary.high;
    $('#cntMedium').textContent = data.summary.medium;
    $('#cntOver').textContent = data.summary.overstocked;
    $('#cntSafe').textContent = data.summary.safe;

    let list = all;
    if (level === 'high') list = list.filter((x) => x.risk_level === 'High');
    if (level === 'medium') list = list.filter((x) => x.risk_level === 'Medium');
    if (level === 'over') list = list.filter((x) => x.risk_level === 'Overstocked');
    if (level === 'safe') list = list.filter((x) => x.risk_level === 'Safe');

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8" class="state">No products match.</td></tr>';
      return;
    }
    body.innerHTML = list
      .map((r) => `<tr>
        <td><a href="product.html?id=${encodeURIComponent(r.product_id)}">${ui.escapeHtml(r.product_name)}</a><div class="cell-sub">${ui.escapeHtml(r.product_id)}</div></td>
        <td><span class="pill">${ui.escapeHtml(r.category)}</span></td>
        <td class="num">${ui.num(r.total_demand)}</td>
        <td class="num">${ui.num(r.current_stock)}</td>
        <td class="num">${r.days_of_stock_left === null ? '∞' : ui.num(r.days_of_stock_left, 1)}</td>
        <td>${ui.riskBadge(r.risk_level)}</td>
        <td class="num">${ui.num(r.reorder_qty)}</td>
        <td class="small">${ui.escapeHtml(r.action)}</td>
      </tr>`)
      .join('');
  }

  async function load(level = active) {
    active = level;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === active));
    const p = getParams();
    try {
      const { data } = await api.risk(p);
      render(data, active);
      $('#hint').textContent = p.horizon >= 30 ? 'Monthly view: forecast uncertainty is higher the further ahead you go.' : '7-day horizon recommended for operational ordering.';
    } catch (e) {
      ui.toast(e.message, 'error');
      $('#tbody').innerHTML = `<tr><td colspan="8" class="state">${ui.escapeHtml(e.message)}</td></tr>`;
    }
  }

  async function loadCats() {
    try {
      const { data } = await api.categories();
      const sel = $('#category');
      data.items.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCats().then(() => load('all'));
    document.querySelectorAll('.tab').forEach((b) =>
      b.addEventListener('click', () => load(b.dataset.tab))
    );
    $('#btnApply').addEventListener('click', () => load(active));
    $('#horizon').addEventListener('change', () => load(active));
    $('#category').addEventListener('change', () => load(active));
    $('#search').addEventListener('input', debounce(() => load(active), 250));
    $('#btnExport').addEventListener('click', () => {
      const cols = [
        { label: 'Product ID', value: 'product_id' },
        { label: 'Product Name', value: 'product_name' },
        { label: 'Category', value: 'category' },
        { label: 'Forecast', value: 'total_demand' },
        { label: 'Stock', value: 'current_stock' },
        { label: 'Days left', value: (r) => (r.days_of_stock_left === null ? 'INF' : r.days_of_stock_left) },
        { label: 'Risk', value: 'risk_level' },
        { label: 'Reorder qty', value: 'reorder_qty' },
        { label: 'Action', value: 'action' },
      ];
      ui.downloadCsv(`arthdrishti_risk_${$('#horizon').value}d_${Date.now()}.csv`, cols, all);
    });
  });

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }
})();
