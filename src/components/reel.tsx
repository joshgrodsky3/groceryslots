"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IngredientCard } from "@/components/ingredient-card";
import {
  BUTTON_NAMES,
  REEL_LABELS,
  type ReelProps,
  type ReelResult,
  TEST_IDS,
} from "@/lib/spin/types";

/** One ingredient row in the scrolling strip, in px (h-16). */
const ROW_PX = 64;
/** Three visible rows: the landing ingredient sits in the middle one. */
const WINDOW_PX = ROW_PX * 3;
/** How far the strip overshoots its resting place before settling back. */
const OVERSHOOT_PX = 14;
/** Reduced motion: short fade before the result is shown. */
const REDUCED_SETTLE_MS = 200;

/** Stable React key per result object, so a new result always remounts the strip. */
const resultKeys = new WeakMap<ReelResult, number>();
let lastResultKey = 0;
function keyFor(result: ReelResult): number {
  const known = resultKeys.get(result);
  if (known !== undefined) {
    return known;
  }
  lastResultKey += 1;
  resultKeys.set(result, lastResultKey);
  return lastResultKey;
}

export function Reel({
  reel,
  result,
  spinning,
  spinMs,
  locked,
  canLock,
  onToggleLock,
  onLanded,
}: ReelProps) {
  const reduce = useReducedMotion() === true;
  const [settled, setSettled] = useState<ReelResult | null>(null);
  const settledRef = useRef<ReelResult | null>(null);
  const onLandedRef = useRef(onLanded);

  useEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);

  // Fires onLanded once per result object, no matter how often the animation
  // callback or the effects run.
  const settle = useCallback(() => {
    if (result === null || settledRef.current === result) {
      return;
    }
    settledRef.current = result;
    setSettled(result);
    onLandedRef.current();
  }, [result]);

  // A spin is pending while this reel should scroll toward a result it has not
  // settled on yet. A re-spin keeps the old result on screen until the new one arrives.
  const pending = result !== null && spinning && settled !== result;
  const useStrip = pending && !locked && !reduce;

  useEffect(() => {
    if (!pending) {
      return;
    }
    if (locked) {
      // Defensive: a locked reel never scrolls, so settle it right away.
      settle();
      return;
    }
    if (!reduce) {
      return;
    }
    const timer = window.setTimeout(settle, REDUCED_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [pending, locked, reduce, settle]);

  let body: ReactNode;
  if (result === null) {
    body = <Placeholder />;
  } else if (useStrip) {
    body = (
      <ScrollingStrip
        key={keyFor(result)}
        result={result}
        spinMs={spinMs}
        onSettled={settle}
      />
    );
  } else if (pending) {
    body = <Placeholder />;
  } else {
    body = (
      <motion.div
        key={keyFor(result)}
        className="h-full"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0.2 }
            : { type: "spring", stiffness: 320, damping: 14 }
        }
      >
        <IngredientCard
          ingredient={result.ingredient}
          nameTestId={TEST_IDS.reelName(reel)}
        />
      </motion.div>
    );
  }

  const label = REEL_LABELS[reel];
  const lockName = locked ? BUTTON_NAMES.unlock(reel) : BUTTON_NAMES.lock(reel);

  return (
    <section
      data-testid={TEST_IDS.reel(reel)}
      aria-label={label}
      className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-950 ${
        locked
          ? "border-amber-400 ring-2 ring-amber-400/70 dark:border-amber-400"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <span className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        {locked ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-zinc-950">
            Locked
          </span>
        ) : null}
      </div>

      <div
        className="relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900"
        style={{ height: WINDOW_PX }}
      >
        {body}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-2 z-10 rounded-lg border-y-2 border-amber-400/80"
          style={{ top: ROW_PX, height: ROW_PX }}
        />
      </div>

      <div className="flex h-9 items-center justify-center">
        {canLock ? (
          <button
            type="button"
            aria-pressed={locked}
            aria-label={lockName}
            onClick={onToggleLock}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              locked
                ? "border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-300"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
            }`}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Placeholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <span
        aria-hidden="true"
        className="text-7xl font-bold leading-none text-zinc-300 dark:text-zinc-700"
      >
        ?
      </span>
    </div>
  );
}

/** Rows scroll up and settle on the landing ingredient (the middle visible row). */
function ScrollingStrip({
  result,
  spinMs,
  onSettled,
}: {
  result: ReelResult;
  spinMs: number;
  onSettled: () => void;
}) {
  const landIndex = result.strip.length;
  const filler = result.strip[0] ?? result.ingredient;
  // Two trailing fillers keep the overshoot from showing an empty window.
  const rows = [...result.strip, result.ingredient, filler, filler];
  const restY = -(landIndex - 1) * ROW_PX;
  const overshootY = restY - OVERSHOOT_PX;

  return (
    <motion.div
      aria-hidden="true"
      className="absolute inset-x-0 top-0"
      initial={{ y: 0 }}
      animate={{ y: [0, overshootY, restY] }}
      transition={{
        duration: spinMs / 1000,
        times: [0, 0.8, 1],
        ease: ["easeOut", "easeInOut"],
      }}
      onAnimationComplete={() => onSettled()}
    >
      {rows.map((row, position) => (
        <div
          key={`${position}-${row.id}`}
          className="flex items-center gap-3 px-4"
          style={{ height: ROW_PX }}
        >
          <span className="text-3xl leading-none">{row.emoji ?? "🛒"}</span>
          <span className="truncate text-base font-medium text-zinc-800 dark:text-zinc-200">
            {row.name}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
