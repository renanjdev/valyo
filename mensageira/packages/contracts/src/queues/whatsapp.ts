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
