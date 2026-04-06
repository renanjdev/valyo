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
