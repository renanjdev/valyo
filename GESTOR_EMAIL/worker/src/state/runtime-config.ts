import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { config } from '../config.js';

const CONFIG_PATH = join(process.cwd(), 'data', 'config.json');

export interface RuntimeConfig {
  email: string;
  password: string;
  apiKey: string;
  imapHost: string;
  mailbox: string;
}

function readFile(): RuntimeConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as RuntimeConfig;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  const rc = readFile();
  return !!(rc?.email && rc?.password && rc?.apiKey && rc?.imapHost);
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return readFile();
}

export function saveRuntimeConfig(data: RuntimeConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  applyToLiveConfig(data);
}

export function applyRuntimeConfig(): void {
  const rc = readFile();
  if (rc) applyToLiveConfig(rc);
}

function applyToLiveConfig(rc: RuntimeConfig): void {
  config.imap.user = rc.email;
  config.imap.password = rc.password;
  config.imap.host = rc.imapHost;
  config.imap.mailbox = rc.mailbox;
  config.gemini.apiKey = rc.apiKey;
}
