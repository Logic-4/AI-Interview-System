import { 
  Home, 
  Play, 
  History, 
  BarChart3, 
  BookOpen, 
  Target,
  Trophy,
  Medal,
} from "lucide-react";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "interviews", label: "New Interview", icon: Play, href: "/interviews/new" },
  { id: "history", label: "Interview History", icon: History, href: "/interviews" },
  { id: "analytics", label: "Progress Analytics", icon: BarChart3, href: "/analytics" },
  { id: "practice-recommendations", label: "Study Plan", icon: Target, href: "/study-plan" },
  { id: "practice-library", label: "Practice Library", icon: BookOpen, href: "/questions" },
  { id: "achievements", label: "Achievements", icon: Trophy, href: "/achievements" },
  { id: "leaderboard", label: "Leaderboard", icon: Medal, href: "/leaderboard" },
];
