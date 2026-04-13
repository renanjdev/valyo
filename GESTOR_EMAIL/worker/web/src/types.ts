export interface Email {
  id: string;
  subject: string;
  sender: string;
  date: string;
  classificacao: string;
  resumo: string;
  status: 'pending' | 'approved' | 'ignored';
  note: string | null;
  run_id: string;
  extracted: ExtractedData | null;
}

export interface ExtractedData {
  pontos_importantes?: string[];
  possiveis_acoes?: string[];
  clareza?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    content: string | null;
    extraction_note: string | null;
  }>;
}

export interface WorkerStatus {
  status: 'idle' | 'running' | 'error';
  lastRun: string | null;
  lastError: string | null;
  log: Array<{ time: string; level: string; msg: string }>;
}

export interface Report {
  id: string;
  hasPdf: boolean;
}
