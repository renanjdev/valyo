import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { api } from '../api.ts';
import { useStore } from '../store.ts';
export function EmailDetail({ email }) {
    const { updateEmailStatus } = useStore();
    const [note, setNote] = useState(email.note ?? '');
    const [loading, setLoading] = useState(null);
    useEffect(() => { setNote(email.note ?? ''); }, [email.id, email.note]);
    const decide = async (action) => {
        setLoading(action);
        try {
            await api.emails.decide(email.id, action, note || undefined);
            updateEmailStatus(email.id, action === 'approve' ? 'approved' : 'ignored');
        }
        finally {
            setLoading(null);
        }
    };
    const box = {
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 6, padding: '10px 12px', marginBottom: 10,
    };
    const labelStyle = {
        fontSize: 10, color: '#6e7681', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: 3,
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsxs("div", { style: { flex: 1, overflowY: 'auto', paddingBottom: 8 }, children: [[
                        ['De', email.sender],
                        ['Assunto', email.subject],
                        ['Data', new Date(email.date).toLocaleString('pt-BR')],
                    ].map(([l, v]) => (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: labelStyle, children: l }), _jsx("div", { style: { fontSize: 12, color: '#c9d1d9', wordBreak: 'break-word' }, children: v })] }, l))), _jsxs("div", { style: box, children: [_jsx("div", { style: labelStyle, children: "Resumo" }), _jsx("div", { style: { fontSize: 12, color: '#8b949e', lineHeight: 1.6 }, children: email.resumo }), email.extracted?.possiveis_acoes?.map((a, i) => (_jsxs("div", { style: {
                                    marginTop: 6, padding: '4px 8px',
                                    background: '#9e6a0311', border: '1px solid #9e6a0333',
                                    borderRadius: 4, fontSize: 11, color: '#d29922',
                                }, children: ["\u26A1 ", a] }, i)))] }), (email.extracted?.attachments?.length ?? 0) > 0 && (_jsxs("div", { style: box, children: [_jsx("div", { style: labelStyle, children: "Anexos" }), email.extracted.attachments.map((att, i) => (_jsxs("div", { style: {
                                    display: 'flex', gap: 8, padding: '5px 0',
                                    borderBottom: '1px solid #21262d', fontSize: 11,
                                }, children: [_jsx("span", { style: {
                                            background: '#21262d', padding: '2px 5px',
                                            borderRadius: 3, fontSize: 10, color: '#8b949e', flexShrink: 0,
                                        }, children: att.content_type.includes('pdf') ? 'PDF' : att.content_type.split('/')[1]?.toUpperCase() ?? 'FILE' }), _jsx("span", { style: { color: '#c9d1d9', flex: 1, wordBreak: 'break-all' }, children: att.filename }), att.content && _jsx("span", { style: { color: '#3fb950', fontSize: 10, flexShrink: 0 }, children: "extra\u00EDdo" })] }, i)))] })), _jsxs("div", { style: box, children: [_jsx("div", { style: labelStyle, children: "Observa\u00E7\u00E3o (opcional)" }), _jsx("textarea", { value: note, onChange: (e) => setNote(e.target.value), placeholder: "Adicionar nota...", style: {
                                    width: '100%', background: '#0d1117', border: '1px solid #30363d',
                                    borderRadius: 4, padding: '6px 8px', fontSize: 11, color: '#c9d1d9',
                                    resize: 'vertical', minHeight: 60, outline: 'none',
                                } })] })] }), email.status === 'pending' ? (_jsxs("div", { style: { display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #30363d' }, children: [_jsx("button", { onClick: () => decide('ignore'), disabled: !!loading, style: {
                            flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                            background: '#da3633', color: '#fff', fontSize: 12, fontWeight: 600,
                            opacity: loading ? 0.6 : 1,
                        }, children: loading === 'ignore' ? '...' : '✗ Rejeitar' }), _jsx("button", { onClick: () => decide('approve'), disabled: !!loading, style: {
                            flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                            background: '#238636', color: '#fff', fontSize: 12, fontWeight: 600,
                            opacity: loading ? 0.6 : 1,
                        }, children: loading === 'approve' ? '...' : '✓ Aprovar' })] })) : (_jsx("div", { style: { paddingTop: 8, textAlign: 'center', fontSize: 12, color: email.status === 'approved' ? '#3fb950' : '#6e7681' }, children: email.status === 'approved' ? '✓ Email aprovado' : '✗ Email rejeitado' }))] }));
}
