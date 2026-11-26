// All calls to the Express API go through here.
// In production, VITE_API_URL points at the Render backend (set it in Vercel).
const API_ROOT = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:4000')).replace(/\/$/, '');
const BASE_URL = `${API_ROOT}/api`;

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. If it was asleep, wait a minute and try again.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  return s ? `?${s}` : '';
};

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  getTickets: (token, params) => request(`/tickets${qs(params)}`, { token }),
  getTicket: (token, id) => request(`/tickets/${id}`, { token }),
  createTicket: (token, payload) => request('/tickets', { method: 'POST', body: payload, token }),
  updateTicket: (token, id, payload) => request(`/tickets/${id}`, { method: 'PUT', body: payload, token }),
  setStatus: (token, id, status, note) => request(`/tickets/${id}/status`, { method: 'PUT', body: { status, note }, token }),
  assign: (token, id, technician_id) => request(`/tickets/${id}/assign`, { method: 'PUT', body: { technician_id }, token }),
  addComment: (token, id, body) => request(`/tickets/${id}/comments`, { method: 'POST', body: { body }, token }),
  deleteTicket: (token, id) => request(`/tickets/${id}`, { method: 'DELETE', token }),

  getUsers: (token, params) => request(`/users${qs(params)}`, { token }),
  createUser: (token, payload) => request('/users', { method: 'POST', body: payload, token }),
  setRole: (token, id, role) => request(`/users/${id}/role`, { method: 'PUT', body: { role }, token }),

  getCategories: (token) => request('/categories', { token }),
  getStats: (token) => request('/stats', { token }),
  getReport: (token, days) => request(`/reports/summary${qs({ days })}`, { token }),
};
