import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useStore } from '../store.ts';
import { api } from '../api.ts';
export function ReportPage() {
    const { currentReport, reports, setReports } = useStore();
    useEffect(() => {
        api.reports.list().then(setReports).catch(() => { });
    }, [setReports]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: {
                    background: '#161b22', borderBottom: '1px solid #30363d',
                    padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }, children: [_jsx("h2", { style: { fontSize: 14, fontWeight: 600 }, children: "Relat\u00F3rio Di\u00E1rio de Emails" }), currentReport?.hasPdf && (_jsx("a", { href: api.reports.pdfUrl(currentReport.id), download: true, style: {
                            padding: '6px 14px', background: '#21262d', color: '#c9d1d9',
                            border: '1px solid #30363d', borderRadius: 6, fontSize: 12, textDecoration: 'none',
                        }, children: "\u2B07 Baixar PDF" }))] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: 16 }, children: currentReport ? (_jsx("pre", { style: {
                        fontSize: 12, color: '#c9d1d9', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                    }, children: currentReport.text })) : (_jsxs("div", { children: [_jsx("p", { style: { color: '#6e7681', fontSize: 13, marginBottom: 16 }, children: "Nenhum relat\u00F3rio gerado nesta sess\u00E3o." }), reports.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { style: { fontSize: 12, color: '#8b949e', marginBottom: 8 }, children: "Relat\u00F3rios anteriores:" }), reports.map((r) => (_jsxs("div", { style: {
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 10px', background: '#161b22', border: '1px solid #30363d',
                                        borderRadius: 6, marginBottom: 6, fontSize: 12,
                                    }, children: [_jsx("span", { style: { flex: 1, color: '#c9d1d9' }, children: r.id }), r.hasPdf && (_jsx("a", { href: api.reports.pdfUrl(r.id), download: true, style: { color: '#58a6ff', textDecoration: 'none', fontSize: 11 }, children: "\u2B07 PDF" }))] }, r.id)))] }))] })) })] }));
}
