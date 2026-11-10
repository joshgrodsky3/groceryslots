"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { spin } from "@/app/actions/spin";
import { Reel } from "@/components/reel";
import { createFeedback } from "@/lib/spin/feedback";
import { gameReducer, initialGameState, lockedIds } from "@/lib/spin/game";
import {
  BUTTON_NAMES,
  type Feedback,
  MAX_RESPINS,
  REEL_KEYS,
  type ReelResult,
  TEST_IDS,
} from "@/lib/spin/types";

/** How long each reel scrolls, left to right, so they stop one after another. */
const SPIN_MS = [1100, 1600, 2100] as const;

const PRIMARY_BUTTON =
  "inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-zinc-950 px-8 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950";

const SECONDARY_BUTTON =
  "inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";

function cookWithText(reels: readonly (ReelResult | null)[]): string {
  const [produce, protein, wildcard] = reels;
  if (!produce || !protein || !wildcard) return "";
  return `Cook with: ${produce.ingredient.name}, ${protein.ingredient.name} and ${wildcard.ingredient.name}`;
}

export function SlotMachine() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  // Created once on the client; every method of the feedback object is a no-op where audio is unavailable.
  const [feedback] = useState<Feedback>(createFeedback);
  const [muted, setMuted] = useState(false);
  // Synchronous guard so a double click cannot start two spins before React re-renders.
  const inFlight = useRef(false);
  const previousPhase = useRef(state.phase);

  useEffect(() => {
    setMuted(feedback.isMuted());
  }, [feedback]);

  useEffect(() => {
    // A failed re-spin also ends in "landed" (with the old results); only a completed spin plays the chime.
    if (
      previousPhase.current === "spinning" &&
      state.phase === "landed" &&
      state.error === null
    ) {
      feedback.done();
    }
    previousPhase.current = state.phase;
  }, [state.phase, state.error, feedback]);

  const landed = state.phase === "landed";
  const spinning = state.phase === "spinning";
  const canRespin = landed && state.respinsLeft > 0;
  const allLocked = state.locked.every(Boolean);

  async function handleSpin() {
    if (inFlight.current || state.phase === "spinning") return;
    inFlight.current = true;
    const request = { locked: lockedIds(state) };
    feedback.pull();
    dispatch({ type: "spin_started" });
    try {
      const response = await spin(request);
      if (response.ok) {
        dispatch({ type: "spin_resolved", reels: response.reels });
      } else {
        dispatch({ type: "spin_failed", error: response.error });
      }
    } catch {
      dispatch({
        type: "spin_failed",
        error: "Something went wrong. Try again.",
      });
    } finally {
      inFlight.current = false;
    }
  }

  function handleLanded(index: number) {
    feedback.land(index);
    dispatch({ type: "reel_landed", index });
  }

  function newRound() {
    dispatch({ type: "new_round" });
  }

  function toggleMute() {
    const next = !muted;
    feedback.setMuted(next);
    setMuted(next);
  }

  const muteLabel = muted ? BUTTON_NAMES.unmute : BUTTON_NAMES.mute;

  const primaryLabel = !landed
    ? BUTTON_NAMES.pull
    : canRespin
      ? BUTTON_NAMES.respin
      : BUTTON_NAMES.newRound;
  const primaryAction = !landed
    ? handleSpin
    : canRespin
      ? handleSpin
      : newRound;
  const primaryDisabled = spinning || (canRespin && allLocked);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      <div className="flex w-full flex-col gap-0">
        <div className="mb-2 flex w-full justify-end">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muteLabel}
            title={muteLabel}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-3 text-lg text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
          </button>
        </div>

        <ul className="grid w-full grid-cols-3 items-stretch gap-2 sm:gap-6">
          {REEL_KEYS.map((reel, index) => (
            <li key={reel} className="flex min-w-0">
              <Reel
                reel={reel}
                result={state.reels[index]}
                spinning={
                  state.spinningReels[index] &&
                  !state.awaiting &&
                  state.reels[index] !== null
                }
                spinMs={SPIN_MS[index]}
                locked={state.locked[index]}
                canLock={canRespin}
                onToggleLock={() => dispatch({ type: "toggle_lock", index })}
                onLanded={() => handleLanded(index)}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Fixed-height rows so the primary button stays put across idle, spinning and landed. */}
      <div className="flex w-full flex-col items-center gap-3">
        <p
          data-testid={TEST_IDS.status}
          aria-live="polite"
          className="flex min-h-12 items-center justify-center text-center text-base font-medium text-zinc-800 dark:text-zinc-200"
        >
          {spinning ? "Spinning…" : landed ? cookWithText(state.reels) : ""}
        </p>

        <p
          data-testid={TEST_IDS.respinsLeft}
          className="flex h-5 items-center text-sm text-zinc-500 dark:text-zinc-400"
        >
          {landed || state.respinsLeft < MAX_RESPINS
            ? `${state.respinsLeft} ${state.respinsLeft === 1 ? "re-spin" : "re-spins"} left`
            : ""}
        </p>

        <button
          type="button"
          onClick={primaryAction}
          disabled={primaryDisabled}
          className={PRIMARY_BUTTON}
        >
          {primaryLabel}
        </button>

        {canRespin ? (
          <button type="button" onClick={newRound} className={SECONDARY_BUTTON}>
            {BUTTON_NAMES.newRound}
          </button>
        ) : (
          <div aria-hidden="true" className="h-12 w-full max-w-xs" />
        )}

        <div className="flex min-h-5 items-center justify-center">
          {state.error ? (
            <p
              role="alert"
              data-testid={TEST_IDS.error}
              className="text-sm text-red-600 dark:text-red-400"
            >
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
