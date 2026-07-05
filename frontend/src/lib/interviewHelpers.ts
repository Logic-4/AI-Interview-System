import type { PopulatedInterview } from '@/types/interview';

/** Matches backend: Math.max(1, Math.min(Math.floor(duration / 2.5), 16)) */
export function estimateQuestionCount(durationMinutes: number): number {
  return Math.max(1, Math.min(Math.floor(durationMinutes / 2.5), 16));
}

export function computeQuestionsReady(interview: PopulatedInterview): boolean {
  const expected =
    (interview as PopulatedInterview & { expectedQuestionCount?: number }).expectedQuestionCount
    ?? interview.questions.length;
  const flag = (interview as PopulatedInterview & { questionsReady?: boolean }).questionsReady;
  return flag === true || interview.questions.length >= expected;
}

export const PLACEHOLDER_TRANSCRIPT_RE = /^\[(No |Transcription)/i;

export function isPlaceholderTranscript(text: string): boolean {
  if (!text || !text.trim()) return true;
  return PLACEHOLDER_TRANSCRIPT_RE.test(text.trim());
}

export function isSomaliLanguage(language: string | undefined | null): boolean {
  if (!language) return false;
  const normalized = language.trim().toLowerCase();
  return normalized === 'somali' || normalized === 'so' || normalized.startsWith('so-');
}

export function speechLanguageCode(language: string | undefined | null): string {
  return isSomaliLanguage(language) ? 'so-SO' : 'en-US';
}

export function normalizeQuestionText(text: string): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s?]/g, '').trim();
}

export function isSimilarQuestionText(a: string, b: string): boolean {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 24 && nb.includes(na.slice(0, Math.min(48, na.length)))) return true;
  if (nb.length >= 24 && na.includes(nb.slice(0, Math.min(48, nb.length)))) return true;
  return false;
}
