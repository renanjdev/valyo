import { makeWASocket, useMultiFileAuthState, DisconnectReason, type WASocket } from 'baileys';
import type {
  WhatsAppProvider, MessageContent, SendResult,
  ConnectionStatus, MessageHandler, StatusHandler, ConnectionHandler,
} from './provider.interface.js';
import pino from 'pino';

const logger = pino({ level: 'warn' });

export class BaileysProvider implements WhatsAppProvider {
  private socket: WASocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private messageHandler: MessageHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private sessionPath: string) {}

  async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

    this.socket = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = 'qr_pending';
        this.connectionHandler?.('qr_pending', qr);
      }

      if (connection === 'open') {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.connectionHandler?.('connected');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.status = 'disconnected';
        this.connectionHandler?.('disconnected');

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          setTimeout(() => this.connect(), delay);
        }
      }
    });

    this.socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const content = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || '';

        let contentType: 'text' | 'image' | 'audio' | 'document' = 'text';
        if (msg.message.imageMessage) contentType = 'image';
        else if (msg.message.audioMessage) contentType = 'audio';
        else if (msg.message.documentMessage) contentType = 'document';

        await this.messageHandler?.({
          from: msg.key.remoteJid!.replace('@s.whatsapp.net', ''),
          content,
          contentType,
          externalId: msg.key.id!,
          timestamp: msg.messageTimestamp as number,
        });
      }
    });

    this.socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update.status) {
          const statusMap: Record<number, 'sent' | 'delivered' | 'read'> = {
            2: 'sent', 3: 'delivered', 4: 'read',
          };
          const status = statusMap[update.update.status];
          if (status) {
            await this.statusHandler?.(update.key.id!, status);
          }
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    this.socket?.end(undefined);
    this.socket = null;
    this.status = 'disconnected';
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async sendMessage(to: string, content: MessageContent): Promise<SendResult> {
    if (!this.socket || this.status !== 'connected') {
      return { success: false, error: 'Not connected' };
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      const result = await this.socket.sendMessage(jid, { text: content.text });
      return { success: true, externalId: result?.key?.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStatusUpdate(handler: StatusHandler): void {
    this.statusHandler = handler;
  }

  onConnectionChange(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
  }
}
