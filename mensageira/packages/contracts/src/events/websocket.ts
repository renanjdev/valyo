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
