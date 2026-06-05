export function dedupeByExternalId<T extends { id: { provider: string; externalId: string } }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id.provider}:${item.id.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

