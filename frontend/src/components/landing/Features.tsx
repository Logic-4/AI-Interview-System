import { motion } from "framer-motion";
import { Mic, Zap, BarChart3, Target, Brain, ShieldCheck } from "lucide-react";

const features = [
  { icon: Mic, title: "Live AI interviewer", desc: "Voice or text conversations with an AI that adapts to your seniority, role, and target company." },
  { icon: Zap, title: "Instant feedback", desc: "Detailed breakdowns on content, delivery, body language, and structure right after each answer." },
  { icon: BarChart3, title: "Performance analytics", desc: "Track progress over time with data-driven insights and benchmarks against industry standards." },
  { icon: Target, title: "Role-specific paths", desc: "Tailored question banks for engineering, product, design, sales, and leadership tracks." },
  { icon: Brain, title: "Memory of you", desc: "Remembers your goals, weak spots, and stories so every session feels personal and progressive." },
  { icon: ShieldCheck, title: "Privacy-first", desc: "Your recordings stay yours. End-to-end encryption with one-click deletion, always." },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-24">
      <div className="absolute inset-0 -z-10 bg-radial-fade" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Why InterviewAI</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            Engineered for <span className="text-gradient">career growth</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A realistic interview environment powered by frontier models — built to turn nerves into offers.
          </p>
        </motion.div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
              style={{ transformPerspective: 1000 }}
              className="group relative p-6 md:p-7 rounded-md bg-card border border-border shadow-card hover:shadow-elegant transition-shadow"
            >
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow group-hover:scale-110 transition-transform">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
