export function isAllowedOperationalPath(path: string) {
  if (!path.startsWith("/admin/operativ-portal/")) return false;
  if (path.includes("..") || path.includes("\\") || path.includes("\u0000")) return false;
  return /^\/admin\/operativ-portal\/(?:koeretoejer\/[0-9a-f-]{36}|rum\/[0-9a-f-]{36}|udstyr\/[0-9a-f-]{36})(?:[#?].*)?$/i.test(path);
}

export function normalizeOperationalQrValue(value: string, baseUrl: string | URL) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const base = typeof baseUrl === "string" ? new URL(baseUrl) : baseUrl;
  let path = trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.host !== base.host) return null;
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  return isAllowedOperationalPath(path) ? path : null;
}
