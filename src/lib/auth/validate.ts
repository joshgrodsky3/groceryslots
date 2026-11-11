import {
  CODE_MAX_LENGTH,
  CODE_MIN_LENGTH,
  DISPLAY_NAME_MAX,
  INVITE_CODE_MAX,
  KITCHEN_NAME_MAX,
} from "@/lib/auth/types";

const EMAIL_MAX = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_PATTERN = /^\d+$/;
const INVITE_PATTERN = /^[A-Za-z0-9_-]+$/;
const FALLBACK_NAME = "Cook";

/** Trim and lowercase an email address. */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Simple shape check for an email address (max 254 characters). */
export function isValidEmail(s: string): boolean {
  const email = normalizeEmail(s);
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

/** A one-time code: digits only, within the Supabase length range, after trimming spaces. */
export function isValidCode(s: string): boolean {
  const code = s.trim();
  return (
    code.length >= CODE_MIN_LENGTH &&
    code.length <= CODE_MAX_LENGTH &&
    DIGITS_PATTERN.test(code)
  );
}

/** Collapse runs of whitespace, trim, and check the length is 1..max characters. */
function cleanName(s: string, max: number): string | null {
  const name = s.replace(/\s+/g, " ").trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= max ? name : null;
}

/** A display name: 1..DISPLAY_NAME_MAX characters after collapsing spaces, else null. */
export function cleanDisplayName(s: string): string | null {
  return cleanName(s, DISPLAY_NAME_MAX);
}

/** Suggested display name from an email: the part before @, capitalised, or "Cook". */
export function defaultDisplayName(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  const trimmed = Array.from(local.trim()).slice(0, DISPLAY_NAME_MAX).join("");
  if (trimmed.length === 0) return FALLBACK_NAME;
  const first = Array.from(trimmed)[0] ?? "";
  return first.toUpperCase() + trimmed.slice(first.length);
}

/** A kitchen name: 1..KITCHEN_NAME_MAX characters after collapsing spaces, else null. */
export function cleanKitchenName(s: string): string | null {
  return cleanName(s, KITCHEN_NAME_MAX);
}

/** An invite code: trimmed, 1..INVITE_CODE_MAX characters of [A-Za-z0-9_-], else null. */
export function cleanInviteCode(s: string): string | null {
  const code = s.trim();
  const valid =
    code.length >= 1 &&
    code.length <= INVITE_CODE_MAX &&
    INVITE_PATTERN.test(code);
  return valid ? code : null;
}
