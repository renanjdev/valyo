import { Router } from 'express';
import { emailState } from '../../shared-state.js';

export const emailsRouter = Router();

emailsRouter.get('/', (req, res) => {
  const runId = (req.query.runId as string) ?? emailState.getLatestRunId();
  if (!runId) return res.json([]);

  const emails = emailState.getByRunId(runId).map((e) => ({
    id: e.email_id,
    subject: e.subject,
    sender: e.sender,
    date: e.date,
    classificacao: e.classificacao,
    resumo: e.resumo,
    status: e.status,
    note: e.note,
    run_id: e.run_id,
    extracted: e.extracted_data
      ? (() => { try { return JSON.parse(e.extracted_data!); } catch { return null; } })()
      : null,
  }));

  res.json(emails);
});

emailsRouter.post('/:id/decision', (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body as { action: 'approve' | 'ignore'; note?: string };

  if (!['approve', 'ignore'].includes(action)) {
    return res.status(400).json({ error: 'action must be approve or ignore' });
  }

  if (action === 'approve') {
    emailState.approve(id, { note });
  } else {
    emailState.ignore(id);
  }

  res.json({ ok: true });
});
