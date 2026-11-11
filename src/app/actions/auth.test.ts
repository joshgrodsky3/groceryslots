import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveDisplayName,
  sendCode,
  signOut,
  verifyCode,
} from "@/app/actions/auth";
import { MESSAGES } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  eqUpdate: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

const RATE_LIMITED = "Too many requests. Wait a minute and try again.";

function fakeClient() {
  // profiles: select(...).eq(...).maybeSingle() and update(...).eq(...)
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    update: mocks.update,
  });
  mocks.update.mockReturnValue({ eq: mocks.eqUpdate });
  return {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue(fakeClient());
  mocks.eqUpdate.mockResolvedValue({ error: null });
});

describe("sendCode", () => {
  it("rejects an invalid email without calling Supabase", async () => {
    const result = await sendCode("not-an-email");
    expect(result).toEqual({ ok: false, error: MESSAGES.invalidEmail });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("sends a code with a normalised email and shouldCreateUser", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    const result = await sendCode("  Ada@Example.com ");
    expect(result).toEqual({ ok: true });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("returns the rate limit message on a 429", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 429 } });
    expect(await sendCode("ada@example.com")).toEqual({
      ok: false,
      error: RATE_LIMITED,
    });
  });

  it("returns the generic message on other Supabase errors", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { status: 500 } });
    expect(await sendCode("ada@example.com")).toEqual({
      ok: false,
      error: MESSAGES.generic,
    });
  });

  it("returns notConnected when the client cannot be created", async () => {
    mocks.createClient.mockRejectedValue(new Error("Missing env"));
    expect(await sendCode("ada@example.com")).toEqual({
      ok: false,
      error: MESSAGES.notConnected,
    });
  });
});

describe("verifyCode", () => {
  it("rejects an invalid email or code without calling Supabase", async () => {
    expect(await verifyCode("nope", "123456")).toEqual({
      ok: false,
      error: MESSAGES.invalidEmail,
    });
    expect(await verifyCode("ada@example.com", "12ab")).toEqual({
      ok: false,
      error: MESSAGES.invalidCode,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("returns badCode when Supabase rejects the code", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403 } });
    expect(await verifyCode("ada@example.com", "123456")).toEqual({
      ok: false,
      error: MESSAGES.badCode,
    });
  });

  it("asks for a name and suggests the profile name when not onboarded", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: "u1", email: "ada@example.com", user_metadata: {} } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { display_name: "Ada L" },
      error: null,
    });
    const result = await verifyCode(" Ada@Example.com ", " 123456 ");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      token: "123456",
      type: "email",
    });
    expect(result).toEqual({
      ok: true,
      needsName: true,
      suggestedName: "Ada L",
    });
  });

  it("falls back to the email-based name when the profile is unreadable", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: "u1", email: "ada@example.com", user_metadata: {} } },
      error: null,
    });
    mocks.maybeSingle.mockRejectedValue(new Error("boom"));
    expect(await verifyCode("ada@example.com", "123456")).toEqual({
      ok: true,
      needsName: true,
      suggestedName: "Ada",
    });
  });

  it("does not ask for a name once onboarded", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "ada@example.com",
          user_metadata: { onboarded: true },
        },
      },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await verifyCode("ada@example.com", "123456");
    expect(result).toEqual({
      ok: true,
      needsName: false,
      suggestedName: "Ada",
    });
  });

  it("returns notConnected when the client cannot be created", async () => {
    mocks.createClient.mockRejectedValue(new Error("Missing env"));
    expect(await verifyCode("ada@example.com", "123456")).toEqual({
      ok: false,
      error: MESSAGES.notConnected,
    });
  });
});

describe("saveDisplayName", () => {
  it("rejects an invalid name", async () => {
    expect(await saveDisplayName("   ")).toEqual({
      ok: false,
      error: MESSAGES.invalidName,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "no session" },
    });
    expect(await saveDisplayName("Ada")).toEqual({
      ok: false,
      error: MESSAGES.notSignedIn,
    });
  });

  it("updates the profile and marks onboarding done", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
    const result = await saveDisplayName("  Ada   L ");
    expect(result).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Ada L" });
    expect(mocks.eqUpdate).toHaveBeenCalledWith("id", "u1");
    expect(mocks.updateUser).toHaveBeenCalledWith({
      data: { onboarded: true },
    });
  });

  it("returns generic when the profile update fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    mocks.eqUpdate.mockResolvedValue({ error: { message: "rls" } });
    expect(await saveDisplayName("Ada")).toEqual({
      ok: false,
      error: MESSAGES.generic,
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("returns notConnected when the client cannot be created", async () => {
    mocks.createClient.mockRejectedValue(new Error("Missing env"));
    expect(await saveDisplayName("Ada")).toEqual({
      ok: false,
      error: MESSAGES.notConnected,
    });
  });
});

describe("signOut", () => {
  it("signs out", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    expect(await signOut()).toEqual({ ok: true });
  });

  it("returns generic on error", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "x" } });
    expect(await signOut()).toEqual({ ok: false, error: MESSAGES.generic });
  });

  it("returns notConnected when the client cannot be created", async () => {
    mocks.createClient.mockRejectedValue(new Error("Missing env"));
    expect(await signOut()).toEqual({
      ok: false,
      error: MESSAGES.notConnected,
    });
  });
});
