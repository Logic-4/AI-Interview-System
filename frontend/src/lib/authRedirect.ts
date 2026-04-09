export function sanitizeRedirectPath(from: string | null | undefined): string {
  if (!from) return "/dashboard";

  const value = from.trim();

  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";

  const blockedPrefixes = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];
  if (blockedPrefixes.some((prefix) => value.startsWith(prefix))) {
    return "/dashboard";
  }

  return value;
}
