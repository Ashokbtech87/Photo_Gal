const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return res.json();
}

// Auth
export const authApi = {
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
};

// Photos
export const photosApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/photos?${qs}`);
  },
  getOne: (id) => request(`/photos/${id}`),
  upload: (formData) => request('/photos', { method: 'POST', body: formData }),
  update: (id, data) => request(`/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/photos/${id}`, { method: 'DELETE' }),
  bulkDownload: async (ids) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/photos/download`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-photos-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// Albums
export const albumsApi = {
  getAll: () => request('/albums'),
  getOne: (id) => request(`/albums/${id}`),
  create: (data) => request('/albums', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/albums/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/albums/${id}`, { method: 'DELETE' }),
};

// Settings
export const settingsApi = {
  get: () => request('/settings'),
  update: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  verify: () => request('/settings/verify', { method: 'POST' }),
};

// Virtual Try-On
export const tryonApi = {
  generate: (data) => request('/tryon/generate', { method: 'POST', body: JSON.stringify(data) }),
  getResults: () => request('/tryon/results'),
  deleteResult: (id) => request(`/tryon/results/${id}`, { method: 'DELETE' }),
  saveToGallery: (id, data) => request(`/tryon/results/${id}/save`, { method: 'POST', body: JSON.stringify(data) }),
};

// AI Agent
export const agentApi = {
  search: (data) => request('/agent/search', { method: 'POST', body: JSON.stringify(data) }),
  download: (data) => request('/agent/download', { method: 'POST', body: JSON.stringify(data) }),
  chat: (data) => request('/agent/chat', { method: 'POST', body: JSON.stringify(data) }),
  getModels: () => request('/agent/models'),
};
