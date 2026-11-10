import { describe, expect, it } from "vitest";
import { FIXTURE_POOL } from "@/lib/spin/fixture";
import { pickReels } from "@/lib/spin/pick";
import {
  type Ingredient,
  type LockedIds,
  REEL_CATEGORIES,
  REEL_KEYS,
  type ReelResult,
  STRIP_LENGTH,
} from "@/lib/spin/types";

/** mulberry32: small seeded PRNG so every test run is repeatable. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectReelRules(result: ReelResult, pool: Ingredient[]): void {
  const allowed = REEL_CATEGORIES[result.reel];
  expect(pool).toContainEqual(result.ingredient);
  expect(allowed).toContain(result.ingredient.category);

  expect(result.strip.length).toBe(STRIP_LENGTH);
  for (const filler of result.strip) {
    expect(allowed).toContain(filler.category);
    expect(filler.id).not.toBe(result.ingredient.id);
  }
  for (let i = 1; i < result.strip.length; i++) {
    expect(result.strip[i].id).not.toBe(result.strip[i - 1].id);
  }
}

describe("pickReels", () => {
  it("lands each reel on an ingredient from its own categories", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const reels = pickReels(
        FIXTURE_POOL,
        [null, null, null],
        seededRng(seed),
      );
      REEL_KEYS.forEach((key, i) => {
        expect(reels[i].reel).toBe(key);
        expect(REEL_CATEGORIES[key]).toContain(reels[i].ingredient.category);
      });
    }
  });

  it("keeps locked ids on their reels", () => {
    const locked: LockedIds = [2, 6, 11];
    const reels = pickReels(FIXTURE_POOL, locked, seededRng(7));
    expect(reels[0].ingredient.id).toBe(2);
    expect(reels[1].ingredient.id).toBe(6);
    expect(reels[2].ingredient.id).toBe(11);
  });

  it("ignores null, unknown and cross-reel locks", () => {
    const locked: LockedIds = [999, 0, 5]; // unknown, unknown, a protein id on produce
    for (let seed = 1; seed <= 20; seed++) {
      const reels = pickReels(FIXTURE_POOL, locked, seededRng(seed));
      expect(REEL_CATEGORIES.produce).toContain(reels[0].ingredient.category);
      expect(REEL_CATEGORIES.protein).toContain(reels[1].ingredient.category);
      expect(REEL_CATEGORIES.wildcard).toContain(reels[2].ingredient.category);
    }
    const reels = pickReels(FIXTURE_POOL, [5, null, 1], seededRng(3));
    expect(reels[0].ingredient.category).toBe("produce");
    expect(reels[2].ingredient.category).not.toBe("produce");
  });

  it("builds strips that exclude the landing ingredient and never repeat adjacently", () => {
    const reels = pickReels(FIXTURE_POOL, [null, null, null], seededRng(99));
    for (const result of reels) {
      expect(result.strip).toHaveLength(STRIP_LENGTH);
      expectReelRules(result, FIXTURE_POOL);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = pickReels(FIXTURE_POOL, [3, null, null], seededRng(42));
    const b = pickReels(FIXTURE_POOL, [3, null, null], seededRng(42));
    expect(a).toEqual(b);
  });

  it("uses Math.random by default", () => {
    const reels = pickReels(FIXTURE_POOL, [null, null, null]);
    expect(reels).toHaveLength(3);
    for (const result of reels) {
      expectReelRules(result, FIXTURE_POOL);
    }
  });

  it("throws when a reel has no candidates", () => {
    const noProduce = FIXTURE_POOL.filter((i) => i.category !== "produce");
    expect(() =>
      pickReels(noProduce, [null, null, null], seededRng(1)),
    ).toThrow("No ingredients for produce");
  });

  it("repeats the only other candidate when a reel has exactly two", () => {
    const pool = FIXTURE_POOL.filter(
      (i) => i.category !== "produce" || i.id === 1 || i.id === 2,
    );
    const reels = pickReels(pool, [1, null, null], seededRng(5));
    expect(reels[0].ingredient.id).toBe(1);
    expect(reels[0].strip).toHaveLength(STRIP_LENGTH);
    expect(reels[0].strip.every((f) => f.id === 2)).toBe(true);
  });

  it("returns an empty strip when a reel has only one candidate", () => {
    const pool = FIXTURE_POOL.filter(
      (i) => i.category !== "produce" || i.id === 4,
    );
    const reels = pickReels(pool, [null, null, null], seededRng(5));
    expect(reels[0].ingredient.id).toBe(4);
    expect(reels[0].strip).toEqual([]);
  });

  it("holds the rules across 200 random spins with random locks", () => {
    const rng = seededRng(2024);
    for (let spin = 0; spin < 200; spin++) {
      const locked = [0, 1, 2].map(() => {
        if (rng() < 0.3) return null;
        return Math.floor(rng() * 15); // includes unknown and cross-reel ids
      }) as LockedIds;

      const reels = pickReels(FIXTURE_POOL, locked, rng);
      reels.forEach((result, i) => {
        expectReelRules(result, FIXTURE_POOL);
        const lock = locked[i];
        const candidateIds = FIXTURE_POOL.filter((c) =>
          REEL_CATEGORIES[result.reel].includes(c.category),
        ).map((c) => c.id);
        if (lock !== null && candidateIds.includes(lock)) {
          expect(result.ingredient.id).toBe(lock);
        }
      });
    }
  });
});
