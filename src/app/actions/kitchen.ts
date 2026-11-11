"use server";

import {
  type ActionResult,
  type Kitchen,
  type KitchenList,
  type KitchenMember,
  MESSAGES,
} from "@/lib/auth/types";
import { cleanInviteCode, cleanKitchenName } from "@/lib/auth/validate";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Session = { supabase: Supabase; userId: string };
type Gate = { ok: true; session: Session } | { ok: false; error: string };

type KitchenRow = {
  id: string;
  name: string;
  inviteCode: string;
  role: Kitchen["role"];
  createdAt: number;
};

const UNKNOWN_NAME = "Cook";

/** Connects to Supabase and confirms a signed-in user. */
async function connect(): Promise<Gate> {
  let supabase: Supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: MESSAGES.notConnected };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: MESSAGES.notSignedIn };
  }
  return { ok: true, session: { supabase, userId: data.user.id } };
}

/** Actions never throw: anything unexpected becomes the generic message. */
async function guard<T extends object>(
  work: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch {
    return { ok: false, error: MESSAGES.generic };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** PostgREST returns embedded many-to-one resources as an object; accept an array too. */
function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRole(value: unknown): value is Kitchen["role"] {
  return value === "owner" || value === "member";
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readKitchenRow(row: unknown): KitchenRow | null {
  if (!isRecord(row) || !isRole(row.role)) return null;
  const kitchen = first(row.kitchens);
  if (!isRecord(kitchen)) return null;
  const id = text(kitchen.id);
  const name = text(kitchen.name);
  const inviteCode = text(kitchen.invite_code);
  if (!id || !name || !inviteCode) return null;
  return {
    id,
    name,
    inviteCode,
    role: row.role,
    createdAt: Date.parse(text(kitchen.created_at) ?? "") || 0,
  };
}

function readMember(
  row: unknown,
): { kitchenId: string; member: KitchenMember } | null {
  if (!isRecord(row)) return null;
  const kitchenId = text(row.kitchen_id);
  const userId = text(row.user_id);
  if (!kitchenId || !userId) return null;
  const profile = first(row.profiles);
  const displayName = isRecord(profile) ? text(profile.display_name) : null;
  return {
    kitchenId,
    member: { userId, displayName: displayName?.trim() || UNKNOWN_NAME },
  };
}

/** The signed-in user's kitchens, newest first, each with its members. */
export async function listKitchens(): Promise<ActionResult<KitchenList>> {
  return guard<KitchenList>(async () => {
    const gate = await connect();
    if (!gate.ok) return gate;
    const { supabase, userId } = gate.session;

    const { data: mine, error: mineError } = await supabase
      .from("kitchen_members")
      .select("role, kitchens(id, name, invite_code, created_at)")
      .eq("user_id", userId);
    if (mineError) return { ok: false, error: MESSAGES.generic };

    const kitchens = (Array.isArray(mine) ? mine : [])
      .map(readKitchenRow)
      .filter(isPresent);
    if (kitchens.length === 0) return { ok: true, kitchens: [] };

    const { data: memberRows, error: membersError } = await supabase
      .from("kitchen_members")
      .select("kitchen_id, user_id, profiles(display_name)")
      .in(
        "kitchen_id",
        kitchens.map((kitchen) => kitchen.id),
      );
    if (membersError) return { ok: false, error: MESSAGES.generic };

    const membersByKitchen = new Map<string, KitchenMember[]>();
    for (const row of Array.isArray(memberRows) ? memberRows : []) {
      const parsed = readMember(row);
      if (!parsed) continue;
      const members = membersByKitchen.get(parsed.kitchenId) ?? [];
      members.push(parsed.member);
      membersByKitchen.set(parsed.kitchenId, members);
    }

    const list = [...kitchens]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(
        (kitchen): Kitchen => ({
          id: kitchen.id,
          name: kitchen.name,
          inviteCode: kitchen.inviteCode,
          role: kitchen.role,
          members: membersByKitchen.get(kitchen.id) ?? [],
        }),
      );
    return { ok: true, kitchens: list };
  });
}

/** Creates a kitchen. The database trigger makes the caller its owner. */
export async function createKitchen(
  name: string,
): Promise<ActionResult<{ kitchen: Kitchen }>> {
  return guard<{ kitchen: Kitchen }>(async () => {
    const gate = await connect();
    if (!gate.ok) return gate;
    const kitchenName = cleanKitchenName(name);
    if (!kitchenName) return { ok: false, error: MESSAGES.invalidKitchenName };
    const { supabase, userId } = gate.session;

    const { data, error } = await supabase
      .from("kitchens")
      .insert({ name: kitchenName })
      .select("id, name, invite_code")
      .single();
    if (error || !isRecord(data)) return { ok: false, error: MESSAGES.generic };

    const id = text(data.id);
    const createdName = text(data.name);
    const inviteCode = text(data.invite_code);
    if (!id || !createdName || !inviteCode) {
      return { ok: false, error: MESSAGES.generic };
    }

    // The display name is cosmetic here, so a failed lookup falls back quietly.
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const displayName = isRecord(profile)
      ? text(profile.display_name)?.trim() || UNKNOWN_NAME
      : UNKNOWN_NAME;

    return {
      ok: true,
      kitchen: {
        id,
        name: createdName,
        inviteCode,
        role: "owner",
        members: [{ userId, displayName }],
      },
    };
  });
}

/** Joins the kitchen that owns an invite code. */
export async function joinKitchen(
  code: string,
): Promise<ActionResult<{ kitchenId: string }>> {
  return guard<{ kitchenId: string }>(async () => {
    const gate = await connect();
    if (!gate.ok) return gate;
    const inviteCode = cleanInviteCode(code);
    if (!inviteCode) return { ok: false, error: MESSAGES.invalidInvite };

    const { data, error } = await gate.session.supabase.rpc("join_kitchen", {
      code: inviteCode,
    });
    if (error) return { ok: false, error: MESSAGES.badInvite };

    const kitchenId = text(data);
    if (!kitchenId) return { ok: false, error: MESSAGES.generic };
    return { ok: true, kitchenId };
  });
}
