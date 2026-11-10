"use server";

import { FIXTURE_POOL } from "@/lib/spin/fixture";
import { pickReels } from "@/lib/spin/pick";
import type {
  Ingredient,
  LockedIds,
  SpinRequest,
  SpinResponse,
} from "@/lib/spin/types";
import { createPublicClient } from "@/lib/supabase/public";

const INVALID = "Invalid spin request.";
const NOT_CONNECTED = "The ingredient database isn't connected yet.";
const LOAD_FAILED = "Couldn't load ingredients. Try again.";

function isLockedId(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
  );
}

function parseLocked(request: unknown): LockedIds | null {
  if (typeof request !== "object" || request === null) return null;
  const locked = (request as { locked?: unknown }).locked;
  if (!Array.isArray(locked) || locked.length !== 3) return null;
  if (!locked.every(isLockedId)) return null;
  return [locked[0], locked[1], locked[2]];
}

export async function spin(request: SpinRequest): Promise<SpinResponse> {
  const locked = parseLocked(request);
  if (!locked) {
    return { ok: false, error: INVALID };
  }

  try {
    let pool: Ingredient[];
    if (process.env.SPIN_FIXTURE === "1") {
      pool = FIXTURE_POOL;
    } else {
      const { data, error } = await createPublicClient()
        .from("ingredients")
        .select("id, name, category, aisle, difficulty, emoji, price_band");
      if (error || !data || data.length === 0) {
        return { ok: false, error: LOAD_FAILED };
      }
      pool = data as Ingredient[];
    }

    return { ok: true, reels: pickReels(pool, locked) };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return { ok: false, error: NOT_CONNECTED };
    }
    return { ok: false, error: LOAD_FAILED };
  }
}
