import { useState, useEffect } from 'react';
import type { Email } from '../types.ts';
import { api } from '../api.ts';
import { useStore } from '../store.ts';

export function EmailDetail({ email }: { email: Email }) {
  const { updateEmailStatus } = useStore();
  const [note, setNote] = useState(email.note ?? '');
  const [loading, setLoading] = useState<'approve' | 'ignore' | null>(null);

  useEffect(() => { setNote(email.note ?? ''); }, [email.id, email.note]);

  const decide = async (action: 'approve' | 'ignore') => {
    setLoading(action);
    try {
      await api.emails.decide(email.id, action, note || undefined);
      updateEmailStatus(email.id, action === 'approve' ? 'approved' : 'ignored');
    } finally {
      setLoading(null);
    }
  };

  const box: React.CSSProperties = {
    background: '#161b22', border: '1px solid #30363d',
    borderRadius: 6, padding: '10px 12px', marginBottom: 10,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: '#6e7681', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: 3,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {[
          ['De', email.sender],
          ['Assunto', email.subject],
          ['Data', new Date(email.date).toLocaleString('pt-BR')],
        ].map(([l, v]) => (
          <div key={l} style={{ marginBottom: 10 }}>
            <div style={labelStyle}>{l}</div>
            <div style={{ fontSize: 12, color: '#c9d1d9', wordBreak: 'break-word' }}>{v}</div>
          </div>
        ))}

        <div style={box}>
          <div style={labelStyle}>Resumo</div>
          <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>{email.resumo}</div>
          {email.extracted?.possiveis_acoes?.map((a, i) => (
            <div key={i} style={{
              marginTop: 6, padding: '4px 8px',
              background: '#9e6a0311', border: '1px solid #9e6a0333',
              borderRadius: 4, fontSize: 11, color: '#d29922',
            }}>⚡ {a}</div>
          ))}
        </div>

        {(email.extracted?.attachments?.length ?? 0) > 0 && (
          <div style={box}>
            <div style={labelStyle}>Anexos</div>
            {email.extracted!.attachments!.map((att, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: '5px 0',
                borderBottom: '1px solid #21262d', fontSize: 11,
              }}>
                <span style={{
                  background: '#21262d', padding: '2px 5px',
                  borderRadius: 3, fontSize: 10, color: '#8b949e', flexShrink: 0,
                }}>
                  {att.content_type.includes('pdf') ? 'PDF' : att.content_type.split('/')[1]?.toUpperCase() ?? 'FILE'}
                </span>
                <span style={{ color: '#c9d1d9', flex: 1, wordBreak: 'break-all' }}>{att.filename}</span>
                {att.content && <span style={{ color: '#3fb950', fontSize: 10, flexShrink: 0 }}>extraído</span>}
              </div>
            ))}
          </div>
        )}

        <div style={box}>
          <div style={labelStyle}>Observação (opcional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Adicionar nota..."
            style={{
              width: '100%', background: '#0d1117', border: '1px solid #30363d',
              borderRadius: 4, padding: '6px 8px', fontSize: 11, color: '#c9d1d9',
              resize: 'vertical', minHeight: 60, outline: 'none',
            }}
          />
        </div>
      </div>

      {email.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #30363d' }}>
          <button
            onClick={() => decide('ignore')}
            disabled={!!loading}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
              background: '#da3633', color: '#fff', fontSize: 12, fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading === 'ignore' ? '...' : '✗ Rejeitar'}
          </button>
          <button
            onClick={() => decide('approve')}
            disabled={!!loading}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
              background: '#238636', color: '#fff', fontSize: 12, fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading === 'approve' ? '...' : '✓ Aprovar'}
          </button>
        </div>
      ) : (
        <div style={{ paddingTop: 8, textAlign: 'center', fontSize: 12, color: email.status === 'approved' ? '#3fb950' : '#6e7681' }}>
          {email.status === 'approved' ? '✓ Email aprovado' : '✗ Email rejeitado'}
        </div>
      )}
    </div>
  );
}
