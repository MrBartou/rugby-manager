/**
 * RNG déterministe.
 *
 * RÈGLE : aucun appel à Math.random() dans le moteur. Le linter le bloque.
 * Tout aléa passe par cet objet — état sérialisable, reproductible.
 *
 * Implémentation : mulberry32 (PRNG simple, rapide, suffisant pour la simulation).
 * Si on veut quelque chose de plus solide statistiquement plus tard, basculer sur xoshiro256**.
 */

export interface Rng {
  /** Tire un nombre dans [0, 1). */
  next(): number;

  /** Tire un entier dans [min, max] inclus. */
  nextInt(min: number, max: number): number;

  /** Tire un booléen avec probabilité p (0-1). */
  nextBool(p: number): boolean;

  /** Tire une valeur dans une distribution normale (Box-Muller). */
  nextGaussian(mean: number, stdDev: number): number;

  /** Choisit un élément d'un tableau non-vide. */
  pick<T>(items: readonly T[]): T;

  /** Sérialise l'état pour persistance (save). */
  serialize(): string;
}

/**
 * Crée un RNG déterministe à partir d'un seed.
 * Le seed peut être numérique (initial) ou la chaîne sérialisée d'un Rng précédent.
 */
export function createRng(seed: number | string): Rng {
  let state: number;
  if (typeof seed === 'number') {
    state = seed >>> 0; // unsigned 32-bit
  } else {
    state = parseInt(seed, 10) >>> 0;
  }

  function nextRaw(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next: nextRaw,

    nextInt(min, max) {
      if (max < min) throw new Error('rng.nextInt: max < min');
      return Math.floor(nextRaw() * (max - min + 1)) + min;
    },

    nextBool(p) {
      if (p < 0 || p > 1) throw new Error('rng.nextBool: p hors [0,1]');
      return nextRaw() < p;
    },

    nextGaussian(mean, stdDev) {
      // Box-Muller transform
      const u1 = nextRaw() || 1e-12;
      const u2 = nextRaw();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stdDev;
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      const idx = Math.floor(nextRaw() * items.length);
      // noUncheckedIndexedAccess oblige à gérer le cas — mais idx ∈ [0, length-1] par construction
      const item = items[idx];
      if (item === undefined) throw new Error('rng.pick: unreachable');
      return item;
    },

    serialize() {
      return String(state);
    },
  };
}
