"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Plus, 
  TrendingUp, 
  Star, 
  BarChart2, 
  ArrowUpRight, 
  Calendar, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Lightbulb
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const stats = [
  { id: 1, label: "Total Interviews", value: "24", trend: "+12%", icon: Briefcase, color: "primary" },
  { id: 2, label: "Avg Score", value: "78/100", trend: "+5%", icon: Star, color: "secondary" },
  { id: 3, label: "Preparation Level", value: "Intermediate", subValue: "Level 4", icon: BarChart2, color: "success" }
];

const recentResults = [
  { id: 1, role: "Senior Software Engineer", date: "Oct 24, 2023", status: "passed", score: "85/100" },
  { id: 2, role: "Product Manager", date: "Oct 21, 2023", status: "practice", score: "72/100" },
  { id: 3, role: "Frontend Developer", date: "Oct 18, 2023", status: "passed", score: "91/100" },
  { id: 4, role: "System Architect", date: "Oct 15, 2023", status: "incomplete", score: "--" }
];

const chartData = [
  { month: "SEP", height: "40%" },
  { month: "", height: "60%" },
  { month: "", height: "50%" },
  { month: "", height: "80%" },
  { month: "", height: "70%" },
  { month: "OCT", height: "100%" }
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Welcome back, Alex!</h1>
          <p className="text-text-muted font-medium">You've completed 4 interviews this week. Keep the momentum going!</p>
        </div>
        <Link href="/interviews/new">
          <Button size="lg" className="h-12 rounded-xl px-6 font-bold shadow-lg shadow-primary/20 group">
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            Start New Interview
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.id} className="p-6 border-white/5 bg-surface/30 backdrop-blur-xl relative group overflow-hidden">
             <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
                   <stat.icon className="w-5 h-5" />
                </div>
                {stat.trend && (
                  <div className="flex items-center text-[10px] font-semibold text-success bg-success/10 px-2 py-1 rounded-full uppercase tracking-widest">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    {stat.trend}
                  </div>
                )}
             </div>
             <p className="text-xs font-semibold text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
             <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-semibold">{stat.value}</h3>
                {stat.subValue && <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">{stat.subValue}</span>}
             </div>
             {/* Decorative line */}
             <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/50 transition-all duration-500" />
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Results Table */}
        <Card className="lg:col-span-2 border-white/5 bg-surface/30 backdrop-blur-xl overflow-hidden">
           <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Recent Interview Results</h3>
              <button className="text-primary text-xs font-semibold uppercase tracking-widest hover:underline">View All</button>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-white/[0.02]">
                       <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Date</th>
                       <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Role</th>
                       <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Status</th>
                       <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Score</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {recentResults.map((result) => (
                      <tr key={result.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                         <td className="px-6 py-5 text-sm font-bold text-text-muted group-hover:text-text-secondary transition-colors">{result.date}</td>
                         <td className="px-6 py-5 text-sm font-semibold tracking-tight">{result.role}</td>
                         <td className="px-6 py-5">
                            {result.status === "passed" && (
                              <Badge className="bg-success/10 text-success border-success/20 font-semibold uppercase tracking-widest text-[9px]">Passed</Badge>
                            )}
                            {result.status === "practice" && (
                              <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold uppercase tracking-widest text-[9px]">Needs Practice</Badge>
                            )}
                            {result.status === "incomplete" && (
                              <Badge className="bg-white/5 text-text-muted border-white/10 font-semibold uppercase tracking-widest text-[9px]">Incomplete</Badge>
                            )}
                         </td>
                         <td className="px-6 py-5 text-sm font-semibold tracking-tighter">{result.score}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </Card>

        {/* Score Progress Chart */}
        <Card className="border-white/5 bg-surface/30 backdrop-blur-xl p-6 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Score Progress</h3>
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Last 30 Days</span>
           </div>
           
           {/* Simple Bar Chart UI */}
           <div className="h-48 flex items-end justify-between gap-3 px-2">
              {chartData.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: bar.height }}
                     transition={{ duration: 1, delay: i * 0.1 }}
                     className="w-full bg-primary/20 rounded-t-lg group-hover:bg-primary/40 transition-colors relative"
                   >
                     {bar.height === "100%" && (
                       <div className="absolute -top-1 w-full h-1 bg-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                     )}
                   </motion.div>
                   {bar.month && <span className="text-[10px] font-semibold text-text-muted">{bar.month}</span>}
                </div>
              ))}
           </div>

           {/* Metrics Breakdown */}
           <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-xs font-bold text-text-muted">Coding Skill</span>
                 </div>
                 <span className="text-xs font-semibold">88%</span>
              </div>
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-success" />
                    <span className="text-xs font-bold text-text-muted">Communication</span>
                 </div>
                 <span className="text-xs font-semibold">72%</span>
              </div>
           </div>
        </Card>
      </div>

      {/* Tip of the Day Card */}
      <Card className="p-8 border-white/5 bg-gradient-to-r from-primary/10 via-surface/30 to-secondary/5 backdrop-blur-xl relative overflow-hidden group">
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-6">
               <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform duration-500">
                  <Lightbulb className="w-8 h-8 fill-white/20" />
               </div>
               <div className="space-y-1 max-w-2xl">
                  <h4 className="text-xl font-semibold tracking-tight">Tip of the day: STAR Method</h4>
                  <p className="text-sm font-medium text-text-muted leading-relaxed">
                    When answering behavioral questions, use the STAR method: Situation, Task, Action, and Result. This provides a clear and structured narrative for the interviewer.
                  </p>
               </div>
            </div>
            <Button variant="outline" className="h-12 rounded-xl group px-6 border-white/5 hover:bg-white/5 font-semibold uppercase tracking-widest text-xs">
              Learn More
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
         </div>
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-64 h-full bg-primary/5 blur-[80px] -rotate-45 translate-x-1/2 pointer-events-none" />
      </Card>
    </div>
  );
}
