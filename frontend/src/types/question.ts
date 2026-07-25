export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionCategory = string;
export type EvaluationStatus = 'pending' | 'completed' | 'failed' | 'invalid';

export interface RetryAttempt {
  answer: string;
  score: number | null;
  feedback: string;
  strengths?: string[];
  improvements?: string[];
  suggestedAnswer?: string;
  createdAt: string;
}

export interface Question {
  _id: string;
  interview: string;
  text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expectedAnswer?: string;
  userAnswer?: string;
  audioUrl?: string;
  score: number | null;
  evaluationStatus: EvaluationStatus;
  aiFeedback?: string;
  timeSpent: number;
  order: number;
  isAnswered: boolean;
  retryAnswers?: RetryAttempt[];
  createdAt?: string;
  updatedAt?: string;
}
