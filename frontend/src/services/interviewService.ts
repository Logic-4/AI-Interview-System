import api from './api';
import { Interview, PopulatedInterview, CreateInterviewPayload, SubmitAnswerPayload, SubmitAnswerResponse, InterviewListParams } from '@/types/interview';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const interviewService = {
  async createInterview(payload: CreateInterviewPayload): Promise<PopulatedInterview> {
    const res = await api.post<ApiResponse<{ interview: PopulatedInterview }>>('/interviews', payload);
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

  async startInterview(id: string): Promise<PopulatedInterview> {
    const res = await api.put<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/start`);
    return res.data.data.interview;
  },

  async submitAnswer(interviewId: string, questionId: string, payload: SubmitAnswerPayload): Promise<SubmitAnswerResponse> {
    const formData = new FormData();
    if (payload.userAnswer !== undefined) formData.append('userAnswer', payload.userAnswer);
    if (payload.timeSpent !== undefined) formData.append('timeSpent', String(payload.timeSpent));
    if (payload.audio) formData.append('audio', payload.audio);

    const res = await api.put<ApiResponse<SubmitAnswerResponse>>(
      `/interviews/${interviewId}/questions/${questionId}/answer`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },

  async completeInterview(id: string): Promise<Interview> {
    const res = await api.put<ApiResponse<{ interview: Interview }>>(`/interviews/${id}/complete`);
    return res.data.data.interview;
  },

  async deleteInterview(id: string): Promise<void> {
    await api.delete(`/interviews/${id}`);
  },
};

export default interviewService;
