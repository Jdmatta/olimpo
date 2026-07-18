/**
 * Fuzzy matching por subsequência com bônus de posição.
 * null = não casa. Score maior = melhor.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  if (q.length > t.length) return null;

  let score = 0;
  let ti = 0;
  let lastMatch = -1;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
    }
    if (found === -1) return null;

    // Base por caractere casado.
    score += 1;
    // Consecutivo ao anterior: forte sinal.
    if (found === lastMatch + 1) score += 4;
    // Início da string ou de palavra: sinal médio.
    if (found === 0) score += 6;
    else if (/[\s\-_./]/.test(t[found - 1])) score += 3;
    // Penaliza distância do início (prefere matches cedo).
    score -= found * 0.05;
    lastMatch = found;
  }

  // Prefere alvos curtos quando o resto empata.
  score -= t.length * 0.01;
  return score;
}

export interface Ranked<T> {
  item: T;
  score: number;
}

export function rankItems<T>(
  query: string,
  items: T[],
  textOf: (item: T) => string,
  limit = 8,
): Ranked<T>[] {
  const out: Ranked<T>[] = [];
  for (const item of items) {
    const score = fuzzyScore(query, textOf(item));
    if (score !== null) out.push({ item, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
