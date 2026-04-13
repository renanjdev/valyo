import { join } from 'path';
import { EmailStateStore } from './state/email-state.js';
import { UidTracker } from './state/uid-tracker.js';
import { RunManager } from './state/run-manager.js';
import { config } from './config.js';

export const emailState = new EmailStateStore(join(config.storage.dataDir, 'emails.db'));
export const uidTracker = new UidTracker(join(config.storage.dataDir, 'uids.db'));
export const runManager = new RunManager();
