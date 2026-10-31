/* Dashboard page: fetch risk report, render stats, charts and table. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let currentReport = [];
  let chartCat = null;
  let chartTop = null;

  function getParams() {
    return {
      horizon: $('#horizon')?.value || 7,
      category: $('#category')?.value || '',
      level: $('#riskLevel')?.value || '',
      search: $('#search')?.value || '',
      promotion: $('#promotion')?.checked ? 1 : 0,
    };
  }

  function renderSummary(s) {
    const cards = $('#summaryCards');
    cards.innerHTML = `
      <div class="stat"><div class="stat-label">Products shown</div><div class="stat-value">${ui.num(s.total_products)}</div></div>
      <div class="stat accent-high"><div class="stat-label">High risk</div><div class="stat-value">${ui.num(s.high)}</div></div>
      <div class="stat accent-medium"><div class="stat-label">Medium risk</div><div class="stat-value">${ui.num(s.medium)}</div></div>
      <div class="stat accent-over"><div class="stat-label">Overstocked</div><div class="stat-value">${ui.num(s.overstocked)}</div></div>
      <div class="stat accent-safe"><div class="stat-label">Safe</div><div class="stat-value">${ui.num(s.safe)}</div></div>
      <div class="stat accent-primary"><div class="stat-label">Total forecast demand</div><div class="stat-value">${ui.num(s.total_forecast_demand)}</div></div>`;
  }

  function renderTable(report) {
    const body = $('#riskBody');
    currentReport = report;
    if (!report.length) {
      body.innerHTML = '<tr><td colspan="9" class="state">No products match the current filters.</td></tr>';
      return;
    }
    body.innerHTML = report
      .map((r) => {
        const cls = ui.riskRowClass(r.risk_level);
        return `<tr class="${cls}">
          <td><a href="product.html?id=${encodeURIComponent(r.product_id)}">${ui.escapeHtml(r.product_name)}</a><div class="cell-sub">${ui.escapeHtml(r.product_id)}</div></td>
          <td><span class="pill">${ui.escapeHtml(r.category)}</span></td>
          <td class="num cell-strong">${ui.num(r.total_demand)}</td>
          <td class="num">${ui.num(r.avg_daily_demand, 1)}</td>
          <td class="num">${ui.num(r.current_stock)}</td>
          <td class="num">${r.days_of_stock_left === null ? '∞' : ui.num(r.days_of_stock_left, 1)}</td>
          <td>${ui.riskBadge(r.risk_level)}</td>
          <td class="num">${ui.num(r.reorder_qty)}</td>
          <td><span class="small">${ui.escapeHtml(r.action)}</span></td>
        </tr>`;
      })
      .join('');
  }

  function palette(level) {
    if (level === 'High') return 'rgba(220,38,38,0.85)';
    if (level === 'Medium') return 'rgba(217,119,6,0.85)';
    if (level === 'Overstocked') return 'rgba(37,99,235,0.85)';
    if (level === 'Safe') return 'rgba(22,163,74,0.85)';
    return 'rgba(148,163,184,0.8)';
  }

  function renderCharts(report) {
    // Risk by category (group)
    const byCat = new Map();
    report.forEach((r) => {
      if (!byCat.has(r.category)) byCat.set(r.category, { High: 0, Medium: 0, Overstocked: 0, Safe: 0, total: 0 });
      const c = byCat.get(r.category);
      if (c[r.risk_level] !== undefined) c[r.risk_level] += 1;
      c.total += 1;
    });
    const cats = Array.from(byCat.keys()).sort();
    const datasetsCat = ['High', 'Medium', 'Overstocked', 'Safe'].map((lvl) => ({
      label: lvl,
      data: cats.map((k) => byCat.get(k)[lvl]),
      backgroundColor: palette(lvl),
      borderRadius: 6,
    }));

    const ctxCat = $('#chartRiskByCategory');
    if (chartCat) chartCat.destroy();
    if (ctxCat) {
      if (typeof Chart === 'undefined') {
        ui.fallbackBars(ctxCat, cats.map((k) => ({ label: k, value: byCat.get(k).High + byCat.get(k).Medium })));
      } else {
        chartCat = new Chart(ctxCat, {
          type: 'bar',
          data: { labels: cats, datasets: datasetsCat },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
          },
        });
      }
    }

    // Top 10 demand
    const top = [...report].sort((a, b) => b.total_demand - a.total_demand).slice(0, 10);
    const ctxTop = $('#chartTop10');
    if (chartTop) chartTop.destroy();
    if (ctxTop) {
      if (typeof Chart === 'undefined') {
        ui.fallbackBars(ctxTop, top.map((t) => ({ label: t.product_name, value: t.total_demand })));
      } else {
        chartTop = new Chart(ctxTop, {
          type: 'bar',
          data: {
            labels: top.map((t) => t.product_name),
            datasets: [
              {
                label: 'Forecast demand',
                data: top.map((t) => t.total_demand),
                backgroundColor: 'rgba(79,70,229,0.85)',
                borderRadius: 8,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { beginAtZero: true } },
          },
        });
      }
    }
  }

  async function load() {
    const p = getParams();
    $('#reportHint').textContent = p.horizon >= 30 ? 'Monthly view: forecast uncertainty is higher the further ahead you go.' : 'Recommended 7-day view for maximum accuracy.';
    try {
      const { data } = await api.risk({
        horizon: p.horizon,
        level: p.level,
        category: p.category,
        search: p.search,
      });
      renderSummary(data.summary);
      renderTable(data.items);
      renderCharts(data.items);
    } catch (error) {
      ui.toast(error.message, 'error');
      $('#riskBody').innerHTML = `<tr><td colspan="9" class="state">${ui.escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.categories();
      const sel = $('#category');
      if (sel) {
        data.items.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function saveSnapshot() {
    try {
      const p = getParams();
      const { data, message } = await api.saveSnapshot({ horizon_days: parseInt(p.horizon, 10) || 7 });
      ui.toast(message, 'success', 'Snapshot saved');
      console.log(data);
    } catch (error) {
      ui.toast(error.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCategories().then(load);
    $('#btnApply').addEventListener('click', load);
    $('#horizon').addEventListener('change', load);
    $('#category').addEventListener('change', load);
    $('#riskLevel').addEventListener('change', load);
    $('#search').addEventListener('input', debounce(load, 300));
    $('#promotion').addEventListener('change', load);
    $('#btnRefresh').addEventListener('click', load);
    $('#btnSaveSnapshot').addEventListener('click', saveSnapshot);
    $('#btnExportCsv').addEventListener('click', () => {
      const cols = [
        { label: 'Product ID', value: 'product_id' },
        { label: 'Product Name', value: 'product_name' },
        { label: 'Category', value: 'category' },
        { label: 'Forecast (horizon)', value: 'total_demand' },
        { label: 'Avg/day', value: 'avg_daily_demand' },
        { label: 'Current Stock', value: 'current_stock' },
        { label: 'Days of Stock Left', value: (r) => (r.days_of_stock_left === null ? 'INF' : r.days_of_stock_left) },
        { label: 'Risk Level', value: 'risk_level' },
        { label: 'Reorder Qty', value: 'reorder_qty' },
        { label: 'Action', value: 'action' },
      ];
      const h = $('#horizon')?.value || 7;
      ui.downloadCsv(`arthdrishti_risk_${h}d_${new Date().toISOString().slice(0, 10)}.csv`, cols, currentReport);
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
