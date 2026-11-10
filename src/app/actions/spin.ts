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

/** How long a loaded ingredient pool is reused before querying again. */
const POOL_TTL_MS = 5 * 60 * 1000;

/** Module-level cache of the database pool. Never used in fixture mode. */
let poolCache: { pool: Ingredient[]; expiresAt: number } | null = null;

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

async function loadPool(): Promise<Ingredient[] | null> {
  const cached = poolCache;
  if (cached && Date.now() < cached.expiresAt) {
    return cached.pool;
  }

  const { data, error } = await createPublicClient()
    .from("ingredients")
    .select("id, name, category, aisle, difficulty, emoji, price_band");
  if (error || !data || data.length === 0) {
    return null;
  }

  const pool = data as Ingredient[];
  poolCache = { pool, expiresAt: Date.now() + POOL_TTL_MS };
  return pool;
}

export async function spin(request: SpinRequest): Promise<SpinResponse> {
  const locked = parseLocked(request);
  if (!locked) {
    return { ok: false, error: INVALID };
  }

  try {
    let pool: Ingredient[] | null;
    if (process.env.SPIN_FIXTURE === "1") {
      pool = FIXTURE_POOL;
    } else {
      pool = await loadPool();
      if (!pool) {
        return { ok: false, error: LOAD_FAILED };
      }
    }

    return { ok: true, reels: pickReels(pool, locked) };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return { ok: false, error: NOT_CONNECTED };
    }
    return { ok: false, error: LOAD_FAILED };
  }
}
