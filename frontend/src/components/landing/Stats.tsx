import { motion } from "framer-motion";

const stats = [
  { v: "100k+", l: "Interviews conducted" },
  { v: "92%", l: "Offer success rate" },
  { v: "4.9/5", l: "Average user rating" },
  { v: "48hr", l: "Avg. prep to confidence" },
];

export function Stats() {
  return (
    <section id="stats" className="relative py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative rounded-3xl border border-border bg-card overflow-hidden shadow-card">
          <div className="absolute inset-0 bg-mesh opacity-60" />
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="relative grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            {stats.map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="p-8 md:p-10 text-center"
              >
                <div className="text-5xl md:text-6xl font-display font-bold text-gradient">{s.v}</div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
