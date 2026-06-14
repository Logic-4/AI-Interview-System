export const DOMAIN_ROLES: Record<string, string[]> = {
  technology: ["Full Stack Developer", "Cybersecurity Analyst"],
  healthcare: ["Registered Nurse (ER)", "Hospital Administrator"],
  finance: ["Financial Analyst", "Supply Chain Manager"],
  engineering: ["Civil Engineer", "Mechanical Engineer"],
  education: ["High School Science Teacher", "University Admissions Officer"],
  legal: ["Legal Assistant", "Urban Planner"],
};

export const DOMAIN_LABELS: Record<string, string> = {
  technology: "Technology",
  healthcare: "Healthcare",
  finance: "Finance",
  engineering: "Engineering",
  education: "Education",
  legal: "Legal",
};

export const QUESTION_CATEGORIES = [
  "intro",
  "conceptual",
  "situational",
  "behavioral",
  "outro",
];

export const DOMAINS = Object.keys(DOMAIN_ROLES);
