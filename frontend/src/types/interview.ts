export type InterviewType = 'technical' | 'behavioral' | 'system-design' | 'hr' | 'mixed';
export type InterviewDifficulty = 'junior' | 'mid' | 'senior' | 'lead';
export type InterviewDomain = 'technology' | 'healthcare' | 'finance' | 'engineering' | 'education' | 'legal';
export type InterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface Interview {
  _id: string;
  user: string;
  title: string;
  type: InterviewType;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
  language: InterviewLanguage;
  status: InterviewStatus;
  questions: string[];
  duration: number;
  jobRole?: string;
  focusSkills?: string[];
  jobDescription?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  overallScore: number | null;
  recordingUrl?: string;
  transcription?: string;
  aiModel?: string;
  tags?: string[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PopulatedInterview extends Omit<Interview, 'questions'> {
  questions: import('./question').Question[];
  feedback?: import('./feedback').Feedback;
}

export type InterviewLanguage = 'english' | 'somali';

export interface CreateInterviewPayload {
  title: string;
  type: InterviewType;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
  language?: InterviewLanguage;
  duration?: number;
  jobRole?: string;
  focusSkills?: string[];
  jobDescription?: string;
  scheduledAt?: string;
  questionCount?: number;
  tags?: string[];
}

export interface SubmitAnswerPayload {
  userAnswer?: string;
  timeSpent?: number;
  audio?: File;
}

export interface AnswerEvaluation {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestedAnswer: string;
}

export interface SubmitAnswerResponse {
  question: import('./question').Question;
  evaluation: AnswerEvaluation;
  followUpText?: string | null;
  isFollowUp?: boolean;
  isTimeUp?: boolean;
}

export interface InterviewListParams {
  page?: number;
  limit?: number;
  status?: InterviewStatus;
  type?: InterviewType;
  domain?: InterviewDomain;
  difficulty?: InterviewDifficulty;
}
