import { describe, expect, it } from "vitest";
import {
  cleanDisplayName,
  cleanInviteCode,
  cleanKitchenName,
  defaultDisplayName,
  isValidCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/validate";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("  ada@example.com  ")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("ada")).toBe(false);
    expect(isValidEmail("ada@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("ada@example")).toBe(false);
    expect(isValidEmail("ada smith@example.com")).toBe(false);
  });

  it("rejects addresses over 254 characters", () => {
    const local = "a".repeat(64);
    const domain = `${"b".repeat(80)}.${"c".repeat(80)}.${"d".repeat(80)}.com`;
    expect(`${local}@${domain}`.length).toBeGreaterThan(254);
    expect(isValidEmail(`${local}@${domain}`)).toBe(false);
  });
});

describe("isValidCode", () => {
  it("accepts digits within 6 to 10 characters", () => {
    expect(isValidCode("123456")).toBe(true);
    expect(isValidCode("1234567890")).toBe(true);
    expect(isValidCode(" 123456 ")).toBe(true);
  });

  it("rejects short, long, empty and non-digit codes", () => {
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("12345")).toBe(false);
    expect(isValidCode("12345678901")).toBe(false);
    expect(isValidCode("12345a")).toBe(false);
    expect(isValidCode("123 456")).toBe(false);
    expect(isValidCode("-123456")).toBe(false);
  });
});

describe("cleanDisplayName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanDisplayName("  Ada   Lovelace ")).toBe("Ada Lovelace");
  });

  it("returns null when empty or blank", () => {
    expect(cleanDisplayName("")).toBeNull();
    expect(cleanDisplayName("   ")).toBeNull();
  });

  it("accepts exactly 30 characters and rejects 31", () => {
    const thirty = "a".repeat(30);
    expect(cleanDisplayName(thirty)).toBe(thirty);
    expect(cleanDisplayName(`${thirty}a`)).toBeNull();
  });
});

describe("defaultDisplayName", () => {
  it("uses the part before @ with a capital first letter", () => {
    expect(defaultDisplayName("ada@example.com")).toBe("Ada");
    expect(defaultDisplayName("  grace.hopper@example.com")).toBe(
      "Grace.hopper",
    );
  });

  it("trims the local part to the display name limit", () => {
    expect(defaultDisplayName(`${"x".repeat(50)}@example.com`)).toHaveLength(
      30,
    );
  });

  it("falls back to Cook when the local part is empty", () => {
    expect(defaultDisplayName("@example.com")).toBe("Cook");
  });
});

describe("cleanKitchenName", () => {
  it("trims, collapses spaces and enforces 1..40", () => {
    expect(cleanKitchenName("  Sunday   Kitchen ")).toBe("Sunday Kitchen");
    expect(cleanKitchenName("   ")).toBeNull();
    expect(cleanKitchenName("k".repeat(40))).toBe("k".repeat(40));
    expect(cleanKitchenName("k".repeat(41))).toBeNull();
  });
});

describe("cleanInviteCode", () => {
  it("trims and accepts letters, digits, underscore and hyphen", () => {
    expect(cleanInviteCode("  abc-DEF_123 ")).toBe("abc-DEF_123");
  });

  it("rejects empty, over-length and disallowed characters", () => {
    expect(cleanInviteCode("")).toBeNull();
    expect(cleanInviteCode("   ")).toBeNull();
    expect(cleanInviteCode("a".repeat(32))).toBe("a".repeat(32));
    expect(cleanInviteCode("a".repeat(33))).toBeNull();
    expect(cleanInviteCode("abc def")).toBeNull();
    expect(cleanInviteCode("abc!")).toBeNull();
  });
});
