import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

export function SettingsPage() {
  const { data: waStatus } = useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: () => api.get<any>('/whatsapp/status'),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Configuracoes</h2>

      <Card>
        <h3 className="font-semibold mb-4">WhatsApp</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Status:</span>
          <Badge label={waStatus?.status || 'disconnected'} variant={waStatus?.status === 'connected' ? 'qualified' : 'unresponsive'} />
          {waStatus?.phone && <span className="text-sm text-gray-500">{waStatus.phone}</span>}
        </div>
      </Card>
    </div>
  );
}
