/** Mulberry32 — deterministic, seedable, framework-free. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** A fresh 32-bit seed per match, from the platform's CSPRNG where there is one. */
export function randomSeed(): number {
  // Typed by hand: the match worker's tsconfig has no DOM lib.
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } })
    .crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return (Math.random() * 0x100000000) >>> 0;
}
