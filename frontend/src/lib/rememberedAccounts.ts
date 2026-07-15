export interface RememberedGoogleAccount {
  provider: 'google';
  name: string;
  email: string;
  avatar?: string;
  lastUsedAt: string;
}

const STORAGE_KEY = 'interviewai-remembered-google-accounts';
const MAX_ACCOUNTS = 3;

function readAccounts(): RememberedGoogleAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RememberedGoogleAccount => item?.provider === 'google' && typeof item.email === 'string');
  } catch {
    return [];
  }
}

export function getRememberedGoogleAccounts(): RememberedGoogleAccount[] {
  return readAccounts().sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export function rememberGoogleAccount(account: Pick<RememberedGoogleAccount, 'name' | 'email' | 'avatar'>): void {
  if (typeof window === 'undefined') return;
  const next = [{ provider: 'google' as const, ...account, lastUsedAt: new Date().toISOString() }, ...readAccounts().filter((item) => item.email.toLowerCase() !== account.email.toLowerCase())].slice(0, MAX_ACCOUNTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function forgetGoogleAccount(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readAccounts().filter((item) => item.email.toLowerCase() !== email.toLowerCase())));
}
