import { type LockedIds, MAX_RESPINS, type ReelResult } from "@/lib/spin/types";

/** idle: nothing pulled yet this round. spinning: a pull or re-spin is in flight. landed: all reels settled. */
export type Phase = "idle" | "spinning" | "landed";

type Triple<T> = [T, T, T];

export type GameState = {
  phase: Phase;
  /** Current result per reel; null before the first landing. Locked reels keep their object identity. */
  reels: Triple<ReelResult | null>;
  locked: Triple<boolean>;
  /** Reels that have landed during the current spin. */
  landedCount: number;
  /** Reels that should scroll during the current spin. */
  spinningReels: Triple<boolean>;
  /** True between spin_started and spin_resolved/spin_failed: the server call is in flight. */
  awaiting: boolean;
  respinsLeft: number;
  error: string | null;
};

export type GameAction =
  | { type: "spin_started" }
  | { type: "spin_resolved"; reels: Triple<ReelResult> }
  | { type: "spin_failed"; error: string }
  | { type: "reel_landed"; index: number }
  | { type: "toggle_lock"; index: number }
  | { type: "new_round" };

export const initialGameState: GameState = {
  phase: "idle",
  reels: [null, null, null],
  locked: [false, false, false],
  landedCount: 0,
  spinningReels: [false, false, false],
  awaiting: false,
  respinsLeft: MAX_RESPINS,
  error: null,
};

function mapTriple<T, U>(
  values: Readonly<Triple<T>>,
  f: (value: T, index: number) => U,
): Triple<U> {
  return [f(values[0], 0), f(values[1], 1), f(values[2], 2)];
}

/** A locked reel keeps its previous result object so <Reel> does not re-animate it. */
function keepIfLocked(
  previous: ReelResult | null,
  locked: boolean,
  fresh: ReelResult,
): ReelResult {
  return locked && previous ? previous : fresh;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "spin_started": {
      if (state.phase === "spinning" || state.awaiting) return state;
      if (state.phase === "landed" && state.respinsLeft <= 0) return state;
      const spinningReels = mapTriple(state.locked, (locked) => !locked);
      if (!spinningReels.some(Boolean)) return state;
      return {
        ...state,
        phase: "spinning",
        awaiting: true,
        landedCount: 0,
        spinningReels,
        error: null,
      };
    }

    case "spin_resolved": {
      if (!state.awaiting) return state;
      // A pull with results already on the table is a re-spin and costs one.
      const isRespin = state.reels.some((reel) => reel !== null);
      const reels = mapTriple(action.reels, (fresh, index) =>
        keepIfLocked(state.reels[index], state.locked[index], fresh),
      );
      const stillSpinning = state.spinningReels.some(Boolean);
      return {
        ...state,
        reels,
        awaiting: false,
        phase: stillSpinning ? "spinning" : "landed",
        respinsLeft: isRespin
          ? Math.max(0, state.respinsLeft - 1)
          : state.respinsLeft,
      };
    }

    case "spin_failed": {
      if (!state.awaiting) return state;
      // Results from before the failed spin are still on the table, so fall back to them.
      const hasResults = state.reels.some((reel) => reel !== null);
      return {
        ...state,
        awaiting: false,
        phase: hasResults ? "landed" : "idle",
        landedCount: 0,
        spinningReels: [false, false, false],
        error: action.error,
      };
    }

    case "reel_landed": {
      if (state.phase !== "spinning" || state.awaiting) return state;
      // Ignores a reel that is not spinning, so a repeated landing is a no-op.
      if (!state.spinningReels[action.index]) return state;
      const spinningReels = mapTriple(state.spinningReels, (spinning, index) =>
        index === action.index ? false : spinning,
      );
      const stillSpinning = spinningReels.some(Boolean);
      return {
        ...state,
        spinningReels,
        landedCount: state.landedCount + 1,
        phase: stillSpinning ? "spinning" : "landed",
      };
    }

    case "toggle_lock": {
      if (state.phase !== "landed" || state.respinsLeft <= 0) return state;
      if (!state.reels[action.index]) return state;
      const locked = mapTriple(state.locked, (value, index) =>
        index === action.index ? !value : value,
      );
      return { ...state, locked };
    }

    case "new_round":
      return initialGameState;
  }
}

/** The ingredient id to keep for each reel, or null to spin it. */
export function lockedIds(state: GameState): LockedIds {
  return mapTriple(state.reels, (reel, index) =>
    state.locked[index] && reel ? reel.ingredient.id : null,
  );
}
