import { create } from 'zustand';
export const useStore = create((set) => ({
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
    updateEmailStatus: (id, status) => set((s) => ({ emails: s.emails.map((e) => (e.id === id ? { ...e, status } : e)) })),
}));
