import { useEffect } from 'react';
import { useStore } from '../store.ts';
import { api } from '../api.ts';

export function ReportPage() {
  const { currentReport, reports, setReports } = useStore();

  useEffect(() => {
    api.reports.list().then(setReports).catch(() => {});
  }, [setReports]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: '#161b22', borderBottom: '1px solid #30363d',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Relatório Diário de Emails</h2>
        {currentReport?.hasPdf && (
          <a
            href={api.reports.pdfUrl(currentReport.id)}
            download
            style={{
              padding: '6px 14px', background: '#21262d', color: '#c9d1d9',
              border: '1px solid #30363d', borderRadius: 6, fontSize: 12, textDecoration: 'none',
            }}
          >
            ⬇ Baixar PDF
          </a>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {currentReport ? (
          <pre style={{
            fontSize: 12, color: '#c9d1d9', lineHeight: 1.7,
            whiteSpace: 'pre-wrap', fontFamily: 'inherit',
          }}>
            {currentReport.text}
          </pre>
        ) : (
          <div>
            <p style={{ color: '#6e7681', fontSize: 13, marginBottom: 16 }}>
              Nenhum relatório gerado nesta sessão.
            </p>
            {reports.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>Relatórios anteriores:</p>
                {reports.map((r) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', background: '#161b22', border: '1px solid #30363d',
                    borderRadius: 6, marginBottom: 6, fontSize: 12,
                  }}>
                    <span style={{ flex: 1, color: '#c9d1d9' }}>{r.id}</span>
                    {r.hasPdf && (
                      <a
                        href={api.reports.pdfUrl(r.id)}
                        download
                        style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 11 }}
                      >
                        ⬇ PDF
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
