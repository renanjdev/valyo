# Foundation & Auth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo structure, database schema, Docker infrastructure, and authentication system as the foundation for all subsequent Mensageira services.

**Architecture:** Turborepo monorepo with 3 shared packages (shared, contracts, db) and the API service with Fastify. PostgreSQL for data, Redis for sessions/cache. JWT auth with access+refresh tokens, multi-tenant via account_id scoping.

**Tech Stack:** Node.js 20, TypeScript, Turborepo, Fastify, Prisma, BullMQ, Redis, PostgreSQL 16, Zod, pino, Docker Compose, vitest

---

## Phasing Context

This is **Plan 1 of 4** for the Mensageira project.

| Plan | Status |
|------|--------|
| **1. Foundation & Auth** | THIS PLAN |
| 2. CRM Core & WhatsApp | After Plan 1 |
| 3. Automation Engine | After Plan 2 |
| 4. Frontend & Integration | After Plan 3 |

**Spec:** `docs/superpowers/specs/2026-04-06-mensageira-design.md`

---

## File Structure

```
mensageira/
├── package.json                          — workspaces root
├── turbo.json                            — turborepo config
├── tsconfig.base.json                    — shared TS config
├── .env.example                          — env template
├── .gitignore
├── docker-compose.yml                    — prod compose
├── docker-compose.dev.yml                — dev overrides
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       │   ├── enums.ts              — all shared enums
│   │       │   └── index.ts
│   │       ├── validators/
│   │       │   ├── phone.ts              — phone normalization
│   │       │   └── index.ts
│   │       ├── constants/
│   │       │   ├── scoring.ts            — lead scoring values
│   │       │   └── index.ts
│   │       └── utils/
│   │           ├── id.ts                 — UUID generation
│   │           └── index.ts
│   │
│   ├── contracts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── queues/
│   │       │   ├── whatsapp.ts           — whatsapp:send, whatsapp:incoming
│   │       │   ├── ai.ts                 — ai:process, ai:response
│   │       │   ├── sequence.ts           — sequence:execute, sequence:schedule
│   │       │   ├── lead.ts               — lead:score_update
│   │       │   ├── notification.ts       — notification:send
│   │       │   └── index.ts
│   │       └── events/
│   │           ├── websocket.ts          — socket.io event types
│   │           └── index.ts
│   │
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       └── prisma/
│           ├── schema.prisma             — full schema
│           └── seed.ts                   — seed data
│
├── apps/
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── vitest.config.ts
│       └── src/
│           ├── app.ts                    — fastify setup + plugins
│           ├── server.ts                 — entry point (start server)
│           ├── config/
│           │   ├── env.ts                — zod-validated env vars
│           │   ├── database.ts           — prisma client singleton
│           │   ├── redis.ts              — redis/bullmq connection
│           │   └── index.ts
│           ├── middleware/
│           │   ├── authenticate.ts       — JWT validation
│           │   ├── tenant-scope.ts       — inject account_id
│           │   ├── authorize.ts          — role-based access
│           │   ├── correlation-id.ts     — generate/propagate
│           │   └── index.ts
│           ├── modules/
│           │   └── auth/
│           │       ├── auth.routes.ts
│           │       ├── auth.controller.ts
│           │       ├── auth.service.ts
│           │       └── auth.schemas.ts   — zod request/response schemas
│           ├── lib/
│           │   ├── errors.ts             — AppError class + error handler
│           │   ├── logger.ts             — pino logger setup
│           │   └── hash.ts              — bcrypt wrapper
│           └── __tests__/
│               ├── setup.ts              — test db + cleanup
│               ├── helpers.ts            — createTestUser, getAuthToken, etc
│               ├── auth/
│               │   ├── register.test.ts
│               │   ├── login.test.ts
│               │   ├── refresh.test.ts
│               │   └── logout.test.ts
│               └── middleware/
│                   ├── authenticate.test.ts
│                   └── tenant-scope.test.ts
```

---

## Chunk 1: Monorepo Setup & Infrastructure

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mensageira",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:migrate": "turbo db:migrate --filter=@mensageira/db",
    "db:seed": "turbo db:seed --filter=@mensageira/db",
    "db:studio": "turbo db:studio --filter=@mensageira/db"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "npm@10.9.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.turbo/
.superpowers/
```

- [ ] **Step 5: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://mensageira:mensageira@localhost:5432/mensageira

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-too-in-production

# API
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=development

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# WhatsApp
WA_SESSION_PATH=/app/sessions
```

- [ ] **Step 6: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .gitignore .env.example
git commit -m "chore: initialize monorepo root with turborepo"
```

---

### Task 2: Docker Compose infrastructure

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mensageira
      POSTGRES_USER: mensageira
      POSTGRES_PASSWORD: mensageira
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mensageira"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

- [ ] **Step 2: Create docker-compose.dev.yml**

```yaml
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# Dev overrides: expose ports on host for local dev tools, verbose logging
services:
  postgres:
    environment:
      POSTGRES_LOG_STATEMENT: "all"

  redis:
    command: redis-server --appendonly yes --loglevel verbose
```

- [ ] **Step 3: Start infrastructure and verify**

Run: `docker compose up -d postgres redis`
Expected: Both containers healthy

Run: `docker compose ps`
Expected: postgres (healthy), redis (healthy)

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "infra: add docker-compose with postgres and redis"
```

---

### Task 3: Shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/enums.ts`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/validators/phone.ts`
- Create: `packages/shared/src/validators/index.ts`
- Create: `packages/shared/src/constants/scoring.ts`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/utils/id.ts`
- Create: `packages/shared/src/utils/index.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@mensageira/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create enums (packages/shared/src/types/enums.ts)**

```typescript
export const LeadStatus = {
  NEW: 'new',
  PROSPECTING: 'prospecting',
  WAITING: 'waiting',
  ENGAGED: 'engaged',
  QUALIFIED: 'qualified',
  UNRESPONSIVE: 'unresponsive',
  NURTURE: 'nurture',
  WON: 'won',
  LOST: 'lost',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadTemperature = {
  COLD: 'cold',
  WARM: 'warm',
  HOT: 'hot',
} as const;
export type LeadTemperature = (typeof LeadTemperature)[keyof typeof LeadTemperature];

export const LeadSource = {
  IMPORT: 'import',
  INBOUND: 'inbound',
  MANUAL: 'manual',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const MessageDirection = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageSender = {
  LEAD: 'lead',
  AI: 'ai',
  HUMAN: 'human',
} as const;
export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

export const MessageStatus = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const MessageContentType = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  DOCUMENT: 'document',
} as const;
export type MessageContentType = (typeof MessageContentType)[keyof typeof MessageContentType];

export const ConversationStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  CLOSED: 'closed',
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const SequenceType = {
  COLD: 'cold',
  WARM: 'warm',
  NURTURE: 'nurture',
} as const;
export type SequenceType = (typeof SequenceType)[keyof typeof SequenceType];

export const LeadSequenceStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type LeadSequenceStatus = (typeof LeadSequenceStatus)[keyof typeof LeadSequenceStatus];

export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  SELLER: 'seller',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AccountPlan = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
} as const;
export type AccountPlan = (typeof AccountPlan)[keyof typeof AccountPlan];

export const EventActor = {
  SYSTEM: 'system',
  AI: 'ai',
  HUMAN: 'human',
} as const;
export type EventActor = (typeof EventActor)[keyof typeof EventActor];

export const LeadEventType = {
  STATUS_CHANGE: 'status_change',
  SCORE_CHANGE: 'score_change',
  ASSIGNED: 'assigned',
  NOTE_ADDED: 'note_added',
  SEQUENCE_STARTED: 'sequence_started',
  SEQUENCE_COMPLETED: 'sequence_completed',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
} as const;
export type LeadEventType = (typeof LeadEventType)[keyof typeof LeadEventType];

export const WASessionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  BANNED: 'banned',
} as const;
export type WASessionStatus = (typeof WASessionStatus)[keyof typeof WASessionStatus];
```

- [ ] **Step 4: Create types index**

```typescript
// packages/shared/src/types/index.ts
export * from './enums.js';
```

- [ ] **Step 5: Create phone validator (packages/shared/src/validators/phone.ts)**

```typescript
import { z } from 'zod';

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55') && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

export const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .transform(normalizePhone)
  .refine((val) => PHONE_REGEX.test(val), {
    message: 'Invalid phone number format',
  });
```

- [ ] **Step 6: Create validators index**

```typescript
// packages/shared/src/validators/index.ts
export * from './phone.js';
```

- [ ] **Step 7: Create scoring constants (packages/shared/src/constants/scoring.ts)**

```typescript
export const SCORE_VALUES = {
  MESSAGE_READ: 5,
  REPLIED: 20,
  DESCRIBED_PAIN: 30,
  ASKED_FEATURE: 25,
  ASKED_PRICE: 25,
  REQUESTED_DEMO: 50,
  MENTIONED_VOLUME: 15,
  NEGATIVE_RESPONSE: -100,
} as const;

export const TEMPERATURE_THRESHOLDS = {
  COLD_MAX: 19,
  WARM_MAX: 49,
  // 50+ = HOT
} as const;

export const SEQUENCE_LIMITS = {
  MAX_STEPS_NO_READ: 3,
  MAX_STEPS_WITH_READ: 5,
  MAX_NURTURE_CYCLES: 2,
} as const;

export const AI_CONFIDENCE_THRESHOLD = 0.7;
```

- [ ] **Step 8: Create constants index**

```typescript
// packages/shared/src/constants/index.ts
export * from './scoring.js';
```

- [ ] **Step 9: Create ID util (packages/shared/src/utils/id.ts)**

```typescript
import { randomUUID } from 'node:crypto';

export function generateId(): string {
  return randomUUID();
}
```

- [ ] **Step 10: Create utils index**

```typescript
// packages/shared/src/utils/index.ts
export * from './id.js';
```

- [ ] **Step 11: Create main index (packages/shared/src/index.ts)**

```typescript
export * from './types/index.js';
export * from './validators/index.js';
export * from './constants/index.js';
export * from './utils/index.js';
```

- [ ] **Step 12: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared package with types, validators, constants"
```

---

### Task 4: Contracts package

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/queues/whatsapp.ts`
- Create: `packages/contracts/src/queues/ai.ts`
- Create: `packages/contracts/src/queues/sequence.ts`
- Create: `packages/contracts/src/queues/lead.ts`
- Create: `packages/contracts/src/queues/notification.ts`
- Create: `packages/contracts/src/queues/index.ts`
- Create: `packages/contracts/src/events/websocket.ts`
- Create: `packages/contracts/src/events/index.ts`
- Create: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create packages/contracts/package.json**

```json
{
  "name": "@mensageira/contracts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@mensageira/shared": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/contracts/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create queue contracts (packages/contracts/src/queues/whatsapp.ts)**

```typescript
import { z } from 'zod';

export const WhatsAppSendPayload = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  correlationId: z.string().uuid(),
  accountId: z.string().uuid(),
});
export type WhatsAppSendPayload = z.infer<typeof WhatsAppSendPayload>;

export const WhatsAppIncomingPayload = z.object({
  from: z.string(),
  content: z.string(),
  contentType: z.enum(['text', 'image', 'audio', 'document']),
  externalId: z.string(),
  timestamp: z.number(),
  accountId: z.string().uuid(),
});
export type WhatsAppIncomingPayload = z.infer<typeof WhatsAppIncomingPayload>;

export const QUEUE_WHATSAPP_SEND = 'whatsapp:send' as const;
export const QUEUE_WHATSAPP_INCOMING = 'whatsapp:incoming' as const;
```

- [ ] **Step 4: Create AI queue contracts (packages/contracts/src/queues/ai.ts)**

```typescript
import { z } from 'zod';

export const AIProcessPayload = z.object({
  conversationId: z.string().uuid(),
  leadId: z.string().uuid(),
  message: z.string(),
  context: z.object({
    leadStatus: z.string(),
    leadScore: z.number(),
    temperature: z.string(),
    conversationHistory: z.array(z.object({
      sender: z.string(),
      content: z.string(),
      timestamp: z.string(),
    })),
  }),
  correlationId: z.string().uuid(),
  accountId: z.string().uuid(),
});
export type AIProcessPayload = z.infer<typeof AIProcessPayload>;

export const AIResponsePayload = z.object({
  conversationId: z.string().uuid(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  action: z.enum(['respond', 'transfer_human', 'stop', 'notify_human']),
  scoreDelta: z.number().optional(),
  scoreReason: z.string().optional(),
  correlationId: z.string().uuid(),
  accountId: z.string().uuid(),
});
export type AIResponsePayload = z.infer<typeof AIResponsePayload>;

export const QUEUE_AI_PROCESS = 'ai:process' as const;
export const QUEUE_AI_RESPONSE = 'ai:response' as const;
```

- [ ] **Step 5: Create remaining queue contracts**

```typescript
// packages/contracts/src/queues/sequence.ts
import { z } from 'zod';

export const SequenceExecutePayload = z.object({
  leadSequenceId: z.string().uuid(),
  step: z.number().int().min(0),
  accountId: z.string().uuid(),
  correlationId: z.string().uuid(),
});
export type SequenceExecutePayload = z.infer<typeof SequenceExecutePayload>;

export const SequenceSchedulePayload = z.object({
  leadSequenceId: z.string().uuid(),
  nextSendAt: z.string().datetime(),
  accountId: z.string().uuid(),
});
export type SequenceSchedulePayload = z.infer<typeof SequenceSchedulePayload>;

export const QUEUE_SEQUENCE_EXECUTE = 'sequence:execute' as const;
export const QUEUE_SEQUENCE_SCHEDULE = 'sequence:schedule' as const;
```

```typescript
// packages/contracts/src/queues/lead.ts
import { z } from 'zod';

export const LeadScoreUpdatePayload = z.object({
  leadId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string(),
  accountId: z.string().uuid(),
  correlationId: z.string().uuid(),
});
export type LeadScoreUpdatePayload = z.infer<typeof LeadScoreUpdatePayload>;

export const QUEUE_LEAD_SCORE_UPDATE = 'lead:score_update' as const;
```

```typescript
// packages/contracts/src/queues/notification.ts
import { z } from 'zod';

export const NotificationSendPayload = z.object({
  userId: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  type: z.enum(['lead_hot', 'ai_uncertain', 'audio_received', 'takeover_needed', 'whatsapp_disconnected']),
  data: z.record(z.unknown()),
  correlationId: z.string().uuid(),
});
export type NotificationSendPayload = z.infer<typeof NotificationSendPayload>;

export const QUEUE_NOTIFICATION_SEND = 'notification:send' as const;
```

```typescript
// packages/contracts/src/queues/index.ts
export * from './whatsapp.js';
export * from './ai.js';
export * from './sequence.js';
export * from './lead.js';
export * from './notification.js';
```

- [ ] **Step 6: Create WebSocket event contracts**

```typescript
// packages/contracts/src/events/websocket.ts
export interface MessageNewEvent {
  conversationId: string;
  message: {
    id: string;
    direction: 'inbound' | 'outbound';
    sender: 'lead' | 'ai' | 'human';
    content: string;
    contentType: string;
    createdAt: string;
  };
}

export interface MessageStatusEvent {
  messageId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface LeadUpdatedEvent {
  leadId: string;
  changes: {
    status?: string;
    score?: number;
    temperature?: string;
    assignedTo?: string;
  };
}

export interface LeadHotEvent {
  leadId: string;
  leadName: string;
  score: number;
  reason: string;
}

export interface WhatsAppStatusEvent {
  status: 'connected' | 'disconnected' | 'qr_pending';
  phone?: string;
}

export interface WhatsAppQREvent {
  qr: string;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export const WS_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_STATUS: 'message:status',
  LEAD_UPDATED: 'lead:updated',
  LEAD_HOT: 'lead:hot',
  SEQUENCE_STEP: 'sequence:step',
  WHATSAPP_STATUS: 'whatsapp:status',
  WHATSAPP_QR: 'whatsapp:qr',
  NOTIFICATION: 'notification',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONVERSATION_TYPING: 'conversation:typing',
  NOTIFICATION_READ: 'notification:read',
} as const;
```

```typescript
// packages/contracts/src/events/index.ts
export * from './websocket.js';
```

```typescript
// packages/contracts/src/index.ts
export * from './queues/index.js';
export * from './events/index.js';
```

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/
git commit -m "feat: add contracts package with queue and websocket types"
```

---

### Task 5: Database package (Prisma schema)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@mensageira/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^6.4.0"
  },
  "devDependencies": {
    "prisma": "^6.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 3: Create Prisma schema (packages/db/prisma/schema.prisma)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────────
// Multi-tenant root
// ──────────────────────────────────────────────

model Account {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(255)
  slug      String   @unique @db.VarChar(100)
  plan      String   @default("free") @db.VarChar(20) // free, starter, pro
  settings  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users             User[]
  leads             Lead[]
  conversations     Conversation[]
  messages          Message[]
  sequences         Sequence[]
  leadSequences     LeadSequence[]
  leadEvents        LeadEvent[]
  whatsappSessions  WhatsAppSession[]

  @@map("accounts")
}

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

model User {
  id           String   @id @default(uuid()) @db.Uuid
  accountId    String   @map("account_id") @db.Uuid
  name         String   @db.VarChar(255)
  email        String   @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         String   @default("seller") @db.VarChar(20) // owner, admin, seller
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  account       Account      @relation(fields: [accountId], references: [id])
  assignedLeads Lead[]       @relation("AssignedLeads")
  refreshTokens RefreshToken[]

  @@unique([accountId, email])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String   @unique @db.VarChar(500)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

// ──────────────────────────────────────────────
// Leads
// ──────────────────────────────────────────────

model Lead {
  id              String    @id @default(uuid()) @db.Uuid
  accountId       String    @map("account_id") @db.Uuid
  assignedTo      String?   @map("assigned_to") @db.Uuid
  name            String    @db.VarChar(255)
  phone           String    @db.VarChar(20)
  company         String?   @db.VarChar(255)
  source          String    @default("manual") @db.VarChar(20) // import, inbound, manual
  sourceDetail    String?   @map("source_detail") @db.VarChar(255)
  status          String    @default("new") @db.VarChar(20)
  score           Int       @default(0)
  temperature     String    @default("cold") @db.VarChar(10) // cold, warm, hot
  nurtureCount    Int       @default(0) @map("nurture_count")
  lastContactedAt DateTime? @map("last_contacted_at")
  tags            Json      @default("[]")
  metadata        Json      @default("{}")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  account       Account        @relation(fields: [accountId], references: [id])
  assignedUser  User?          @relation("AssignedLeads", fields: [assignedTo], references: [id])
  conversations Conversation[]
  leadSequences LeadSequence[]
  leadEvents    LeadEvent[]

  @@unique([accountId, phone])
  @@index([accountId, status, score(sort: Desc)], map: "idx_leads_pipeline")
  @@index([accountId, temperature, lastContactedAt(sort: Desc)], map: "idx_leads_hot")
  @@map("leads")
}

// ──────────────────────────────────────────────
// Conversations & Messages
// ──────────────────────────────────────────────

model Conversation {
  id            String    @id @default(uuid()) @db.Uuid
  accountId     String    @map("account_id") @db.Uuid
  leadId        String    @map("lead_id") @db.Uuid
  channel       String    @default("whatsapp") @db.VarChar(20)
  status        String    @default("active") @db.VarChar(20) // active, paused, closed
  aiEnabled     Boolean   @default(true) @map("ai_enabled")
  startedAt     DateTime  @default(now()) @map("started_at")
  lastMessageAt DateTime? @map("last_message_at")

  account  Account   @relation(fields: [accountId], references: [id])
  lead     Lead      @relation(fields: [leadId], references: [id])
  messages Message[]

  @@unique([accountId, leadId, channel])
  @@index([leadId], map: "idx_conv_lead")
  @@index([lastMessageAt(sort: Desc)], map: "idx_conv_last_msg")
  @@map("conversations")
}

model Message {
  id             String    @id @default(uuid()) @db.Uuid
  accountId      String    @map("account_id") @db.Uuid
  conversationId String    @map("conversation_id") @db.Uuid
  externalId     String?   @map("external_id") @db.VarChar(255)
  correlationId  String?   @map("correlation_id") @db.Uuid
  direction      String    @db.VarChar(10) // inbound, outbound
  sender         String    @db.VarChar(10) // lead, ai, human
  content        String    @db.Text
  contentType    String    @default("text") @map("content_type") @db.VarChar(20)
  status         String    @default("queued") @db.VarChar(20)
  queuedAt       DateTime  @default(now()) @map("queued_at")
  sentAt         DateTime? @map("sent_at")
  deliveredAt    DateTime? @map("delivered_at")
  readAt         DateTime? @map("read_at")
  failedAt       DateTime? @map("failed_at")
  error          String?   @db.Text
  createdAt      DateTime  @default(now()) @map("created_at")

  account      Account      @relation(fields: [accountId], references: [id])
  conversation Conversation @relation(fields: [conversationId], references: [id])

  @@index([conversationId, createdAt(sort: Desc)], map: "idx_messages_conversation")
  @@index([externalId], map: "idx_messages_external")
  @@map("messages")
}

// ──────────────────────────────────────────────
// Sequences
// ──────────────────────────────────────────────

model Sequence {
  id          String    @id @default(uuid()) @db.Uuid
  accountId   String    @map("account_id") @db.Uuid
  name        String    @db.VarChar(255)
  type        String    @db.VarChar(20) // cold, warm, nurture
  version     Int       @default(1)
  steps       Json      // [{day, type, template, delay_days}]
  isActive    Boolean   @default(true) @map("is_active")
  publishedAt DateTime? @map("published_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account       Account        @relation(fields: [accountId], references: [id])
  leadSequences LeadSequence[]

  @@map("sequences")
}

model LeadSequence {
  id              String    @id @default(uuid()) @db.Uuid
  accountId       String    @map("account_id") @db.Uuid
  leadId          String    @map("lead_id") @db.Uuid
  sequenceId      String    @map("sequence_id") @db.Uuid
  sequenceVersion Int       @map("sequence_version")
  currentStep     Int       @default(0) @map("current_step")
  status          String    @default("active") @db.VarChar(20)
  nextSendAt      DateTime? @map("next_send_at")
  retryCount      Int       @default(0) @map("retry_count")
  lastError       String?   @map("last_error") @db.Text
  lockedAt        DateTime? @map("locked_at")
  lockedBy        String?   @map("locked_by") @db.VarChar(255)
  startedAt       DateTime  @default(now()) @map("started_at")
  completedAt     DateTime? @map("completed_at")

  account  Account  @relation(fields: [accountId], references: [id])
  lead     Lead     @relation(fields: [leadId], references: [id])
  sequence Sequence @relation(fields: [sequenceId], references: [id])

  @@index([nextSendAt(sort: Asc)], map: "idx_leadseq_pending_send")
  @@index([leadId], map: "idx_leadseq_lead")
  @@index([status], map: "idx_leadseq_status")
  @@map("lead_sequences")
}

// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────

model LeadEvent {
  id        String   @id @default(uuid()) @db.Uuid
  accountId String   @map("account_id") @db.Uuid
  leadId    String   @map("lead_id") @db.Uuid
  type      String   @db.VarChar(50) // status_change, score_change, assigned, etc
  actor     String   @db.VarChar(10) // system, ai, human
  actorId   String?  @map("actor_id") @db.Uuid
  data      Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id])
  lead    Lead    @relation(fields: [leadId], references: [id])

  @@index([leadId, createdAt(sort: Desc)], map: "idx_events_lead_timeline")
  @@map("lead_events")
}

// ──────────────────────────────────────────────
// WhatsApp Sessions
// ──────────────────────────────────────────────

model WhatsAppSession {
  id              String    @id @default(uuid()) @db.Uuid
  accountId       String    @map("account_id") @db.Uuid
  phone           String    @db.VarChar(20)
  status          String    @default("disconnected") @db.VarChar(20)
  sessionData     Json      @default("{}") @map("session_data")
  lastConnectedAt DateTime? @map("last_connected_at")

  account Account @relation(fields: [accountId], references: [id])

  @@unique([accountId, phone])
  @@map("whatsapp_sessions")
}
```

- [ ] **Step 4: Create db package src index**

```typescript
// packages/db/src/index.ts
export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
```

- [ ] **Step 5: Install dependencies and generate client**

Run: `cd packages/db && npm install`
Run: `npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 6: Run initial migration**

Ensure Docker postgres is running.

Run: `DATABASE_URL=postgresql://mensageira:mensageira@localhost:5432/mensageira npx prisma migrate dev --name init`
Expected: Migration created and applied

- [ ] **Step 6b: Create partial indexes via raw SQL migration**

Prisma does not support partial indexes natively. Create a custom migration:

Run: `DATABASE_URL=postgresql://mensageira:mensageira@localhost:5432/mensageira npx prisma migrate dev --name add_partial_indexes --create-only`

Then edit the generated migration SQL file and add:

```sql
-- Scheduler: pending sends (critical performance index)
CREATE INDEX idx_leadseq_pending_send_partial
ON lead_sequences (next_send_at ASC)
WHERE status = 'active' AND next_send_at IS NOT NULL AND locked_at IS NULL;

-- Messages: pending retry
CREATE INDEX idx_messages_pending
ON messages (status, queued_at ASC)
WHERE status IN ('queued', 'failed');

-- Leads: hot leads only
DROP INDEX IF EXISTS idx_leads_hot;
CREATE INDEX idx_leads_hot_partial
ON leads (account_id, temperature, last_contacted_at DESC)
WHERE temperature = 'hot';
```

Run: `DATABASE_URL=postgresql://mensageira:mensageira@localhost:5432/mensageira npx prisma migrate dev`
Expected: Migration applied

- [ ] **Step 7: Commit**

```bash
git add packages/db/
git commit -m "feat: add database package with full prisma schema"
```

---

## Chunk 2: API Service — Foundation, Config, Middleware

### Task 6: API service skeleton

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/config/database.ts`
- Create: `apps/api/src/config/redis.ts`
- Create: `apps/api/src/config/index.ts`
- Create: `apps/api/src/lib/logger.ts`
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/src/lib/hash.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@mensageira/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mensageira/shared": "*",
    "@mensageira/contracts": "*",
    "@mensageira/db": "*",
    "@fastify/cors": "^10.0.0",
    "@fastify/jwt": "^9.0.0",
    "bcrypt": "^5.1.0",
    "bullmq": "^5.30.0",
    "fastify": "^5.2.0",
    "ioredis": "^5.4.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/node": "^22.0.0",
    "pino-pretty": "^13.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/api/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 4: Create env config (apps/api/src/config/env.ts)**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
```

- [ ] **Step 5: Create database config (apps/api/src/config/database.ts)**

```typescript
import { PrismaClient } from '@mensageira/db';
import { env } from './env.js';

let prisma: PrismaClient;

export function getDatabase(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: env.DATABASE_URL,
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prisma;
}
```

- [ ] **Step 6: Create redis config (apps/api/src/config/redis.ts)**

```typescript
import Redis from 'ioredis';
import { env } from './env.js';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return redis;
}
```

- [ ] **Step 7: Create config index**

```typescript
// apps/api/src/config/index.ts
export { env } from './env.js';
export { getDatabase } from './database.js';
export { getRedis } from './redis.js';
```

- [ ] **Step 8: Create logger (apps/api/src/lib/logger.ts)**

```typescript
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

- [ ] **Step 9: Create error handling (apps/api/src/lib/errors.ts)**

```typescript
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const correlationId = request.headers['x-correlation-id'] as string | undefined;

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code || 'APP_ERROR',
      message: error.message,
      correlationId,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.flatten().fieldErrors,
      correlationId,
    });
  }

  logger.error({ err: error, correlationId }, 'Unhandled error');
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
    correlationId,
  });
}
```

- [ ] **Step 10: Create hash utility (apps/api/src/lib/hash.ts)**

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 11: Create Fastify app (apps/api/src/app.ts)**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/index.js';
import { errorHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { correlationIdHook } from './middleware/correlation-id.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export async function buildApp() {
  const app = Fastify({ logger });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  // Global hooks
  app.addHook('onRequest', correlationIdHook);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}
```

- [ ] **Step 12: Create server entry point (apps/api/src/server.ts)**

```typescript
import { env } from './config/index.js';
import { buildApp } from './app.js';
import { logger } from './lib/logger.js';

async function start() {
  const app = await buildApp();

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  logger.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});
```

- [ ] **Step 13: Commit**

```bash
git add apps/api/
git commit -m "feat: add API service skeleton with fastify, config, logger, errors"
```

---

### Task 7: Middleware

**Files:**
- Create: `apps/api/src/middleware/correlation-id.ts`
- Create: `apps/api/src/middleware/authenticate.ts`
- Create: `apps/api/src/middleware/tenant-scope.ts`
- Create: `apps/api/src/middleware/authorize.ts`
- Create: `apps/api/src/middleware/index.ts`

- [ ] **Step 1: Create correlation-id middleware**

```typescript
// apps/api/src/middleware/correlation-id.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const correlationId =
    (request.headers['x-correlation-id'] as string) || randomUUID();
  request.headers['x-correlation-id'] = correlationId;
  reply.header('x-correlation-id', correlationId);
}
```

- [ ] **Step 2: Create authenticate middleware**

```typescript
// apps/api/src/middleware/authenticate.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  userId: string;
  accountId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const payload = await request.jwtVerify<AuthUser>();
    request.authUser = payload;
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED');
  }
}
```

- [ ] **Step 3: Create tenant-scope middleware**

```typescript
// apps/api/src/middleware/tenant-scope.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    accountId?: string;
  }
}

export async function tenantScope(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.authUser?.accountId) {
    throw new AppError(401, 'No tenant context', 'NO_TENANT');
  }
  request.accountId = request.authUser.accountId;
}
```

- [ ] **Step 4: Create authorize middleware**

```typescript
// apps/api/src/middleware/authorize.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '@mensageira/shared';

const ROLE_HIERARCHY: Record<string, number> = {
  seller: 1,
  admin: 2,
  owner: 3,
};

export function authorize(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const userRole = request.authUser?.role;
    if (!userRole) {
      throw new AppError(401, 'Not authenticated', 'UNAUTHORIZED');
    }
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const minLevel = Math.min(
      ...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 999),
    );
    if (userLevel < minLevel) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
  };
}
```

- [ ] **Step 5: Create middleware index**

```typescript
// apps/api/src/middleware/index.ts
export { correlationIdHook } from './correlation-id.js';
export { authenticate, type AuthUser } from './authenticate.js';
export { tenantScope } from './tenant-scope.js';
export { authorize } from './authorize.js';
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/
git commit -m "feat: add authentication, tenant-scope, authorization middleware"
```

---

### Task 8: Auth module

**Files:**
- Create: `apps/api/src/modules/auth/auth.schemas.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Create auth schemas (apps/api/src/modules/auth/auth.schemas.ts)**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  accountName: z.string().min(2).max(255),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
```

- [ ] **Step 2: Create auth service (apps/api/src/modules/auth/auth.service.ts)**

```typescript
import type { PrismaClient } from '@mensageira/db';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import { AppError } from '../../lib/errors.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

export class AuthService {
  constructor(
    private db: PrismaClient,
    private jwt: FastifyInstance['jwt'],
  ) {}

  async register(input: RegisterInput) {
    // Email is globally unique (simplifies login — no need for account slug)
    const existingUser = await this.db.user.findFirst({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);
    const slug = slugify(input.accountName) + '-' + randomUUID().slice(0, 6);

    const account = await this.db.account.create({
      data: {
        name: input.accountName,
        slug,
        users: {
          create: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'owner',
          },
        },
      },
      include: { users: true },
    });

    const user = account.users[0];
    const tokens = await this.generateTokens(user.id, account.id, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      account: { id: account.id, name: account.name, slug: account.slug },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await this.db.user.findFirst({
      where: { email: input.email, isActive: true },
      include: { account: true },
    });
    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const validPassword = await verifyPassword(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokens(user.id, user.accountId, user.role);

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      account: { id: user.account.id, name: user.account.name, slug: user.account.slug },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { account: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.db.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH');
    }

    // Rotate refresh token
    await this.db.refreshToken.delete({ where: { id: stored.id } });

    const { user } = stored;
    return this.generateTokens(user.id, user.accountId, user.role);
  }

  async logout(refreshToken: string) {
    await this.db.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  private async generateTokens(userId: string, accountId: string, role: string) {
    const accessToken = this.jwt.sign(
      { userId, accountId, role },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    const refreshToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.db.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
```

- [ ] **Step 3: Create auth controller (apps/api/src/modules/auth/auth.controller.ts)**

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';

export class AuthController {
  constructor(private service: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await this.service.register(input);
    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await this.service.login(input);
    return reply.send(result);
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const input = refreshSchema.parse(request.body);
    const result = await this.service.refresh(input.refreshToken);
    return reply.send(result);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshSchema.parse(request.body);
    await this.service.logout(refreshToken);
    return reply.status(204).send();
  }
}
```

- [ ] **Step 4: Create auth routes (apps/api/src/modules/auth/auth.routes.ts)**

```typescript
import type { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { getDatabase } from '../../config/index.js';

export async function authRoutes(app: FastifyInstance) {
  const db = getDatabase();
  const service = new AuthService(db, app.jwt);
  const controller = new AuthController(service);

  app.post('/register', (req, rep) => controller.register(req, rep));
  app.post('/login', (req, rep) => controller.login(req, rep));
  app.post('/refresh', (req, rep) => controller.refresh(req, rep));
  app.post('/logout', (req, rep) => controller.logout(req, rep));
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/
git commit -m "feat: add auth module with register, login, refresh, logout"
```

---

### Task 9: Auth tests

**Files:**
- Create: `apps/api/src/__tests__/setup.ts`
- Create: `apps/api/src/__tests__/helpers.ts`
- Create: `apps/api/src/__tests__/auth/register.test.ts`
- Create: `apps/api/src/__tests__/auth/login.test.ts`
- Create: `apps/api/src/__tests__/auth/refresh.test.ts`

- [ ] **Step 1: Create test setup (apps/api/src/__tests__/setup.ts)**

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@mensageira/db';

// IMPORTANT: Tests use a separate database to avoid destroying dev data
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://mensageira:mensageira@localhost:5432/mensageira_test';

const prisma = new PrismaClient({
  datasourceUrl: TEST_DB_URL,
});

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  // Clean tables in correct order (foreign key constraints)
  await prisma.refreshToken.deleteMany();
  await prisma.leadEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.leadSequence.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.whatsAppSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

- [ ] **Step 2: Create test helpers (apps/api/src/__tests__/helpers.ts)**

```typescript
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function createTestUser(overrides = {}) {
  const app = await getApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      accountName: 'Test Account',
      ...overrides,
    },
  });
  return JSON.parse(res.body);
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
```

- [ ] **Step 3: Create register tests (apps/api/src/__tests__/auth/register.test.ts)**

```typescript
import { describe, it, expect } from 'vitest';
import { getApp } from '../helpers.js';

describe('POST /api/auth/register', () => {
  it('should create account and user', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Renan',
        email: 'renan@test.com',
        password: 'password123',
        accountName: 'Homologa Plus',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.name).toBe('Renan');
    expect(body.user.role).toBe('owner');
    expect(body.account.name).toBe('Homologa Plus');
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    const app = await getApp();
    const payload = {
      name: 'User',
      email: 'dup@test.com',
      password: 'password123',
      accountName: 'Account',
    };

    await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload });

    expect(res.statusCode).toBe(409);
  });

  it('should reject short password', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User',
        email: 'short@test.com',
        password: '123',
        accountName: 'Account',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 4: Create login tests (apps/api/src/__tests__/auth/login.test.ts)**

```typescript
import { describe, it, expect } from 'vitest';
import { getApp, createTestUser } from '../helpers.js';

describe('POST /api/auth/login', () => {
  it('should return tokens for valid credentials', async () => {
    const app = await getApp();
    const email = `login-${Date.now()}@test.com`;
    await createTestUser({ email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(email);
  });

  it('should reject invalid password', async () => {
    const app = await getApp();
    const email = `bad-${Date.now()}@test.com`;
    await createTestUser({ email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject non-existent email', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ghost@test.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 5: Create refresh tests (apps/api/src/__tests__/auth/refresh.test.ts)**

```typescript
import { describe, it, expect } from 'vitest';
import { getApp, createTestUser } from '../helpers.js';

describe('POST /api/auth/refresh', () => {
  it('should return new tokens', async () => {
    const app = await getApp();
    const { refreshToken } = await createTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    // Old refresh token should be rotated
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it('should reject invalid refresh token', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'invalid-token' },
    });

    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd apps/api && npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/__tests__/
git commit -m "test: add auth module tests (register, login, refresh)"
```

---

### Task 10: Install dependencies and verify

- [ ] **Step 1: Install all dependencies from root**

Run: `npm install` (from project root)
Expected: All workspaces resolved

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx turbo lint`
Expected: No type errors

- [ ] **Step 3: Start infra and run migrations**

Run: `docker compose up -d postgres redis`
Run: `cd packages/db && DATABASE_URL=postgresql://mensageira:mensageira@localhost:5432/mensageira npx prisma migrate dev --name init`
Expected: Migration applied

- [ ] **Step 4: Run API tests**

Run: `cd apps/api && npm test`
Expected: All tests pass

- [ ] **Step 5: Start API and test health check**

Run: `cd apps/api && npm run dev` (in background)
Run: `curl http://localhost:3000/health`
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 6: Final commit (only if there are remaining unstaged changes)**

```bash
git status
# Only stage files that are part of the project — review before adding
git add package-lock.json
git commit -m "chore: verify full foundation setup (deps, migrations, tests, health)"
```

---

## Summary

After completing this plan you will have:

- **Monorepo** with Turborepo, 3 packages (shared, contracts, db), 1 app (api)
- **Docker Compose** with PostgreSQL 16 and Redis 7
- **Full database schema** with all 9 tables, indexes, and multi-tenant support
- **API service** with Fastify, pino logger, structured errors, correlation_id
- **Auth system** with register, login, refresh, logout + JWT + refresh token rotation
- **Middleware** stack: authenticate → tenantScope → authorize → correlationId
- **Tests** for the auth module
- **Healthcheck** endpoint

**Next plan:** Plan 2 — CRM Core & WhatsApp (Leads CRUD, Conversations, Messages, WhatsApp Service with Baileys)
