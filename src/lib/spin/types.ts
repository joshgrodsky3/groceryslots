/**
 * Shared contract for the spin feature. Every spin module imports its types
 * from here, so the server action, the reels and the tests agree on shapes.
 */

export type Category = "produce" | "protein" | "pantry" | "wildcard";
export type PriceBand = "cheap" | "mid" | "splurge";

/** One row of public.ingredients (the columns the app reads). */
export type Ingredient = {
  id: number;
  name: string;
  category: Category;
  aisle: string;
  difficulty: number; // 1 (easy) to 5 (hard)
  emoji: string | null;
  price_band: PriceBand;
};

/** The three reels, left to right. */
export const REEL_KEYS = ["produce", "protein", "wildcard"] as const;
export type ReelKey = (typeof REEL_KEYS)[number];

export const REEL_LABELS: Record<ReelKey, string> = {
  produce: "Produce",
  protein: "Protein",
  wildcard: "Wildcard",
};

/** Which ingredient categories each reel draws from. */
export const REEL_CATEGORIES: Record<ReelKey, readonly Category[]> = {
  produce: ["produce"],
  protein: ["protein"],
  wildcard: ["pantry", "wildcard"],
};

/** Filler ingredients shown scrolling past before a reel lands. */
export const STRIP_LENGTH = 12;
/** Re-spins allowed after the first pull of a round. */
export const MAX_RESPINS = 2;

export type ReelResult = {
  reel: ReelKey;
  /** Where the reel lands. */
  ingredient: Ingredient;
  /** STRIP_LENGTH fillers from the same reel's categories; never the landing one. */
  strip: Ingredient[];
};

/** One entry per reel, in REEL_KEYS order: an ingredient id to keep, or null to spin. */
export type LockedIds = [number | null, number | null, number | null];

export type SpinRequest = { locked: LockedIds };

export type SpinResponse =
  | { ok: true; reels: [ReelResult, ReelResult, ReelResult] }
  | { ok: false; error: string };

/** Props for <Reel> (src/components/reel.tsx). */
export type ReelProps = {
  reel: ReelKey;
  /** null before the first spin: show the "?" placeholder. */
  result: ReelResult | null;
  /** true while this reel should be scrolling. */
  spinning: boolean;
  /** How long this reel scrolls before it settles, in ms (staggered per reel). */
  spinMs: number;
  locked: boolean;
  /** Show the lock toggle (after the first landing, while re-spins remain). */
  canLock: boolean;
  onToggleLock: () => void;
  /** Called once each time the reel finishes settling on `result`. */
  onLanded: () => void;
};

/** Sound and haptics (src/lib/spin/feedback.ts). Every method is safe to call anywhere. */
export type Feedback = {
  /** Lever pulled. */
  pull: () => void;
  /** A reel landed; index 0-2 raises the pitch. */
  land: (reelIndex: number) => void;
  /** All three reels landed. */
  done: () => void;
  isMuted: () => boolean;
  setMuted: (muted: boolean) => void;
};

/** data-testid values and accessible names the UI must expose (used by e2e tests). */
export const TEST_IDS = {
  reel: (reel: ReelKey) => `reel-${reel}`, // wrapper of each reel
  reelName: (reel: ReelKey) => `reel-name-${reel}`, // landed ingredient name; absent until landed
  respinsLeft: "respins-left", // element whose text contains the number left
  status: "spin-status", // aria-live region: "Spinning…", or the three names
  error: "spin-error",
} as const;

export const BUTTON_NAMES = {
  pull: "Pull the lever",
  respin: "Re-spin",
  newRound: "New round",
  lock: (reel: ReelKey) => `Lock ${REEL_LABELS[reel]}`,
  unlock: (reel: ReelKey) => `Unlock ${REEL_LABELS[reel]}`,
  mute: "Mute sound",
  unmute: "Unmute sound",
} as const;
