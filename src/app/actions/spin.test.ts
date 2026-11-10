import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ingredient, ReelResult } from "@/lib/spin/types";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  createPublicClient: vi.fn(),
  pickReels: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: mocks.createPublicClient,
}));

vi.mock("@/lib/spin/pick", () => ({
  pickReels: mocks.pickReels,
}));

vi.mock("@/lib/spin/fixture", () => ({
  FIXTURE_POOL: [
    {
      id: 900,
      name: "Fixture Carrot",
      category: "produce",
      aisle: "Produce",
      difficulty: 1,
      emoji: "🥕",
      price_band: "cheap",
    },
  ] satisfies Ingredient[],
}));

import { spin } from "@/app/actions/spin";

const POOL: Ingredient[] = [
  {
    id: 1,
    name: "Kale",
    category: "produce",
    aisle: "Produce",
    difficulty: 2,
    emoji: "🥬",
    price_band: "cheap",
  },
  {
    id: 2,
    name: "Chicken",
    category: "protein",
    aisle: "Meat",
    difficulty: 3,
    emoji: null,
    price_band: "mid",
  },
  {
    id: 3,
    name: "Rice",
    category: "pantry",
    aisle: "Grains",
    difficulty: 1,
    emoji: "🍚",
    price_band: "cheap",
  },
];

function reel(ingredient: Ingredient, key: ReelResult["reel"]): ReelResult {
  return { reel: key, ingredient, strip: [] };
}

const RESULT = [
  reel(POOL[0], "produce"),
  reel(POOL[1], "protein"),
  reel(POOL[2], "wildcard"),
] as const;

function setQuery(result: { data: unknown; error: unknown }) {
  mocks.select.mockResolvedValue(result);
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.createPublicClient.mockReturnValue({ from: mocks.from });
}

const ORIGINAL_FIXTURE = process.env.SPIN_FIXTURE;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPIN_FIXTURE;
  mocks.pickReels.mockReturnValue(RESULT);
  setQuery({ data: POOL, error: null });
});

afterEach(() => {
  if (ORIGINAL_FIXTURE === undefined) {
    delete process.env.SPIN_FIXTURE;
  } else {
    process.env.SPIN_FIXTURE = ORIGINAL_FIXTURE;
  }
});

describe("spin server action", () => {
  it("returns three reels for a valid request", async () => {
    const response = await spin({ locked: [1, null, null] });

    expect(response).toEqual({ ok: true, reels: RESULT });
    expect(mocks.select).toHaveBeenCalledWith(
      "id, name, category, aisle, difficulty, emoji, price_band",
    );
    expect(mocks.from).toHaveBeenCalledWith("ingredients");
    expect(mocks.pickReels).toHaveBeenCalledWith(POOL, [1, null, null]);
  });

  it("accepts all-null and mixed locks", async () => {
    await expect(spin({ locked: [null, null, null] })).resolves.toMatchObject({
      ok: true,
    });
    await expect(spin({ locked: [null, 2, 3] })).resolves.toMatchObject({
      ok: true,
    });
  });

  it.each([
    ["not an object", null],
    ["missing locked", {}],
    ["locked not an array", { locked: "1,null,null" }],
    ["too short", { locked: [null, null] }],
    ["too long", { locked: [null, null, null, null] }],
    ["string id", { locked: ["1", null, null] }],
    ["zero id", { locked: [0, null, null] }],
    ["negative id", { locked: [-1, null, null] }],
    ["fractional id", { locked: [1.5, null, null] }],
    [
      "unsafe integer id",
      { locked: [Number.MAX_SAFE_INTEGER + 1, null, null] },
    ],
    ["NaN id", { locked: [Number.NaN, null, null] }],
    ["undefined entry", { locked: [undefined, null, null] }],
  ])("rejects an invalid request (%s)", async (_label, request) => {
    const response = await spin(request as never);

    expect(response).toEqual({ ok: false, error: "Invalid spin request." });
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.pickReels).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the query fails", async () => {
    setQuery({ data: null, error: { message: "boom" } });

    const response = await spin({ locked: [null, null, null] });

    expect(response).toEqual({
      ok: false,
      error: "Couldn't load ingredients. Try again.",
    });
    expect(mocks.pickReels).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the query returns no rows", async () => {
    setQuery({ data: [], error: null });

    const response = await spin({ locked: [null, null, null] });

    expect(response).toEqual({
      ok: false,
      error: "Couldn't load ingredients. Try again.",
    });
  });

  it("returns a friendly error when the query throws", async () => {
    mocks.select.mockRejectedValue(new Error("network down"));
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createPublicClient.mockReturnValue({ from: mocks.from });

    const response = await spin({ locked: [null, null, null] });

    expect(response).toEqual({
      ok: false,
      error: "Couldn't load ingredients. Try again.",
    });
  });

  it("returns a friendly error when pickReels throws", async () => {
    mocks.pickReels.mockImplementation(() => {
      throw new Error("No ingredients for produce");
    });

    const response = await spin({ locked: [null, null, null] });

    expect(response).toEqual({
      ok: false,
      error: "Couldn't load ingredients. Try again.",
    });
  });

  it("uses the fixture pool and never calls the client when SPIN_FIXTURE=1", async () => {
    process.env.SPIN_FIXTURE = "1";

    const response = await spin({ locked: [null, null, null] });

    expect(response.ok).toBe(true);
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(mocks.pickReels).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 900, name: "Fixture Carrot" })],
      [null, null, null],
    );
  });

  it("returns the not-connected message when the env var is missing", async () => {
    mocks.createPublicClient.mockImplementation(() => {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL — copy .env.example to .env.local and fill it in",
      );
    });

    const response = await spin({ locked: [null, null, null] });

    expect(response).toEqual({
      ok: false,
      error: "The ingredient database isn't connected yet.",
    });
  });
});
