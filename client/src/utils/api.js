// Auto-detect API URL based on environment
const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production'
    ? window.location.origin  // In production, use same origin (Caddy will proxy)
    : 'http://localhost:4000'); // In development, use local server

export const API = (path) => `${API_BASE}${path}`;

export async function fetchWithAuth(url, options = {}) {
  // Token aus localStorage für Fallback (wird aber nicht mehr benötigt, da Cookie verwendet wird)
  const token = localStorage.getItem('sessionToken');

  const headers = {
    ...options.headers,
  };

  // Fallback für alte Sessions die noch localStorage verwenden
  if (token) {
    headers['X-Session-Token'] = token;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // WICHTIG: Sendet httpOnly Cookies mit
  });

  // Wenn 401, Session ist abgelaufen
  if (response.status === 401) {
    localStorage.removeItem('sessionToken');
    window.location.reload();
  }

  // Check if response is OK before allowing JSON parsing
  if (!response.ok && response.status !== 401) {
    const errorText = await response.text();
    console.error(`API Error ${response.status} for ${url}:`, errorText);
    throw new Error(`Server error: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function apiRequest(path, options = {}) {
  const url = API(path);
  return fetchWithAuth(url, options);
}

export async function apiGet(path) {
  return apiRequest(path);
}

export async function apiPost(path, data) {
  return apiRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function apiPut(path, data) {
  return apiRequest(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function apiDelete(path) {
  return apiRequest(path, {
    method: 'DELETE',
  });
}
