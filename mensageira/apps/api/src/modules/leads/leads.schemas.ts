import { z } from 'zod';
import { phoneSchema } from '@mensageira/shared';

export const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  phone: phoneSchema,
  company: z.string().max(255).optional(),
  source: z.enum(['import', 'inbound', 'manual']).default('manual'),
  sourceDetail: z.string().max(255).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  status: z.enum(['new', 'prospecting', 'waiting', 'engaged', 'qualified', 'unresponsive', 'nurture', 'won', 'lost']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const importLeadsSchema = z.object({
  leads: z.array(z.object({
    name: z.string().min(1),
    phone: phoneSchema,
    company: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })).min(1).max(1000),
  sourceDetail: z.string().optional(),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

export const bulkActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['assign', 'update_status', 'add_tag']),
  value: z.string(),
});
export type BulkActionInput = z.infer<typeof bulkActionSchema>;

export const scoreAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().min(1),
});
export type ScoreAdjustInput = z.infer<typeof scoreAdjustSchema>;

export const listLeadsQuery = z.object({
  status: z.string().optional(),
  temperature: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  search: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuery>;
