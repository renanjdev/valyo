import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';

export function SequencesPage() {
  const { data: sequences } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => api.get<any>('/sequences'),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Sequencias</h2>
        <Button size="sm">+ Nova Sequencia</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sequences?.map((seq: any) => (
          <Card key={seq.id}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold">{seq.name}</h3>
              <Badge label={seq.type} />
            </div>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>v{seq.version}</span>
              <span>{(seq.steps as any[])?.length || 0} steps</span>
              <span>{seq.activeLeads || 0} leads ativos</span>
            </div>
            <div className="flex gap-2 mt-4">
              {seq.publishedAt ? (
                <Badge label="Publicada" variant="qualified" />
              ) : (
                <Badge label="Rascunho" variant="new" />
              )}
            </div>
          </Card>
        ))}
        {!sequences?.length && <p className="text-gray-600 text-sm">Nenhuma sequencia criada</p>}
      </div>
    </div>
  );
}
