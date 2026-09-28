import type { ApiError } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: unknown[];
  constructor(status: number, body: ApiError['error']) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function getToken(): string | null {
  return localStorage.getItem('access_token');
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiRequestError(res.status, { code: 'INTERNAL_SERVER_ERROR', message: 'Invalid server response.' });
  }

  const envelope = json as { success: boolean; data?: T; meta?: unknown; error?: ApiError['error'] };
  if (!res.ok || !envelope.success) {
    const err = envelope.error ?? { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' };
    if (res.status === 401 && err.code === 'AUTH_TOKEN_INVALID') onUnauthorized?.();
    throw new ApiRequestError(res.status, err);
  }

  return (envelope.data ?? (envelope as unknown)) as T;
}
