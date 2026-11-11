"use server";

import { type ActionResult, MESSAGES, type VerifyData } from "@/lib/auth/types";
import {
  cleanDisplayName,
  defaultDisplayName,
  isValidCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/validate";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMITED = "Too many requests. Wait a minute and try again.";

/**
 * Success for actions with no extra data. The default ActionResult generic
 * (Record<string, never>) rejects a bare { ok: true } literal, so cast once here.
 */
const SUCCESS = { ok: true } as ActionResult;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Returns null when Supabase is not configured (createClient throws). */
async function connect(): Promise<ServerClient | null> {
  try {
    return await createClient();
  } catch {
    return null;
  }
}

/** Emails a one-time code. Creates the account on first use. */
export async function sendCode(email: string): Promise<ActionResult> {
  try {
    if (typeof email !== "string" || !isValidEmail(email)) {
      return { ok: false, error: MESSAGES.invalidEmail };
    }
    const supabase = await connect();
    if (!supabase) return { ok: false, error: MESSAGES.notConnected };

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true },
    });
    if (error) {
      return {
        ok: false,
        error: error.status === 429 ? RATE_LIMITED : MESSAGES.generic,
      };
    }
    return SUCCESS;
  } catch {
    return { ok: false, error: MESSAGES.generic };
  }
}

/** Checks the emailed code and signs the user in. */
export async function verifyCode(
  email: string,
  token: string,
): Promise<ActionResult<VerifyData>> {
  try {
    if (typeof email !== "string" || !isValidEmail(email)) {
      return { ok: false, error: MESSAGES.invalidEmail };
    }
    if (typeof token !== "string" || !isValidCode(token)) {
      return { ok: false, error: MESSAGES.invalidCode };
    }
    const supabase = await connect();
    if (!supabase) return { ok: false, error: MESSAGES.notConnected };

    const address = normalizeEmail(email);
    const { data, error } = await supabase.auth.verifyOtp({
      email: address,
      token: token.trim(),
      type: "email",
    });
    if (error || !data.user) {
      return { ok: false, error: MESSAGES.badCode };
    }

    const user = data.user;
    const needsName = !user.user_metadata?.onboarded;

    let suggestedName = defaultDisplayName(user.email ?? address);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const existing = profile?.display_name;
      if (typeof existing === "string" && existing.length > 0) {
        suggestedName = existing;
      }
    } catch {
      // Profile not readable: keep the email-based suggestion.
    }

    return { ok: true, needsName, suggestedName };
  } catch {
    return { ok: false, error: MESSAGES.generic };
  }
}

/** Saves the signed-in user's display name and marks onboarding done. */
export async function saveDisplayName(name: string): Promise<ActionResult> {
  try {
    const cleaned = typeof name === "string" ? cleanDisplayName(name) : null;
    if (!cleaned) return { ok: false, error: MESSAGES.invalidName };
    const supabase = await connect();
    if (!supabase) return { ok: false, error: MESSAGES.notConnected };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) {
      return { ok: false, error: MESSAGES.notSignedIn };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: cleaned })
      .eq("id", user.id);
    if (profileError) return { ok: false, error: MESSAGES.generic };

    const { error: metaError } = await supabase.auth.updateUser({
      data: { onboarded: true },
    });
    if (metaError) return { ok: false, error: MESSAGES.generic };

    return SUCCESS;
  } catch {
    return { ok: false, error: MESSAGES.generic };
  }
}

/** Signs the current user out. */
export async function signOut(): Promise<ActionResult> {
  try {
    const supabase = await connect();
    if (!supabase) return { ok: false, error: MESSAGES.notConnected };
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: MESSAGES.generic };
    return SUCCESS;
  } catch {
    return { ok: false, error: MESSAGES.generic };
  }
}
