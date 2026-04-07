"use client";

import React, { useState } from "react";
import { 
  Star, 
  Clock, 
  CheckCircle2, 
  Timer, 
  Search,
  MoreVertical
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("1M");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
         <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Progress Analytics</h1>
            <p className="text-[13px] font-medium text-text-muted">
              Track your performance and skill evolution
            </p>
         </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Star, label: "Average Score", value: "84.2%", trend: "+10%", trendColor: "text-success bg-success/10", iconColor: "text-primary" },
          { icon: Clock, label: "Practice Time", value: "42.5h", trend: "+5h", trendColor: "text-success bg-success/10", iconColor: "text-purple-400" },
          { icon: CheckCircle2, label: "Interviews Completed", value: "28", trend: "Flat", trendColor: "text-text-muted bg-white/5", iconColor: "text-success" },
          { icon: Timer, label: "Avg Response Time", value: "1.4m", trend: "-8%", trendColor: "text-danger bg-danger/10", iconColor: "text-orange-400" },
        ].map((stat, i) => (
          <Card key={i} className="p-5 border-white/5 bg-[#12151C] hover:bg-[#161B22] transition-colors cursor-default">
             <div className="flex justify-between items-start mb-4">
                <div className={cn("w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5", stat.iconColor)}>
                   <stat.icon className="w-4 h-4" />
                </div>
                <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wider", stat.trendColor)}>
                   {stat.trend}
                </div>
             </div>
             <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                <div className="text-2xl font-black">{stat.value}</div>
             </div>
          </Card>
        ))}
      </div>

      {/* Main Chart Area */}
      <Card className="p-6 border-white/5 bg-[#12151C]">
        <div className="flex items-center justify-between mb-8">
           <div>
              <h3 className="text-sm font-bold text-white mb-1">Score Improvement Over Time</h3>
              <p className="text-[11px] font-medium text-text-muted">Weekly performance trend across all modules</p>
           </div>
           <div className="flex items-center bg-[#0A0C10] p-1 rounded-lg border border-white/5">
             {["1W", "1M", "1Y"].map(range => (
               <button 
                 key={range}
                 onClick={() => setTimeRange(range)}
                 className={cn(
                   "px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                   timeRange === range ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-white"
                 )}
               >
                 {range}
               </button>
             ))}
           </div>
        </div>

        <div className="w-full h-[250px] relative">
          {/* Simulated Line Chart using SVG */}
          <svg className="w-full h-full" viewBox="0 0 1000 250" preserveAspectRatio="none">
             <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stopColor="rgba(41,98,255,0.3)" />
                   <stop offset="100%" stopColor="rgba(41,98,255,0.0)" />
                </linearGradient>
             </defs>
             {/* Grid lines */}
             {[0, 50, 100, 150, 200, 250].map(y => (
               <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
             ))}
             
             {/* Chart Line & Fill */}
             <path 
                d="M 0,200 L 140,195 L 280,165 L 420,175 L 560,130 L 700,90 L 840,110 L 1000,70" 
                fill="none" 
                stroke="#2962FF" 
                strokeWidth="4" 
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_15px_rgba(41,98,255,0.8)]"
             />
             <path 
                d="M 0,200 L 140,195 L 280,165 L 420,175 L 560,130 L 700,90 L 840,110 L 1000,70 L 1000,250 L 0,250 Z" 
                fill="url(#chartGradient)" 
             />
             
             {/* Data Points */}
             {[
               {x: 0, y: 200}, {x: 140, y: 195}, {x: 280, y: 165}, {x: 420, y: 175},
               {x: 560, y: 130}, {x: 700, y: 90}, {x: 840, y: 110}, {x: 1000, y: 70}
             ].map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#12151C" stroke="#2962FF" strokeWidth="2" />
             ))}
          </svg>

          {/* X Axis Labels */}
          <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest pl-2">
             <span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span>
             <span>Week 5</span><span>Week 6</span><span>Week 7</span><span>Current</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
         {/* Skill Proficiency (Radar) */}
         <Card className="p-6 border-white/5 bg-[#12151C] flex flex-col items-center">
            <div className="w-full text-left mb-6">
               <h3 className="text-sm font-bold text-white mb-1">Skill Proficiency</h3>
               <p className="text-[11px] font-medium text-text-muted">Technical vs. Soft Skills balance</p>
            </div>
            
            <div className="relative w-full max-w-[260px] aspect-square flex items-center justify-center">
               <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  {/* Grid Polygon */}
                  <polygon points="100,20 180,100 100,180 20,100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <polygon points="100,40 160,100 100,160 40,100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <polygon points="100,60 140,100 100,140 60,100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <polygon points="100,80 120,100 100,120 80,100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  
                  {/* Axes */}
                  <line x1="100" y1="20" x2="100" y2="180" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                  {/* Data Polygon */}
                  <polygon 
                    points="100,30 160,100 100,140 50,100" 
                    fill="rgba(41,98,255,0.2)" 
                    stroke="#2962FF" 
                    strokeWidth="2" 
                    className="drop-shadow-[0_0_10px_rgba(41,98,255,0.5)]"
                  />
                  
                  {/* Polygon points */}
                  <circle cx="100" cy="30" r="3" fill="#2962FF" />
                  <circle cx="160" cy="100" r="3" fill="#2962FF" />
                  <circle cx="100" cy="140" r="3" fill="#2962FF" />
                  <circle cx="50" cy="100" r="3" fill="#2962FF" />
               </svg>

               {/* Labels */}
               <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Technical</span>
               <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Communication</span>
               <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Culture</span>
               <span className="absolute -left-[60px] top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Prob Solving</span>
            </div>
            
            <div className="w-full flex justify-center gap-6 mt-8">
               <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Technical Profile
               </div>
            </div>
         </Card>

         {/* Interview Activity (Bars) */}
         <Card className="p-6 border-white/5 bg-[#12151C]">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-sm font-bold text-white mb-1">Interview Activity</h3>
                  <p className="text-[11px] font-medium text-text-muted">Volume by job category</p>
               </div>
               <button className="text-text-muted hover:text-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
               </button>
            </div>

            <div className="space-y-6">
               {[
                 { label: "Frontend Engineering", value: 12, percent: 80 },
                 { label: "Backend Systems", value: 8, percent: 55 },
                 { label: "System Design", value: 5, percent: 35 },
                 { label: "Behavioral", value: 3, percent: 15 },
               ].map((item, i) => (
                 <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                       <span className="text-white">{item.label}</span>
                       <span className="text-text-muted">{item.value} Sessions</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${item.percent}%` }}
                         transition={{ duration: 1, delay: 0.1 * i }}
                         className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(41,98,255,0.4)]"
                       />
                    </div>
                 </div>
               ))}
            </div>
         </Card>
      </div>

      {/* Recent Detailed Insights Table */}
      <Card className="p-1 border-white/5 bg-[#12151C] mt-4 overflow-hidden">
         <div className="p-5 flex items-center justify-between border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Recent Detailed Insights</h3>
            <Link href="/analytics/reports" className="text-xs font-bold text-primary hover:text-primary-light transition-colors">
               View all reports
            </Link>
         </div>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-[#0A0C10]/50 border-b border-white/5">
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Role</th>
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Date</th>
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Core Strength</th>
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Improvement Area</th>
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Overall Score</th>
                     <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Action</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5 whitespace-nowrap">
                  {[
                    { role: "Senior React Developer", date: "Oct 24, 2023", strength: "Component Architecture", strengthColor: "text-success bg-success/10", weakness: "Error Handling", weaknessColor: "text-danger bg-danger/10", score: 92, scoreColor: "bg-success" },
                    { role: "Product Systems Architect", date: "Oct 21, 2023", strength: "Scalability", strengthColor: "text-success bg-success/10", weakness: "Microservices Flow", weaknessColor: "text-warning bg-warning/10", score: 78, scoreColor: "bg-warning" },
                    { role: "Node.js Engineer", date: "Oct 15, 2023", strength: "Event Loop Logic", strengthColor: "text-success bg-success/10", weakness: "Unit Testing", weaknessColor: "text-danger bg-danger/10", score: 95, scoreColor: "bg-success" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                       <td className="px-6 py-5">
                          <span className="text-sm font-bold text-white">{row.role}</span>
                       </td>
                       <td className="px-6 py-5">
                          <span className="text-xs font-semibold text-text-muted">{row.date}</span>
                       </td>
                       <td className="px-6 py-5">
                          <span className={cn("px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase", row.strengthColor)}>
                             {row.strength}
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          <span className={cn("px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase", row.weaknessColor)}>
                             {row.weakness}
                          </span>
                       </td>
                       <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className={cn("h-full rounded-full", row.scoreColor)} style={{ width: `${row.score}%` }} />
                             </div>
                             <span className="text-xs font-bold text-white tabular-nums">{row.score}</span>
                          </div>
                       </td>
                       <td className="px-6 py-5">
                          <Link href="/interviews/demo/report" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary-light transition-colors">
                             REPORT
                          </Link>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </Card>

    </div>
  );
}
