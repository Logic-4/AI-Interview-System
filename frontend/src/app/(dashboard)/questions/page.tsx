"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Loader2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Tag,
  Eye,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import questionService from "@/services/questionService";
import type { QuestionBankItem, QuestionBankListParams } from "@/types/question";

const DOMAINS = [
  "frontend", "backend", "fullstack", "devops", "data-science", "mobile", "cloud",
  "security", "qa-testing", "ai-ml", "healthcare", "finance", "marketing", "sales",
  "human-resources", "education", "legal", "engineering", "creative", "operations",
  "customer-service", "management", "general",
];

const TYPES = ["technical", "behavioral", "system-design", "mixed"];
const DIFFICULTIES = ["easy", "medium", "hard"];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<QuestionBankItem | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: QuestionBankListParams = { page, limit: 12 };
      if (search) params.search = search;
      if (domain) params.domain = domain;
      if (type) params.type = type as QuestionBankListParams["type"];
      if (difficulty) params.difficulty = difficulty as QuestionBankListParams["difficulty"];
      const data = await questionService.getQuestions(params);
      setQuestions(data.questions);
      setTotalPages(data.pagination?.pages ?? 1);
    } catch {
      setError("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [page, search, domain, type, difficulty]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const clearFilters = () => {
    setSearch("");
    setDomain("");
    setType("");
    setDifficulty("");
    setPage(1);
  };

  const hasFilters = !!search || !!domain || !!type || !!difficulty;

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Practice Library</h1>
          <p className="text-sm text-text-muted font-medium mt-0.5">Browse and study interview questions</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search questions..."
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-sm text-text-primary font-medium placeholder:text-text-muted/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-10 px-4 rounded-lg text-xs font-bold text-text-primary border-border/40">
            <Filter className="w-3.5 h-3.5 mr-2" /> Filters
            {hasFilters && <span className="ml-2 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">!</span>}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card hoverEffect={false} className="p-4 border-border/40 bg-surface/30 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Domain</label>
                    <select value={domain} onChange={(e) => { setDomain(e.target.value); setPage(1); }}
                      className="w-full h-9 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-xs text-text-primary font-medium focus:outline-none focus:border-primary/50 capitalize">
                      <option value="">All Domains</option>
                      {DOMAINS.map((d) => <option key={d} value={d}>{d.replace("-", " ")}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Type</label>
                    <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
                      className="w-full h-9 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-xs text-text-primary font-medium focus:outline-none focus:border-primary/50 capitalize">
                      <option value="">All Types</option>
                      {TYPES.map((t) => <option key={t} value={t}>{t.replace("-", " ")}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Difficulty</label>
                    <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
                      className="w-full h-9 px-3 rounded-lg border border-border/40 bg-foreground/[0.03] text-xs text-text-primary font-medium focus:outline-none focus:border-primary/50 capitalize">
                      <option value="">All Levels</option>
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 text-center">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="text-sm text-text-muted font-medium">{error}</p>
        </Card>
      ) : questions.length === 0 ? (
        <Card hoverEffect={false} className="p-12 border-border/40 bg-surface/30 text-center">
          <BookOpen className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-text-primary mb-1">No questions found</h3>
          <p className="text-xs text-text-muted font-medium">Try adjusting your filters or search term.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((q) => (
              <Card
                key={q._id}
                hoverEffect
                className="p-5 border-border/40 bg-surface/30 cursor-pointer"
                onClick={() => setSelected(q)}
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge className={cn(
                    "text-[8px] font-bold uppercase tracking-widest",
                    q.difficulty === "hard" ? "bg-danger/10 text-danger border-danger/20" :
                    q.difficulty === "easy" ? "bg-success/10 text-success border-success/20" :
                    "bg-warning/10 text-warning border-warning/20"
                  )}>
                    {q.difficulty}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-bold uppercase tracking-widest capitalize">
                    {q.type?.replace("-", " ") ?? "general"}
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-text-primary leading-relaxed line-clamp-3 mb-3">{q.text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest capitalize">{q.domain?.replace("-", " ")}</span>
                  <button className="text-[9px] font-bold text-primary flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                </div>
                {q.tags && q.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    <Tag className="w-2.5 h-2.5 text-text-muted" />
                    {q.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[8px] font-medium text-text-muted bg-foreground/[0.04] px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="h-9 px-3 rounded-lg text-xs font-bold text-text-primary border-border/40">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-bold text-text-muted">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="h-9 px-3 rounded-lg text-xs font-bold text-text-primary border-border/40">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Question Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-surface border border-border/40 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-[8px] font-bold uppercase tracking-widest",
                    selected.difficulty === "hard" ? "bg-danger/10 text-danger border-danger/20" :
                    selected.difficulty === "easy" ? "bg-success/10 text-success border-success/20" :
                    "bg-warning/10 text-warning border-warning/20"
                  )}>
                    {selected.difficulty}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-bold uppercase tracking-widest capitalize">
                    {selected.type?.replace("-", " ")}
                  </Badge>
                </div>
                <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-sm font-semibold text-text-primary leading-relaxed">{selected.text}</h3>

              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest capitalize">
                Domain: {selected.domain?.replace("-", " ")}
              </p>

              {selected.sampleAnswer && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Sample Answer</p>
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <p className="text-xs text-text-muted font-medium leading-relaxed">{selected.sampleAnswer}</p>
                  </div>
                </div>
              )}

              {selected.tags && selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} className="bg-foreground/5 text-text-muted border-border/40 text-[8px] font-medium">{tag}</Badge>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
