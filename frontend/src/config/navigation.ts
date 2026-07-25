import { 
  Home, 
  Play, 
  History, 
  BarChart3, 
} from "lucide-react";

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "interviews", label: "New Interview", icon: Play, href: "/interviews/new" },
  { id: "history", label: "Interview History", icon: History, href: "/interviews" },
  { id: "analytics", label: "Progress Analytics", icon: BarChart3, href: "/analytics" },
];
