import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Clock,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Skeleton } from "../../components/ui/Skeleton";
import interviewService from "../../services/interviewService";
import { Interview, InterviewStatus } from "../../types/interview";
import { cn } from "../../lib/utils";
import { DOMAIN_LABELS } from "../../lib/constants";

const STATUS_OPTIONS: { label: string; value: InterviewStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function StatusBadge({ status, score }: { status: string; score: number | null }) {
  if (status === "completed") {
    if (score !== null && score >= 70)
      return <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-bold uppercase tracking-widest">Passed</Badge>;
    if (score !== null)
      return <Badge className="bg-warning/10 text-warning border-warning/20 text-[9px] font-bold uppercase tracking-widest">Needs Practice</Badge>;
    return <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-bold uppercase tracking-widest">Completed</Badge>;
  }
  if (status === "in-progress")
    return <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-widest">In Progress</Badge>;
  if (status === "scheduled")
    return <Badge className="bg-foreground/5 text-text-muted border-white-light dark:border-[#1b2e4b] text-[9px] font-bold uppercase tracking-widest">Scheduled</Badge>;
  if (status === "cancelled")
    return <Badge className="bg-danger/10 text-danger border-danger/20 text-[9px] font-bold uppercase tracking-widest">Cancelled</Badge>;
  return null;
}

export default function InterviewsHistoryPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<InterviewStatus | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [retakingId, setRetakingId] = useState<string | null>(null);

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

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      await interviewService.deleteInterview(id);
      setInterviews((prev) => prev.filter((iv) => iv._id !== id));
    } catch {
      setError("Failed to delete interview. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetake = async (id: string) => {
    setRetakingId(id);
    try {
      await interviewService.resetInterview(id);
      navigate(`/interviews/${id}`);
    } catch {
      setError("Failed to reset interview. Please try again.");
      setRetakingId(null);
    }
  };

  const filteredInterviews = search
    ? interviews.filter((iv) => iv.title.toLowerCase().includes(search.toLowerCase()))
    : interviews;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 text-black dark:text-white-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-text-primary dark:text-white">Interview History</h1>
          <p className="text-text-muted font-semibold">
            {total > 0 ? `${total} interview${total !== 1 ? "s" : ""} total` : "No interviews yet"}
          </p>
        </div>
        <Link to="/interviews/new">
          <Button size="lg" className="h-12 rounded-md px-6 font-bold shadow-lg shadow-primary/20 group text-white">
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
            className="form-input pl-10 pr-4 h-10"
          />
        </form>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-text-muted flex-shrink-0" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value as InterviewStatus | ""); setPage(1); }}
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold rounded-md transition-all border uppercase tracking-widest",
                statusFilter === opt.value
                  ? "bg-primary text-white border-primary shadow-primary/25"
                  : "text-text-muted border-white-light dark:border-[#1b2e4b] hover:text-text-primary dark:hover:text-white hover:bg-white-light/30 dark:hover:bg-[#1a2941]/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border border-white-light dark:border-[#1b2e4b] overflow-hidden" hoverEffect={false}>
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-danger text-sm font-semibold">{error}</p>
            <Button variant="outline" onClick={fetchInterviews} className="text-xs text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]">Retry</Button>
          </div>
        ) : !filteredInterviews.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-text-muted">
            <Briefcase className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-semibold">No interviews found</p>
              <p className="text-xs mt-1">
                {statusFilter ? "Try changing the filter or " : ""}
                <Link to="/interviews/new" className="text-primary hover:underline">start a new interview</Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto table-responsive">
            <table className="w-full text-left border-collapse table-hover">
              <thead>
                <tr className="bg-white-light/30 dark:bg-[#1a2941]/50 border-b border-white-light dark:border-[#1b2e4b]">
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Title</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Type</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Domain</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Difficulty</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Date</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Score</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Duration</th>
                  <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white-light/40 dark:divide-[#191e3a]">
                {filteredInterviews.map((iv) => (
                  <tr key={iv._id} className="group hover:bg-white-light/20 dark:hover:bg-[#1a2941]/40 transition-colors border-b border-white-light/40 dark:border-[#191e3a]">
                    <td className="px-6 py-5">
                      <Link
                        to={iv.status === "completed" ? `/interviews/${iv._id}/report` : `/interviews/${iv._id}`}
                        className="text-sm font-semibold tracking-tight text-text-primary dark:text-white hover:text-primary transition-colors"
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
                    <td className="px-6 py-5 text-sm font-semibold text-text-primary dark:text-white">
                      {iv.overallScore !== null ? `${iv.overallScore}/100` : "—"}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1 text-xs font-semibold text-text-muted">
                        <Clock className="w-3 h-3" />
                        {iv.duration}m
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1">
                        {iv.status === "completed" && (
                          <button
                            onClick={(e) => { e.preventDefault(); handleRetake(iv._id); }}
                            disabled={retakingId === iv._id}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-30"
                            title="Retake interview"
                          >
                            {retakingId === iv._id ? (
                               <LoadingSpinner size="sm" className="h-4 w-4" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.preventDefault(); setConfirmDelete({ id: iv._id, title: iv.title }); }}
                          disabled={deletingId === iv._id}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/5 transition-all disabled:opacity-30"
                          title="Delete interview"
                        >
                          {deletingId === iv._id ? (
                             <LoadingSpinner size="sm" className="h-4 w-4 border-danger" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
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
              className="w-8 h-8 rounded-md border border-white-light dark:border-[#1b2e4b] flex items-center justify-center text-text-muted hover:text-text-primary dark:hover:text-white hover:bg-white-light/30 dark:hover:bg-[#1a2941]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                    "w-8 h-8 rounded-md text-xs font-bold transition-all",
                    page === pageNum
                      ? "bg-primary text-white shadow-primary/25"
                      : "text-text-muted border border-white-light dark:border-[#1b2e4b] hover:text-text-primary dark:hover:text-white hover:bg-white-light/30 dark:hover:bg-[#1a2941]/50"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-md border border-white-light dark:border-[#1b2e4b] flex items-center justify-center text-text-muted hover:text-text-primary dark:hover:text-white hover:bg-white-light/30 dark:hover:bg-[#1a2941]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-black rounded-md border border-white-light dark:border-[#1b2e4b] shadow-lg max-w-sm w-full mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground dark:text-white">Delete Interview</h3>
                <p className="text-sm text-text-muted mt-0.5">
                  This will permanently remove all questions, answers, and feedback.
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground dark:text-white bg-white-light/20 dark:bg-[#1a2941]/50 rounded-md px-3 py-2 truncate">
              &ldquo;{confirmDelete.title}&rdquo;
            </p>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white-light dark:border-[#1b2e4b]">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} className="text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]">
                Cancel
              </Button>
              <Button size="sm" onClick={executeDelete} className="bg-danger text-white hover:bg-danger/90">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
