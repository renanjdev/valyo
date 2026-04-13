import { Router } from 'express';
import { ImapFlow } from 'imapflow';
import { isConfigured, getRuntimeConfig, saveRuntimeConfig } from '../../state/runtime-config.js';

export const setupRouter = Router();

setupRouter.get('/status', (_req, res) => {
  res.json({ configured: isConfigured() });
});

setupRouter.get('/', (_req, res) => {
  const rc = getRuntimeConfig();
  if (!rc) return res.json(null);
  res.json({
    email: rc.email,
    password: '••••••••',
    apiKey: rc.apiKey ? rc.apiKey.slice(0, 8) + '...' : '',
    imapHost: rc.imapHost,
    mailbox: rc.mailbox,
  });
});

setupRouter.post('/test', async (req, res) => {
  const { email, password, imapHost = 'outlook.office365.com' } = req.body as {
    email: string; password: string; imapHost?: string;
  };
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const client = new ImapFlow({
    host: imapHost, port: 993, secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

setupRouter.post('/', (req, res) => {
  const { email, password, apiKey, imapHost = 'outlook.office365.com', mailbox = 'INBOX' } = req.body as {
    email: string; password: string; apiKey: string; imapHost?: string; mailbox?: string;
  };
  if (!email || !password || !apiKey) {
    return res.status(400).json({ error: 'email, password and apiKey are required' });
  }
  saveRuntimeConfig({ email, password, apiKey, imapHost, mailbox });
  res.json({ ok: true });
});
