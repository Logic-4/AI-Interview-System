export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionCategory = 'technical' | 'behavioral' | 'system-design' | 'mixed';

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
  aiFeedback?: string;
  timeSpent: number;
  order: number;
  isAnswered: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionBankItem {
  _id: string;
  text: string;
  category: string;
  domain: string;
  difficulty: QuestionDifficulty;
  type: QuestionCategory;
  sampleAnswer?: string;
  tags?: string[];
  usageCount?: number;
  isActive?: boolean;
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionBankListParams {
  page?: number;
  limit?: number;
  domain?: string;
  difficulty?: QuestionDifficulty;
  type?: QuestionCategory;
  search?: string;
}

export interface GenerateQuestionsPayload {
  type: QuestionCategory;
  domain: string;
  difficulty: QuestionDifficulty;
  count: number;
}
