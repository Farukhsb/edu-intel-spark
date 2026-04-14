export type CommunicationCategory =
  | "feedback-summary"
  | "at-risk-alert"
  | "grade-released"
  | "intervention-follow-up";

export interface CommunicationMessage {
  id: string;
  createdAt: string;
  category: CommunicationCategory;
  recipientName: string;
  recipientEmail: string | null;
  subject: string;
  body: string;
  relatedStudentId?: string;
  relatedAssignmentId?: string;
}

const STORAGE_KEY = "gradeai.communicationOutbox";

export const loadCommunicationOutbox = (): CommunicationMessage[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CommunicationMessage[];
  } catch {
    return [];
  }
};

export const saveCommunicationOutbox = (messages: CommunicationMessage[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
};

export const queueCommunicationMessage = (
  message: Omit<CommunicationMessage, "id" | "createdAt">
) => {
  const nextMessage: CommunicationMessage = {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const current = loadCommunicationOutbox();
  saveCommunicationOutbox([nextMessage, ...current].slice(0, 50));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gradeai:communications-updated"));
  }
  return nextMessage;
};
