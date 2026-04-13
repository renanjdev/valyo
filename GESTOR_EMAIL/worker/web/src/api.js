async function request(method, path, body) {
    const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
    }
    return res.json();
}
export const api = {
    setup: {
        status: () => request('GET', '/api/setup/status'),
        get: () => request('GET', '/api/setup'),
        test: (data) => request('POST', '/api/setup/test', data),
        save: (data) => request('POST', '/api/setup', data),
    },
    worker: {
        status: () => request('GET', '/api/worker/status'),
        start: () => request('POST', '/api/worker/start'),
        shutdown: () => request('POST', '/api/worker/shutdown'),
    },
    emails: {
        list: (runId) => request('GET', `/api/emails${runId ? `?runId=${runId}` : ''}`),
        decide: (id, action, note) => request('POST', `/api/emails/${id}/decision`, { action, note }),
    },
    reports: {
        list: () => request('GET', '/api/reports'),
        generate: (runId) => request('POST', '/api/reports/generate', { runId }),
        pdfUrl: (id) => `/api/reports/${id}/pdf`,
    },
};
