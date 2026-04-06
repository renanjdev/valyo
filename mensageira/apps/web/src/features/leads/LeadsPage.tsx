import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export function LeadsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => api.get<any>(`/leads?search=${search}&status=${statusFilter}&limit=50`),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Leads</h2>
        <Button size="sm">+ Novo Lead</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos</option>
          <option value="new">Novos</option>
          <option value="prospecting">Prospecting</option>
          <option value="waiting">Aguardando</option>
          <option value="engaged">Engajados</option>
          <option value="qualified">Qualificados</option>
        </select>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-border">
              <th className="text-left py-3 px-2">Nome</th>
              <th className="text-left py-3 px-2">Empresa</th>
              <th className="text-left py-3 px-2">Status</th>
              <th className="text-left py-3 px-2">Score</th>
              <th className="text-left py-3 px-2">Temp.</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((lead: any) => (
              <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="border-b border-border/50 hover:bg-white/5 cursor-pointer">
                <td className="py-3 px-2 font-medium">{lead.name}</td>
                <td className="py-3 px-2 text-gray-400">{lead.company || '-'}</td>
                <td className="py-3 px-2"><Badge label={lead.status} /></td>
                <td className="py-3 px-2">{lead.score}</td>
                <td className="py-3 px-2"><Badge label={lead.temperature} variant={lead.temperature} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items?.length && <p className="text-gray-600 text-sm text-center py-8">Nenhum lead encontrado</p>}
      </Card>
    </div>
  );
}
