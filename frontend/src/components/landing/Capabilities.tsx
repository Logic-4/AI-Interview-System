import { motion } from "framer-motion";
import {
  FileText, Mic2, LineChart, Globe2, BarChart3,
  Code2, Stethoscope, TrendingUp, Wrench, GraduationCap, Scale,
} from "lucide-react";

const items = [
  {
    icon: FileText,
    tag: "Resume aware",
    title: "CV-tailored mock interviews",
    desc: "Upload a PDF, Word, or TXT resume. We parse your career history and generate questions that probe your actual experience and projects.",
  },
  {
    icon: LineChart,
    tag: "AI Evaluation",
    title: "Gemma AI-powered grading",
    desc: "Receive instant, detailed scoring and coaching from our specialized Gemma model, rating your technical depth, clarity, and relevance.",
  },
  {
    icon: Mic2,
    tag: "Voice native",
    title: "Real-time voice conversations",
    desc: "Hands-free, low-latency speech-to-text and text-to-speech, modeled on a live Zoom or Teams interview — no typing required.",
  },
  {
    icon: LineChart,
    tag: "Deep reports",
    title: "Behavioral & technical breakdowns",
    desc: "Post-interview scoring on communication, problem solving, technical accuracy, and code quality with concrete strengths and gaps.",
  },
  {
    icon: Globe2,
    tag: "Multilingual",
    title: "Bilingual interview tracks",
    desc: "Practice in English or Somali with first-class localization across questions, transcripts, and feedback — switch any time.",
  },
  {
    icon: BarChart3,
    tag: "Progress",
    title: "Historical performance analytics",
    desc: "Dashboards that track progress over time: top scores, average duration, domain coverage, and trends across every session.",
  },
];

const domains = [
  { icon: Code2, name: "Technology", roles: "Full Stack Dev · Cybersecurity Analyst" },
  { icon: Stethoscope, name: "Healthcare", roles: "Registered Nurse · Hospital Admin" },
  { icon: TrendingUp, name: "Finance", roles: "Financial Analyst · Supply Chain" },
  { icon: Wrench, name: "Engineering", roles: "Civil Engineer · Mechanical Engineer" },
  { icon: GraduationCap, name: "Education", roles: "Science Teacher · Admissions Officer" },
  { icon: Scale, name: "Legal", roles: "Legal Assistant · Urban Planner" },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="relative py-20 md:py-24 overflow-hidden">
      {/* Section-level pattern backgrounds */}
      <div className="absolute inset-0 -z-10 bg-mesh opacity-25 dark:opacity-45" />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-20 dark:opacity-15" />
      <div className="absolute -top-24 left-1/3 -z-10 h-[36rem] w-[36rem] rounded-full bg-primary/8 blur-3xl animate-blob" />
      <div className="absolute bottom-0 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-primary-glow/8 blur-3xl animate-blob [animation-delay:-8s]" />

      {/* Floating particles */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-primary/40"
            style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 100}%` }}
            animate={{ y: [0, -24, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Platform capabilities</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            A complete <span className="text-gradient">interview studio</span>, built in
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Six production-grade systems working in concert — from resume parsing to body language, voice, and longitudinal analytics.
          </p>
        </motion.div>

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              whileHover={{ y: -8, rotateX: 3, rotateY: -3, scale: 1.01 }}
              style={{ transformPerspective: 1200, transformStyle: "preserve-3d" }}
              className="group relative p-6 md:p-7 rounded-md bg-card/80 backdrop-blur-xl border border-border shadow-card hover:shadow-elegant transition-shadow"
            >
              {/* 3D icon stack */}
              <div className="relative h-16 w-16" style={{ transformStyle: "preserve-3d" }}>
                <div
                  className="absolute inset-0 rounded bg-gradient-primary opacity-30 blur-md"
                  style={{ transform: "translateZ(-20px)" }}
                />
                <div
                  className="absolute inset-1 rounded bg-primary/20 border border-primary/30"
                  style={{ transform: "translateZ(-8px) rotate(-6deg)" }}
                />
                <div
                  className="relative h-16 w-16 rounded bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow group-hover:scale-110 transition-transform"
                  style={{ transform: "translateZ(0)" }}
                >
                  <it.icon className="h-6 w-6" />
                </div>
              </div>

              <span className="mt-5 inline-block text-[10px] font-semibold uppercase tracking-widest text-primary px-2 py-1 rounded-full border border-primary/20 bg-primary/5">
                {it.tag}
              </span>
              <h3 className="mt-3 text-xl font-semibold leading-snug">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Domain coverage */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-16 md:mt-20"
        >
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">Domain coverage</p>
              <h3 className="mt-3 text-3xl md:text-4xl font-bold">
                Trained across <span className="text-gradient">6 industries</span>
              </h3>
              <p className="mt-3 text-muted-foreground">
                Role-specific question banks and rubrics tuned for the realities of each domain.
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Up to 6 supported domains
            </span>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group flex items-center gap-4 p-5 rounded-md bg-card/80 backdrop-blur-xl border border-border shadow-card hover:shadow-elegant transition-shadow"
              >
                <div className="h-12 w-12 shrink-0 rounded bg-primary/10 border border-primary/20 text-primary grid place-items-center group-hover:bg-gradient-primary group-hover:text-primary-foreground group-hover:border-transparent transition-colors">
                  <d.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.roles}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
