import { handleMockRequest, isStaticHost } from './mockBackend';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (isStaticHost()) {
    try {
      return (await handleMockRequest(method, url, body)) as T;
    } catch (e: any) {
      throw new ApiError(e?.status ?? 500, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong');
    }
  }

  try {
    const res = await fetch(`/api${url}`, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        return (await handleMockRequest(method, url, body)) as T;
      }
      throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Something went wrong');
    }
    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    try {
      return (await handleMockRequest(method, url, body)) as T;
    } catch (mockErr: any) {
      throw new ApiError(mockErr?.status ?? 500, mockErr?.code ?? 'ERROR', mockErr?.message ?? 'Something went wrong');
    }
  }
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  patch: <T,>(url: string, body: unknown = {}) => request<T>('PATCH', url, body),
  del: <T,>(url: string) => request<T>('DELETE', url),
};

