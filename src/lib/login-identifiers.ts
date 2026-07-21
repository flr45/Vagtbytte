export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function findCaseInsensitiveLoginConflicts(users: Array<{ id: string; loginIdentifier: string }>) {
  const byNormalized = new Map<string, Array<{ id: string; loginIdentifier: string }>>();
  for (const user of users) {
    const key = normalizeLoginIdentifier(user.loginIdentifier);
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), user]);
  }

  return [...byNormalized.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([loginIdentifier, items]) => ({ loginIdentifier, users: items }));
}
