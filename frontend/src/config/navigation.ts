import { 
  Home, 
  Play, 
  History, 
  BarChart3, 
  BookOpen, 
  FileText, 
  MessageSquare, 
  Target
} from "lucide-react";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "interviews", label: "New Interview", icon: Play, href: "/interviews/new" },
  { id: "history", label: "Interview History", icon: History, href: "/interviews" },
  { id: "results", label: "Interview Results", icon: FileText, href: "/interviews/demo/report" },
  { id: "feedback", label: "Question Feedback", icon: MessageSquare, href: "/interviews/demo/review" },
  { id: "analytics", label: "Progress Analytics", icon: BarChart3, href: "/analytics" },
  { id: "practice-recommendations", label: "Study Plan", icon: Target, href: "/study-plan" },
  { id: "practice-library", label: "Practice Library", icon: BookOpen, href: "/questions" }
];
