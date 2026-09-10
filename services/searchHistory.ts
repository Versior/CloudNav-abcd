const MAX_SEARCH_HISTORY = 8;

export const normalizeSearchHistory = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const query = item.trim();
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    result.push(query);
    if (result.length === MAX_SEARCH_HISTORY) break;
  }
  return result;
};

export const recordSearch = (history: unknown, query: string): string[] => {
  const next = query.trim();
  if (!next) return normalizeSearchHistory(history);
  return normalizeSearchHistory([next, ...(Array.isArray(history) ? history : [])]);
};
