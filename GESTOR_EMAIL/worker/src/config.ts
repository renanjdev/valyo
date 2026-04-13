import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true });

interface Config {
  imap: {
    host: string;
    port: number;
    user: string;
    password: string;
    mailbox: string;
    tls: boolean;
  };
  gemini: {
    apiKey: string | null;
  };
  worker: {
    pollIntervalMs: number;
    maxEmailsPerBatch: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  storage: {
    dataDir: string;
    outputDir: string;
  };
  logLevel: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config: Config = {
  imap: {
    host: optional('IMAP_HOST', ''),
    port: parseInt(optional('IMAP_PORT', '993'), 10),
    user: optional('IMAP_USER', ''),
    password: optional('IMAP_PASSWORD', ''),
    mailbox: optional('IMAP_MAILBOX', 'INBOX'),
    tls: optional('IMAP_TLS', 'true') === 'true',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder'
      ? process.env.GEMINI_API_KEY
      : null,
  },
  worker: {
    pollIntervalMs: parseInt(optional('POLL_INTERVAL_MS', '60000'), 10),
    maxEmailsPerBatch: parseInt(optional('MAX_EMAILS_PER_BATCH', '20'), 10),
    maxRetries: parseInt(optional('MAX_RETRIES', '3'), 10),
    retryDelayMs: parseInt(optional('RETRY_DELAY_MS', '5000'), 10),
  },
  storage: {
    dataDir: optional('DATA_DIR', './data'),
    outputDir: optional('OUTPUT_DIR', '../squads/email-processor/output'),
  },
  logLevel: optional('LOG_LEVEL', 'info'),
};
