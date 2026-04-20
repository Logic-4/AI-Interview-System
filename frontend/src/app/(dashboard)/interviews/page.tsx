"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Briefcase,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import interviewService from "@/services/interviewService";
import { Interview, InterviewStatus } from "@/types/interview";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { label: string; value: InterviewStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const DOMAIN_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full Stack",
  devops: "DevOps",
  "data-science": "Data Science",
  mobile: "Mobile",
  cloud: "Cloud",
  security: "Security",
  "qa-testing": "QA / Testing",
  "ai-ml": "AI / ML",
  healthcare: "Healthcare",
  finance: "Finance",
  marketing: "Marketing",
  sales: "Sales",
  "human-resources": "Human Resources",
  education: "Education",
  legal: "Legal",
  engineering: "Engineering",
  creative: "Creative",
  operations: "Operations",
  "customer-service": "Customer Service",
  management: "Management",
  general: "General",
};

function StatusBadge({ status, score }: { status: string; score: number | null }) {
  if (status === "completed") {
    if (score !== null && score >= 70)
      return <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-semibold uppercase tracking-widest">Passed</Badge>;
    if (score !== null)
      return <Badge className="bg-warning/10 text-warning border-warning/20 text-[9px] font-semibold uppercase tracking-widest">Needs Practice</Badge>;
    return <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-semibold uppercase tracking-widest">Completed</Badge>;
  }
  if (status === "in-progress")
    return <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-semibold uppercase tracking-widest">In Progress</Badge>;
  if (status === "scheduled")
    return <Badge className="bg-foreground/5 text-text-muted border-border/40 text-[9px] font-semibold uppercase tracking-widest">Scheduled</Badge>;
  if (status === "cancelled")
    return <Badge className="bg-danger/10 text-danger border-danger/20 text-[9px] font-semibold uppercase tracking-widest">Cancelled</Badge>;
  return null;
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof interviewService.getInterviews>[0] = {
        page,
        limit: 10,
      };
      if (statusFilter) params.status = statusFilter;
      const { interviews: data, pagination } = await interviewService.getInterviews(params);
      setInterviews(data);
      setTotalPages(pagination.pages);
      setTotal(pagination.total);
    } catch {
      setError("Failed to load interviews. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const filteredInterviews = search
    ? interviews.filter((iv) => iv.title.toLowerCase().includes(search.toLowerCase()))
    : interviews;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 text-text-primary">Interview History</h1>
          <p className="text-text-muted font-medium">
            {total > 0 ? `${total} interview${total !== 1 ? "s" : ""} total` : "No interviews yet"}
          </p>
        </div>
        <Link href="/interviews/new">
          <Button size="lg" className="h-12 rounded-xl px-6 font-bold shadow-lg shadow-primary/20 group">
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            Start New Interview
          </Button>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-md relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title..."
            className="w-full h-10 bg-foreground/[0.03] border border-border/40 rounded-lg pl-10 pr-4 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-foreground/[0.05] transition-all text-text-primary placeholder:text-text-muted"
          />
        </form>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-text-muted flex-shrink-0" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value as InterviewStatus | ""); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all border uppercase tracking-widest",
                statusFilter === opt.value
                  ? "bg-primary text-white border-primary"
                  : "text-text-muted border-border/40 hover:text-text-primary hover:bg-foreground/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/40 bg-surface/30 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-danger text-sm font-semibold">{error}</p>
            <Button variant="outline" onClick={fetchInterviews} className="text-xs text-text-primary border-border/40">Retry</Button>
          </div>
        ) : !filteredInterviews.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-text-muted">
            <Briefcase className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-semibold">No interviews found</p>
              <p className="text-xs mt-1">
                {statusFilter ? "Try changing the filter or " : ""}
                <Link href="/interviews/new" className="text-primary hover:underline">start a new interview</Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Title</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Type</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Domain</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Difficulty</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Date</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Score</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredInterviews.map((iv) => (
                  <tr key={iv._id} className="group hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-6 py-5">
                      <Link
                        href={iv.status === "completed" ? `/interviews/${iv._id}/report` : `/interviews/${iv._id}`}
                        className="text-sm font-semibold tracking-tight text-text-primary hover:text-primary transition-colors"
                      >
                        {iv.title}
                      </Link>
                    </td>
                    <td className="px-6 py-5 text-xs font-semibold text-text-muted capitalize">{iv.type.replace("-", " ")}</td>
                    <td className="px-6 py-5 text-xs font-semibold text-text-muted">{DOMAIN_LABELS[iv.domain] ?? iv.domain}</td>
                    <td className="px-6 py-5 text-xs font-semibold text-text-muted capitalize">{iv.difficulty}</td>
                    <td className="px-6 py-5 text-xs font-bold text-text-muted">
                      {new Date(iv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={iv.status} score={iv.overallScore} />
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-text-primary">
                      {iv.overallScore !== null ? `${iv.overallScore}/100` : "—"}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1 text-xs font-semibold text-text-muted">
                        <Clock className="w-3 h-3" />
                        {iv.duration}m
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-semibold text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-border/40 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    page === pageNum
                      ? "bg-primary text-white"
                      : "text-text-muted border border-border/40 hover:text-text-primary hover:bg-foreground/[0.04]"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg border border-border/40 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
