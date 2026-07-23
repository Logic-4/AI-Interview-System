/**
 * seedDemoData.js
 * ─────────────────────────────────────────────────────────────
 * Seeds realistic demo data into MongoDB Atlas for the demo account.
 * Usage (from the /backend folder):  npm run seed:demo
 * ─────────────────────────────────────────────────────────────
 */

// Force Node.js to use Google DNS — fixes SRV lookup failures
// that occur when the local Windows DNS resolver blocks SRV queries.
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');

// ─── Helpers ────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Demo Interview Definitions ─────────────────────────────
const INTERVIEWS = [
  {
    title: 'Full-Stack Developer – React & Node.js',
    type: 'technical',
    difficulty: 'mid',
    domain: 'technology',
    jobRole: 'Full-Stack Developer',
    focusSkills: ['React', 'Node.js', 'REST APIs', 'MongoDB'],
    daysAgo: 58,
    overallScore: 72,
    catScores: { communication: 75, technicalAccuracy: 70, problemSolving: 68, codeQuality: 74, confidence: 73 },
    strengths: ['Clear communication of complex ideas', 'Strong understanding of React lifecycle', 'Good API design instincts'],
    improvements: ['Deepen knowledge of database indexing', 'Practice time complexity analysis', 'Work on CSS-in-JS patterns'],
    recommendations: ['Study advanced React patterns (render props, compound components)', 'Practice LeetCode medium-level problems daily', 'Build a full-stack project with authentication'],
    detailedFeedback: 'Overall a solid performance for a mid-level candidate. You demonstrated good command of the React ecosystem and were able to articulate Node.js concepts clearly. The main areas to focus on are algorithmic thinking and database optimization. Your communication was confident and structured — keep up that approach.',
  },
  {
    title: 'Behavioral Interview – Team Leadership',
    type: 'behavioral',
    difficulty: 'mid',
    domain: 'technology',
    jobRole: 'Engineering Team Lead',
    focusSkills: ['Leadership', 'Conflict Resolution', 'Agile', 'Communication'],
    daysAgo: 52,
    overallScore: 85,
    catScores: { communication: 90, technicalAccuracy: 78, problemSolving: 82, codeQuality: 80, confidence: 95 },
    strengths: ['Exceptional storytelling using STAR method', 'High emotional intelligence in conflict scenarios', 'Very confident delivery'],
    improvements: ['Provide more quantitative outcomes in answers', 'Expand on cross-functional collaboration examples'],
    recommendations: ['Prepare 10 STAR stories with measurable outcomes', 'Practice "tell me about a failure" responses', 'Research company culture before interviews'],
    detailedFeedback: 'Outstanding behavioral interview. Your use of the STAR method was consistent and your answers showed genuine leadership maturity. The confidence in your delivery stood out. To further strengthen your responses, incorporate metrics and measurable impact where possible.',
  },
  {
    title: 'System Design – Scalable Chat Application',
    type: 'system-design',
    difficulty: 'senior',
    domain: 'technology',
    jobRole: 'Senior Software Engineer',
    focusSkills: ['System Design', 'Scalability', 'Microservices', 'WebSockets'],
    daysAgo: 47,
    overallScore: 63,
    catScores: { communication: 65, technicalAccuracy: 60, problemSolving: 62, codeQuality: 65, confidence: 63 },
    strengths: ['Good high-level architecture sketch', 'Identified key bottlenecks early', 'Asked clarifying questions'],
    improvements: ['Need deeper understanding of CAP theorem tradeoffs', 'Elaborate on database sharding strategies', 'Discuss load balancing in more detail'],
    recommendations: ['Study Designing Data-Intensive Applications (Kleppmann)', 'Practice whiteboard system design problems weekly', 'Review case studies of large-scale systems (WhatsApp, Slack)'],
    detailedFeedback: 'A challenging question that revealed areas for growth. You correctly identified the core components needed for a chat system but struggled with deep-diving into the trade-offs. The architecture was sound at a high level, but needs more technical depth for a senior role.',
  },
  {
    title: 'HR Interview – Career Goals & Culture Fit',
    type: 'hr',
    difficulty: 'junior',
    domain: 'technology',
    jobRole: 'Software Engineer',
    focusSkills: ['Communication', 'Career Planning', 'Culture Fit', 'Motivation'],
    daysAgo: 40,
    overallScore: 88,
    catScores: { communication: 92, technicalAccuracy: 80, problemSolving: 85, codeQuality: 82, confidence: 91 },
    strengths: ['Very articulate and polished answers', 'Demonstrated strong self-awareness', 'Excellent understanding of company values'],
    improvements: ['Elaborate more on long-term 5-year vision', 'Tie personal goals more directly to company mission'],
    recommendations: ['Research target companies thoroughly before interviews', 'Prepare answers on salary expectations', 'Practice "why do you want to leave?" responses'],
    detailedFeedback: 'Excellent HR interview performance. You came across as professional, self-aware, and genuinely enthusiastic. Your communication was polished and your answers aligned well with common company values. A very strong culture-fit impression.',
  },
  {
    title: 'JavaScript Deep Dive – Async & Closures',
    type: 'technical',
    difficulty: 'mid',
    domain: 'technology',
    jobRole: 'Frontend Developer',
    focusSkills: ['JavaScript', 'Async/Await', 'Closures', 'Event Loop'],
    daysAgo: 34,
    overallScore: 79,
    catScores: { communication: 78, technicalAccuracy: 82, problemSolving: 76, codeQuality: 80, confidence: 79 },
    strengths: ['Strong grasp of Promise chains and async/await', 'Explained event loop clearly with examples', 'Good code structure in live coding'],
    improvements: ['Closures in loops need more practice', 'Memory leak detection could be stronger'],
    recommendations: ["Study JavaScript: The Good Parts and You Don't Know JS", 'Practice building small async utilities from scratch', 'Review garbage collection and memory management'],
    detailedFeedback: "A well-rounded JavaScript technical interview. You clearly understand modern async patterns and were able to explain the event loop in a way an interviewer would appreciate. Closures in tricky scenarios (like loops) tripped you up — that's a common stumbling block worth drilling more.",
  },
  {
    title: 'Mixed Interview – Backend Systems & Soft Skills',
    type: 'mixed',
    difficulty: 'senior',
    domain: 'technology',
    jobRole: 'Backend Engineer',
    focusSkills: ['Node.js', 'Databases', 'Leadership', 'System Architecture'],
    daysAgo: 28,
    overallScore: 81,
    catScores: { communication: 83, technicalAccuracy: 80, problemSolving: 79, codeQuality: 82, confidence: 81 },
    strengths: ['Balanced technical depth with soft skills', 'Strong database query optimization knowledge', 'Confident handling of ambiguous questions'],
    improvements: ['Kubernetes and container orchestration knowledge gaps', 'More concise answers under time pressure'],
    recommendations: ['Complete Docker & Kubernetes certification', 'Time yourself answering questions (aim for 2 min behavioral, 5 min technical)', 'Practice microservices architecture patterns'],
    detailedFeedback: 'A well-rounded mixed interview showing competence across both technical and behavioral dimensions. Your database knowledge was impressive and your soft skills added real value. The main gap is in cloud/container orchestration which is increasingly important for senior backend roles.',
  },
  {
    title: 'Healthcare Tech – Data Privacy & Compliance',
    type: 'technical',
    difficulty: 'mid',
    domain: 'healthcare',
    jobRole: 'Healthcare Software Engineer',
    focusSkills: ['HIPAA', 'Data Security', 'Python', 'Healthcare APIs'],
    daysAgo: 21,
    overallScore: 74,
    catScores: { communication: 76, technicalAccuracy: 72, problemSolving: 73, codeQuality: 74, confidence: 75 },
    strengths: ['Good awareness of HIPAA compliance requirements', 'Explained data encryption approaches well', 'Showed genuine interest in healthcare domain'],
    improvements: ['HL7 FHIR standard knowledge needs strengthening', 'EHR system integration experience limited'],
    recommendations: ['Get certified in HIPAA compliance', 'Build a sample healthcare API using FHIR standard', 'Study common healthcare data models'],
    detailedFeedback: 'Solid performance for healthcare technology interview. Your compliance awareness was good and you showed the right mindset for working in a regulated environment. To break into this domain fully, invest time in FHIR and EHR integration hands-on experience.',
  },
  {
    title: 'Algorithm Challenge – Arrays & Dynamic Programming',
    type: 'technical',
    difficulty: 'senior',
    domain: 'technology',
    jobRole: 'Software Engineer',
    focusSkills: ['Algorithms', 'Dynamic Programming', 'Arrays', 'Big-O Notation'],
    daysAgo: 15,
    overallScore: 67,
    catScores: { communication: 70, technicalAccuracy: 65, problemSolving: 63, codeQuality: 68, confidence: 69 },
    strengths: ['Approached problems systematically with brute force first', 'Good Big-O notation explanations', 'Clean code organization'],
    improvements: ['Dynamic programming patterns need significant practice', 'Struggled with memoization implementation', 'Optimization from O(n^2) to O(n) needs more drill'],
    recommendations: ['Complete NeetCode 150 roadmap', 'Focus on DP patterns: 0/1 knapsack, LCS, LIS', 'Practice explaining solutions out loud while coding'],
    detailedFeedback: 'Algorithm interviews at senior level are challenging and this session showed that DP is your main weakness. The good news is your problem decomposition instinct is solid — you just need to recognize DP patterns faster. Consistent daily LeetCode practice over the next 4-6 weeks will make a significant difference.',
  },
  {
    title: 'Finance Tech – Risk Assessment Systems',
    type: 'technical',
    difficulty: 'mid',
    domain: 'finance',
    jobRole: 'FinTech Software Engineer',
    focusSkills: ['Python', 'Risk Models', 'Financial APIs', 'Data Pipelines'],
    daysAgo: 10,
    overallScore: 77,
    catScores: { communication: 78, technicalAccuracy: 76, problemSolving: 77, codeQuality: 78, confidence: 76 },
    strengths: ['Good understanding of financial data pipeline requirements', 'Explained risk model components clearly', 'Showed awareness of regulatory constraints'],
    improvements: ['Deeper Python data science library knowledge needed', 'Real-time data streaming patterns could be stronger'],
    recommendations: ['Study pandas, numpy for financial modeling', 'Learn Apache Kafka for real-time financial data', 'Review common fintech regulatory frameworks (SOX, PCI-DSS)'],
    detailedFeedback: 'Good showing for a fintech interview. You demonstrated domain awareness that many pure software engineers lack. The technical gaps are mainly in the data engineering space which is very learnable. Your regulatory awareness was a real differentiator.',
  },
  {
    title: 'Behavioral – Handling Failure & Resilience',
    type: 'behavioral',
    difficulty: 'junior',
    domain: 'technology',
    jobRole: 'Junior Software Developer',
    focusSkills: ['Resilience', 'Growth Mindset', 'Team Collaboration', 'Problem Solving'],
    daysAgo: 7,
    overallScore: 91,
    catScores: { communication: 93, technicalAccuracy: 88, problemSolving: 90, codeQuality: 89, confidence: 95 },
    strengths: ['Exceptional self-reflection and growth mindset demonstrated', 'Failure story was authentic and compelling', 'Outstanding confidence without arrogance'],
    improvements: ['Add more technical context to team collaboration answers'],
    recommendations: ['Maintain this high standard in actual interviews', 'Prepare 2-3 more STAR stories on resilience themes', 'Practice with a mock interviewer for final polish'],
    detailedFeedback: 'One of the strongest behavioral interviews in this session history. Your authenticity in discussing failure while pivoting to growth and outcomes was genuinely impressive. This level of self-awareness and communication will serve you extremely well in real interviews. Keep this up.',
  },
  {
    title: 'Full-Stack Interview – Advanced Concepts',
    type: 'technical',
    difficulty: 'senior',
    domain: 'technology',
    jobRole: 'Senior Full-Stack Engineer',
    focusSkills: ['TypeScript', 'GraphQL', 'AWS', 'CI/CD', 'Testing'],
    daysAgo: 4,
    overallScore: 83,
    catScores: { communication: 84, technicalAccuracy: 85, problemSolving: 81, codeQuality: 83, confidence: 82 },
    strengths: ['TypeScript type system knowledge was impressive', 'GraphQL resolver design was well thought-out', 'Good CI/CD pipeline understanding'],
    improvements: ['AWS advanced services (Lambda, Step Functions) need more depth', 'Testing coverage strategies could be more comprehensive'],
    recommendations: ['Get AWS Solutions Architect Associate certification', 'Build a serverless project with Lambda and API Gateway', 'Study testing pyramid and TDD methodologies'],
    detailedFeedback: 'Strong senior-level performance. Your TypeScript and GraphQL knowledge are clearly production-level. The AWS gaps are common for those who have primarily used managed services. Pursuing AWS certification would round out your profile significantly.',
  },
  {
    title: 'System Design – E-Commerce Platform at Scale',
    type: 'system-design',
    difficulty: 'lead',
    domain: 'technology',
    jobRole: 'Staff Engineer',
    focusSkills: ['Distributed Systems', 'Caching', 'CDN', 'Payment Systems', 'Search'],
    daysAgo: 2,
    overallScore: 78,
    catScores: { communication: 80, technicalAccuracy: 78, problemSolving: 76, codeQuality: 79, confidence: 77 },
    strengths: ['Excellent CDN and caching layer design', 'Payment system security considerations were thorough', 'Good database partitioning strategy'],
    improvements: ['Search infrastructure (Elasticsearch) needs more depth', 'Disaster recovery planning was superficial'],
    recommendations: ['Study distributed systems papers (Google Spanner, Dynamo)', 'Design 3 more large-scale systems end-to-end for practice', 'Learn Elasticsearch for search architecture interviews'],
    detailedFeedback: 'Solid staff engineer-level system design. Your caching and payment architecture showed senior-level thinking. For a lead/staff role, interviewers expect you to also address operational concerns (observability, disaster recovery, on-call escalation paths) which were missing here.',
  },
];

const IN_PROGRESS = [
  {
    title: 'Cloud Architecture – AWS & Microservices',
    type: 'technical',
    difficulty: 'senior',
    domain: 'technology',
    jobRole: 'Cloud Engineer',
    focusSkills: ['AWS', 'Microservices', 'Terraform', 'Kubernetes'],
    daysAgo: 0,
  },
  {
    title: 'Leadership & Strategy – Engineering Manager',
    type: 'behavioral',
    difficulty: 'lead',
    domain: 'technology',
    jobRole: 'Engineering Manager',
    focusSkills: ['Strategy', 'People Management', 'OKRs', 'Hiring'],
    daysAgo: 1,
  },
];

const QUESTION_SETS = {
  technical: [
    { text: 'Explain the difference between REST and GraphQL. When would you choose one over the other?', category: 'API Design', difficulty: 'medium' },
    { text: 'How does Node.js handle asynchronous operations internally? Describe the event loop.', category: 'JavaScript', difficulty: 'hard' },
    { text: 'What are the SOLID principles and how do you apply them in your daily work?', category: 'Software Design', difficulty: 'medium' },
    { text: 'Describe a time you optimized a slow database query. What was the problem and your solution?', category: 'Databases', difficulty: 'hard' },
    { text: 'What is the difference between horizontal and vertical scaling? Give examples of when to use each.', category: 'Scalability', difficulty: 'medium' },
    { text: "Explain how React's reconciliation algorithm works and why it matters for performance.", category: 'Frontend', difficulty: 'hard' },
    { text: 'Walk me through how you would implement authentication in a full-stack application.', category: 'Security', difficulty: 'medium' },
  ],
  behavioral: [
    { text: 'Tell me about a time you had a conflict with a teammate. How did you resolve it?', category: 'Conflict Resolution', difficulty: 'medium' },
    { text: "Describe the most challenging project you've worked on. What made it challenging and what did you learn?", category: 'Project Experience', difficulty: 'medium' },
    { text: 'Tell me about a time you failed. What happened and what did you do differently afterwards?', category: 'Resilience', difficulty: 'hard' },
    { text: 'How do you prioritize tasks when you have multiple deadlines competing for your attention?', category: 'Time Management', difficulty: 'easy' },
    { text: 'Describe a situation where you had to influence a decision without formal authority.', category: 'Leadership', difficulty: 'hard' },
    { text: 'Tell me about a time you went above and beyond for a customer or stakeholder.', category: 'Customer Focus', difficulty: 'medium' },
  ],
  'system-design': [
    { text: 'Design a URL shortening service like bit.ly. Walk me through your architecture.', category: 'System Design', difficulty: 'medium' },
    { text: 'How would you design a notification system that handles 10 million users?', category: 'Scalability', difficulty: 'hard' },
    { text: 'Design a distributed cache. How do you handle cache invalidation and consistency?', category: 'Distributed Systems', difficulty: 'hard' },
    { text: 'What trade-offs would you consider when choosing between SQL and NoSQL for a new product?', category: 'Database Design', difficulty: 'medium' },
    { text: 'How would you design the backend for a real-time collaborative document editor?', category: 'Real-time Systems', difficulty: 'hard' },
    { text: 'Explain the CAP theorem and describe a scenario where you had to make a CAP trade-off.', category: 'Distributed Systems', difficulty: 'hard' },
  ],
  hr: [
    { text: 'Tell me about yourself and your career journey so far.', category: 'Introduction', difficulty: 'easy' },
    { text: 'Why are you looking for a new opportunity? What motivates you?', category: 'Motivation', difficulty: 'easy' },
    { text: 'Where do you see yourself in 5 years?', category: 'Career Goals', difficulty: 'medium' },
    { text: 'What are your greatest strengths and one area you are actively working to improve?', category: 'Self-Assessment', difficulty: 'easy' },
    { text: 'Why do you want to work at this company specifically?', category: 'Culture Fit', difficulty: 'medium' },
    { text: 'What does a healthy work environment look like to you?', category: 'Culture', difficulty: 'easy' },
  ],
  mixed: [
    { text: 'Walk me through a complex technical problem you solved recently.', category: 'Technical', difficulty: 'hard' },
    { text: 'Describe your experience with agile methodologies. How do you handle sprint planning?', category: 'Process', difficulty: 'medium' },
    { text: 'How do you stay current with new technologies and industry trends?', category: 'Growth', difficulty: 'easy' },
    { text: 'Tell me about a time you mentored a junior developer.', category: 'Leadership', difficulty: 'medium' },
    { text: 'What is your approach to code reviews? Both giving and receiving feedback.', category: 'Collaboration', difficulty: 'medium' },
    { text: 'Describe how you would debug a performance issue in a production system.', category: 'Technical', difficulty: 'hard' },
    { text: 'How do you handle technical debt in a fast-moving team?', category: 'Technical Leadership', difficulty: 'hard' },
  ],
};

const USER_ANSWERS = {
  technical: [
    'REST uses fixed endpoints and HTTP methods while GraphQL gives clients the power to request exactly the data they need. I would choose REST for simple CRUD operations and public APIs, but GraphQL shines when you have complex, nested data requirements or multiple client types with different data needs.',
    'Node.js is single-threaded but uses libuv under the hood which provides an event loop with different phases: timers, I/O callbacks, idle, poll, check, and close callbacks. Async operations get offloaded to the OS or thread pool, and callbacks are queued back into the event loop when complete.',
    'SOLID stands for Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. In practice I apply them by keeping classes focused on one concern, programming to interfaces, and using dependency injection. This makes code much more testable and maintainable.',
    'I once had a query scanning 2 million user records for a reporting feature. I added a composite index on the most filtered columns, rewrote the query to avoid N+1 problems, and added a caching layer for frequently accessed reports. This reduced response time from 8 seconds to 200ms.',
    'Horizontal scaling means adding more machines and distributing load — great for stateless services. Vertical scaling means upgrading the machine resources — simpler but has limits. For a web app I would horizontal scale the API layer and vertical scale the database up to a point, then shard.',
    "React's reconciliation uses a virtual DOM diffing algorithm. When state changes, it creates a new vDOM tree and diffs it against the previous one using keys to identify stable elements. Keys are critical — bad key usage causes unnecessary re-renders and understanding this helps avoid performance pitfalls.",
    'For authentication I would use JWT tokens — short-lived access tokens stored in memory and refresh tokens in httpOnly cookies. The login endpoint validates credentials, issues both tokens. Protected routes check the access token. A refresh endpoint uses the cookie to issue a new access token when it expires.',
  ],
  behavioral: [
    'During a product sprint, a teammate and I disagreed on the API design approach. Rather than escalate, I set up a 30-minute design session where we each presented our approach with trade-offs. We ended up combining both ideas and the feature shipped on time.',
    'My most challenging project was rebuilding our authentication system while the old one was still live with zero downtime. I implemented a dual-write strategy, gradually migrated users, and ran both systems in parallel for 3 weeks.',
    'I led a feature launch that had a critical bug discovered in production. I owned the incident, communicated proactively with stakeholders, and led the hotfix effort. Afterwards I wrote a detailed post-mortem and implemented better staging environment testing.',
    'I use a combination of urgency-impact matrix and stakeholder communication. I list all tasks, assess their business impact and deadline, then communicate proactively when something needs to slip. I also time-block my calendar to protect deep work periods.',
    'As a mid-level engineer I once convinced our tech lead to adopt TypeScript by building a small proof-of-concept that demonstrated 30% fewer runtime errors in a module I had rewritten. Data and demonstration were more persuasive than argument.',
    'A customer was blocked before a major demo. I stayed 3 hours late to fix their issue, documented the fix clearly, and followed up the next day. They gave very positive feedback in the next sprint review.',
  ],
  'system-design': [
    'For a URL shortener I would use base62 encoding of an auto-incrementing ID, stored in a distributed KV store like Redis for hot URLs and a relational DB for persistence. A CDN layer handles the 301 redirects.',
    'A notification system at 10M users needs a message queue (Kafka) to decouple producers from consumers. Multiple consumer workers handle different channels — push, email, SMS. User preferences determine routing.',
    'A distributed cache like Redis can use consistent hashing to distribute keys across nodes. Cache invalidation is the hardest part — I would use TTL-based expiry as the safety net plus explicit invalidation on write.',
    'SQL for structured data with complex relationships and ACID requirements — financial transactions, user records. NoSQL for flexible schemas, high write throughput, and horizontal scalability — user activity logs, product catalogs.',
    'Real-time collaboration needs operational transformation or CRDTs to handle concurrent edits. Each operation is transformed relative to concurrent operations before applying. WebSockets maintain persistent connections.',
    'CAP says you can only guarantee 2 of: Consistency, Availability, Partition tolerance. Since partitions always happen in distributed systems, you choose CP or AP. For financial systems I choose CP — unavailable is better than inconsistent.',
  ],
  hr: [
    'I am a software engineer with 3 years of experience building web applications. I started with frontend development, then moved full-stack because I was curious about the backend. My journey has been driven by curiosity.',
    'I have grown a lot in my current role but I am looking for a team where I can take on more technical leadership and work on larger-scale systems. I am motivated by building products that genuinely help people.',
    'In 5 years I see myself as a senior or staff engineer who leads technical decisions for a significant product area. I want to have mentored junior engineers and contributed to the technical culture of my team.',
    'My greatest strengths are my curiosity and ability to learn quickly. An area I am actively improving is public speaking and presenting technical ideas to non-technical stakeholders.',
    'I have followed this company for a while and what really attracts me is the engineering culture — specifically the emphasis on code quality and the open-source contributions from the team.',
    'A healthy work environment for me means psychological safety — being able to share ideas and admit mistakes without fear. It also means clear communication, respect for focus time, and genuine investment in growth.',
  ],
  mixed: [
    'Recently I optimized our search feature that was timing out for large datasets. I profiled the code, found 3 N+1 query problems, added appropriate indexes, and implemented pagination. Response time went from 5s to under 300ms.',
    'I am a big believer in agile when it is done right. Sprint planning should involve the whole team in estimation. I push for breaking down large user stories and leaving 20% of sprint capacity for tech debt.',
    'I subscribe to engineering blogs, follow key engineers on social media, and do a weekly read of the Hacker News front page. I also try to build one small project per quarter using a technology I want to learn.',
    'I mentored a junior developer who was struggling with async JavaScript. I set up weekly 30-minute pair programming sessions and made them code reviewer on my PRs. After 3 months they were independently delivering features.',
    'For code reviews I look for correctness, then readability, then edge cases. I try to frame feedback as questions rather than direct criticism. I also appreciate thorough reviews of my code — it is a learning mechanism.',
    'I start with metrics and logs. Form a hypothesis about the bottleneck. Add targeted instrumentation if needed. I never deploy a fix to production without a rollback plan. Slow and methodical beats fast and risky.',
    'Tech debt is real but zero tech debt is a myth. I advocate for a 20% rule — at least 20% of sprint capacity for improvements and cleanup. Framing debt as risk helps get buy-in from non-technical stakeholders.',
  ],
};

const AI_FEEDBACK = [
  'Good answer that covers the key concepts. Consider adding a concrete example from your experience to strengthen the response.',
  'Strong response with good structure. The technical accuracy was high and you communicated the concept clearly.',
  'Excellent answer. You went beyond the surface level and showed real depth of understanding.',
  'Decent answer but could be more specific. Try to quantify outcomes and use more precise technical terminology.',
  'Very good response. The STAR method was applied well and the outcome was clearly articulated.',
  'Solid answer. Adding one more technical detail about the implementation would make this even stronger.',
  'Good breadth of knowledge shown. For a senior role, try to connect this concept to production experience.',
];

// ─── Main Seed Function ──────────────────────────────────────
async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI not set in .env');
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const user = await User.findOne({ name: /mohamud/i }) || await User.findOne({});
  if (!user) {
    console.error('No users found. Please register first.');
    process.exit(1);
  }
  console.log(`Seeding data for user: ${user.name} (${user._id})\n`);

  const existing = await Interview.findOne({ user: user._id, tags: 'demo-seed' });
  if (existing) {
    console.log('Demo data already exists (found tag: demo-seed). Skipping.');
    await mongoose.disconnect();
    return;
  }

  let totalInterviews = 0;
  let totalQuestions = 0;
  let totalFeedbacks = 0;

  console.log('Seeding completed interviews...');
  for (const def of INTERVIEWS) {
    const createdAt = daysAgo(def.daysAgo);
    const startedAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
    const completedAt = new Date(startedAt.getTime() + rand(25, 55) * 60 * 1000);

    const interview = await Interview.create({
      user: user._id,
      title: def.title,
      type: def.type,
      difficulty: def.difficulty,
      domain: def.domain,
      jobRole: def.jobRole,
      focusSkills: def.focusSkills,
      status: 'completed',
      duration: rand(25, 60),
      overallScore: def.overallScore,
      aiModel: 'gemma-3-technical-interviewer',
      tags: ['demo-seed'],
      questionsReady: true,
      generationStatus: 'ready',
      expectedQuestionCount: 6,
      language: 'english',
      startedAt,
      completedAt,
      createdAt,
      updatedAt: completedAt,
    });

    const qSet = QUESTION_SETS[def.type] || QUESTION_SETS.technical;
    const aSet = USER_ANSWERS[def.type] || USER_ANSWERS.technical;
    const qCount = rand(5, Math.min(7, qSet.length));
    const questionIds = [];

    for (let i = 0; i < qCount; i++) {
      const qDef = qSet[i % qSet.length];
      const baseScore = def.catScores.technicalAccuracy + rand(-8, 8);
      const score = Math.min(100, Math.max(0, baseScore));

      const q = await Question.create({
        interview: interview._id,
        text: qDef.text,
        category: qDef.category,
        difficulty: qDef.difficulty,
        expectedAnswer: 'A thorough answer should cover the key concepts, trade-offs, and include a real-world example from your experience.',
        userAnswer: aSet[i % aSet.length],
        score,
        evaluationStatus: 'completed',
        aiFeedback: AI_FEEDBACK[i % AI_FEEDBACK.length],
        timeSpent: rand(90, 300),
        order: i,
        isAnswered: true,
        createdAt,
      });
      questionIds.push(q._id);
      totalQuestions++;
    }

    interview.questions = questionIds;
    await interview.save();

    await Feedback.create({
      interview: interview._id,
      user: user._id,
      overallScore: def.overallScore,
      categories: {
        communication: {
          score: def.catScores.communication,
          feedback: def.catScores.communication >= 80
            ? 'Clear, structured, and confident delivery throughout the session.'
            : 'Generally clear but could benefit from more structured delivery and concrete examples.',
        },
        technicalAccuracy: {
          score: def.catScores.technicalAccuracy,
          feedback: def.catScores.technicalAccuracy >= 80
            ? 'Demonstrated strong command of technical concepts with accurate explanations.'
            : 'Core concepts understood but some inaccuracies in advanced topics.',
        },
        problemSolving: {
          score: def.catScores.problemSolving,
          feedback: def.catScores.problemSolving >= 80
            ? 'Systematic approach to breaking down problems. Good at considering edge cases.'
            : 'Good problem decomposition but needs to push further toward optimal solutions.',
        },
        codeQuality: {
          score: def.catScores.codeQuality,
          feedback: def.catScores.codeQuality >= 80
            ? 'Clean, readable code with good naming conventions and structure.'
            : 'Functional code but could benefit from better organization and naming.',
        },
        confidence: {
          score: def.catScores.confidence,
          feedback: def.catScores.confidence >= 80
            ? 'Highly confident delivery. Handled uncertainty gracefully without losing composure.'
            : 'Reasonably confident but hesitation evident on harder questions.',
        },
      },
      strengths: def.strengths,
      improvements: def.improvements,
      recommendations: def.recommendations,
      detailedFeedback: def.detailedFeedback,
      aiModel: 'gemma-3-technical-interviewer',
      createdAt: completedAt,
    });

    totalInterviews++;
    totalFeedbacks++;
    console.log(`  [${def.type}] ${def.title} — Score: ${def.overallScore}/100`);
  }

  console.log('\nSeeding in-progress interviews...');
  for (const def of IN_PROGRESS) {
    const createdAt = daysAgo(def.daysAgo);
    const startedAt = new Date(createdAt.getTime() + 3 * 60 * 1000);

    const interview = await Interview.create({
      user: user._id,
      title: def.title,
      type: def.type,
      difficulty: def.difficulty,
      domain: def.domain,
      jobRole: def.jobRole,
      focusSkills: def.focusSkills,
      status: 'in-progress',
      duration: 45,
      aiModel: 'gemma-3-technical-interviewer',
      tags: ['demo-seed'],
      questionsReady: true,
      generationStatus: 'ready',
      expectedQuestionCount: 6,
      language: 'english',
      startedAt,
      createdAt,
    });

    const qSet = QUESTION_SETS[def.type] || QUESTION_SETS.technical;
    const questionIds = [];

    for (let i = 0; i < 6; i++) {
      const qDef = qSet[i % qSet.length];
      const isAnswered = i < 2;
      const q = await Question.create({
        interview: interview._id,
        text: qDef.text,
        category: qDef.category,
        difficulty: qDef.difficulty,
        expectedAnswer: 'A thorough answer should cover the key concepts, trade-offs, and a real-world example.',
        userAnswer: isAnswered ? (USER_ANSWERS[def.type] || USER_ANSWERS.technical)[i] : '',
        score: isAnswered ? rand(65, 90) : null,
        evaluationStatus: isAnswered ? 'completed' : 'pending',
        aiFeedback: isAnswered ? AI_FEEDBACK[i % AI_FEEDBACK.length] : '',
        timeSpent: isAnswered ? rand(90, 240) : 0,
        order: i,
        isAnswered,
        createdAt,
      });
      questionIds.push(q._id);
      totalQuestions++;
    }

    interview.questions = questionIds;
    await interview.save();
    totalInterviews++;
    console.log(`  [${def.type}] ${def.title} — In Progress`);
  }

  await User.findByIdAndUpdate(user._id, { interviewCount: totalInterviews });

  console.log('\n===================================================');
  console.log('SEED COMPLETE');
  console.log('===================================================');
  console.log(`  Interviews  : ${totalInterviews} (${INTERVIEWS.length} completed, ${IN_PROGRESS.length} in-progress)`);
  console.log(`  Questions   : ${totalQuestions}`);
  console.log(`  Feedbacks   : ${totalFeedbacks}`);
  console.log(`  User        : ${user.name}`);
  console.log('===================================================\n');

  await mongoose.disconnect();
  console.log('Disconnected. Ready for screenshots!\n');
}

seed().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
