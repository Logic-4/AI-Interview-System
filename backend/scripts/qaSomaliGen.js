require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { generateInterviewQuestions } = require('../services/gemmaService');

async function main() {
  const specs = [
    { label: 'Somali · junior · Frontend+Backend · no focus skills', difficulty: 'junior', jobRole: 'Frontend Development & Backend Development', focusSkills: [] },
    { label: 'Somali · mid · focus [React, PostgreSQL]', difficulty: 'mid', jobRole: 'Frontend Development & Backend Development', focusSkills: ['React', 'PostgreSQL'] },
    { label: 'Somali · senior · Cybersecurity · focus [Encryption]', difficulty: 'senior', jobRole: 'Cybersecurity', focusSkills: ['Encryption'] },
  ];
  for (const spec of specs) {
    console.log(`\n${'='.repeat(70)}\n${spec.label}\n${'='.repeat(70)}`);
    try {
      const questions = await generateInterviewQuestions('technology', spec.difficulty, 4, {
        jobRole: spec.jobRole,
        focusSkills: spec.focusSkills,
        language: 'somali',
        requestTimeoutMs: 60000,
      });
      questions.forEach((q, i) => console.log(`  [${i}] (${q.category}) ${q.text || '(EMPTY)'}`));
    } catch (err) {
      console.error(`  GENERATION ERROR: ${err.message}`);
    }
  }
  process.exit(0);
}
main();
