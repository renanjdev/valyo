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
  const [error, setError] = useState<string | null>(null);

  const loadEmails = async () => {
    try {
      const list = await api.emails.list();
      setEmails(list);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    api.setup.status().then(({ configured }) => {
      if (!configured) navigate('/setup');
    }).catch(() => {});
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
    } catch (e) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) ?? null;
  const total = emails.length;
  const pending = emails.filter((e) => e.status === 'pending').length;
  const approved = emails.filter((e) => e.status === 'approved').length;
  const ignored = emails.filter((e) => e.status === 'ignored').length;
  const allDecided = total > 0 && pending === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Aprovação de Emails</h2>
        <button
          onClick={handleFetch}
          disabled={fetching}
          style={{
            padding: '6px 14px', background: '#238636', color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: fetching ? 0.6 : 1,
          }}
        >
          {fetching ? '⏳ Buscando...' : '▶ Buscar Emails'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#da363322', borderBottom: '1px solid #da3633',
          padding: '8px 16px', fontSize: 12, color: '#f85149',
        }}>
          {error}
        </div>
      )}

      {total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          padding: '10px 16px', background: '#0d1117', borderBottom: '1px solid #30363d',
        }}>
          {([
            ['Total', total, '#c9d1d9'],
            ['Pendentes', pending, '#d29922'],
            ['Aprovados', approved, '#3fb950'],
            ['Rejeitados', ignored, '#f85149'],
          ] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: '#6e7681' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, borderRight: '1px solid #30363d' }}>
          {emails.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6e7681', fontSize: 13, marginTop: 40 }}>
              Nenhum email. Clique "Buscar Emails" para começar.
            </div>
          ) : (
            <EmailList emails={emails} />
          )}
        </div>
        {selectedEmail && (
          <div style={{ width: 360, padding: 12, overflowY: 'auto', flexShrink: 0 }}>
            <EmailDetail email={selectedEmail} />
          </div>
        )}
      </div>

      <div style={{
        background: '#161b22', borderTop: '1px solid #30363d',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 11, color: '#6e7681' }}>
          {total > 0 ? `${total - pending} de ${total} revisados` : 'Sem emails carregados'}
        </span>
        <div style={{ flex: 1, background: '#21262d', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{
            background: '#238636', height: '100%', borderRadius: 4,
            width: total > 0 ? `${((total - pending) / total) * 100}%` : '0%',
            transition: 'width 0.3s',
          }} />
        </div>
        <button
          onClick={handleGenerate}
          disabled={!allDecided || generating}
          style={{
            padding: '6px 14px',
            background: allDecided ? '#238636' : '#21262d',
            color: allDecided ? '#fff' : '#484f58',
            border: '1px solid #30363d', borderRadius: 6, fontSize: 12, fontWeight: 600,
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? '⏳ Gerando...' : '📄 Gerar Relatório'}
        </button>
      </div>
    </div>
  );
}
