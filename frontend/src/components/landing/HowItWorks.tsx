import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const steps = [
  { n: "01", title: "Pick your role", desc: "Tell us the company, level, and type of interview you're preparing for." },
  { n: "02", title: "Practice live", desc: "Speak naturally with an AI that asks follow-ups and probes your reasoning." },
  { n: "03", title: "Review & improve", desc: "Review each answer, time spent, score, detailed feedback, and concrete next steps." },
];

const DURATION = 2.4; // seconds for full line sweep

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [completed, setCompleted] = useState<number>(-1);

  useEffect(() => {
    if (!inView) return;
    const timers = steps.map((_, i) =>
      setTimeout(() => setCompleted((c) => Math.max(c, i)), ((i + 1) / steps.length) * DURATION * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <section id="how" ref={ref} className="relative py-20 md:py-24 bg-surface/50 border-y border-border">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Three steps to interview-ready</h2>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-6 relative">
          {/* Animated connecting line */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px overflow-hidden">
            <div className="absolute inset-0 bg-border" />
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary-glow"
              initial={{ width: "0%" }}
              animate={inView ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: DURATION, ease: "easeInOut" }}
            />
          </div>

          {steps.map((s, i) => {
            const done = completed >= i;
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative text-center px-2"
              >
                <div
                  className={`relative mx-auto h-24 w-24 rounded-md border shadow-card grid place-items-center transition-colors duration-500 ${
                    done ? "bg-gradient-primary border-transparent" : "bg-card border-border"
                  }`}
                >
                  {/* Number */}
                  <span
                    className={`text-3xl font-display font-bold transition-opacity duration-300 ${
                      done ? "opacity-0" : "text-gradient opacity-100"
                    }`}
                  >
                    {s.n}
                  </span>
                  {/* Check */}
                  <motion.span
                    initial={false}
                    animate={done ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="absolute inset-0 grid place-items-center text-white"
                  >
                    <Check className="h-9 w-9" strokeWidth={3} />
                  </motion.span>
                  {!done && (
                    <span className="absolute inset-0 rounded-md border border-primary/20 animate-pulse-ring" />
                  )}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
