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
    // This endpoint re-evaluates every unscored answer before it writes the
    // report, so it can legitimately run for minutes on a busy model server.
    // The shared 30s default made "Regenerate" look broken: the request was
    // aborted client-side while the server went on to score the answers.
    const res = await api.post<ApiResponse<{ feedback: Feedback }>>(url, undefined, { timeout: 300000 });
    return res.data.data.feedback;
  },

  async getUserProgress(period: ProgressPeriod = '30d'): Promise<UserProgress> {
    const res = await api.get<ApiResponse<UserProgress>>('/feedback/progress', { params: { period } });
    return res.data.data;
  },
};

export default feedbackService;
