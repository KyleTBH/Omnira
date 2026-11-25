// Browser API adapter for the shared Omnira frontend.
const API_BASE = new URLSearchParams(location.search).get('api') || 'http://127.0.0.1:8000';
window.omnira = {
  request: async (path, options = {}, userId = null) => {
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': String(userId) } : {})
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }
};
