import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKitchen,
  joinKitchen,
  listKitchens,
} from "@/app/actions/kitchen";
import { MESSAGES } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

type Result = { data: unknown; error: unknown };

type Chain = Promise<Result> & {
  select: () => Chain;
  eq: () => Chain;
  in: () => Chain;
  insert: (values: unknown) => Chain;
  single: () => Promise<Result>;
  maybeSingle: () => Promise<Result>;
};

/** A query builder: every filter returns the chain, and awaiting it yields the result. */
function query(result: Result): Chain {
  const chain: Chain = Object.assign(Promise.resolve(result), {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    insert: (values: unknown) => {
      mocks.insert(values);
      return chain;
    },
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  });
  return chain;
}

const client = {
  auth: { getUser: mocks.getUser },
  from: mocks.from,
  rpc: mocks.rpc,
};

const SIGNED_IN = { data: { user: { id: "u1" } }, error: null };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue(client);
  mocks.getUser.mockResolvedValue(SIGNED_IN);
});

describe("listKitchens", () => {
  it("reports not connected when the Supabase env is missing", async () => {
    mocks.createClient.mockRejectedValueOnce(new Error("Missing env"));
    expect(await listKitchens()).toEqual({
      ok: false,
      error: MESSAGES.notConnected,
    });
  });

  it("asks the user to sign in when there is no session", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Auth session missing" },
    });
    expect(await listKitchens()).toEqual({
      ok: false,
      error: MESSAGES.notSignedIn,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns an empty list when the user has no kitchens", async () => {
    mocks.from.mockReturnValueOnce(query({ data: [], error: null }));
    expect(await listKitchens()).toEqual({ ok: true, kitchens: [] });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("lists kitchens newest first with members and a Cook fallback", async () => {
    mocks.from
      .mockReturnValueOnce(
        query({
          data: [
            {
              role: "member",
              kitchens: {
                id: "k-old",
                name: "Old Kitchen",
                invite_code: "oldcode1",
                created_at: "2026-01-01T00:00:00+00:00",
              },
            },
            {
              role: "owner",
              kitchens: {
                id: "k-new",
                name: "New Kitchen",
                invite_code: "newcode1",
                created_at: "2026-03-01T00:00:00+00:00",
              },
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              kitchen_id: "k-new",
              user_id: "u1",
              profiles: { display_name: "Ana" },
            },
            {
              kitchen_id: "k-new",
              user_id: "u2",
              profiles: [{ display_name: "  Ben " }],
            },
            {
              kitchen_id: "k-old",
              user_id: "u3",
              profiles: { display_name: null },
            },
          ],
          error: null,
        }),
      );

    expect(await listKitchens()).toEqual({
      ok: true,
      kitchens: [
        {
          id: "k-new",
          name: "New Kitchen",
          inviteCode: "newcode1",
          role: "owner",
          members: [
            { userId: "u1", displayName: "Ana" },
            { userId: "u2", displayName: "Ben" },
          ],
        },
        {
          id: "k-old",
          name: "Old Kitchen",
          inviteCode: "oldcode1",
          role: "member",
          members: [{ userId: "u3", displayName: "Cook" }],
        },
      ],
    });
  });

  it("returns the generic message when a query fails", async () => {
    mocks.from.mockReturnValueOnce(
      query({ data: null, error: { message: "boom" } }),
    );
    expect(await listKitchens()).toEqual({
      ok: false,
      error: MESSAGES.generic,
    });
  });

  it("never throws, even when the auth call throws", async () => {
    mocks.getUser.mockRejectedValueOnce(new Error("network"));
    expect(await listKitchens()).toEqual({
      ok: false,
      error: MESSAGES.generic,
    });
  });
});

describe("createKitchen", () => {
  it("rejects a blank name without touching the database", async () => {
    expect(await createKitchen("   ")).toEqual({
      ok: false,
      error: MESSAGES.invalidKitchenName,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("asks the user to sign in first", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    expect(await createKitchen("Sunday Crew")).toEqual({
      ok: false,
      error: MESSAGES.notSignedIn,
    });
  });

  it("inserts the kitchen and returns it with the creator as owner", async () => {
    mocks.from
      .mockReturnValueOnce(
        query({
          data: { id: "k1", name: "Sunday Crew", invite_code: "abc123" },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { display_name: "Ana" }, error: null }),
      );

    expect(await createKitchen("  Sunday   Crew ")).toEqual({
      ok: true,
      kitchen: {
        id: "k1",
        name: "Sunday Crew",
        inviteCode: "abc123",
        role: "owner",
        members: [{ userId: "u1", displayName: "Ana" }],
      },
    });
    expect(mocks.insert).toHaveBeenCalledWith({ name: "Sunday Crew" });
  });

  it("falls back to Cook when the profile cannot be read", async () => {
    mocks.from
      .mockReturnValueOnce(
        query({
          data: { id: "k2", name: "Late Night", invite_code: "xyz789" },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: null, error: { message: "nope" } }));

    const result = await createKitchen("Late Night");
    expect(result).toMatchObject({
      ok: true,
      kitchen: { members: [{ userId: "u1", displayName: "Cook" }] },
    });
  });

  it("returns the generic message when the insert fails", async () => {
    mocks.from.mockReturnValueOnce(
      query({ data: null, error: { message: "rls" } }),
    );
    expect(await createKitchen("Sunday Crew")).toEqual({
      ok: false,
      error: MESSAGES.generic,
    });
  });
});

describe("joinKitchen", () => {
  it("rejects a malformed invite code without calling the database", async () => {
    expect(await joinKitchen("bad code!")).toEqual({
      ok: false,
      error: MESSAGES.invalidInvite,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("joins by calling join_kitchen with the cleaned code", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "k9", error: null });
    expect(await joinKitchen("  ABC-123 ")).toEqual({
      ok: true,
      kitchenId: "k9",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("join_kitchen", { code: "ABC-123" });
  });

  it("reports an unknown code as a bad invite", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "invalid invite code" },
    });
    expect(await joinKitchen("NOPE1234")).toEqual({
      ok: false,
      error: MESSAGES.badInvite,
    });
  });

  it("asks the user to sign in first", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "no session" },
    });
    expect(await joinKitchen("ABC123")).toEqual({
      ok: false,
      error: MESSAGES.notSignedIn,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
