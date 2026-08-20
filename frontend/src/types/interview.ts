export type InterviewDifficulty = 'junior' | 'mid' | 'senior' | 'lead';
export type InterviewDomain = 'technology';

export type InterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type InterviewWarmupPhase = 'idle' | 'warming' | 'ready' | 'failed';

export interface InterviewWarmupServiceState {
  status: InterviewWarmupPhase;
  startedAt: string | null;
  completedAt: string | null;
  readyUntil: string | null;
  error: string | null;
}

export interface InterviewWarmupStatus {
  status: InterviewWarmupPhase;
  ttlMs: number;
  started?: boolean;
  services: {
    gemma: InterviewWarmupServiceState;
    speech: InterviewWarmupServiceState;
  };
}

export interface Interview {
  _id: string;
  user: string;
  company?: string | null;
  title: string;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
  language: InterviewLanguage;
  status: InterviewStatus;
  questions: string[];
  duration: number;
  jobRole?: string;
  focusSkills?: string[];
  jobDescription?: string;
  resumeText?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  overallScore: number | null;
  recordingUrl?: string;
  recordingStatus?: 'none' | 'recording' | 'processing' | 'ready' | 'failed';
  transcription?: string;
  aiModel?: string;
  tags?: string[];
  isDeleted?: boolean;
  proctoring?: InterviewProctoring;
  createdAt: string;
  updatedAt: string;
}

export interface PopulatedInterview extends Omit<Interview, 'questions'> {
  questions: import('./question').Question[];
  feedback?: import('./feedback').Feedback;
  questionsReady?: boolean;
  expectedQuestionCount?: number;
  generationStatus?: 'queued' | 'generating-first' | 'generating-remaining' | 'ready' | 'partial' | 'failed';
  generationError?: string;
  firstQuestionReadyAt?: string;
  generationCompletedAt?: string;
}

export type InterviewLanguage = 'english' | 'somali';

export type IdentityVerificationOutcome =
  | 'passed'
  | 'failed'
  | 'no_face'
  | 'multiple_faces'
  | 'no_reference'
  | 'provider_error';

export interface IdentityVerificationStatus {
  required: boolean;
  status: 'not_required' | 'pending' | 'passed' | 'failed' | 'blocked';
  provider: string;
  threshold: number | null;
  similarity: number | null;
  attempts: number;
  hasReferenceImage: boolean;
  referenceImageUrl: string;
  referenceSource: 'application' | 'avatar' | 'none';
  lastReason: string;
  verifiedAt: string | null;
}

export interface IdentityVerificationResult {
  verification: IdentityVerificationStatus;
  outcome: IdentityVerificationOutcome;
  passed: boolean;
  message: string;
}

export interface CreateInterviewPayload {
  title: string;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
  language?: InterviewLanguage;
  duration?: number;
  jobRole?: string;
  focusSkills?: string[];
  jobDescription?: string;
  resumeText?: string;
  scheduledAt?: string;
  questionCount?: number;
  tags?: string[];
}

export interface SubmitAnswerPayload {
  userAnswer?: string;
  timeSpent?: number;
  audio?: File | Blob;
  activePromptText?: string;
}

export interface AnswerEvaluation {
  score: number | null;
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestedAnswer: string;
  evaluationStatus?: import('./question').EvaluationStatus;
}

export interface SubmitAnswerResponse {
  question: import('./question').Question;
  evaluation: AnswerEvaluation;
  followUpText?: string | null;
  isFollowUp?: boolean;
  isTimeUp?: boolean;
  answeredCandidateQuestion?: boolean;
}

export type ProctoringViolationType =
  | 'tab_switch'
  | 'window_blur'
  | 'gaze_away'
  | 'face_not_detected';

export interface ProctoringViolationRecord {
  type: ProctoringViolationType;
  timestamp: string;
  details: string;
  strike: number | null;
}

export interface InterviewProctoring {
  enabled: boolean;
  strikes: number;
  integrityScore: number;
  violations: ProctoringViolationRecord[];
  flaggedForReview: boolean;
}

export interface ReportProctoringEventPayload {
  type: ProctoringViolationType;
  details?: string;
  strike?: number;
}

export interface ReportProctoringEventResponse {
  strikes: number;
  integrityScore: number;
  flaggedForReview: boolean;
}

export interface InterviewListParams {
  page?: number;
  limit?: number;
  status?: InterviewStatus;
  domain?: InterviewDomain;
  difficulty?: InterviewDifficulty;
  search?: string;
}
