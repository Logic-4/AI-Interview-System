/**
 * End-to-end interview QA with timing instrumentation.
 *
 * Creates interviews through the real API, answers every question IN THE
 * INTERVIEW'S OWN LANGUAGE, completes, and generates the report — recording
 * how long each stage took so slow paths are visible.
 *
 * Language handling note: an earlier version of this harness read
 * `interview.language` from GET /interviews/:id/progress, which does not
 * select that field. It silently came back undefined, so Somali interviews
 * were answered in English and every Somali score was meaningless. Language is
 * now taken from the create response and asserted before any answer is sent.
 *
 * Usage: node scripts/qaE2E.js <email> <password>
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });

const BASE = 'http://localhost:5000/api/v1';
const [, , EMAIL, PASSWORD] = process.argv;
if (!EMAIL || !PASSWORD) {
  console.error('Usage: node scripts/qaE2E.js <email> <password>');
  process.exit(1);
}

let TOKEN = '';
const timings = [];

function record(label, ms, extra = {}) {
  timings.push({ label, ms, ...extra });
}

async function api(method, path, body, timeoutMs = 300000) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json.data ?? json;
}

/** Answers written for each language. Never cross-used — see the note above. */
const ANSWERS = {
  english: {
    strong: "A database index is a separate data structure, usually a B-tree, that keeps column values in sorted order with pointers back to the rows. It turns a full table scan into a logarithmic lookup, so reads get much faster. The trade-off is that every insert, update and delete must also maintain the index, so writes get slower and the index costs disk space. I'd add one for columns used in WHERE and JOIN clauses with high selectivity, and avoid indexing low-cardinality columns like a boolean flag.",
    medium: "An index makes queries faster because the database can find rows without scanning the whole table. You add it on columns you search by. It does use extra space though.",
    weak: "I don't really know, I haven't used that much.",
  },
  somali: {
    strong: "Index-ku waa qaab-dhismeed xog oo gaar ah, badanaa B-tree, kaas oo qiimayaasha tiirka ku hayo si habaysan isagoo tilmaamaya safafka asalka ah. Wuxuu ka dhigayaa raadinta mid degdeg ah halkii uu shaxda oo dhan sawiri lahaa, sidaas darteed akhrintu aad bay u dhaqsataa. Waxa ka soo horjeeda ayaa ah in wax kasta oo la geliyo ama la beddelo ay tahay in index-ka sidoo kale la cusboonaysiiyo, sidaas darteed qorista way gaabinaysaa, sidoo kale waxay qaadataa meel bakhaar ah. Waxaan ku dari lahaa tiirarka lagu isticmaalo WHERE iyo JOIN.",
    medium: "Index-ku wuxuu ka dhigayaa su'aalaha degdeg ah maxaa yeelay database-ku wuxuu heli karaa safafka isagoon shaxda oo dhan eegin. Waxaad ku dartaa tiirarka aad wax ka raadiso. Waxay isticmaashaa meel dheeraad ah.",
    weak: "Ma ogi, kuma shaqeeyn wax badan oo la xiriira.",
  },
};

async function login() {
  const t0 = Date.now();
  const data = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD }, 30000);
  TOKEN = data.accessToken;
  record('login', Date.now() - t0);
  console.log(`Logged in as ${data.user.email}`);
}

async function waitReady(id, label) {
  const t0 = Date.now();
  let firstQuestionMs = null;
  for (let i = 0; i < 150; i++) {
    const { interview } = await api('GET', `/interviews/${id}/progress`, null, 30000);
    const ready = (interview.questions || []).filter((q) => q.text).length;
    if (firstQuestionMs === null && ready >= 1) {
      firstQuestionMs = Date.now() - t0;
      record('first_question_ready', firstQuestionMs, { interview: label });
    }
    if (interview.questionsReady) {
      const total = Date.now() - t0;
      record('all_questions_ready', total, { interview: label, count: ready });
      return total;
    }
    if (interview.generationStatus === 'failed') {
      throw new Error(`generation failed: ${interview.generationError}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`timed out waiting for questions (${label})`);
}

async function runInterview(spec) {
  const { label, language, jobRole, focusSkills, duration, difficulty, domain } = spec;
  console.log(`\n${'='.repeat(70)}\n${label}\n${'='.repeat(70)}`);

  const tCreate = Date.now();
  const { interview: created } = await api('POST', '/interviews', {
    title: `QA ${label}`,
    difficulty,
    domain,
    language,
    duration,
    jobRole,
    focusSkills,
  }, 60000);
  record('create_interview', Date.now() - tCreate, { interview: label });

  // Language comes from the create response, which returns the full document.
  // Assert it rather than trusting the spec, so a backend default can never
  // silently put us back in the cross-language bug this harness once had.
  if (String(created.language).toLowerCase() !== language) {
    throw new Error(`language mismatch: asked for ${language}, interview says ${created.language}`);
  }
  const answers = ANSWERS[language];
  if (!answers) throw new Error(`no answer set for language ${language}`);
  console.log(`id=${created._id} lang=${created.language} role="${created.jobRole}" focus=${JSON.stringify(created.focusSkills)} ${duration}min ${difficulty}`);

  const genMs = await waitReady(created._id, label);
  console.log(`Questions ready in ${(genMs / 1000).toFixed(1)}s`);

  const full = await api('GET', `/interviews/${created._id}`, null, 30000);
  const questions = full.interview.questions;
  questions.forEach((q, i) => console.log(`  [${i}] (${q.category}) ${q.text}`));

  await api('PUT', `/interviews/${created._id}/start`, null, 30000).catch((e) => {
    if (!String(e.message).includes('400')) throw e;
  });

  const kinds = ['strong', 'weak', 'medium'];
  const rows = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const kind = kinds[i % kinds.length];
    const t0 = Date.now();
    const res = await api('PUT', `/interviews/${created._id}/questions/${q._id}/answer`, {
      userAnswer: answers[kind], timeSpent: 25,
    });
    const ms = Date.now() - t0;
    record('submit_answer', ms, { interview: label, index: i, kind });
    rows.push({ i, kind, score: res.evaluation.score, status: res.evaluation.evaluationStatus, isFollowUp: res.isFollowUp, ms });
    console.log(`  Q${i} [${q.category}] ${kind.padEnd(6)} -> score=${String(res.evaluation.score).padStart(4)} ${res.evaluation.evaluationStatus.padEnd(10)} followUp=${res.isFollowUp} (${(ms / 1000).toFixed(1)}s)`);
  }

  const tComplete = Date.now();
  await api('PUT', `/interviews/${created._id}/complete`);
  record('complete_interview', Date.now() - tComplete, { interview: label });

  const done = await api('GET', `/interviews/${created._id}`, null, 30000);
  console.log(`  overallScore=${done.interview.overallScore} (complete took ${((Date.now() - tComplete) / 1000).toFixed(1)}s)`);

  let feedbackOk = false;
  const tFb = Date.now();
  try {
    await api('POST', `/feedback/${created._id}/generate`);
    feedbackOk = true;
  } catch (e) {
    console.log(`  feedback failed: ${e.message.slice(0, 160)}`);
  }
  record('generate_feedback', Date.now() - tFb, { interview: label, ok: feedbackOk });
  console.log(`  feedback ${feedbackOk ? 'OK' : 'FAILED'} (${((Date.now() - tFb) / 1000).toFixed(1)}s)`);

  const final = await api('GET', `/interviews/${created._id}`, null, 30000);
  return {
    label, id: created._id, language, jobRole,
    focusSkills: created.focusSkills,
    questions: questions.map((q) => q.text),
    rows,
    overallScore: final.interview.overallScore,
    feedbackOk,
    genMs,
  };
}

const SPECS = [
  {
    label: 'A · Somali · Frontend+Backend · no focus skills · 15min · junior',
    language: 'somali', domain: 'technology', difficulty: 'junior', duration: 15,
    jobRole: 'Frontend Development & Backend Development', focusSkills: [],
  },
  {
    label: 'B · English · Frontend+Backend · focus [React, PostgreSQL] · 15min · mid',
    language: 'english', domain: 'technology', difficulty: 'mid', duration: 15,
    jobRole: 'Frontend Development & Backend Development', focusSkills: ['React', 'PostgreSQL'],
  },
  {
    label: 'C · Somali · Cybersecurity · focus [Encryption] · 10min · senior',
    language: 'somali', domain: 'technology', difficulty: 'senior', duration: 10,
    jobRole: 'Cybersecurity', focusSkills: ['Encryption'],
  },
];

async function main() {
  await login();
  const results = [];
  for (const spec of SPECS) {
    try {
      results.push(await runInterview(spec));
    } catch (err) {
      console.error(`FAILED ${spec.label}: ${err.message}`);
    }
  }

  console.log(`\n\n${'='.repeat(70)}\nRESULTS\n${'='.repeat(70)}`);
  for (const r of results) {
    console.log(`\n${r.label}`);
    console.log(`  id=${r.id} overall=${r.overallScore} feedback=${r.feedbackOk ? 'OK' : 'FAILED'}`);
    console.log(`  scores: ${r.rows.map((x) => `${x.kind}:${x.score}`).join(', ')}`);
    const scored = r.rows.filter((x) => typeof x.score === 'number');
    console.log(`  evaluated ${scored.length}/${r.rows.length}`);
  }

  console.log(`\n${'='.repeat(70)}\nTIMINGS (seconds)\n${'='.repeat(70)}`);
  const byLabel = new Map();
  for (const t of timings) {
    if (!byLabel.has(t.label)) byLabel.set(t.label, []);
    byLabel.get(t.label).push(t.ms);
  }
  for (const [label, list] of byLabel) {
    const sorted = [...list].sort((a, b) => a - b);
    const sum = list.reduce((a, b) => a + b, 0);
    console.log(
      `${label.padEnd(22)} n=${String(list.length).padStart(2)} ` +
      `avg=${(sum / list.length / 1000).toFixed(1)}s ` +
      `min=${(sorted[0] / 1000).toFixed(1)}s ` +
      `max=${(sorted[sorted.length - 1] / 1000).toFixed(1)}s ` +
      `total=${(sum / 1000).toFixed(1)}s`
    );
  }

  // Per-language submit cost — the headline number for "why is Somali slow".
  console.log('\nsubmit_answer by language:');
  for (const lang of ['somali', 'english']) {
    const labels = new Set(results.filter((r) => r.language === lang).map((r) => r.label));
    const list = timings.filter((t) => t.label === 'submit_answer' && labels.has(t.interview)).map((t) => t.ms);
    if (!list.length) continue;
    const sum = list.reduce((a, b) => a + b, 0);
    console.log(`  ${lang.padEnd(8)} n=${list.length} avg=${(sum / list.length / 1000).toFixed(1)}s max=${(Math.max(...list) / 1000).toFixed(1)}s`);
  }
  console.log(`\nWall clock: ${(timings.reduce((a, t) => a + t.ms, 0) / 1000 / 60).toFixed(1)} min of measured work`);
}

main().catch((err) => { console.error('SCRIPT FAILED:', err); process.exit(1); });
