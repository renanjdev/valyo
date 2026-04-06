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
