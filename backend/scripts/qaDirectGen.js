require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { generateInterviewQuestions } = require('../services/gemmaService');
const { buildInterviewPayload } = require('../services/promptPayloadService');

const CASES = [
  {
    label: 'SENIOR React (fresh job)',
    job: {
      title: 'Senior React Developer (QA)',
      description: 'Own our customer-facing dashboard rebuild in React 18 + TypeScript, with a heavy focus on state management architecture (Redux Toolkit) and performance (code-splitting, memoization). You will collaborate directly with design on a Tailwind-based component library and mentor two mid-level engineers.',
      requiredSkills: ['React', 'TypeScript', 'Redux', 'Tailwind CSS'],
      experienceLevel: 'senior',
      domain: 'technology',
      interviewLanguage: 'English',
      durationMinutes: 15,
      targetJobRole: '',
    },
    application: { candidateName: 'Amina Ali QA', resumeText: '6 years frontend, deep React + TypeScript, built a component library on Tailwind, owns Redux Toolkit state architecture for a fintech dashboard.' },
    count: 4,
  },
  {
    label: 'MID Node.js (fresh job)',
    job: {
      title: 'Backend Node.js Engineer (QA)',
      description: 'Build and maintain REST APIs on Node.js/Express backed by MongoDB, and add real-time features via Socket.io for our live-chat product. 2-4 years experience expected; you will not be expected to own infrastructure decisions.',
      requiredSkills: ['Node.js', 'MongoDB', 'Express', 'Socket.io'],
      experienceLevel: 'mid',
      domain: 'technology',
      interviewLanguage: 'English',
      durationMinutes: 15,
      targetJobRole: '',
    },
    application: { candidateName: 'Hassan Mohamed QA', resumeText: '3 years backend, Node/Express REST APIs, MongoDB schema design, added Socket.io real-time notifications to a support tool.' },
    count: 4,
  },
];

async function main() {
  for (const c of CASES) {
    console.log(`\n${'='.repeat(70)}\n${c.label}\n${'='.repeat(70)}`);
    const payload = buildInterviewPayload(c.job, c.application);
    console.log(`difficulty=${payload.difficulty} focusSkills=${JSON.stringify(payload.focusSkills)} jobRole="${payload.jobRole}"`);
    try {
      const questions = await generateInterviewQuestions(payload.domain, payload.difficulty, c.count, {
        ...payload,
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
