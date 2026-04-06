import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ArrowLeft } from 'lucide-react';

export function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lead } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<any>(`/leads/${id}`),
  });

  const { data: timeline } = useQuery({
    queryKey: ['lead', id, 'timeline'],
    queryFn: () => api.get<any>(`/leads/${id}/timeline`),
  });

  if (!lead) return <p className="text-gray-500">Carregando...</p>;

  return (
    <div>
      <button onClick={() => navigate('/leads')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{lead.name}</h2>
                <p className="text-gray-500">{lead.phone} {lead.company && `- ${lead.company}`}</p>
              </div>
              <div className="flex gap-2">
                <Badge label={lead.status} />
                <Badge label={lead.temperature} variant={lead.temperature} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div><span className="text-gray-500 text-sm">Score</span><p className="text-2xl font-bold">{lead.score}</p></div>
              <div><span className="text-gray-500 text-sm">Origem</span><p className="text-sm">{lead.source}</p></div>
              <div><span className="text-gray-500 text-sm">Responsavel</span><p className="text-sm">{lead.assignedUser?.name || 'Nao atribuido'}</p></div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="mt-4">
            <h3 className="font-semibold mb-4">Timeline</h3>
            <div className="space-y-3">
              {timeline?.map((event: any) => (
                <div key={event.id} className="flex items-center gap-3 text-sm border-l-2 border-border pl-3">
                  <Badge label={event.type} />
                  <span className="text-gray-400">{event.actor}</span>
                  <span className="text-gray-600 ml-auto">{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <h3 className="font-semibold mb-3">Acoes</h3>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm">Ver Conversa</Button>
              <Button variant="secondary" size="sm">Atribuir</Button>
              <Button variant="secondary" size="sm">Ajustar Score</Button>
              <Button variant="danger" size="sm">Parar Automacao</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
