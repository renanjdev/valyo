import { z } from 'zod';

export const stepSchema = z.object({
  day: z.number().int().min(0),
  type: z.enum(['consultive', 'value', 'social_proof', 'checkin']),
  template: z.string().min(1),
  delayDays: z.number().int().min(0),
});

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['cold', 'warm', 'nurture']),
  steps: z.array(stepSchema).min(1).max(10),
});
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  steps: z.array(stepSchema).min(1).max(10).optional(),
});

export const enrollSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
});
