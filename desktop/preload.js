const { contextBridge } = require('electron');
const BASE = process.env.OMNIRA_API_URL || 'http://127.0.0.1:8000';
contextBridge.exposeInMainWorld('omnira', {
  request: async (path, options = {}, userId = null) => {
    const response = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...(userId ? { 'X-User-Id': String(userId) } : {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  }
});
