/**
 * HTTP client for the Python ML microservice.
 * All model/forecast/risk calls go through here.
 */
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const TIMEOUT_MS = 20000;

async function request(path, { method = 'GET', body, query } = {}) {
  let url = `${env.mlServiceUrl}${path}`;
  if (query) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!res.ok) {
      const detail = payload && payload.detail ? payload.detail : `ML service returned ${res.status}`;
      throw new ApiError(res.status, detail);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError(504, 'The ML service timed out. Please try again.');
    }
    throw ApiError.serviceUnavailable(
      'The ML prediction service is not reachable. Start it with: uvicorn app.main:app --port 8000'
    );
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  health: () => request('/health'),
  overview: () => request('/stats/overview'),
  categories: () => request('/categories'),
  listProducts: (query) => request('/products', { query }),
  getProduct: (id) => request(`/products/${encodeURIComponent(id)}`),
  getHistory: (id, days) => request(`/products/${encodeURIComponent(id)}/history`, { query: { days } }),
  predict: (body) => request('/predict', { method: 'POST', body }),
  forecastProduct: (body) => request('/forecast', { method: 'POST', body }),
  forecastBatch: (body) => request('/forecast/batch', { method: 'POST', body }),
  risk: (query) => request('/risk', { query }),
  topDemand: (query) => request('/top-demand', { query }),
};
