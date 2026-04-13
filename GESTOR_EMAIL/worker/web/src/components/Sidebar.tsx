import { NavLink } from 'react-router-dom';
import { useStore } from '../store.ts';

export function Sidebar() {
  const emails = useStore((s) => s.emails);
  const pendingCount = emails.filter((e) => e.status === 'pending').length;

  return (
    <nav style={{
      width: 200, background: '#161b22', borderRight: '1px solid #30363d',
      display: 'flex', flexDirection: 'column', padding: '16px 0', flexShrink: 0,
    }}>
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #30363d', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#c9d1d9' }}>📧 Gestor Email</div>
        <div style={{ fontSize: 10, color: '#6e7681' }}>CERPRO</div>
      </div>
      {([
        { to: '/', label: 'Aprovação', icon: '📥', badge: pendingCount },
        { to: '/report', label: 'Relatório', icon: '📄', badge: 0 },
        { to: '/worker', label: 'Status', icon: '⚙️', badge: 0 },
        { to: '/setup', label: 'Configurações', icon: '🔧', badge: 0 },
      ] as const).map(({ to, label, icon, badge }) => (
        <NavLink key={to} to={to} end style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          fontSize: 12, color: isActive ? '#58a6ff' : '#8b949e',
          background: isActive ? '#1f6feb22' : 'transparent',
          textDecoration: 'none', borderRadius: 4, margin: '0 8px',
        })}>
          <span>{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
          {badge > 0 && (
            <span style={{
              background: '#da3633', color: '#fff', fontSize: 9,
              padding: '1px 5px', borderRadius: 8,
            }}>{badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
