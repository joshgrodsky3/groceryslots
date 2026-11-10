import {
  type Ingredient,
  type LockedIds,
  REEL_CATEGORIES,
  REEL_KEYS,
  type ReelKey,
  type ReelResult,
  STRIP_LENGTH,
} from "@/lib/spin/types";

type Rng = () => number;

function pickIndex(length: number, rng: Rng): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

function candidatesFor(pool: Ingredient[], reel: ReelKey): Ingredient[] {
  const categories = REEL_CATEGORIES[reel];
  return pool.filter((ingredient) => categories.includes(ingredient.category));
}

/**
 * Fillers scroll past before the reel lands. They come from the same
 * candidates as the landing ingredient, never equal the landing one, and
 * never repeat the filler directly before them (when there is a choice).
 * With one other candidate it repeats that candidate; with none it is empty.
 */
function buildStrip(
  candidates: Ingredient[],
  landing: Ingredient,
  rng: Rng,
): Ingredient[] {
  const others = candidates.filter((c) => c.id !== landing.id);
  if (others.length === 0) {
    return [];
  }

  const strip: Ingredient[] = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    const last = strip.length > 0 ? strip[strip.length - 1] : undefined;
    const options =
      others.length > 1 && last
        ? others.filter((c) => c.id !== last.id)
        : others;
    strip.push(options[pickIndex(options.length, rng)]);
  }
  return strip;
}

function pickReel(
  pool: Ingredient[],
  reel: ReelKey,
  lockedId: number | null,
  rng: Rng,
): ReelResult {
  const candidates = candidatesFor(pool, reel);
  if (candidates.length === 0) {
    throw new Error(`No ingredients for ${reel}`);
  }

  const lockedMatch = candidates.find((c) => c.id === lockedId);
  const ingredient =
    lockedMatch ?? candidates[pickIndex(candidates.length, rng)];

  return {
    reel,
    ingredient,
    strip: buildStrip(candidates, ingredient, rng),
  };
}

/**
 * Picks the three reels (produce, protein, wildcard) from the pool.
 * A locked id lands on that ingredient if it is a candidate for its reel;
 * otherwise (null, unknown, or from another reel's categories) the reel
 * lands on a uniformly random candidate. Pure apart from `rng`.
 */
export function pickReels(
  pool: Ingredient[],
  locked: LockedIds,
  rng: Rng = Math.random,
): [ReelResult, ReelResult, ReelResult] {
  return [
    pickReel(pool, REEL_KEYS[0], locked[0], rng),
    pickReel(pool, REEL_KEYS[1], locked[1], rng),
    pickReel(pool, REEL_KEYS[2], locked[2], rng),
  ];
}
