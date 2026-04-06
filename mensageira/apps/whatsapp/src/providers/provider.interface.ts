export interface MessageContent {
  text: string;
  type?: 'text' | 'image' | 'document';
}

export interface SendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface IncomingMessage {
  from: string;
  content: string;
  contentType: 'text' | 'image' | 'audio' | 'document';
  externalId: string;
  timestamp: number;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'qr_pending';

export type MessageHandler = (message: IncomingMessage) => Promise<void>;
export type StatusHandler = (externalId: string, status: 'sent' | 'delivered' | 'read') => Promise<void>;
export type ConnectionHandler = (status: ConnectionStatus, qr?: string) => void;

export interface WhatsAppProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ConnectionStatus;
  sendMessage(to: string, content: MessageContent): Promise<SendResult>;
  onMessage(handler: MessageHandler): void;
  onStatusUpdate(handler: StatusHandler): void;
  onConnectionChange(handler: ConnectionHandler): void;
}
