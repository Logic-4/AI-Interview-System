import api from './api';
import { Feedback, UserProgress, ProgressPeriod } from '@/types/feedback';
import { ApiResponse } from '@/types/api';

const feedbackService = {
  async getFeedback(interviewId: string): Promise<Feedback> {
    const res = await api.get<ApiResponse<{ feedback: Feedback }>>(`/feedback/${interviewId}`);
    return res.data.data.feedback;
  },

  async generateFeedback(interviewId: string, force = false): Promise<Feedback> {
    const url = force
      ? `/feedback/${interviewId}/generate?force=true`
      : `/feedback/${interviewId}/generate`;
    const res = await api.post<ApiResponse<{ feedback: Feedback }>>(url);
    return res.data.data.feedback;
  },

  async getUserProgress(period: ProgressPeriod = '30d'): Promise<UserProgress> {
    const res = await api.get<ApiResponse<UserProgress>>('/feedback/progress', { params: { period } });
    return res.data.data;
  },
};

export default feedbackService;
