import api from './api';
import { QuestionBankItem, QuestionBankListParams, GenerateQuestionsPayload } from '@/types/question';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const questionService = {
  async getQuestions(params?: QuestionBankListParams): Promise<{ questions: QuestionBankItem[]; pagination: PaginatedResponse<QuestionBankItem>['pagination'] }> {
    const res = await api.get<PaginatedResponse<QuestionBankItem>>('/questions', { params });
    return { questions: res.data.data, pagination: res.data.pagination };
  },

  async getQuestion(id: string): Promise<QuestionBankItem> {
    const res = await api.get<ApiResponse<{ question: QuestionBankItem }>>(`/questions/${id}`);
    return res.data.data.question;
  },

  async createQuestion(payload: Omit<QuestionBankItem, '_id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<QuestionBankItem> {
    const res = await api.post<ApiResponse<{ question: QuestionBankItem }>>('/questions', payload);
    return res.data.data.question;
  },

  async updateQuestion(id: string, payload: Partial<QuestionBankItem>): Promise<QuestionBankItem> {
    const res = await api.put<ApiResponse<{ question: QuestionBankItem }>>(`/questions/${id}`, payload);
    return res.data.data.question;
  },

  async deleteQuestion(id: string): Promise<void> {
    await api.delete(`/questions/${id}`);
  },

  async generateQuestions(payload: GenerateQuestionsPayload): Promise<QuestionBankItem[]> {
    const res = await api.post<ApiResponse<{ questions: QuestionBankItem[] }>>('/questions/generate', payload);
    return res.data.data.questions;
  },
};

export default questionService;
