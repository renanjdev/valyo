import { z } from 'zod';

export const listConversationsQuery = z.object({
  status: z.enum(['active', 'paused', 'closed']).optional(),
  aiEnabled: z.coerce.boolean().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  correlationId: z.string().uuid().optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(['active', 'paused', 'closed']).optional(),
  aiEnabled: z.boolean().optional(),
});

export const messagesQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
});
