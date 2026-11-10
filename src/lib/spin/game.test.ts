import { describe, expect, it } from "vitest";
import {
  type GameState,
  gameReducer,
  initialGameState,
  lockedIds,
} from "@/lib/spin/game";
import type { Ingredient, ReelKey, ReelResult } from "@/lib/spin/types";

function ingredient(id: number, category: Ingredient["category"]): Ingredient {
  return {
    id,
    name: `Item ${id}`,
    category,
    aisle: "Test aisle",
    difficulty: 1,
    emoji: null,
    price_band: "cheap",
  };
}

function result(reel: ReelKey, id: number): ReelResult {
  return { reel, ingredient: ingredient(id, reel), strip: [] };
}

type Reels = [ReelResult, ReelResult, ReelResult];

const first: Reels = [
  result("produce", 1),
  result("protein", 2),
  result("wildcard", 3),
];
const second: Reels = [
  result("produce", 4),
  result("protein", 5),
  result("wildcard", 6),
];

/** Runs a full pull (start, resolve, every spinning reel lands) and returns the landed state. */
function landedRound(state: GameState, reels: Reels): GameState {
  let next = gameReducer(state, { type: "spin_started" });
  next = gameReducer(next, { type: "spin_resolved", reels: reels });
  for (const index of [0, 1, 2]) {
    next = gameReducer(next, { type: "reel_landed", index });
  }
  return next;
}

describe("initialGameState", () => {
  it("starts idle with nothing locked and both re-spins available", () => {
    expect(initialGameState).toEqual({
      phase: "idle",
      reels: [null, null, null],
      locked: [false, false, false],
      landedCount: 0,
      spinningReels: [false, false, false],
      awaiting: false,
      respinsLeft: 2,
      error: null,
    });
  });
});

describe("spin_started", () => {
  it("marks every reel spinning on the first pull and enters the spinning phase", () => {
    const next = gameReducer(initialGameState, { type: "spin_started" });
    expect(next.phase).toBe("spinning");
    expect(next.awaiting).toBe(true);
    expect(next.spinningReels).toEqual([true, true, true]);
    expect(next.reels).toEqual([null, null, null]);
    expect(next.respinsLeft).toBe(2);
  });

  it("clears a previous error", () => {
    const failed = gameReducer(initialGameState, {
      type: "spin_failed",
      error: "boom",
    });
    const next = gameReducer(failed, { type: "spin_started" });
    expect(next.error).toBeNull();
  });

  it("ignores a second start while a spin is in flight (double click)", () => {
    const started = gameReducer(initialGameState, { type: "spin_started" });
    expect(gameReducer(started, { type: "spin_started" })).toBe(started);
  });

  it("does not spin locked reels", () => {
    const landed = landedRound(initialGameState, first);
    const locked = gameReducer(landed, { type: "toggle_lock", index: 1 });
    const next = gameReducer(locked, { type: "spin_started" });
    expect(next.spinningReels).toEqual([true, false, true]);
  });

  it("is ignored once re-spins are used up", () => {
    let state = landedRound(initialGameState, first);
    state = gameReducer(state, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: second });
    for (const index of [0, 1, 2])
      state = gameReducer(state, { type: "reel_landed", index });
    state = gameReducer(state, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: first });
    for (const index of [0, 1, 2])
      state = gameReducer(state, { type: "reel_landed", index });
    expect(state.respinsLeft).toBe(0);
    expect(gameReducer(state, { type: "spin_started" })).toBe(state);
  });
});

describe("spin_resolved", () => {
  it("stores the results and starts the unlocked reels scrolling", () => {
    const started = gameReducer(initialGameState, { type: "spin_started" });
    const next = gameReducer(started, { type: "spin_resolved", reels: first });
    expect(next.reels).toEqual(first);
    expect(next.awaiting).toBe(false);
    expect(next.phase).toBe("spinning");
    expect(next.spinningReels).toEqual([true, true, true]);
  });

  it("is ignored when no spin is in flight", () => {
    const next = gameReducer(initialGameState, {
      type: "spin_resolved",
      reels: first,
    });
    expect(next).toBe(initialGameState);
  });

  it("keeps the previous object for a locked reel across a re-spin", () => {
    const landed = landedRound(initialGameState, first);
    const locked = gameReducer(landed, { type: "toggle_lock", index: 0 });
    let state = gameReducer(locked, { type: "spin_started" });
    state = gameReducer(state, {
      type: "spin_resolved",
      reels: [
        result("produce", 99),
        result("protein", 98),
        result("wildcard", 97),
      ],
    });
    expect(state.reels[0]).toBe(landed.reels[0]);
    expect(state.reels[1]).not.toBe(landed.reels[1]);
    expect(state.reels[2]).not.toBe(landed.reels[2]);
  });

  it("uses up one re-spin on a re-spin but not on the first pull", () => {
    const afterFirst = landedRound(initialGameState, first);
    expect(afterFirst.respinsLeft).toBe(2);
    let state = gameReducer(afterFirst, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: second });
    expect(state.respinsLeft).toBe(1);
  });
});

describe("spin_failed", () => {
  it("returns to idle with an error after a failed first pull", () => {
    const started = gameReducer(initialGameState, { type: "spin_started" });
    const next = gameReducer(started, { type: "spin_failed", error: "Nope." });
    expect(next.phase).toBe("idle");
    expect(next.error).toBe("Nope.");
    expect(next.awaiting).toBe(false);
    expect(next.spinningReels).toEqual([false, false, false]);
    expect(next.respinsLeft).toBe(2);
  });

  it("returns to landed with the old results and re-spin count after a failed re-spin", () => {
    const landed = landedRound(initialGameState, first);
    let state = gameReducer(landed, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_failed", error: "Nope." });
    expect(state.phase).toBe("landed");
    expect(state.reels).toEqual(first);
    expect(state.respinsLeft).toBe(2);
    expect(state.error).toBe("Nope.");
  });

  it("is ignored when no spin is in flight", () => {
    expect(
      gameReducer(initialGameState, { type: "spin_failed", error: "x" }),
    ).toBe(initialGameState);
  });
});

describe("reel_landed", () => {
  it("moves to landed once every spinning reel has landed", () => {
    let state = gameReducer(initialGameState, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: first });
    state = gameReducer(state, { type: "reel_landed", index: 0 });
    state = gameReducer(state, { type: "reel_landed", index: 2 });
    expect(state.phase).toBe("spinning");
    expect(state.landedCount).toBe(2);
    state = gameReducer(state, { type: "reel_landed", index: 1 });
    expect(state.phase).toBe("landed");
    expect(state.landedCount).toBe(3);
    expect(state.spinningReels).toEqual([false, false, false]);
  });

  it("ignores a landing for a reel that is not spinning", () => {
    const landed = landedRound(initialGameState, first);
    expect(gameReducer(landed, { type: "reel_landed", index: 0 })).toBe(landed);
  });

  it("is idempotent for the same reel", () => {
    let state = gameReducer(initialGameState, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: first });
    const once = gameReducer(state, { type: "reel_landed", index: 1 });
    expect(gameReducer(once, { type: "reel_landed", index: 1 })).toBe(once);
  });

  it("ignores a landing for an out-of-range index", () => {
    let state = gameReducer(initialGameState, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: first });
    expect(gameReducer(state, { type: "reel_landed", index: 7 })).toBe(state);
  });

  it("ignores a landing while the server call is still in flight", () => {
    const started = gameReducer(initialGameState, { type: "spin_started" });
    expect(gameReducer(started, { type: "reel_landed", index: 0 })).toBe(
      started,
    );
  });
});

describe("toggle_lock", () => {
  it("locks and unlocks a landed reel while re-spins remain", () => {
    const landed = landedRound(initialGameState, first);
    const locked = gameReducer(landed, { type: "toggle_lock", index: 2 });
    expect(locked.locked).toEqual([false, false, true]);
    const unlocked = gameReducer(locked, { type: "toggle_lock", index: 2 });
    expect(unlocked.locked).toEqual([false, false, false]);
  });

  it("does nothing before the first landing", () => {
    expect(
      gameReducer(initialGameState, { type: "toggle_lock", index: 0 }),
    ).toBe(initialGameState);
  });

  it("does nothing while spinning", () => {
    const started = gameReducer(initialGameState, { type: "spin_started" });
    expect(gameReducer(started, { type: "toggle_lock", index: 0 })).toBe(
      started,
    );
  });

  it("does nothing once no re-spins are left", () => {
    let state = landedRound(initialGameState, first);
    state = gameReducer(state, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: second });
    for (const index of [0, 1, 2])
      state = gameReducer(state, { type: "reel_landed", index });
    state = gameReducer(state, { type: "spin_started" });
    state = gameReducer(state, { type: "spin_resolved", reels: first });
    for (const index of [0, 1, 2])
      state = gameReducer(state, { type: "reel_landed", index });
    expect(state.respinsLeft).toBe(0);
    expect(gameReducer(state, { type: "toggle_lock", index: 0 })).toBe(state);
  });
});

describe("new_round", () => {
  it("returns everything to the initial state", () => {
    let state = landedRound(initialGameState, first);
    state = gameReducer(state, { type: "toggle_lock", index: 0 });
    state = gameReducer(state, { type: "new_round" });
    expect(state).toEqual(initialGameState);
  });
});

describe("lockedIds", () => {
  it("is null for every reel before any result", () => {
    expect(lockedIds(initialGameState)).toEqual([null, null, null]);
  });

  it("returns the ingredient id only for locked reels with a result", () => {
    const landed = landedRound(initialGameState, first);
    const locked = gameReducer(landed, { type: "toggle_lock", index: 1 });
    expect(lockedIds(locked)).toEqual([null, 2, null]);
  });
});
