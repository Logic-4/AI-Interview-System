const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { generateInterviewQuestions } = require('../services/gemmaService');
const { synthesizeSpeech } = require('../services/somaliSpeechService');

function percentile(sorted, value) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(value * sorted.length) - 1)];
}

function summary(samples) {
  const successful = samples.filter((sample) => sample.ok).map((sample) => sample.ms).sort((a, b) => a - b);
  return {
    attempted: samples.length,
    succeeded: successful.length,
    failed: samples.length - successful.length,
    p50Ms: percentile(successful, 0.50),
    p95Ms: percentile(successful, 0.95),
    p99Ms: percentile(successful, 0.99),
    minMs: successful[0] ?? null,
    maxMs: successful.at(-1) ?? null,
  };
}

async function measure(name, runs, operation) {
  const samples = [];
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    try {
      await operation(index);
      samples.push({ run: index + 1, ok: true, ms: Math.round(performance.now() - startedAt) });
    } catch (error) {
      samples.push({ run: index + 1, ok: false, ms: Math.round(performance.now() - startedAt), error: error.message.slice(0, 200) });
    }
  }
  return { name, samples, summary: summary(samples) };
}

async function main() {
  const runs = Math.max(1, Math.min(Number(process.env.BENCHMARK_RUNS || 10), 100));
  const questionLanguage = process.env.BENCHMARK_LANGUAGE || 'english';
  const ttsCode = questionLanguage === 'somali' ? 'so-SO' : 'en-US';

  const question = await measure('first-question', runs, (index) => generateInterviewQuestions(
    'technical',
    'technology',
    'mid',
    1,
    {
      jobRole: 'React developer',
      language: questionLanguage,
      focusSkills: ['React', 'JavaScript'],
      _forcedIndex: index % 5,
      _forcedCount: 5,
      requestId: `benchmark-question-${index + 1}`,
      requestTimeoutMs: Number(process.env.BENCHMARK_TIMEOUT_MS || 15000),
    }
  ));

  const ttsText = questionLanguage === 'somali'
    ? 'Sidee ayaad u sharxi lahayd khibraddaada React?'
    : 'How would you explain your experience with React?';
  const tts = await measure('tts', runs, (index) => synthesizeSpeech(ttsText, ttsCode, {
    requestId: `benchmark-tts-${index + 1}`,
  }));

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), runs, questionLanguage, results: [question, tts] }, null, 2));
  if (!question.summary.succeeded || !tts.summary.succeeded) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
