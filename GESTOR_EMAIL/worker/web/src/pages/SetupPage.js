import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
export function SetupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: '', password: '', apiKey: '',
        imapHost: 'outlook.office365.com', mailbox: 'INBOX',
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        api.setup.status().then(({ configured }) => {
            if (configured)
                navigate('/');
        }).catch(() => { });
    }, [navigate]);
    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const r = await api.setup.test({ email: form.email, password: form.password, imapHost: form.imapHost });
            setTestResult({ ok: r.ok, msg: r.ok ? 'Conexão bem-sucedida!' : (r.error ?? 'Falha na conexão') });
        }
        finally {
            setTesting(false);
        }
    };
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.setup.save(form);
            navigate('/');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setSaving(false);
        }
    };
    const inputStyle = {
        width: '100%', background: '#0d1117', border: '1px solid #30363d',
        borderRadius: 4, padding: '8px 10px', fontSize: 13, color: '#c9d1d9',
        outline: 'none', marginBottom: 16,
    };
    return (_jsx("div", { style: {
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#0d1117', padding: 24,
        }, children: _jsxs("div", { style: {
                background: '#161b22', border: '1px solid #30363d',
                borderRadius: 8, padding: 32, width: '100%', maxWidth: 480,
            }, children: [_jsx("h1", { style: { fontSize: 16, fontWeight: 700, color: '#c9d1d9', marginBottom: 6 }, children: "\uD83D\uDCE7 Configura\u00E7\u00E3o do Gestor Email" }), _jsx("p", { style: { fontSize: 12, color: '#6e7681', marginBottom: 24 }, children: "Configure suas credenciais para come\u00E7ar a usar o sistema." }), _jsx("label", { style: { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }, children: "Email corporativo" }), _jsx("input", { style: inputStyle, type: "email", placeholder: "usuario@empresa.com.br", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }), _jsx("label", { style: { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }, children: "Senha (app password)" }), _jsx("input", { style: inputStyle, type: "password", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) }), _jsx("label", { style: { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }, children: "Chave API (Gemini)" }), _jsx("input", { style: inputStyle, type: "password", placeholder: "AIza...", value: form.apiKey, onChange: (e) => setForm({ ...form, apiKey: e.target.value }) }), _jsxs("button", { style: {
                        background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
                        padding: '8px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, width: '100%',
                    }, onClick: () => setShowAdvanced(!showAdvanced), children: [showAdvanced ? '▾' : '▸', " Configura\u00E7\u00F5es avan\u00E7adas"] }), showAdvanced && (_jsxs(_Fragment, { children: [_jsx("label", { style: { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }, children: "Servidor IMAP" }), _jsx("input", { style: inputStyle, value: form.imapHost, onChange: (e) => setForm({ ...form, imapHost: e.target.value }) }), _jsx("label", { style: { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }, children: "Pasta (Mailbox)" }), _jsx("input", { style: inputStyle, value: form.mailbox, onChange: (e) => setForm({ ...form, mailbox: e.target.value }) })] })), _jsx("button", { style: {
                        background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
                        padding: '8px 0', borderRadius: 6, fontSize: 12, width: '100%',
                        marginBottom: 8, opacity: testing ? 0.6 : 1,
                    }, onClick: handleTest, disabled: testing, children: testing ? 'Testando...' : '🔌 Testar conexão IMAP' }), testResult && (_jsx("div", { style: {
                        padding: '8px 10px', borderRadius: 4, marginBottom: 12, fontSize: 12,
                        background: testResult.ok ? '#23863322' : '#da363322',
                        color: testResult.ok ? '#3fb950' : '#f85149',
                    }, children: testResult.msg })), error && (_jsx("div", { style: {
                        padding: '8px 10px', borderRadius: 4, marginBottom: 12,
                        fontSize: 12, background: '#da363322', color: '#f85149',
                    }, children: error })), _jsx("button", { style: {
                        width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
                        fontSize: 13, fontWeight: 600, background: '#238636', color: '#fff',
                        marginTop: 8, opacity: saving ? 0.6 : 1,
                    }, onClick: handleSave, disabled: saving, children: saving ? 'Salvando...' : 'Salvar e começar' })] }) }));
}
