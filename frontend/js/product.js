/* Individual product page. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let chartDaily = null;
  let chartHist = null;
  let productId = ui.queryParam('id');

  function showError(msg) {
    $('#prodTitle').textContent = 'Product not found';
    $('#prodSub').textContent = msg;
    $('#fcBody').innerHTML = `<tr><td colspan="2" class="state">${ui.escapeHtml(msg)}</td></tr>`;
    $('#wkBody').innerHTML = `<tr><td colspan="3" class="state">${ui.escapeHtml(msg)}</td></tr>`;
  }

  function renderProduct(p) {
    $('#breadcrumbId').textContent = p.product_id;
    $('#prodTitle').textContent = p.product_name;
    $('#prodSub').textContent = `${p.category} • ₹${ui.num(p.price, 2)} per unit • Stock ${ui.num(p.current_stock)}`;
    $('#pId').textContent = p.product_id;
    $('#pCat').textContent = p.category;
    $('#pPrice').textContent = ui.num(p.price, 2);
    $('#pStock').textContent = ui.num(p.current_stock);
    $('#pReorder').textContent = ui.num(p.reorder_level);
    $('#pLead').textContent = ui.num(p.lead_time_days);
  }

  function renderRisk(f) {
    $('#pRiskBadge').innerHTML = ui.riskBadge(f.risk_level);
    $('#pDaysLeft').textContent = f.days_of_stock_left === null ? '∞ (no expected daily demand)' : ui.num(f.days_of_stock_left, 1) + ' days';
    $('#pReorderQty').textContent = ui.num(f.reorder_qty);
    $('#pAction').textContent = f.action;
  }

  function renderForecast(fc) {
    $('#fcSummary').textContent = `${ui.num(fc.total_demand)} units total • ${ui.num(fc.avg_daily_demand, 1)} / day`;
    $('#fcBody').innerHTML = (fc.daily || [])
      .map((d) => `<tr><td>${d.date}</td><td class="num">${ui.num(d.units)}</td></tr>`)
      .join('') || '<tr><td colspan="2" class="state">No data</td></tr>';
    $('#wkBody').innerHTML = (fc.weekly || [])
      .map((w) => `<tr><td>${w.week_start}</td><td>${w.week_end}</td><td class="num">${ui.num(w.units)}</td></tr>`)
      .join('') || '<tr><td colspan="3" class="state">No data</td></tr>';

    const ctx = $('#chartDaily');
    if (chartDaily) chartDaily.destroy();
    if (ctx) {
      if (typeof Chart === 'undefined') {
        ui.fallbackBars(ctx, (fc.daily || []).map((d) => ({ label: d.date.slice(5), value: d.units })));
      } else {
        chartDaily = new Chart(ctx, {
          type: 'line',
          data: {
            labels: (fc.daily || []).map((d) => d.date.slice(5)),
            datasets: [{
              label: 'Predicted units',
              data: (fc.daily || []).map((d) => d.units),
              tension: 0.35,
              borderColor: 'rgba(79,70,229,1)',
              backgroundColor: 'rgba(79,70,229,0.12)',
              fill: true,
              pointRadius: 2,
            }],
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
        });
      }
    }
  }

  function renderHistory(hist) {
    const ctx = $('#chartHistory');
    if (chartHist) chartHist.destroy();
    if (ctx) {
      const items = (hist.items || []).slice(-60);
      if (typeof Chart === 'undefined') {
        ui.fallbackBars(ctx, items.map((d) => ({ label: d.date.slice(5), value: d.units_sold })));
      } else {
        chartHist = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: items.map((d) => d.date.slice(5)),
            datasets: [{
              label: 'Units sold',
              data: items.map((d) => d.units_sold),
              backgroundColor: 'rgba(14,165,233,0.75)',
              borderRadius: 4,
            }],
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
        });
      }
    }
  }

  async function load() {
    if (!productId) {
      showError('Missing product ID in URL. Open a product from the Products page.');
      return;
    }
    try {
      const [pRes, hRes] = await Promise.all([
        api.product(productId),
        api.history(productId, 60),
      ]);
      renderProduct(pRes.data);
      renderHistory(hRes.data);
      await forecast();
    } catch (e) {
      showError(e.message);
      ui.toast(e.message, 'error');
    }
  }

  async function forecast() {
    const horizon = $('#horizon').value;
    const promotion = $('#promotion').checked ? 1 : 0;
    try {
      const { data: fc } = await api.forecast(productId, { horizon_days: horizon, promotion_flag: promotion });
      renderForecast(fc);
      // Also get risk from batch for this product? Easier: call risk filtered? Alternatively call forecast then derive? But ML batch gives full risk; not necessary. Fetch risk with search to get this product's risk.
      const { data: risk } = await api.risk({ horizon, search: productId });
      const item = (risk.items || []).find((r) => r.product_id === productId);
      if (item) renderRisk(item);
    } catch (e) {
      ui.toast(e.message, 'error');
      $('#fcBody').innerHTML = `<tr><td colspan="2" class="state">${ui.escapeHtml(e.message)}</td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#btnForecast').addEventListener('click', forecast);
    $('#horizon').addEventListener('change', forecast);
    $('#promotion').addEventListener('change', forecast);
    load();
  });
})();
