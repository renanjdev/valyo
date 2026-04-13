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
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.setup.status().then(({ configured }) => {
      if (configured) navigate('/');
    }).catch(() => {});
  }, [navigate]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.setup.test({ email: form.email, password: form.password, imapHost: form.imapHost });
      setTestResult({ ok: r.ok, msg: r.ok ? 'Conexão bem-sucedida!' : (r.error ?? 'Falha na conexão') });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.setup.save(form);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d1117', border: '1px solid #30363d',
    borderRadius: 4, padding: '8px 10px', fontSize: 13, color: '#c9d1d9',
    outline: 'none', marginBottom: 16,
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0d1117', padding: 24,
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: 32, width: '100%', maxWidth: 480,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#c9d1d9', marginBottom: 6 }}>
          📧 Configuração do Gestor Email
        </h1>
        <p style={{ fontSize: 12, color: '#6e7681', marginBottom: 24 }}>
          Configure suas credenciais para começar a usar o sistema.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
          Email corporativo
        </label>
        <input
          style={inputStyle} type="email" placeholder="usuario@empresa.com.br"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
          Senha (app password)
        </label>
        <input
          style={inputStyle} type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
          Chave API (Gemini)
        </label>
        <input
          style={inputStyle} type="password" placeholder="AIza..."
          value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
        />

        <button
          style={{
            background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
            padding: '8px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, width: '100%',
          }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾' : '▸'} Configurações avançadas
        </button>

        {showAdvanced && (
          <>
            <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
              Servidor IMAP
            </label>
            <input
              style={inputStyle} value={form.imapHost}
              onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
            />
            <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4 }}>
              Pasta (Mailbox)
            </label>
            <input
              style={inputStyle} value={form.mailbox}
              onChange={(e) => setForm({ ...form, mailbox: e.target.value })}
            />
          </>
        )}

        <button
          style={{
            background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
            padding: '8px 0', borderRadius: 6, fontSize: 12, width: '100%',
            marginBottom: 8, opacity: testing ? 0.6 : 1,
          }}
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? 'Testando...' : '🔌 Testar conexão IMAP'}
        </button>

        {testResult && (
          <div style={{
            padding: '8px 10px', borderRadius: 4, marginBottom: 12, fontSize: 12,
            background: testResult.ok ? '#23863322' : '#da363322',
            color: testResult.ok ? '#3fb950' : '#f85149',
          }}>
            {testResult.msg}
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 10px', borderRadius: 4, marginBottom: 12,
            fontSize: 12, background: '#da363322', color: '#f85149',
          }}>
            {error}
          </div>
        )}

        <button
          style={{
            width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
            fontSize: 13, fontWeight: 600, background: '#238636', color: '#fff',
            marginTop: 8, opacity: saving ? 0.6 : 1,
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Salvar e começar'}
        </button>
      </div>
    </div>
  );
}
