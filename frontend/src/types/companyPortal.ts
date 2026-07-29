export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type WorkplaceType = 'on-site' | 'remote' | 'hybrid';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';
export type JobStatus = 'draft' | 'published' | 'paused' | 'closed';
export type InterviewLanguage = 'English' | 'Somali';
export type InterviewType = 'technical' | 'behavioral' | 'hr' | 'system-design' | 'mixed';
export type ApplicationStatus = 'applied' | 'under_review' | 'interview_scheduled' | 'interviewed' | 'shortlisted' | 'rejected' | 'hired';
export type ResumeStatus = 'uploaded' | 'missing' | 'reviewed';
export type CompanyInterviewStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type PassFailStatus = 'passed' | 'failed' | 'pending';

export interface Job {
  _id: string;
  company: string;
  createdBy: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  workplaceType: WorkplaceType;
  location: string;
  numberOfHiresNeeded: number;
  maxApplications?: number;
  applicationDeadline?: string;
  status: JobStatus;
  description: string;
  responsibilities?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: ExperienceLevel;
  education?: string;
  requiredEducation?: string;
  salaryRange?: string;
  benefitsNotes?: string;
  interviewLanguage: InterviewLanguage;
  interviewType: InterviewType;
  difficulty: ExperienceLevel;
  targetJobRole?: string;
  durationMinutes: number;
  focusSkills: string[];
  numberOfQuestions: number;
  resumeRequired: boolean;
  coverLetterRequired: boolean;
  allowCandidateSelectTime: boolean;
  completionDeadline?: string;
  interviewExpiryDate?: string;
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
  appliedPosition: string;
  jobId?: string;
  experienceLevel: string;
  interviewScore?: number | null;
  status: ApplicationStatus;
  isShortlisted: boolean;
  appliedDate: string;
  avatar?: string;
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
  type: InterviewType;
  difficulty: string;
  language: string;
  jobRole: string;
  duration: number;
  scheduledAt?: string;
  status: CompanyInterviewStatus;
  overallScore?: number | null;
  feedback?: {
    overallScore?: number;
    summary?: string;
    strengths?: string[];
    improvements?: string[];
  };
  createdAt: string;
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
  strengths?: string[];
  improvements?: string[];
  detailedCategoryScores?: Record<string, any>;
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
}
