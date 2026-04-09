export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'interviewer';
  avatar?: string;
  bio?: string;
  skills?: string[];
  targetRole?: string;
  experienceLevel?: 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | '';
  interviewCount?: number;
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  bio?: string;
  skills?: string[];
  targetRole?: string;
  experienceLevel?: string;
}

export interface DashboardOverview {
  totalInterviews: number;
  completedInterviews: number;
  inProgressInterviews: number;
  scheduledInterviews: number;
}

export interface DashboardScores {
  average: number;
  highest: number;
  lowest: number;
  totalReviewed: number;
}

export interface RecentInterviewSummary {
  _id: string;
  title: string;
  type: string;
  difficulty: string;
  domain: string;
  status: string;
  overallScore: number | null;
  createdAt: string;
}

export interface ScoreTrendItem {
  _id: string;
  overallScore: number;
  categories: Record<string, { score: number }>;
  createdAt: string;
}

export interface DashboardStats {
  overview: DashboardOverview;
  scores: DashboardScores;
  recentInterviews: RecentInterviewSummary[];
  scoreTrend: ScoreTrendItem[];
}
