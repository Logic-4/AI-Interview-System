import { create } from 'zustand';
import { PopulatedInterview } from '@/types/interview';
import { Question } from '@/types/question';

interface InterviewState {
  activeInterview: PopulatedInterview | null;
  currentQuestionIndex: number;
  sessionId: string | null;
  timeElapsed: number;
  isSessionActive: boolean;
  answeredQuestions: Record<string, Question>;
  setActiveInterview: (interview: PopulatedInterview | null) => void;
  setCurrentQuestionIndex: (index: number) => void;
  nextQuestion: () => void;
  setSessionId: (id: string | null) => void;
  setTimeElapsed: (seconds: number) => void;
  setSessionActive: (active: boolean) => void;
  recordAnswer: (questionId: string, question: Question) => void;
  resetSession: () => void;
}

export const useInterviewStore = create<InterviewState>()((set, get) => ({
  activeInterview: null,
  currentQuestionIndex: 0,
  sessionId: null,
  timeElapsed: 0,
  isSessionActive: false,
  answeredQuestions: {},
  setActiveInterview: (interview) => set({ activeInterview: interview }),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  nextQuestion: () => {
    const { activeInterview, currentQuestionIndex } = get();
    const total = activeInterview?.questions.length ?? 0;
    if (currentQuestionIndex < total - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },
  setSessionId: (id) => set({ sessionId: id }),
  setTimeElapsed: (seconds) => set({ timeElapsed: seconds }),
  setSessionActive: (active) => set({ isSessionActive: active }),
  recordAnswer: (questionId, question) =>
    set((state) => ({
      answeredQuestions: { ...state.answeredQuestions, [questionId]: question },
    })),
  resetSession: () =>
    set({
      activeInterview: null,
      currentQuestionIndex: 0,
      sessionId: null,
      timeElapsed: 0,
      isSessionActive: false,
      answeredQuestions: {},
    }),
}));
