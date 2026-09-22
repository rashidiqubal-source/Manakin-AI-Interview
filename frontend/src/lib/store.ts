import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EvaluationResult {
  clarity: { score: number; reasoning: string };
  warmth: { score: number; reasoning: string };
  patience: { score: number; reasoning: string };
  simplicity: { score: number; reasoning: string };
  fluency: { score: number; reasoning: string };
  engagement: { score: number; reasoning: string };
  overallRecommendation: string;
  evidenceQuotes: string[];
  teachingStyle?: string;
  riskFlags?: string[];
  keyHighlights?: string[];
  consistencyAnalysis?: string;
  communicationStyleAnalysis?: {
    structure: string;
    examplesUsed: boolean;
    stepByStep: boolean;
  };
}

interface InterviewState {
  candidateName: string;
  sessionId: string | null;
  invitationToken: string | null;
  activeInvitationId: string | null;
  messages: ChatMessage[];
  evaluation: EvaluationResult | null;
  
  setCandidateName: (name: string) => void;
  setSessionId: (id: string) => void;
  setInvitationToken: (token: string | null) => void;
  setActiveInvitationId: (id: string | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setEvaluation: (evalData: EvaluationResult) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  candidateName: '',
  sessionId: null,
  invitationToken: null,
  activeInvitationId: null,
  messages: [],
  evaluation: null,

  setCandidateName: (name) => set({ candidateName: name }),
  setSessionId: (id) => set({ sessionId: id }),
  setInvitationToken: (token) => set({ invitationToken: token }),
  setActiveInvitationId: (id) => set({ activeInvitationId: id }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setEvaluation: (evalData) => set({ evaluation: evalData }),
  reset: () => set({ candidateName: '', sessionId: null, invitationToken: null, activeInvitationId: null, messages: [], evaluation: null }),
}));
