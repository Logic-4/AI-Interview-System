import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section id="cta" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[2.5rem] p-10 md:p-16 text-center bg-gradient-primary"
        >
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/15 blur-3xl animate-blob" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-blob [animation-delay:-8s]" />
          <div className="absolute inset-0 grid-pattern opacity-15" />

          <div className="relative">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Ready to ace your next interview?
            </h2>
            <p className="mt-5 text-lg text-white/85 max-w-xl mx-auto">
              Join thousands of candidates using InterviewAI Pro to land roles at the world's most ambitious companies.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 h-12 px-7 rounded-full bg-background text-foreground font-semibold shadow-elegant hover:-translate-y-0.5 transition-all"
              >
                Get started for free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-white/40 text-white font-semibold hover:bg-white/10 transition"
              >
                View features
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
