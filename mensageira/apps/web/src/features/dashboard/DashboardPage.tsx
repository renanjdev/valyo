import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

export function DashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.get<any>('/dashboard/overview'),
  });

  const { data: metrics } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => api.get<any>('/dashboard/metrics?period=30d'),
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => api.get<any>('/dashboard/activity'),
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500">Total Leads</p>
          <p className="text-3xl font-bold mt-1">{overview?.totalLeads || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Leads Quentes</p>
          <p className="text-3xl font-bold mt-1 text-red-400">{overview?.byTemperature?.hot || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Sequences Ativas</p>
          <p className="text-3xl font-bold mt-1 text-primary">{overview?.activeSequences || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Taxa de Resposta</p>
          <p className="text-3xl font-bold mt-1 text-green-400">{metrics?.responseRate || 0}%</p>
        </Card>
      </div>

      {/* Pipeline */}
      <Card className="mb-8">
        <h3 className="font-semibold mb-4">Pipeline</h3>
        <div className="flex gap-2 flex-wrap">
          {overview?.byStatus && Object.entries(overview.byStatus).map(([status, count]: any) => (
            <div key={status} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
              <Badge label={status} />
              <span className="text-sm font-medium">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity */}
      <Card>
        <h3 className="font-semibold mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {activity?.map((event: any) => (
            <div key={event.id} className="flex items-center gap-3 text-sm">
              <Badge label={event.type} />
              <span className="text-gray-400">{event.lead?.name}</span>
              <span className="text-gray-600 ml-auto">{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
            </div>
          ))}
          {!activity?.length && <p className="text-gray-600 text-sm">Nenhuma atividade recente</p>}
        </div>
      </Card>
    </div>
  );
}
