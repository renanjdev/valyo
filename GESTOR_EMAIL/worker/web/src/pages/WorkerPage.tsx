import { useEffect, useRef } from 'react';
import { useStore } from '../store.ts';
import { api } from '../api.ts';

export function WorkerPage() {
  const { workerStatus, setWorkerStatus } = useStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const s = await api.worker.status();
      setWorkerStatus(s);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const statusColor = { idle: '#3fb950', running: '#58a6ff', error: '#f85149' };
  const status = workerStatus?.status ?? 'idle';

  const handleStart = async () => {
    try {
      await api.worker.start();
      await poll();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Encerrar o worker? A interface ficará inacessível.')) return;
    await api.worker.shutdown().catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', padding: '10px 16px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Status do Worker</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: '#161b22', border: '1px solid #30363d',
          borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: statusColor[status], flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
              {status === 'idle' ? 'Aguardando' : status === 'running' ? 'Processando...' : 'Erro'}
            </div>
            {workerStatus?.lastRun && (
              <div style={{ fontSize: 11, color: '#6e7681' }}>
                Último run: {new Date(workerStatus.lastRun).toLocaleString('pt-BR')}
              </div>
            )}
            {workerStatus?.lastError && (
              <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>{workerStatus.lastError}</div>
            )}
          </div>
          <button
            onClick={handleStart}
            disabled={status === 'running'}
            style={{
              padding: '6px 14px', background: '#238636', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 12, fontWeight: 600, opacity: status === 'running' ? 0.5 : 1,
            }}
          >
            ▶ Buscar Emails
          </button>
        </div>

        <div style={{
          background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
          padding: 10, fontFamily: 'monospace', fontSize: 10, color: '#8b949e',
          minHeight: 100, maxHeight: 200, overflowY: 'auto',
        }}>
          {(workerStatus?.log ?? []).map((line, i) => (
            <div key={i} style={{
              lineHeight: 1.7,
              color: line.level === 'ERROR' ? '#f85149' : line.level === 'WARN' ? '#d29922' : '#8b949e',
            }}>
              <span style={{ color: '#484f58' }}>
                [{new Date(line.time).toLocaleTimeString('pt-BR')}]
              </span>
              {' '}
              <span style={{ color: line.level === 'INFO' ? '#58a6ff' : 'inherit' }}>{line.level}</span>
              {' '}{line.msg}
            </div>
          ))}
          {(!workerStatus?.log || workerStatus.log.length === 0) && (
            <span style={{ color: '#484f58' }}>Sem logs recentes.</span>
          )}
        </div>

        <div>
          <button
            onClick={handleShutdown}
            style={{
              padding: '8px 16px', background: 'transparent', color: '#6e7681',
              border: '1px solid #30363d', borderRadius: 6, fontSize: 12,
            }}
          >
            ⏹ Encerrar worker
          </button>
        </div>
      </div>
    </div>
  );
}
