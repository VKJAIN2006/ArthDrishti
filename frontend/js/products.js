/* Products catalog page. */
(function () {
  const $ = (sel) => document.querySelector(sel);
  let allProducts = [];

  function render(list) {
    const body = $('#productsBody');
    $('#productsCount').textContent = `${list.length} product${list.length === 1 ? '' : 's'} shown`;
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="state">No products found.</td></tr>';
      return;
    }
    body.innerHTML = list
      .map((p) => `<tr>
        <td class="cell-strong"><a href="product.html?id=${encodeURIComponent(p.product_id)}">${ui.escapeHtml(p.product_name)}</a><div class="cell-sub">${ui.escapeHtml(p.product_id)}</div></td>
        <td><span class="pill">${ui.escapeHtml(p.category)}</span></td>
        <td class="num">₹${ui.num(p.price, 2)}</td>
        <td class="num">${ui.num(p.current_stock)}</td>
        <td class="num">${ui.num(p.reorder_level)}</td>
        <td class="num">${ui.num(p.lead_time_days)}</td>
        <td><a class="btn btn-ghost btn-sm" href="product.html?id=${encodeURIComponent(p.product_id)}">View details</a></td>
      </tr>`)
      .join('');
  }

  function filter() {
    const q = ($('#searchProd').value || '').toLowerCase();
    const cat = $('#catProd').value || '';
    const list = allProducts.filter((p) => {
      const matchQ = !q || p.product_id.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q);
      const matchC = !cat || p.category === cat;
      return matchQ && matchC;
    });
    render(list);
  }

  async function load() {
    try {
      const { data } = await api.products({ limit: 200 });
      allProducts = data.items || [];
      render(allProducts);
    } catch (e) {
      ui.toast(e.message, 'error');
      $('#productsBody').innerHTML = `<tr><td colspan="7" class="state">${ui.escapeHtml(e.message)}</td></tr>`;
    }
  }

  async function loadCats() {
    try {
      const { data } = await api.categories();
      const sel = $('#catProd');
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
    loadCats().then(load);
    $('#searchProd').addEventListener('input', debounce(filter, 250));
    $('#catProd').addEventListener('change', filter);
  });

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }
})();
