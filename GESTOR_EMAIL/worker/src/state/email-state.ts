import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

export type EmailStatus = 'pending' | 'approved' | 'ignored';

export interface EmailStateRow {
  email_id: string;
  uid: number;
  mailbox: string;
  subject: string;
  sender: string;
  date: string;
  classificacao: string;
  resumo: string;
  status: EmailStatus;
  user_edited: boolean;
  edited_resumo: string | null;
  user_observation: string | null;
  included_in_ata: boolean;
  ata_run_id: string | null;
  run_id: string;
  extracted_data: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export class EmailStateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_state (
        email_id TEXT PRIMARY KEY,
        uid INTEGER NOT NULL,
        mailbox TEXT NOT NULL,
        subject TEXT NOT NULL,
        sender TEXT NOT NULL,
        date TEXT NOT NULL,
        classificacao TEXT NOT NULL,
        resumo TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        user_edited INTEGER NOT NULL DEFAULT 0,
        edited_resumo TEXT,
        user_observation TEXT,
        included_in_ata INTEGER NOT NULL DEFAULT 0,
        ata_run_id TEXT,
        run_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_status ON email_state(status);
      CREATE INDEX IF NOT EXISTS idx_run_id ON email_state(run_id);
      CREATE INDEX IF NOT EXISTS idx_uid_mailbox ON email_state(uid, mailbox);
    `);

    const cols = (this.db.prepare('PRAGMA table_info(email_state)').all() as Array<{ name: string }>);
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('extracted_data')) {
      this.db.exec('ALTER TABLE email_state ADD COLUMN extracted_data TEXT');
    }
    if (!colNames.has('note')) {
      this.db.exec('ALTER TABLE email_state ADD COLUMN note TEXT');
    }

    logger.debug('Email state store initialized');
  }

  savePending(emails: Array<{
    email_id: string;
    uid: number;
    mailbox: string;
    subject: string;
    sender: string;
    date: string;
    classificacao: string;
    resumo: string;
    run_id: string;
    extracted_data?: string | null;
  }>): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO email_state
        (email_id, uid, mailbox, subject, sender, date, classificacao, resumo,
         status, user_edited, included_in_ata, run_id, extracted_data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((items: typeof emails) => {
      const now = new Date().toISOString();
      for (const e of items) {
        insert.run(e.email_id, e.uid, e.mailbox, e.subject, e.sender, e.date, e.classificacao, e.resumo, e.run_id, e.extracted_data ?? null, now, now);
      }
    });

    tx(emails);
    logger.info({ count: emails.length }, 'Emails saved as pending');
  }

  approve(emailId: string, opts?: { editedResumo?: string; observation?: string; note?: string }): void {
    const now = new Date().toISOString();
    const edited = opts?.editedResumo !== undefined;

    this.db.prepare(`
      UPDATE email_state SET
        status = 'approved', user_edited = ?, edited_resumo = ?,
        user_observation = ?, note = ?, updated_at = ?
      WHERE email_id = ?
    `).run(edited ? 1 : 0, opts?.editedResumo || null, opts?.observation || null, opts?.note || null, now, emailId);
  }

  ignore(emailId: string): void {
    this.db.prepare(`
      UPDATE email_state SET status = 'ignored', updated_at = ? WHERE email_id = ?
    `).run(new Date().toISOString(), emailId);
  }

  markIncludedInAta(emailIds: string[], ataRunId: string): void {
    const stmt = this.db.prepare(`
      UPDATE email_state SET included_in_ata = 1, ata_run_id = ?, updated_at = ? WHERE email_id = ?
    `);

    const tx = this.db.transaction((ids: string[]) => {
      const now = new Date().toISOString();
      for (const id of ids) {
        stmt.run(ataRunId, now, id);
      }
    });

    tx(emailIds);
  }

  getPending(): EmailStateRow[] {
    return this.db.prepare(
      "SELECT * FROM email_state WHERE status = 'pending' ORDER BY created_at ASC"
    ).all() as EmailStateRow[];
  }

  getApprovedNotInAta(): EmailStateRow[] {
    return this.db.prepare(
      "SELECT * FROM email_state WHERE status = 'approved' AND included_in_ata = 0 ORDER BY created_at ASC"
    ).all() as EmailStateRow[];
  }

  getByRunId(runId: string): EmailStateRow[] {
    return this.db.prepare(
      'SELECT * FROM email_state WHERE run_id = ? ORDER BY created_at ASC'
    ).all(runId) as EmailStateRow[];
  }

  getStats(): { total: number; pending: number; approved: number; ignored: number; inAta: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored,
        SUM(CASE WHEN included_in_ata = 1 THEN 1 ELSE 0 END) as inAta
      FROM email_state
    `).get() as { total: number; pending: number; approved: number; ignored: number; inAta: number };

    return row;
  }

  getLatestRunId(): string | null {
    const row = this.db.prepare(
      'SELECT run_id FROM email_state ORDER BY created_at DESC LIMIT 1'
    ).get() as { run_id: string } | undefined;
    return row?.run_id ?? null;
  }

  close(): void {
    this.db.close();
    logger.debug('Email state store closed');
  }
}
