export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Something went wrong');
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>('GET', url),
  post: <T,>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  patch: <T,>(url: string, body: unknown = {}) => request<T>('PATCH', url, body),
  del: <T,>(url: string) => request<T>('DELETE', url),
};
