import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, Sparkles, Pause } from "lucide-react";
import { Link } from "react-router-dom";
export function Hero() {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      "Hello! I am your AI Interviewer. I'm here to help you practice and perfect your interview skills with real-time feedback. Let's start the session."
    );

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.name.includes("Samantha") ||
        v.name.includes("Female") ||
        v.name.includes("Google US English")
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1;
    utterance.pitch = 1.05;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return (
    <section id="top" className="relative pt-28 pb-14 md:pt-36 md:pb-20 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 -z-10 bg-mesh" />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-40 dark:opacity-20" />
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl animate-blob" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground/80">Powered by GEMMA fine tuned</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02]"
          >
            Master your next{" "}
            <span className="text-gradient">interview</span> with an AI coach
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0"
          >
            Practice with a realistic, role-specific AI interviewer. Get instant feedback on your answers, delivery, and confidence — then land the offer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3"
          >
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-elegant hover:-translate-y-0.5 transition-all"
            >
              Start practicing free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>

        </div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-xl lg:-mt-4"
        >
          {/* Orb / logo halo behind character */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="relative h-72 w-72 md:h-96 md:w-96">
              <div className="absolute inset-8 rounded-full bg-gradient-primary opacity-90 blur-sm" />
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-ring [animation-delay:1s]" />
            </div>
          </div>

          <img
            src="/assets/ai-interview-coach.png"
            alt="Male AI interview coach with a headset and tablet"
            width={1062}
            height={868}
            className="relative z-10 mx-auto w-[92%] h-auto"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-transparent via-background/55 to-background dark:via-background/35 dark:to-background" />

          {/* Dynamic Speaking Waveform Overlay */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 10 }}
                className="absolute z-30 bottom-32 left-4 md:-left-4 px-4 py-3 rounded-2xl bg-surface-elevated/95 backdrop-blur border border-border shadow-card flex flex-col gap-1.5 w-48 text-left"
              >
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold animate-pulse">● AI speaking...</p>
                <div className="flex items-end gap-1 h-6">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [4, 16 + Math.random() * 8, 4] }}
                      transition={{
                        duration: 0.3 + Math.random() * 0.2,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: i * 0.03,
                      }}
                      className="w-1 bg-primary rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
