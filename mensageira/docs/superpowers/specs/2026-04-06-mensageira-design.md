# Mensageira — Design Spec

CRM de prospecção e follow-up via WhatsApp com agente IA (Claude) como primeiro respondedor.

## Contexto

### Problema
Empresas de homologação de energia solar controlam operações com planilhas, WhatsApp e anotações. Conforme o volume cresce (10 → 30+ projetos/mês), perdem prazos de distribuidora, integradores ficam sem visibilidade e o financeiro descontrola.

### Produto
Homologa Plus — gestão de homologação com pipeline, controle de integradores e financeiro. O Mensageira é a camada de prospecção e nurturing automatizada que alimenta o funil comercial do Homologa Plus.

### Público-alvo
- Empresas de homologação de energia solar
- Projetistas de energia solar
- Integradores

### Modelo de venda
Consultiva. A IA não fecha — prepara e acelera. O humano fecha.

---

## Arquitetura

### Abordagem: Serviços Separados com Fila

3 serviços independentes + scheduler, comunicando via Redis (BullMQ):

```
Frontend (React+Vite)
       │ REST/WS
       ▼
   API Service (Fastify)
    │         │
    ▼         ▼
  Redis ◄──► PostgreSQL
    │
    ├── WhatsApp Service (Baileys → Meta Cloud futuro)
    ├── AI Worker (Claude API)
    └── Scheduler (follow-ups, cadência)
```

**Justificativa:**
- WhatsApp Service isolado — crash não afeta API nem dashboard
- Escala independente — mais AI Workers conforme volume
- Migração facilitada — trocar Baileys por API Meta = substituir 1 provider
- Filas BullMQ garantem retry, rate limiting e agendamento

### Serviços

| Serviço | Responsabilidade | Container Docker |
|---------|-----------------|------------------|
| **api** | REST + WebSocket + CRM logic | porta 3000 |
| **whatsapp** | Conexão Baileys + envio/recebimento | volume persistente wa_sessions |
| **ai-worker** | Claude API + scoring + classifier | escalável (replicas) |
| **scheduler** | Follow-ups + cadência + cron jobs | scan por índice, batch processing |
| **web** | React + Vite (nginx em prod) | porta 80 |

### Observabilidade

- Logs estruturados (JSON) em todos os serviços com pino
- correlation_id propagado em todas as requisições e jobs de fila
- Healthcheck endpoint (`GET /health`) em todos os serviços — retorna status de dependências (db, redis, whatsapp connection)
- Métricas básicas: queue depth, message throughput, AI latency, WhatsApp connection uptime

---

## State Machine do Lead

```
NEW → PROSPECTING → WAITING_RESPONSE → ENGAGED → QUALIFIED → WON
                         │                                    └→ LOST
                         └→ UNRESPONSIVE → NURTURE ──(30-60d)──→ PROSPECTING
                                              └→ LOST
```

### Estados

| Estado | O que acontece | Quem atua |
|--------|---------------|-----------|
| **NEW** | Lead importado, ainda não contactado | Sistema |
| **PROSPECTING** | IA envia mensagem inicial de aquecimento | IA |
| **WAITING_RESPONSE** | Follow-ups adaptativos rodando | IA (cadência automática) |
| **ENGAGED** | Lead respondeu — IA qualifica/conversa contextual | IA |
| **QUALIFIED** | Interesse real detectado — transferido para humano | Humano assume |
| **UNRESPONSIVE** | Sequência esgotada sem resposta | Sistema pausa |
| **NURTURE** | Reengajamento futuro (30-60 dias) | Sistema reagenda |
| **WON / LOST** | Resultado final | Humano marca |

### Regras de Transição

- **→ ENGAGED:** Lead respondeu qualquer mensagem (mesmo "quem é você?")
- **→ QUALIFIED:** IA detecta interesse real — pediu demo, descreveu dor, mencionou volume, perguntou contrato
- **→ UNRESPONSIVE:** Sequência esgotada (3 sem leitura, 5 com leitura) sem resposta
- **→ NURTURE:** Lead unresponsive movido para ciclo longo para nova tentativa. Máximo 2 ciclos de nurture — após o segundo ciclo sem resposta, auto-marca como LOST

---

## Sequência de Mensagens

### Cadência Sem Leitura (até 3 tentativas)

| Dia | Tipo | Mensagem |
|-----|------|----------|
| **D0** | Abertura consultiva | "Oi [Nome], tudo bem? Eu trabalho com empresas de homologação de energia solar e tenho percebido uma coisa: quando o volume de projetos começa a crescer, o controle que funcionava com 10 projetos por mês vira uma bagunça com 30. Prazos escapam, distribuidora cobra, integrador fica no escuro. Você tá passando por algo assim ou já tem isso mais organizado?" |
| **D3** | Insight concreto | "Oi [Nome], só um ponto rápido. Converso com bastante gente do setor e um padrão que aparece muito: empresa que toca 30+ homologações por mês usando planilha e WhatsApp perde em média 2 a 3 projetos por mês por prazo estourado. Não por incompetência — por falta de visibilidade. Se você tá nessa faixa de volume, talvez faça sentido trocarmos uma ideia." |
| **D7** | Despedida | "[Nome], vou parar por aqui pra não atrapalhar. Se lá na frente o volume apertar e você precisar de mais controle, me chama. Sucesso nos projetos!" |

### Cadência Com Leitura (até 5 tentativas)

| Dia | Tipo | Mensagem |
|-----|------|----------|
| **D0** | Abertura consultiva | (mesma acima) |
| **D2** | Pergunta de contexto | "Oi [Nome], sem querer tomar seu tempo — só uma curiosidade rápida: vocês tocam mais projetos avulsos ou trabalham com integradores fixos? Pergunto porque a dinâmica de controle muda bastante entre os dois modelos." |
| **D4** | Dor concreta | "Oi [Nome], uma situação que vejo muito: projetista entrega a documentação, a homologadora protocola na distribuidora, mas ninguém acompanha o prazo de retorno. Aí quando percebe, já venceu e tem que reprotocolar. Isso sozinho custa semanas de atraso. Vocês tem algum controle ativo pra isso hoje?" |
| **D7** | Prova social específica | "[Nome], uma homologadora aqui do [região] que tocava uns 40 projetos/mês tava no mesmo cenário — planilha, grupo de WhatsApp por integrador, cobrança manual de prazo. Depois que centralizou num sistema, o tempo de ciclo caiu quase pela metade e os integradores pararam de ligar cobrando status. Se quiser, te mostro como funciona em 5 minutos, sem compromisso." |
| **D11** | Despedida elegante | "[Nome], vou parar por aqui. Se lá na frente o volume apertar e você precisar de mais controle, me chama. Desejo sucesso nos projetos!" |

### Princípios das Mensagens
- Abertura sempre consultiva com pergunta aberta
- Follow-ups alternam entre: consultivo, valor concreto, check-in direto
- Nunca repetitivo ou previsível
- Tom natural, como se fosse humano acompanhando
- Dados concretos e cenários específicos do setor (não genéricos)
- Prova social com contexto real: porte, região, volume, ferramentas

---

## Lead Scoring

| Sinal | Pontos | Lógica |
|-------|--------|--------|
| Visualizou mensagem | +5 | Por mensagem visualizada |
| Respondeu (qualquer coisa) | +20 | Engajamento ativo |
| Descreveu dor/problema | +30 | IA detecta descrição de problema |
| Perguntou sobre funcionalidade | +25 | Interesse no produto |
| Perguntou preço | +25 | Sinal forte de intenção |
| Pediu demo/reunião | +50 | Transferir imediatamente |
| Mencionou volume de projetos | +15 | Indica porte da operação |
| Resposta negativa explícita | -100 | Parar imediatamente |

### Faixas de Temperatura

| Faixa | Score | Ação |
|-------|-------|------|
| FRIO | 0-19 | Cadência normal |
| MORNO | 20-49 | Priorizar na fila |
| QUENTE | 50+ | Notificar humano |

---

## Regras de Decisão da IA

### IA Continua Respondendo
- Lead faz pergunta genérica ("o que é isso?")
- Lead pede mais info ("me explica melhor")
- Lead responde sem demonstrar interesse claro

### IA Transfere para Humano
- Lead pede demo ou reunião
- Lead descreve dor/problema específico
- Lead menciona volume de projetos
- Lead pergunta sobre contrato/implantação
- **Lead pergunta preço** → IA contextualiza ("depende do volume e modelo"), tenta entender cenário, direciona para humano

### IA Para Imediatamente
- Lead pede para parar
- Lead bloqueia ou reage negativamente
- Lead pede para remover da lista
- Score cai para negativo

### Respostas Curtas ("sim", "talvez", "mais ou menos")
- IA **não classifica** como engajado direto
- IA faz pergunta de aprofundamento: "Legal! Você tá usando planilha pra acompanhar ou tem algum sistema hoje?"
- Se 2+ respostas curtas seguidas sem substância → notifica humano

### Notifica Humano (sem transferir conversa)
- Lead responde com áudio (IA não processa)
- Lead envia imagem/documento
- Lead faz pergunta fora do escopo do produto
- IA não tem confiança na resposta (threshold < 0.7)
- Lead score atinge 50+ (quente)

---

## Modelo de Dados (PostgreSQL)

### accounts — Tenant raiz (multi-tenant)
```
PK  id              UUID DEFAULT gen_random_uuid()
    name            VARCHAR(255) NOT NULL
    slug            VARCHAR(100) UNIQUE NOT NULL
    plan            ENUM (free, starter, pro) DEFAULT 'free'
    settings        JSONB DEFAULT '{}'
    created_at, updated_at
```

### users
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
    name            VARCHAR
    email           VARCHAR
    password_hash   VARCHAR
    role            ENUM (owner, admin, seller)
    is_active       BOOLEAN DEFAULT true
    created_at, updated_at
    UNIQUE(account_id, email)
```

### leads
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
FK  assigned_to     → users.id NULLABLE
    name            VARCHAR
    phone           VARCHAR
    company         VARCHAR
    source          ENUM (import, inbound, manual)
    source_detail   VARCHAR NULLABLE  — ex: "csv-2026-04", "landing-page-solar"
    status          ENUM (new, prospecting, waiting, engaged, qualified, unresponsive, nurture, won, lost)
    score           INTEGER DEFAULT 0
    temperature     ENUM (cold, warm, hot) DEFAULT 'cold'
    nurture_count   INTEGER DEFAULT 0  — quantas vezes passou por NURTURE (max 2)
    last_contacted_at TIMESTAMP NULLABLE
    tags            JSONB DEFAULT '[]'
    metadata        JSONB DEFAULT '{}'  — região, volume_projetos, modelo_negócio
    created_at, updated_at
    UNIQUE(account_id, phone)
```

### conversations
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
FK  lead_id         → leads.id NOT NULL
    channel         ENUM (whatsapp)
    status          ENUM (active, paused, closed)
    ai_enabled      BOOLEAN DEFAULT true
    started_at, last_message_at
    UNIQUE(account_id, lead_id, channel)
```

### messages
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
FK  conversation_id → conversations.id NOT NULL
    external_id     VARCHAR NULLABLE  — ID do WhatsApp
    correlation_id  UUID NULLABLE  — rastreamento de fluxo
    direction       ENUM (inbound, outbound)
    sender          ENUM (lead, ai, human)
    content         TEXT
    content_type    ENUM (text, image, audio, document) DEFAULT 'text'
    status          ENUM (queued, sent, delivered, read, failed)
    queued_at       TIMESTAMP DEFAULT NOW()
    sent_at         TIMESTAMP NULLABLE
    delivered_at    TIMESTAMP NULLABLE
    read_at         TIMESTAMP NULLABLE
    failed_at       TIMESTAMP NULLABLE
    error           TEXT NULLABLE
    created_at
```

### sequences
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
    name            VARCHAR
    type            ENUM (cold, warm, nurture)
    version         INTEGER DEFAULT 1
    steps           JSONB  — [{day, type, template, delay_days}]
    is_active       BOOLEAN DEFAULT true
    published_at    TIMESTAMP NULLABLE
    created_at, updated_at
```

### lead_sequences
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
FK  lead_id         → leads.id NOT NULL
FK  sequence_id     → sequences.id NOT NULL
    sequence_version INTEGER  — versão em que o lead entrou
    current_step    INTEGER DEFAULT 0
    status          ENUM (active, paused, completed, cancelled)
    next_send_at    TIMESTAMP
    retry_count     INTEGER DEFAULT 0
    last_error      TEXT NULLABLE
    locked_at       TIMESTAMP NULLABLE  — controle de concorrência entre workers
    locked_by       VARCHAR NULLABLE  — worker_id que pegou o lock
    started_at, completed_at
```

### lead_events — audit log (append-only)
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
FK  lead_id         → leads.id NOT NULL
    type            ENUM (status_change, score_change, assigned, note_added, sequence_started, sequence_completed, message_sent, message_received)
    actor           ENUM (system, ai, human)
    actor_id        UUID NULLABLE  — user_id se human
    data            JSONB  — {from: "new", to: "prospecting", reason: "..."}
    created_at
```

### whatsapp_sessions
```
PK  id              UUID
FK  account_id      → accounts.id NOT NULL
    phone           VARCHAR
    status          ENUM (connected, disconnected, banned)
    session_data    JSONB
    last_connected_at
    UNIQUE(account_id, phone)
```

### Índices

```sql
-- Query principal do scheduler (envios pendentes) — batch com limite
CREATE INDEX idx_leadseq_pending_send
ON lead_sequences (next_send_at ASC)
WHERE status = 'active' AND next_send_at IS NOT NULL AND locked_at IS NULL;

-- Pipeline por conta (kanban)
CREATE INDEX idx_leads_pipeline
ON leads (account_id, status, score DESC);

-- Busca por telefone (dedup + lookup)
CREATE UNIQUE INDEX idx_leads_phone
ON leads (account_id, phone);

-- Histórico de conversas
CREATE INDEX idx_messages_conversation
ON messages (conversation_id, created_at DESC);

-- Reconciliação WhatsApp (status updates)
CREATE INDEX idx_messages_external
ON messages (external_id) WHERE external_id IS NOT NULL;

-- Mensagens pendentes (retry de envio)
CREATE INDEX idx_messages_pending
ON messages (status, queued_at ASC)
WHERE status IN ('queued', 'failed');

-- Timeline do lead
CREATE INDEX idx_events_lead_timeline
ON lead_events (lead_id, created_at DESC);

-- Leads quentes por conta
CREATE INDEX idx_leads_hot
ON leads (account_id, temperature, last_contacted_at DESC)
WHERE temperature = 'hot';

-- Conversa por lead/canal (lookup rápido)
CREATE UNIQUE INDEX idx_conv_lead_channel
ON conversations (account_id, lead_id, channel);
```

---

## API Endpoints

### Auth & Middleware

**Autenticação:** JWT com access token (15min) + refresh token (7d). Token carrega: user_id, account_id, role.

**Middleware stack:**
1. `authenticate` — valida JWT
2. `tenantScope` — injeta account_id em todas queries
3. `authorize(role)` — checa permissão por role
4. `rateLimit` — por account_id (não por IP)
5. `correlationId` — gera/propaga correlation_id

### Auth
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Cria account + primeiro user (owner) |
| POST | `/api/auth/login` | Retorna access_token + refresh_token |
| POST | `/api/auth/refresh` | Renova access_token |
| POST | `/api/auth/logout` | Invalida refresh_token |

### Leads
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/leads` | Lista com filtros: status, temperature, assigned_to, search. Paginação cursor-based |
| GET | `/api/leads/:id` | Detalhes + score + metadata + última mensagem |
| POST | `/api/leads` | Cria lead individual |
| POST | `/api/leads/import` | Importa lista (CSV/JSON). Idempotente via phone. Retorna: created, duplicated, errors |
| PATCH | `/api/leads/:id` | Atualiza campos (status, assigned_to, tags, metadata) |
| POST | `/api/leads/:id/assign` | Atribui lead a um vendedor |
| POST | `/api/leads/:id/score` | Ajuste manual de score (+/-) com motivo |
| POST | `/api/leads/:id/stop` | Para automação — cancela sequence + pausa IA |
| GET | `/api/leads/:id/timeline` | Histórico completo (lead_events) |
| GET | `/api/leads/pipeline` | Leads agrupados por status (kanban view) |
| POST | `/api/leads/bulk` | Ações em lote: assign, update status, add tag. Idempotente |

### Conversations & Messages
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/conversations` | Lista conversas ativas. Filtro: status, ai_enabled |
| GET | `/api/conversations/by-lead/:leadId` | Busca conversa diretamente pelo lead |
| GET | `/api/conversations/:id/messages` | Histórico de mensagens. Paginação cursor-based |
| POST | `/api/conversations/:id/messages` | Humano envia mensagem manual. Idempotente via correlation_id |
| PATCH | `/api/conversations/:id` | Pausar/retomar IA, fechar conversa |
| POST | `/api/conversations/:id/takeover` | Humano assume — desliga IA, notifica dashboard |

### Sequences
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/sequences` | Lista sequences com stats (leads ativos, taxa de resposta) |
| POST | `/api/sequences` | Cria nova sequence (draft) |
| PATCH | `/api/sequences/:id` | Edita steps/config (cria nova version se já publicada) |
| POST | `/api/sequences/:id/publish` | Publica versão — novos leads usam essa versão |
| POST | `/api/sequences/:id/enroll` | Inscreve leads (batch) na sequence. Idempotente via lead_id+sequence_id |
| POST | `/api/sequences/:id/clone` | Clona sequence como draft |
| GET | `/api/sequences/:id/leads` | Leads inscritos com status e step atual |

### WhatsApp
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/whatsapp/status` | Status da conexão + métricas: uptime, fila pendente, msgs/hora, last_error |
| POST | `/api/whatsapp/connect` | Inicia sessão Baileys — retorna QR code via WebSocket |
| POST | `/api/whatsapp/disconnect` | Desconecta sessão |
| POST | `/api/whatsapp/restart` | Reinicia sessão (recupera de erro) |

### Users & Team
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/users` | Lista usuários da account (admin+) |
| POST | `/api/users/invite` | Convida novo vendedor (admin+) |
| PATCH | `/api/users/:id` | Atualiza role, status (admin+) |
| GET | `/api/users/me` | Perfil do usuário logado |

### Dashboard & Metrics
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dashboard/overview` | Total leads, por status, score médio, leads quentes, sequences ativas |
| GET | `/api/dashboard/metrics` | Taxa resposta, taxa conversão, tempo médio de ciclo. Filtro: period (7d/30d/90d) |
| GET | `/api/dashboard/activity` | Feed de atividade recente (mensagens, transições, assigns) |

### Healthcheck (todos os serviços)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Status + dependências (db: ok, redis: ok, whatsapp: connected) |
| GET | `/health/ready` | Readiness probe para Docker/orchestrator |

### Idempotência
Endpoints críticos suportam idempotência:
- `POST /leads/import` — via phone (dedup por account_id+phone)
- `POST /conversations/:id/messages` — via correlation_id no header `Idempotency-Key`
- `POST /sequences/:id/enroll` — via lead_id+sequence_id (UNIQUE constraint)
- `POST /leads/bulk` — via operação+lead_id

---

## WebSocket Events (Realtime)

Conexão única via Socket.IO, autenticada com JWT, scoped por account_id.

### Server → Client
| Evento | Payload |
|--------|---------|
| `message:new` | Nova mensagem (in/out) |
| `message:status` | Atualização: sent/delivered/read |
| `lead:updated` | Mudança de status/score/temperature |
| `lead:hot` | Lead atingiu score 50+ |
| `sequence:step` | Sequence avançou step |
| `whatsapp:status` | Conexão/desconexão |
| `whatsapp:qr` | QR code para escanear |
| `notification` | Alertas (áudio recebido, IA sem confiança, etc) |

### Client → Server
| Evento | Payload |
|--------|---------|
| `conversation:join` | Entra numa sala de conversa |
| `conversation:leave` | Sai da sala |
| `conversation:typing` | Indicador de digitação |
| `notification:read` | Marca notificação como lida |

---

## Comunicação entre Serviços (BullMQ)

### Filas

| Fila | Producer | Consumer | Payload |
|------|----------|----------|---------|
| `whatsapp:send` | API, Scheduler | WhatsApp Service | {conversation_id, content, correlation_id} |
| `whatsapp:incoming` | WhatsApp Service | API | {from, content, external_id, timestamp} |
| `ai:process` | API | AI Worker | {conversation_id, lead_id, message, context} |
| `ai:response` | AI Worker | API | {conversation_id, content, confidence, action} |
| `sequence:execute` | Scheduler | API | {lead_sequence_id, step} |
| `sequence:schedule` | API | Scheduler | {lead_sequence_id, next_send_at} |
| `lead:score_update` | AI Worker | API | {lead_id, delta, reason} |
| `notification:send` | API, AI Worker | API (WebSocket) | {user_id, type, data} |

### Contracts Package
Payloads padronizados no package `@mensageira/contracts`:
- Tipos TypeScript para cada fila
- Schemas Zod para validação
- Tipos de eventos WebSocket
- Shared entre todos os serviços

---

## Estrutura de Pastas

```
mensageira/
├── packages/
│   ├── shared/          — tipos, utils, validações compartilhadas
│   │   └── src/
│   │       ├── types/
│   │       ├── validators/
│   │       ├── constants/
│   │       └── utils/
│   ├── contracts/       — payloads de filas e WebSocket
│   │   └── src/
│   │       ├── queues/      — tipos por fila BullMQ
│   │       ├── events/      — tipos de eventos WebSocket
│   │       └── index.ts
│   └── db/              — migrations e seed data
│       ├── migrations/
│       └── seeds/
│
├── apps/
│   ├── api/             — Serviço principal (CRM + REST + WebSocket)
│   │   └── src/
│   │       ├── config/
│   │       ├── middleware/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── leads/
│   │       │   ├── conversations/
│   │       │   ├── sequences/
│   │       │   ├── whatsapp/
│   │       │   ├── users/
│   │       │   └── dashboard/
│   │       ├── websocket/
│   │       ├── queues/
│   │       └── app.ts
│   │
│   ├── whatsapp/        — Serviço WhatsApp (Baileys)
│   │   └── src/
│   │       ├── providers/
│   │       │   ├── provider.interface.ts   — abstraction layer
│   │       │   ├── baileys.provider.ts     — MVP
│   │       │   └── meta-cloud.provider.ts  — futuro
│   │       ├── handlers/
│   │       ├── session/
│   │       └── worker.ts
│   │
│   ├── ai-worker/       — Processamento IA (Claude)
│   │   └── src/
│   │       ├── prompts/     — templates por etapa do funil
│   │       ├── scoring/
│   │       ├── classifier/  — intent detection, short-answer handler
│   │       └── worker.ts
│   │
│   ├── scheduler/       — Follow-up engine + cadência
│   │   └── src/
│   │       ├── jobs/
│   │       ├── cron/
│   │       └── worker.ts
│   │
│   └── web/             — Frontend React + Vite
│       └── src/
│           ├── components/    — shadcn/ui primitivos
│           ├── features/
│           │   ├── auth/
│           │   ├── leads/         — pipeline kanban, detail, import
│           │   ├── conversations/ — chat view, takeover
│           │   ├── sequences/     — builder, stats
│           │   ├── dashboard/     — overview, metrics
│           │   ├── whatsapp/      — connection manager, QR
│           │   └── settings/
│           ├── hooks/
│           ├── lib/
│           └── stores/
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json         — workspaces root
├── turbo.json
└── tsconfig.base.json
```

---

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: pg_isready
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]
    command: redis-server --appendonly yes
    healthcheck: redis-cli ping
    restart: unless-stopped

  api:
    build: ./apps/api
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    restart: unless-stopped

  whatsapp:
    build: ./apps/whatsapp
    volumes: [wa_sessions:/app/sessions]
    depends_on: [redis, postgres]
    restart: on-failure
    deploy:
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 5
        window: 60s

  ai-worker:
    build: ./apps/ai-worker
    depends_on: [redis, postgres]
    restart: unless-stopped
    deploy: {replicas: 1}  # escalar conforme volume

  scheduler:
    build: ./apps/scheduler
    depends_on: [redis, postgres]
    restart: unless-stopped

  web:
    build: ./apps/web
    ports: ["80:80"]
    depends_on: [api]

volumes:
  pgdata:
  redisdata:
  wa_sessions:  # sessão Baileys persiste entre restarts
```

### WhatsApp Service — Restart Strategy
- `restart: on-failure` com delay de 10s entre tentativas
- Máximo 5 tentativas em janela de 60s
- Se exceder: mantém parado, notifica via health check
- Reconexão automática do Baileys dentro do serviço com backoff exponencial

### Scheduler — Batch Processing
- Scan periódico via `idx_leadseq_pending_send` (partial index)
- Processa em batches de 50 lead_sequences por ciclo
- Lock otimista: `UPDATE ... SET locked_at = NOW(), locked_by = worker_id WHERE locked_at IS NULL`
- Timeout de lock: 5 minutos — se locked_at > 5min, libera para outro worker

---

## Tech Stack

### Backend
- Node.js + TypeScript
- Fastify
- Prisma (ORM)
- BullMQ (filas)
- Socket.IO (realtime)
- Zod (validação)
- pino (logs estruturados)

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand (state management)
- TanStack Query (data fetching)

### Infra
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7
- Baileys (WhatsApp MVP) → Meta Cloud API (futuro)
- Claude API (Anthropic)
- Turborepo (monorepo)

---

## WhatsApp Provider Interface

Abstraction layer para facilitar migração futura:

```typescript
interface WhatsAppProvider {
  connect(): Promise<void>
  disconnect(): Promise<void>
  getStatus(): ConnectionStatus
  sendMessage(to: string, content: MessageContent): Promise<SendResult>
  onMessage(handler: MessageHandler): void
  onStatusUpdate(handler: StatusHandler): void
  onConnectionChange(handler: ConnectionHandler): void
}
```

- MVP: `BaileysProvider` implementa a interface
- Futuro: `MetaCloudProvider` implementa a mesma interface
- Troca = alterar config de qual provider instanciar

---

## Decisões de Design

1. **JSONB para sequences.steps e leads.metadata** — flexibilidade sem migrations para cada campo novo
2. **lead_events como audit log append-only** — timeline completa reconstruível, sem perda de histórico
3. **whatsapp_sessions separado** — isolamento total, muda sozinha na migração de provider
4. **Multi-tenant desde o dia 1** — account_id em tudo, UNIQUE constraints compostas. Evita refactor doloroso depois
5. **Sequence versioning** — leads ativos rodam a versão em que entraram. Editar sequence não afeta leads em andamento
6. **Lock otimista em lead_sequences** — evita dois workers processando o mesmo lead simultaneamente
7. **Partial indexes** — queries do scheduler e mensagens pendentes são as mais frequentes, partial indexes mantêm performance
8. **Feature-based no frontend** — cada feature (leads, conversations, dashboard) tem seus próprios componentes, hooks e lógica
9. **Monorepo com Turborepo** — builds paralelos, cache, shared packages. Um repo, deploy independente por serviço
10. **correlation_id end-to-end** — propagado da API até filas e logs. Rastreamento completo de qualquer fluxo
