import { motion } from "framer-motion";
import { Building2, Briefcase, Award, ShieldCheck, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const companyFeatures = [
  {
    icon: Briefcase,
    title: "Job Postings & Custom Criteria",
    desc: "Create and publish targeted job postings with customizable experience levels, skill tags, passing score thresholds, and language preferences (English or Somali).",
  },
  {
    icon: Award,
    title: "Automated AI Interviews & Scoring",
    desc: "Automate technical, behavioral, and role-specific interviews with realistic AI evaluation, scoring candidates instantly across key competency areas.",
  },
  {
    icon: Users,
    title: "Candidate Shortlisting & Portal",
    desc: "Manage applicant pipelines, review full transcriptions and audio recordings, compare candidate scores, and shortlist top talent in one centralized dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Proctored Identity & Security Checks",
    desc: "Ensure interview integrity with automated facial verification, multi-face detection alerts, and real-time identity security monitoring.",
  },
];

export function Companies() {
  return (
    <section id="companies" className="relative py-20 md:py-24 bg-surface/50 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-primary">
            <Building2 className="h-3.5 w-3.5" />
            <span>Enterprise & Hiring Managers</span>
          </div>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
            Empower your team with <span className="text-gradient">Company Portals</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Transform high-volume hiring with AI-driven screening. Save hundreds of recruiter hours while hiring higher quality talent faster.
          </p>
        </motion.div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {companyFeatures.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
              className="p-6 rounded-2xl bg-card border border-border shadow-card hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center mb-5">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-semibold shadow-glow hover:shadow-elegant hover:-translate-y-0.5 transition-all"
          >
            Access Company Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
