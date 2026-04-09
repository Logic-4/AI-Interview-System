export interface CategoryScore {
  score: number;
  feedback: string;
}

export interface FeedbackCategories {
  communication: CategoryScore;
  technicalAccuracy: CategoryScore;
  problemSolving: CategoryScore;
  codeQuality: CategoryScore;
  confidence: CategoryScore;
}

export interface Feedback {
  _id: string;
  interview: string;
  user: string;
  overallScore: number;
  categories: FeedbackCategories;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
  recommendations: string[];
  aiModel?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProgressPeriod = '7d' | '30d' | '90d' | '365d';

export interface ProgressAverages {
  overall: number;
  communication: number;
  technicalAccuracy: number;
  problemSolving: number;
  codeQuality: number;
  confidence: number;
}

export interface ProgressTimelineItem {
  _id: string;
  overallScore: number;
  categories: {
    communication?: { score: number };
    technicalAccuracy?: { score: number };
    problemSolving?: { score: number };
    codeQuality?: { score: number };
    confidence?: { score: number };
  };
  createdAt: string;
}

export interface RecentInsightInterview {
  _id: string;
  title: string;
  domain: string;
  type: string;
}

export interface RecentInsight {
  _id: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  categories: {
    communication?: { score: number };
    technicalAccuracy?: { score: number };
    problemSolving?: { score: number };
    codeQuality?: { score: number };
    confidence?: { score: number };
  };
  createdAt: string;
  interview: RecentInsightInterview | null;
}

export interface DomainActivityItem {
  domain: string;
  count: number;
}

export interface UserProgress {
  period: string;
  timeline: ProgressTimelineItem[];
  averages: ProgressAverages;
  totalInterviewsReviewed: number;
  recentInsights: RecentInsight[];
  domainActivity: DomainActivityItem[];
}
