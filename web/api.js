// Shared browser transport: verified bearer identity, never a trusted user ID.
const API_BASE = new URLSearchParams(location.search).get('api') ||
  (location.protocol === 'file:' || location.port === '5500' ? 'http://127.0.0.1:8000' : location.origin);
let omniraSession = null;
try { omniraSession = JSON.parse(sessionStorage.getItem('omnira-auth') || 'null'); } catch {}
window.omnira = {
  user: () => omniraSession,
  clearSession: () => { omniraSession = null; try { sessionStorage.removeItem('omnira-auth'); localStorage.removeItem('omniraUser'); } catch {} },
  request: async (path, options = {}, _legacyUserId = null) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(API_BASE + path, {
        ...options, signal: options.signal || controller.signal,
        headers: {
          ...(options.body instanceof FormData ? {} : {'Content-Type': 'application/json'}),
          ...(omniraSession?.token ? {'Authorization': `Bearer ${omniraSession.token}`} : {}),
          ...options.headers
        }
      });
      if (options.raw && response.ok) return response;
      const data = await response.json();
      if (!response.ok) { const error = new Error(typeof data.detail === 'string' ? data.detail : 'Request failed'); error.status = response.status; throw error; }
      if (path === '/auth/login') {
        omniraSession = data;
        try { sessionStorage.setItem('omnira-auth', JSON.stringify(data)); } catch {}
      }
      return data;
    } finally { clearTimeout(timer); }
  }
};
