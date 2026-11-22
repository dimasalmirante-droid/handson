/**
 * Deterministic shuffling for quizzes. The server picks a seed per page load;
 * each new attempt uses seed + attempt, so a retry shows a new order while the
 * server render and the browser agree on the first one.
 */

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A permutation of 0..n-1 (Fisher–Yates). */
export function permutation(n: number, random: () => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** Question order and, per question, option order for one attempt. */
export function quizLayout(optionCounts: number[], seed: number, attempt: number) {
  const random = seededRandom(seed + attempt * 7919);
  return {
    questions: permutation(optionCounts.length, random),
    options: optionCounts.map((n) => permutation(n, random)),
  };
}
