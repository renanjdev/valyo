import type { Email } from '../types.ts';
import { useStore } from '../store.ts';

const borderColor = { pending: '#30363d', approved: '#238636', ignored: '#30363d' };

export function EmailList({ emails }: { emails: Email[] }) {
  const { selectedEmailId, setSelectedEmailId } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {emails.map((e) => (
        <div
          key={e.id}
          onClick={() => setSelectedEmailId(e.id)}
          style={{
            background: selectedEmailId === e.id ? '#1f6feb11' : '#161b22',
            border: `1px solid ${selectedEmailId === e.id ? '#58a6ff' : borderColor[e.status]}`,
            borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
            opacity: e.status === 'ignored' ? 0.45 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>
              {e.sender.split('<')[0].trim() || e.sender}
            </span>
            <span style={{ fontSize: 10, color: '#6e7681' }}>
              {new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
          <div style={{
            fontSize: 12, color: '#8b949e', marginBottom: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {e.subject}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 10,
              background: '#1f6feb22', color: '#58a6ff',
            }}>{e.classificacao}</span>
            {e.status === 'approved' && (
              <span style={{ fontSize: 10, color: '#3fb950', marginLeft: 'auto' }}>✓ Aprovado</span>
            )}
            {e.status === 'ignored' && (
              <span style={{ fontSize: 10, color: '#6e7681', marginLeft: 'auto' }}>✗ Rejeitado</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
