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
