export function sanitizeRedirectPath(from: string | null | undefined, user?: any): string {
  const isCompany = user?.role === 'company' || (user?.role === 'admin' && user?.company);
  const defaultPath = isCompany ? '/company/dashboard' : '/dashboard';

  if (!from) return defaultPath;

  const value = from.trim();

  if (!value.startsWith('/')) return defaultPath;
  if (value.startsWith('//')) return defaultPath;

  const blockedPrefixes = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback'];
  if (blockedPrefixes.some((prefix) => value.startsWith(prefix))) {
    return defaultPath;
  }

  return value;
}
