/**
 * sttService.ts
 *
 * Sends a recorded audio Blob to the backend STT endpoint
 * (POST /api/v1/stt/transcribe) which proxies it to the local
 * Somali ASR model (somaliSpeechService.transcribeAudio).
 *
 * Returns the plain transcript string, or throws on network / server error.
 */

import { getApiBaseUrl } from '../lib/apiConfig';

/**
 * Transcribe an audio Blob via the local STT backend.
 *
 * @param audioBlob  The recorded audio (webm/opus from MediaRecorder)
 * @param filename   Optional filename hint sent to the server (default: "answer.webm")
 * @returns          The transcript text, or "" if the model returned nothing
 * @throws           On network failure or non-2xx HTTP response
 */
export async function transcribeAudio(
  audioBlob: Blob,
  filename = 'answer.webm',
  languageCode = 'so-SO'
): Promise<string> {
  // Attach the JWT so the protected route accepts the request
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('accessToken')
    : null;

  const form = new FormData();
  form.append('audio', audioBlob, filename);
  form.append('languageCode', languageCode);

  const response = await fetch(`${getApiBaseUrl()}/stt/transcribe`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`STT API responded with ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { success: boolean; transcript: string };
  return data.transcript ?? '';
}
