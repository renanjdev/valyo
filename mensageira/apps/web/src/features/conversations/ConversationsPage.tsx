import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

export function ConversationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<any>('/conversations?limit=50'),
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selected],
    queryFn: () => selected ? api.get<any>(`/conversations/${selected}/messages?limit=50`) : null,
    enabled: !!selected,
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Conversas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* List */}
        <Card className="overflow-auto">
          {data?.items?.map((conv: any) => (
            <div
              key={conv.id}
              onClick={() => setSelected(conv.id)}
              className={`p-3 rounded-lg cursor-pointer mb-1 ${selected === conv.id ? 'bg-primary/10' : 'hover:bg-white/5'}`}
            >
              <div className="flex justify-between">
                <span className="font-medium text-sm">{conv.lead.name}</span>
                <Badge label={conv.lead.temperature} variant={conv.lead.temperature} />
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {conv.messages?.[0]?.content || 'Sem mensagens'}
              </p>
            </div>
          ))}
          {!data?.items?.length && <p className="text-gray-600 text-sm text-center py-4">Nenhuma conversa</p>}
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selected ? (
            <>
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {messages?.items?.slice().reverse().map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      msg.direction === 'outbound'
                        ? msg.sender === 'ai' ? 'bg-purple-900/30 text-purple-200' : 'bg-primary/20 text-orange-200'
                        : 'bg-white/10 text-white'
                    }`}>
                      <p>{msg.content}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {msg.sender} - {new Date(msg.createdAt).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <input className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-white" placeholder="Digite..." />
                <button className="bg-primary text-black px-4 py-2 rounded-lg text-sm font-medium">Enviar</button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600">Selecione uma conversa</div>
          )}
        </Card>
      </div>
    </div>
  );
}
