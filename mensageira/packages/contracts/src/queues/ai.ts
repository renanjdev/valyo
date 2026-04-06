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
