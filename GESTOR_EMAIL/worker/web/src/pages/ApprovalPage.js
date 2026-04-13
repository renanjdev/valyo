import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.ts';
import { api } from '../api.ts';
import { EmailList } from '../components/EmailList.tsx';
import { EmailDetail } from '../components/EmailDetail.tsx';
export function ApprovalPage() {
    const navigate = useNavigate();
    const { emails, selectedEmailId, setEmails, setCurrentReport } = useStore();
    const [fetching, setFetching] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const loadEmails = async () => {
        try {
            const list = await api.emails.list();
            setEmails(list);
        }
        catch { /* ignore */ }
    };
    useEffect(() => {
        api.setup.status().then(({ configured }) => {
            if (!configured)
                navigate('/setup');
        }).catch(() => { });
        loadEmails();
    }, []);
    const handleFetch = async () => {
        setFetching(true);
        setError(null);
        try {
            await api.worker.start();
            const poll = setInterval(async () => {
                const s = await api.worker.status();
                if (s.status !== 'running') {
                    clearInterval(poll);
                    setFetching(false);
                    await loadEmails();
                }
            }, 2000);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setFetching(false);
        }
    };
    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const result = await api.reports.generate();
            setCurrentReport({ id: result.reportId, text: result.text, hasPdf: result.hasPdf });
            navigate('/report');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setGenerating(false);
        }
    };
    const selectedEmail = emails.find((e) => e.id === selectedEmailId) ?? null;
    const total = emails.length;
    const pending = emails.filter((e) => e.status === 'pending').length;
    const approved = emails.filter((e) => e.status === 'approved').length;
    const ignored = emails.filter((e) => e.status === 'ignored').length;
    const allDecided = total > 0 && pending === 0;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: {
                    background: '#161b22', borderBottom: '1px solid #30363d',
                    padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }, children: [_jsx("h2", { style: { fontSize: 14, fontWeight: 600 }, children: "Aprova\u00E7\u00E3o de Emails" }), _jsx("button", { onClick: handleFetch, disabled: fetching, style: {
                            padding: '6px 14px', background: '#238636', color: '#fff', border: 'none',
                            borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: fetching ? 0.6 : 1,
                        }, children: fetching ? '⏳ Buscando...' : '▶ Buscar Emails' })] }), error && (_jsx("div", { style: {
                    background: '#da363322', borderBottom: '1px solid #da3633',
                    padding: '8px 16px', fontSize: 12, color: '#f85149',
                }, children: error })), total > 0 && (_jsx("div", { style: {
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                    padding: '10px 16px', background: '#0d1117', borderBottom: '1px solid #30363d',
                }, children: [
                    ['Total', total, '#c9d1d9'],
                    ['Pendentes', pending, '#d29922'],
                    ['Aprovados', approved, '#3fb950'],
                    ['Rejeitados', ignored, '#f85149'],
                ].map(([l, v, c]) => (_jsxs("div", { style: { background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 10px' }, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 700, color: c }, children: v }), _jsx("div", { style: { fontSize: 10, color: '#6e7681' }, children: l })] }, l))) })), _jsxs("div", { style: { flex: 1, display: 'flex', overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 12, borderRight: '1px solid #30363d' }, children: emails.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: '#6e7681', fontSize: 13, marginTop: 40 }, children: "Nenhum email. Clique \"Buscar Emails\" para come\u00E7ar." })) : (_jsx(EmailList, { emails: emails })) }), selectedEmail && (_jsx("div", { style: { width: 360, padding: 12, overflowY: 'auto', flexShrink: 0 }, children: _jsx(EmailDetail, { email: selectedEmail }) }))] }), _jsxs("div", { style: {
                    background: '#161b22', borderTop: '1px solid #30363d',
                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                }, children: [_jsx("span", { style: { fontSize: 11, color: '#6e7681' }, children: total > 0 ? `${total - pending} de ${total} revisados` : 'Sem emails carregados' }), _jsx("div", { style: { flex: 1, background: '#21262d', borderRadius: 4, height: 4, overflow: 'hidden' }, children: _jsx("div", { style: {
                                background: '#238636', height: '100%', borderRadius: 4,
                                width: total > 0 ? `${((total - pending) / total) * 100}%` : '0%',
                                transition: 'width 0.3s',
                            } }) }), _jsx("button", { onClick: handleGenerate, disabled: !allDecided || generating, style: {
                            padding: '6px 14px',
                            background: allDecided ? '#238636' : '#21262d',
                            color: allDecided ? '#fff' : '#484f58',
                            border: '1px solid #30363d', borderRadius: 6, fontSize: 12, fontWeight: 600,
                            opacity: generating ? 0.6 : 1,
                        }, children: generating ? '⏳ Gerando...' : '📄 Gerar Relatório' })] })] }));
}
