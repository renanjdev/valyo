import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useStore } from '../store.ts';
const borderColor = { pending: '#30363d', approved: '#238636', ignored: '#30363d' };
export function EmailList({ emails }) {
    const { selectedEmailId, setSelectedEmailId } = useStore();
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: emails.map((e) => (_jsxs("div", { onClick: () => setSelectedEmailId(e.id), style: {
                background: selectedEmailId === e.id ? '#1f6feb11' : '#161b22',
                border: `1px solid ${selectedEmailId === e.id ? '#58a6ff' : borderColor[e.status]}`,
                borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
                opacity: e.status === 'ignored' ? 0.45 : 1,
            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 3 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600, color: '#c9d1d9' }, children: e.sender.split('<')[0].trim() || e.sender }), _jsx("span", { style: { fontSize: 10, color: '#6e7681' }, children: new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })] }), _jsx("div", { style: {
                        fontSize: 12, color: '#8b949e', marginBottom: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }, children: e.subject }), _jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center' }, children: [_jsx("span", { style: {
                                fontSize: 10, padding: '2px 6px', borderRadius: 10,
                                background: '#1f6feb22', color: '#58a6ff',
                            }, children: e.classificacao }), e.status === 'approved' && (_jsx("span", { style: { fontSize: 10, color: '#3fb950', marginLeft: 'auto' }, children: "\u2713 Aprovado" })), e.status === 'ignored' && (_jsx("span", { style: { fontSize: 10, color: '#6e7681', marginLeft: 'auto' }, children: "\u2717 Rejeitado" }))] })] }, e.id))) }));
}
