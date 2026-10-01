/** Small deterministic PRNG (mulberry32) so seeded data is identical on every run. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable pseudo-random number in [0,1) derived from a string. */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return createRng(h)();
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pick = <T>(rng: () => number, items: T[]): T =>
  items[Math.floor(rng() * items.length)];
export const between = (rng: () => number, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));
