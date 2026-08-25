export interface CfProgramDetailAnswer {
  fieldId: string;
  label: string;
  type?: string;
  value: unknown;
}

export interface CfProgramDetailAnswerGroup {
  id: string;
  title: string;
  submittedAt: Date | null;
  answers: CfProgramDetailAnswer[];
}

export interface CfProgramDetailForm {
  id: string;
  formId: string;
  templateName: string;
  status: string;
  dueAt: Date | null;
  dueDate: string | null;
  sentAt: Date | null;
  openedAt: Date | null;
  submittedAt: Date | null;
  answers: CfProgramDetailAnswer[];
}

export interface CfProgramDetailResponse {
  program: Record<string, unknown>;
  summary: {
    current: number;
    completed: number;
    closed: number;
  };
  participants: Array<{
    client: {
      id: string;
      businessName: string;
      primaryContactName: string;
      email: string;
      phone: string;
    };
    enrollment: Record<string, unknown>;
    coreIntake: CfProgramDetailAnswerGroup[];
    programIntake: CfProgramDetailAnswerGroup[];
    forms: CfProgramDetailForm[];
    terms: Record<string, unknown>[];
    contracts: Record<string, unknown>[];
    monitoring: Record<string, unknown>[];
  }>;
}