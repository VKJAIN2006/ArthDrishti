/* Tiny API client around fetch with consistent error handling. */
(function () {
  const BASE = (window.APPCONFIG && window.APPCONFIG.API_BASE) || '/api';

  function buildQuery(params) {
    if (!params) return '';
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') search.append(key, value);
    });
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }

  async function request(path, { method = 'GET', body, params } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(BASE + path + buildQuery(params), {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkError) {
      const error = new Error('Cannot reach the server. Is the backend running on port 3000?');
      error.status = 0;
      throw error;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error((payload && payload.message) || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = payload && payload.details;
      throw error;
    }
    return payload;
  }

  window.api = {
    health: () => request('/health'),
    overview: () => request('/stats/overview'),
    categories: () => request('/categories'),
    products: (params) => request('/products', { params }),
    product: (id) => request(`/products/${encodeURIComponent(id)}`),
    history: (id, days = 60) => request(`/products/${encodeURIComponent(id)}/history`, { params: { days } }),
    forecast: (id, params) => request(`/forecast/${encodeURIComponent(id)}`, { params }),
    forecastBatch: (params) => request('/forecast', { params }),
    topDemand: (params) => request('/top-demand', { params }),
    risk: (params) => request('/risk', { params }),
    saveSnapshot: (body) => request('/forecasts/snapshot', { method: 'POST', body }),
    contact: (body) => request('/contact', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    register: (body) => request('/auth/register', { method: 'POST', body }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  };
})();
