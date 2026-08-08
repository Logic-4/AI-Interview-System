export const TECHNOLOGY_SPECIALIZATIONS = [
  "Frontend Development",
  "Backend Development",
  "Mobile App Development",
  "DevOps & Infrastructure",
  "Cloud Engineering",
  "Database Administration",
  "Data Science & Analytics",
  "Machine Learning & AI",
  "Cybersecurity",
  "Software Architecture",
];

export const DOMAIN_ROLES: Record<string, string[]> = {
  technology: TECHNOLOGY_SPECIALIZATIONS,
};

export const DOMAIN_LABELS: Record<string, string> = {
  technology: "Technology",
};

export const QUESTION_CATEGORIES = [
  "intro",
  "conceptual",
  "situational",
  "behavioral",
  "outro",
];

export const DOMAINS = Object.keys(DOMAIN_ROLES);
