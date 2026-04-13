import { processCycle } from '../index.js';
import { getLogs } from '../utils/log-buffer.js';

export type WorkerStatus = 'idle' | 'running' | 'error';

let status: WorkerStatus = 'idle';
let lastRun: string | null = null;
let lastError: string | null = null;
let cycleTimeout: ReturnType<typeof setTimeout> | null = null;

export function getWorkerStatus() {
  return {
    status,
    lastRun,
    lastError,
    log: getLogs().slice(-20),
  };
}

export async function startManualCycle(): Promise<void> {
  if (status === 'running') return;

  status = 'running';
  lastError = null;

  cycleTimeout = setTimeout(() => {
    status = 'error';
    lastError = 'Timeout: cycle took more than 5 minutes';
  }, 5 * 60 * 1000);

  try {
    await processCycle();
    lastRun = new Date().toISOString();
    status = 'idle';
  } catch (err) {
    status = 'error';
    lastError = err instanceof Error ? err.message : String(err);
    lastRun = new Date().toISOString();
  } finally {
    if (cycleTimeout) clearTimeout(cycleTimeout);
  }
}
