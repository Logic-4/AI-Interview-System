/** Canonical API base URL — matches vite `define` / Vercel `NEXT_PUBLIC_API_URL`. */
export function getApiBaseUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
    'http://localhost:5000/api/v1'
  );
}

export function getGoogleAuthUrl(): string {
  return `${getApiBaseUrl()}/auth/google`;
}
