import api from './api';
import { Interview, PopulatedInterview, CreateInterviewPayload, SubmitAnswerPayload, SubmitAnswerResponse, AnswerEvaluation, InterviewListParams, InterviewWarmupStatus, IdentityVerificationStatus, IdentityVerificationResult, ReportProctoringEventPayload, ReportProctoringEventResponse } from '@/types/interview';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const interviewService = {
  async startInterviewWarmup(force = false, language?: 'english' | 'somali'): Promise<InterviewWarmupStatus> {
    const res = await api.post<ApiResponse<{ warmup: InterviewWarmupStatus }>>(
      '/interviews/warmup',
      undefined,
      { params: { ...(force ? { force: true } : {}), ...(language ? { language } : {}) } }
    );
    return res.data.data.warmup;
  },

  async getInterviewWarmupStatus(signal?: AbortSignal): Promise<InterviewWarmupStatus> {
    const res = await api.get<ApiResponse<{ warmup: InterviewWarmupStatus }>>(
      '/interviews/warmup',
      { signal }
    );
    return res.data.data.warmup;
  },

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

  async getIdentityStatus(id: string): Promise<IdentityVerificationStatus> {
    const res = await api.get<ApiResponse<{ verification: IdentityVerificationStatus }>>(`/interviews/${id}/identity`);
    return res.data.data.verification;
  },

  async verifyIdentity(id: string, frame: Blob): Promise<IdentityVerificationResult> {
    const formData = new FormData();
    formData.append('frame', frame, 'frame.jpg');
    try {
      const res = await api.post<ApiResponse<IdentityVerificationResult>>(
        `/interviews/${id}/identity/verify`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data.data;
    } catch (err: any) {
      // 4xx responses may still carry a structured verification payload the UI needs to render.
      if (err?.response?.data?.data) {
        return err.response.data.data as IdentityVerificationResult;
      }
      throw err;
    }
  },

  async uploadRecordingChunk(interviewId: string, index: number, chunk: Blob): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk, `chunk_${index}.webm`);
    formData.append('index', String(index));
    await api.post(`/interviews/${interviewId}/recording/chunk`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
      // Evaluation can take longer than the shared 30s default. The backend's
      // own worst case is INTERVIEW_TURN_TIMEOUT_MS (45s) x 2 attempts + a
      // 1.5s retry backoff = ~91.5s — this must stay above that, or axios
      // times out while the server is still processing, and the client's
      // retry-on-failure below fires a second, duplicate evaluation call for
      // the same answer.
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 100000 }
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
      `/interviews/${interviewId}/questions/${questionId}/evaluate`,
      undefined,
      // One evaluation legitimately takes ~25-45s on the model server (the
      // backend's own INTERVIEW_TURN_TIMEOUT_MS is 45s, and Somali has been
      // measured at 77s). The shared 30s default aborted the request at the
      // exact moment the server was writing a successful score, so "Retry
      // evaluation" reported failure for work that had actually succeeded.
      { timeout: 150000 }
    );
    return res.data.data;
  },

  async completeInterview(id: string): Promise<Interview> {
    // Completion waits for any still-running background evaluations and
    // retries the failed ones before averaging, so it can outlast the shared
    // 30s default. It is idempotent, so a client-side abort is recoverable —
    // but aborting means the caller never learns the final score.
    const res = await api.put<ApiResponse<{ interview: Interview }>>(
      `/interviews/${id}/complete`,
      undefined,
      { timeout: 180000 }
    );
    return res.data.data.interview;
  },

  async resetInterview(id: string): Promise<PopulatedInterview> {
    const res = await api.put<ApiResponse<{ interview: PopulatedInterview }>>(`/interviews/${id}/reset`);
    return res.data.data.interview;
  },

  async deleteInterview(id: string): Promise<void> {
    await api.delete(`/interviews/${id}`);
  },

  async reportProctoringEvent(
    id: string,
    payload: ReportProctoringEventPayload
  ): Promise<ReportProctoringEventResponse> {
    const res = await api.post<{ data: ReportProctoringEventResponse }>(
      `/interviews/${id}/proctoring/event`,
      payload
    );
    return res.data.data;
  },
};

export default interviewService;
