import api from './api';
import { Interview, PopulatedInterview, CreateInterviewPayload, SubmitAnswerPayload, SubmitAnswerResponse, AnswerEvaluation, InterviewListParams } from '@/types/interview';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const interviewService = {
  async createInterview(payload: CreateInterviewPayload, idempotencyKey?: string): Promise<PopulatedInterview> {
    const res = await api.post<ApiResponse<{ interview: PopulatedInterview }>>('/interviews', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
    return res.data.data.interview;
  },

  async getInterviews(params?: InterviewListParams): Promise<{ interviews: Interview[]; pagination: PaginatedResponse<Interview>['pagination'] }> {
    const res = await api.get<PaginatedResponse<Interview>>('/interviews', { params });
    return { interviews: res.data.data, pagination: res.data.pagination };
  },

  async getInterview(id: string): Promise<PopulatedInterview> {
    const res = await api.get<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}`);
    return res.data.data.interview;
  },

  async getInterviewProgress(id: string, signal?: AbortSignal): Promise<PopulatedInterview> {
    const res = await api.get<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/progress`, { signal });
    return res.data.data.interview;
  },

  async retryQuestionGeneration(id: string): Promise<PopulatedInterview> {
    const res = await api.post<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/retry-generation`);
    return res.data.data.interview;
  },

  async startInterview(id: string): Promise<PopulatedInterview> {
    const res = await api.put<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/start`);
    return res.data.data.interview;
  },

  async submitAnswer(interviewId: string, questionId: string, payload: SubmitAnswerPayload): Promise<SubmitAnswerResponse> {
    const formData = new FormData();
    if (payload.userAnswer !== undefined) formData.append('userAnswer', payload.userAnswer);
    if (payload.timeSpent !== undefined) formData.append('timeSpent', String(payload.timeSpent));
    if (payload.activePromptText) formData.append('activePromptText', payload.activePromptText);
    if (payload.audio) {
      const filename = payload.audio instanceof File ? payload.audio.name : 'answer.webm';
      formData.append('audio', payload.audio, filename);
    }

    const res = await api.put<ApiResponse<SubmitAnswerResponse>>(
      `/interviews/${interviewId}/questions/${questionId}/answer`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },

  async retryEvaluate(interviewId: string, questionId: string, retryAnswer: string): Promise<{ evaluation: AnswerEvaluation }> {
    const res = await api.post<ApiResponse<{ evaluation: AnswerEvaluation }>>(
      `/interviews/${interviewId}/questions/${questionId}/retry`,
      { retryAnswer }
    );
    return res.data.data;
  },

  async reevaluateAnswer(interviewId: string, questionId: string): Promise<{ evaluation: AnswerEvaluation; question: import('@/types/question').Question }> {
    const res = await api.post<ApiResponse<{ evaluation: AnswerEvaluation; question: import('@/types/question').Question }>>(
      `/interviews/${interviewId}/questions/${questionId}/evaluate`
    );
    return res.data.data;
  },

  async completeInterview(id: string): Promise<Interview> {
    const res = await api.put<ApiResponse<{ interview: Interview }>>(`/interviews/${id}/complete`);
    return res.data.data.interview;
  },

  async resetInterview(id: string): Promise<PopulatedInterview> {
    const res = await api.put<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/reset`);
    return res.data.data.interview;
  },

  async deleteInterview(id: string): Promise<void> {
    await api.delete(`/interviews/${id}`);
  },
};

export default interviewService;
