import { config } from './config.js';
import { logger } from './utils/logger.js';
import { ImapClient } from './imap/client.js';
import { parseMessages } from './imap/parser.js';
import { classifyEmails } from './pipeline/classifier.js';
import { extractEmails } from './pipeline/extractor.js';
import { stringify } from 'yaml';
import { applyRuntimeConfig, isConfigured } from './state/runtime-config.js';
import { emailState, uidTracker, runManager } from './shared-state.js';
import { startWebServer } from './web/server.js';
const imapClient = new ImapClient();

let running = true;
let cycleCount = 0;

export async function processCycle(): Promise<void> {
  cycleCount++;
  const cycleLogger = logger.child({ cycle: cycleCount });

  if (!isConfigured()) {
    cycleLogger.info('Worker not configured — skipping cycle (use web UI to configure)');
    return;
  }

  cycleLogger.info('Poll cycle started');

  try {
    // 1. Connect
    await imapClient.connect();

    // 2. Get new UIDs
    const processedUIDs = uidTracker.getProcessedUIDs(config.imap.mailbox);
    const newUIDs = await imapClient.fetchNewUIDs(processedUIDs);

    if (newUIDs.length === 0) {
      cycleLogger.info('No new emails');
      await imapClient.disconnect();
      return;
    }

    cycleLogger.info({ count: newUIDs.length }, 'Processing new emails');

    // 3. Fetch raw messages
    const rawMessages = await imapClient.fetchMessages(newUIDs);

    // 4. Disconnect IMAP early
    await imapClient.disconnect();

    if (rawMessages.length === 0) {
      cycleLogger.warn('No messages fetched despite new UIDs');
      return;
    }

    // 5. Parse
    cycleLogger.info('Parsing emails...');
    const parsedEmails = await parseMessages(rawMessages);

    if (parsedEmails.length === 0) {
      cycleLogger.warn('All emails failed to parse');
      return;
    }

    // 6. Classify (rules-first, Claude only when needed)
    cycleLogger.info('Classifying emails...');
    const { emails: classifiedEmails, stats: classifyStats } = await classifyEmails(parsedEmails);

    // 7. Extract (Claude only for bodies >= 30 chars)
    cycleLogger.info('Extracting data...');
    const extractedEmails = await extractEmails(classifiedEmails);

    // 8. Save outputs as pending (NO ATA generation)
    const { runId, runDir } = runManager.createRun();

    const parsedYaml = stringify({
      total_emails: parsedEmails.length,
      parsed_at: new Date().toISOString(),
      emails: parsedEmails.map(({ uid, message_id, ...rest }) => rest),
    });

    const classifiedYaml = stringify({
      total_emails: classifiedEmails.length,
      classificados_por_regra: classifyStats.porRegra,
      classificados_por_ia: classifyStats.porIA,
      indefinidos: classifyStats.indefinidos,
      emails: classifiedEmails.map(({ uid, message_id, ...rest }) => rest),
    });

    const extractedYaml = stringify({
      total_emails: extractedEmails.length,
      emails: extractedEmails.map(({ uid, message_id, ...rest }) => rest),
    });

    runManager.writeOutput(runDir, 'parsed-emails.md', `\`\`\`yaml\n${parsedYaml}\`\`\``);
    runManager.writeOutput(runDir, 'classified-emails.md', `\`\`\`yaml\n${classifiedYaml}\`\`\``);
    runManager.writeOutput(runDir, 'extracted-data.md', `\`\`\`yaml\n${extractedYaml}\`\`\``);

    // 9. Save per-email state as pending
    emailState.savePending(
      extractedEmails.map((e) => ({
        email_id: `${runId}:${e.id}`,
        uid: e.uid,
        mailbox: config.imap.mailbox,
        subject: e.subject,
        sender: `${e.sender.name} <${e.sender.email}>`,
        date: e.date,
        classificacao: e.classificacao,
        resumo: e.resumo,
        run_id: runId,
        extracted_data: JSON.stringify(e),
      })),
    );

    // 10. Mark UIDs as processed
    uidTracker.markBatch(
      parsedEmails.map((e) => ({
        uid: e.uid,
        mailbox: config.imap.mailbox,
        message_id: e.message_id,
        subject: e.subject,
      })),
      runId,
    );

    const uidStats = uidTracker.getStats();
    const emailStats = emailState.getStats();
    cycleLogger.info(
      {
        runId,
        emailsProcessed: parsedEmails.length,
        classifyStats,
        savedAsPending: extractedEmails.length,
        totalPending: emailStats.pending,
        totalProcessedUIDs: uidStats.total,
      },
      'Cycle completed — emails saved as PENDING (awaiting user approval for ATA)',
    );
  } catch (err) {
    cycleLogger.error({ err }, 'Cycle failed');
    try { await imapClient.disconnect(); } catch { /* ignore */ }
  }
}

async function main(): Promise<void> {
  applyRuntimeConfig();
  await startWebServer(3030);

  const emailStats = emailState.getStats();

  logger.info(
    {
      host: config.imap.host,
      user: config.imap.user,
      mailbox: config.imap.mailbox,
      pollInterval: `${config.worker.pollIntervalMs / 1000}s`,
      maxBatch: config.worker.maxEmailsPerBatch,
      pendingEmails: emailStats.pending,
      approvedEmails: emailStats.approved,
    },
    'Email Processor Worker starting (human-in-the-loop mode)',
  );

  // Run first cycle immediately
  await processCycle();

  // Start polling loop
  const interval = setInterval(async () => {
    if (!running) return;
    await processCycle();
  }, config.worker.pollIntervalMs);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    running = false;
    clearInterval(interval);

    try { await imapClient.disconnect(); } catch { /* ignore */ }
    uidTracker.close();
    emailState.close();

    logger.info({ totalCycles: cycleCount }, 'Worker stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker crashed');
  process.exit(1);
});
