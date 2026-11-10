"use client";

import type { Ingredient, PriceBand } from "@/lib/spin/types";

const PRICE_LABEL: Record<PriceBand, string> = {
  cheap: "Cheap",
  mid: "Mid",
  splurge: "Splurge",
};

const DIFFICULTY_STEPS = [1, 2, 3, 4, 5] as const;
const DIFFICULTY_MAX = 5;

export function IngredientCard({
  ingredient,
  nameTestId,
}: {
  ingredient: Ingredient;
  /** Optional data-testid for the name element (the reel passes its reelName id). */
  nameTestId?: string;
}) {
  const difficulty = Math.min(
    DIFFICULTY_MAX,
    Math.max(0, Math.round(ingredient.difficulty)),
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
      <span aria-hidden="true" className="text-5xl leading-none">
        {ingredient.emoji ?? "🛒"}
      </span>
      <p
        data-testid={nameTestId}
        className="text-xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50"
      >
        {ingredient.name}
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {ingredient.aisle}
      </p>
      <div
        role="img"
        aria-label={`Difficulty ${difficulty} of ${DIFFICULTY_MAX}`}
        className="flex items-center gap-1"
      >
        {DIFFICULTY_STEPS.map((step) => (
          <span
            key={step}
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              step <= difficulty
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
        {PRICE_LABEL[ingredient.price_band]}
      </span>
    </div>
  );
}
