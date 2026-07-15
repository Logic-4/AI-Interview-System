/** Canonical API base URL — matches vite `define` / Vercel `NEXT_PUBLIC_API_URL`. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
}

export function getGoogleAuthUrl(loginHint?: string): string {
  const url = new URL(`${getApiBaseUrl()}/auth/google`, window.location.origin);
  if (loginHint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginHint)) url.searchParams.set('login_hint', loginHint);
  return url.toString();
}
