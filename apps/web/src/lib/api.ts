export function normalizeApiBase(rawBase?: string): string {
  const trimmed = (rawBase || '').trim();
  if (!trimmed) return '/api';

  const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');
  if (!withoutTrailingSlashes) return '/api';

  return withoutTrailingSlashes.endsWith('/api')
    ? withoutTrailingSlashes
    : `${withoutTrailingSlashes}/api`;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export function buildApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;

  let normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint || normalizedEndpoint === '/api' || normalizedEndpoint === 'api') {
    return API_BASE;
  }

  if (normalizedEndpoint.startsWith('/api/')) {
    normalizedEndpoint = normalizedEndpoint.slice('/api'.length);
  } else if (normalizedEndpoint.startsWith('api/')) {
    normalizedEndpoint = normalizedEndpoint.slice('api'.length);
  }

  const path = normalizedEndpoint.startsWith('/') ? normalizedEndpoint : `/${normalizedEndpoint}`;
  return `${API_BASE}${path}`;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const contentType = res.headers.get('content-type') || 'unknown content type';
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Server returned non-JSON response from ${res.url} (${res.status}, ${contentType}). ` +
      `This usually means the frontend is pointing at the app page instead of the API. Response started with: ${snippet}`
    );
  }
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const res = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const data = await parseJsonResponse(res);

  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  return data;
}
