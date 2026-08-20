export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type WorkplaceType = 'on-site' | 'remote' | 'hybrid';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';
export type JobStatus = 'draft' | 'published' | 'paused' | 'closed';
export type InterviewLanguage = 'English' | 'Somali';
export type ApplicationStatus = 'applied' | 'under_review' | 'interview_scheduled' | 'interviewed' | 'shortlisted' | 'rejected' | 'hired';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ResumeStatus = 'uploaded' | 'missing' | 'reviewed';
export type CompanyInterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type PassFailStatus = 'passed' | 'failed' | 'pending';

export interface Job {
  _id: string;
  company: string;
  createdBy: string;
  title: string;
  employmentType: EmploymentType;
  workplaceType: WorkplaceType;
  location: string;
  numberOfHiresNeeded: number;
  maxApplications?: number;
  applicationDeadline?: string;
  status: JobStatus;
  description: string;
  requiredSkills: string[];
  experienceLevel: ExperienceLevel;
  education?: string;
  requiredEducation?: string;
  interviewLanguage: InterviewLanguage;
  targetJobRole?: string;
  durationMinutes: number;
  focusSkills: string[];
  numberOfQuestions: number;
  resumeRequired: boolean;
  passingScoreThreshold: number;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type JobPayload = Omit<Job, '_id' | 'company' | 'createdBy' | 'createdAt' | 'updatedAt' | 'applicationCount'>;

export interface Application {
  _id: string;
  job: Job | string;
  company: string;
  candidate: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    skills?: string[];
    experienceLevel?: string;
  };
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  profilePhotoUrl?: string;
  resumeUrl?: string;
  resumeStatus: ResumeStatus;
  coverLetter?: string;
  selectedInterviewDate?: string;
  selectedInterviewTime?: string;
  appliedDate: string;
  status: ApplicationStatus;
  isShortlisted: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  interviewStatus: string;
  interview?: any;
  overallScore?: number | null;
  createdAt: string;
}

export interface CandidateSummary {
  _id: string;
  candidateId: string;
  name: string;
  email: string;
  phone?: string;
  appliedPosition: string;
  jobId?: string;
  interviewId?: string | null;
  experienceLevel: string;
  interviewScore?: number | null;
  status: ApplicationStatus;
  isShortlisted: boolean;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  appliedDate: string;
  avatar?: string;
  profilePhotoUrl?: string;
  resumeUrl?: string;
  resumeText?: string;
  skills?: string[];
}


export interface CompanyInterview {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  company: string;
  title: string;
  difficulty: string;
  language: string;
  jobRole: string;
  duration: number;
  scheduledAt?: string;
  status: CompanyInterviewStatus;
  overallScore?: number | null;
  recordingUrl?: string;
  recordingStatus?: 'none' | 'recording' | 'processing' | 'ready' | 'failed';
  feedback?: {
    overallScore?: number;
    summary?: string;
    strengths?: string[];
    improvements?: string[];
  };
  proctoring?: {
    enabled: boolean;
    strikes: number;
    integrityScore: number;
    flaggedForReview: boolean;
    violations?: ProctoringViolation[];
  };
  createdAt: string;
}

export type IdentityVerificationStatus = 'not_required' | 'pending' | 'passed' | 'failed' | 'blocked';
export type ProctoringViolationType = 'tab_switch' | 'window_blur' | 'gaze_away' | 'face_not_detected';

export interface QuestionEvaluation {
  order: number;
  text: string;
  category: string;
  score: number | null;
  aiFeedback: string;
  userAnswer: string;
}

export interface CategoryScoreEntry {
  score: number;
  feedback: string;
}

export interface ProctoringViolation {
  type: ProctoringViolationType;
  timestamp: string;
  details: string;
  strike: number | null;
}

export interface CompanyAssessment {
  _id: string;
  candidate: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
    skills?: string[];
  };
  candidateName: string;
  job: {
    _id?: string;
    title: string;
    department?: string;
  };
  assessmentType: string;
  score: number;
  passingScore: number;
  passFailStatus: PassFailStatus;
  completionDate: string;
  summaryNotes?: string;
  detailedFeedback?: string;
  strengths?: string[];
  improvements?: string[];
  detailedCategoryScores?: Record<string, any>;
  categoryScores?: {
    communication?: CategoryScoreEntry;
    technicalAccuracy?: CategoryScoreEntry;
    problemSolving?: CategoryScoreEntry;
    codeQuality?: CategoryScoreEntry;
    confidence?: CategoryScoreEntry;
  } | null;
  integrityScore?: number;
  flaggedForReview?: boolean;
  proctoringStrikes?: number;
  identityVerification?: {
    status: IdentityVerificationStatus;
    similarity?: number | null;
    threshold?: number | null;
    attempts?: number;
  } | null;
  proctoringViolations?: ProctoringViolation[];
  questionEvaluations?: QuestionEvaluation[];
}

export interface CompanyProfile {
  _id: string;
  name: string;
  contactEmail: string;
  logo?: string;
  phone?: string;
  website?: string;
  address?: string;
  description?: string;
  preferredLanguage?: string;
  timezone?: string;
  status: string;
  adminUser?: {
    _id: string;
    name: string;
    email: string;
  };
}

export interface CompanyDashboardMetrics {
  totalJobs: number;
  activeJobs: number;
  draftJobs: number;
  totalApplications: number;
  candidatesInterviewed: number;
  candidatesShortlisted: number;
  pendingInterviews: number;
  unreviewedSecurityEvents: number;
}

export type VerificationOutcome =
  | 'passed'
  | 'failed'
  | 'no_face'
  | 'multiple_faces'
  | 'no_reference'
  | 'provider_error'
  | 'attempts_exhausted';

export interface SecurityEvent {
  _id: string;
  company: string;
  interview: { _id: string; title: string; jobRole?: string; scheduledAt?: string } | string;
  candidateName: string;
  outcome: VerificationOutcome;
  similarity: number | null;
  threshold: number | null;
  provider: string;
  attempt: number;
  facesDetected: number;
  reason: string;
  liveFrameUrl: string;
  referenceImageUrl: string;
  severity: 'info' | 'warning' | 'critical';
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy?: { _id: string; name: string; email: string } | null;
  createdAt: string;
}
