export type InterviewType = 'technical' | 'behavioral' | 'system-design' | 'hr' | 'mixed';
export type InterviewDifficulty = 'junior' | 'mid' | 'senior' | 'lead';
export type InterviewDomain =
  | 'frontend' | 'backend' | 'fullstack' | 'devops'
  | 'data-science' | 'mobile' | 'cloud' | 'security' | 'qa-testing' | 'ai-ml'
  | 'healthcare' | 'finance' | 'marketing' | 'sales'
  | 'human-resources' | 'education' | 'legal'
  | 'engineering' | 'creative' | 'operations'
  | 'customer-service' | 'management' | 'general';
export type InterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface Interview {
  _id: string;
  user: string;
  title: string;
  type: InterviewType;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
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

export interface CreateInterviewPayload {
  title: string;
  type: InterviewType;
  difficulty: InterviewDifficulty;
  domain: InterviewDomain;
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

export interface SubmitAnswerResponse {
  question: import('./question').Question;
  evaluation: {
    score: number;
    feedback: string;
    strengths?: string[];
    improvements?: string[];
    suggestedAnswer?: string;
  };
}

export interface InterviewListParams {
  page?: number;
  limit?: number;
  status?: InterviewStatus;
  type?: InterviewType;
  domain?: InterviewDomain;
  difficulty?: InterviewDifficulty;
}
