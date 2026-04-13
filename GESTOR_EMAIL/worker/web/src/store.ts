import { create } from 'zustand';
import type { Email, WorkerStatus, Report } from './types.ts';

interface AppStore {
  emails: Email[];
  selectedEmailId: string | null;
  workerStatus: WorkerStatus | null;
  reports: Report[];
  currentReport: { id: string; text: string; hasPdf: boolean } | null;

  setEmails: (emails: Email[]) => void;
  setSelectedEmailId: (id: string | null) => void;
  setWorkerStatus: (status: WorkerStatus) => void;
  setReports: (reports: Report[]) => void;
  setCurrentReport: (report: { id: string; text: string; hasPdf: boolean } | null) => void;
  updateEmailStatus: (id: string, status: Email['status']) => void;
}

export const useStore = create<AppStore>((set) => ({
  emails: [],
  selectedEmailId: null,
  workerStatus: null,
  reports: [],
  currentReport: null,

  setEmails: (emails) => set({ emails, selectedEmailId: emails[0]?.id ?? null }),
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  setWorkerStatus: (workerStatus) => set({ workerStatus }),
  setReports: (reports) => set({ reports }),
  setCurrentReport: (currentReport) => set({ currentReport }),
  updateEmailStatus: (id, status) =>
    set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, status } : e)) })),
}));
