/* Home page: live stats + top demand preview. */
(function () {
  const $ = (sel) => document.querySelector(sel);

  function renderStats(s) {
    $('#statsGrid').innerHTML = `
      <div class="stat accent-primary">
        <div class="stat-label">Products tracked</div>
        <div class="stat-value">${ui.num(s.products)}</div>
        <div class="stat-hint">across ${ui.num(s.categories)} categories</div>
      </div>
      <div class="stat">
        <div class="stat-label">Units sold (history)</div>
        <div class="stat-value">${ui.num(s.total_units_sold)}</div>
        <div class="stat-hint">${ui.num(s.records)} sales records</div>
      </div>
      <div class="stat">
        <div class="stat-label">Avg units / record</div>
        <div class="stat-value">${ui.num(s.avg_daily_units, 1)}</div>
        <div class="stat-hint">daily average per product</div>
      </div>
      <div class="stat">
        <div class="stat-label">Analysed period</div>
        <div class="stat-value" style="font-size:1.15rem">${ui.escapeHtml(s.date_from || '—')} → ${ui.escapeHtml(s.date_to || '—')}</div>
        <div class="stat-hint">historical window</div>
      </div>`;

    $('#heroProducts').textContent = ui.num(s.products);
    $('#heroCategories').textContent = ui.num(s.categories);
    $('#heroRecords').textContent = ui.num(s.records);
    $('#heroDataDate').textContent = s.date_to || '—';
  }

  function renderTop(items) {
    const body = $('#topDemandBody');
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" class="state">No forecast available.</td></tr>';
      return;
    }
    body.innerHTML = items
      .map(
        (i) => `<tr>
          <td class="cell-strong"><a href="product.html?id=${encodeURIComponent(i.product_id)}">${ui.escapeHtml(i.product_name)}</a><div class="cell-sub">${ui.escapeHtml(i.product_id)}</div></td>
          <td><span class="pill">${ui.escapeHtml(i.category)}</span></td>
          <td class="num cell-strong">${ui.num(i.total_demand)}</td>
          <td class="num">${ui.num(i.avg_daily_demand, 1)}</td>
          <td>${ui.riskBadge(i.risk_level)}</td>
        </tr>`
      )
      .join('');
  }

  async function init() {
    try {
      const [{ data: stats }, { data: top }] = await Promise.all([
        api.overview(),
        api.topDemand({ n: 6, horizon: 7 }),
      ]);
      renderStats(stats);
      renderTop(top.items || []);
      $('#heroStatus').textContent = 'Live predictions from the XGBoost demand model.';
    } catch (error) {
      $('#heroStatus').textContent = 'Prediction service unavailable.';
      ui.toast(error.message, 'error');
      const body = $('#topDemandBody');
      if (body) body.innerHTML = `<tr><td colspan="5" class="state">Could not load forecast. ${ui.escapeHtml(error.message)}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
