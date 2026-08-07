export function hasExactIdSet(expectedIds: string[], orderedIds: string[]) {
  if (expectedIds.length !== orderedIds.length) return false;
  const expected = new Set(expectedIds);
  const ordered = new Set(orderedIds);
  if (expected.size !== expectedIds.length || ordered.size !== orderedIds.length) return false;
  return expectedIds.every((id) => ordered.has(id));
}

export function copyName(name: string) {
  const trimmed = name.trim();
  return `${trimmed || "Kopi"} – kopi`;
}
