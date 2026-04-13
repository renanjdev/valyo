import type { Email, WorkerStatus, Report } from './types.ts';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  setup: {
    status: () => request<{ configured: boolean }>('GET', '/api/setup/status'),
    get: () => request<unknown>('GET', '/api/setup'),
    test: (data: { email: string; password: string; imapHost: string }) =>
      request<{ ok: boolean; error?: string }>('POST', '/api/setup/test', data),
    save: (data: { email: string; password: string; apiKey: string; imapHost?: string; mailbox?: string }) =>
      request<{ ok: boolean }>('POST', '/api/setup', data),
  },
  worker: {
    status: () => request<WorkerStatus>('GET', '/api/worker/status'),
    start: () => request<{ ok: boolean }>('POST', '/api/worker/start'),
    shutdown: () => request<{ ok: boolean }>('POST', '/api/worker/shutdown'),
  },
  emails: {
    list: (runId?: string) =>
      request<Email[]>('GET', `/api/emails${runId ? `?runId=${runId}` : ''}`),
    decide: (id: string, action: 'approve' | 'ignore', note?: string) =>
      request<{ ok: boolean }>('POST', `/api/emails/${id}/decision`, { action, note }),
  },
  reports: {
    list: () => request<Report[]>('GET', '/api/reports'),
    generate: (runId?: string) =>
      request<{ ok: boolean; reportId: string; text: string; hasPdf: boolean }>(
        'POST', '/api/reports/generate', { runId }
      ),
    pdfUrl: (id: string) => `/api/reports/${id}/pdf`,
  },
};
