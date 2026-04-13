import { Router } from 'express';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { emailState, runManager } from '../../shared-state.js';
import { generateATA } from '../../pipeline/ata-generator.js';
import { config } from '../../config.js';
import type { ExtractedEmail } from '../../types/pipeline.js';

const execAsync = promisify(exec);
export const reportsRouter = Router();

reportsRouter.get('/', (_req, res) => {
  const outputBase = resolve(config.storage.outputDir);
  if (!existsSync(outputBase)) return res.json([]);

  const reports = readdirSync(outputBase, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      id: d.name,
      hasPdf: existsSync(join(outputBase, d.name, 'v1', 'relatorio-diario.pdf')),
    }))
    .reverse();

  res.json(reports);
});

reportsRouter.post('/generate', async (req, res) => {
  const runId = (req.body?.runId as string) ?? emailState.getLatestRunId();
  if (!runId) return res.status(400).json({ error: 'No run to generate report for' });

  const allRows = emailState.getByRunId(runId);
  const pending = allRows.filter((e) => e.status === 'pending');
  if (pending.length > 0) {
    return res.status(409).json({ error: `${pending.length} emails still pending decision` });
  }

  const approved = allRows.filter((e) => e.status === 'approved');
  if (approved.length === 0) {
    return res.status(400).json({ error: 'No approved emails in this run' });
  }

  const extractedEmails: ExtractedEmail[] = approved
    .map((row) => {
      if (!row.extracted_data) return null;
      try { return JSON.parse(row.extracted_data) as ExtractedEmail; } catch { return null; }
    })
    .filter((e): e is ExtractedEmail => e !== null);

  if (extractedEmails.length === 0) {
    return res.status(500).json({ error: 'Could not parse extracted email data from DB' });
  }

  try {
    const date = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const ataText = await generateATA(extractedEmails, date);

    const outputBase = resolve(config.storage.outputDir);
    const runDir = join(outputBase, runId, 'v1');
    runManager.writeOutput(runDir, 'ata-diaria.md', ataText);

    const pyScript = join(runDir, 'generate-pdf.py');
    if (existsSync(pyScript)) {
      try {
        await execAsync(`python "${pyScript}"`, { cwd: runDir, timeout: 60000 });
      } catch {
        // PDF failure is non-fatal
      }
    }

    emailState.markIncludedInAta(approved.map((r) => r.email_id), runId);

    res.json({
      ok: true,
      reportId: runId,
      text: ataText,
      hasPdf: existsSync(join(runDir, 'relatorio-diario.pdf')),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

reportsRouter.get('/:id/pdf', (req, res) => {
  const pdfPath = resolve(join(config.storage.outputDir, req.params.id, 'v1', 'relatorio-diario.pdf'));
  if (!existsSync(pdfPath)) return res.status(404).json({ error: 'PDF not found' });
  res.download(pdfPath, `relatorio-${req.params.id}.pdf`);
});
