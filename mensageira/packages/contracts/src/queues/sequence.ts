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
