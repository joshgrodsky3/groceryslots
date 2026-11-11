"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { AUTH_LABELS, AUTH_TEST_IDS, ROUTES } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; name: string };

const LINK =
  "inline-flex min-h-11 items-center rounded-full px-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:text-zinc-300 dark:hover:bg-zinc-900";

const BUTTON =
  "inline-flex min-h-11 items-center rounded-full border border-zinc-300 bg-white px-4 font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";

export function AccountBar() {
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          if (active) setAccount({ status: "signed-out" });
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const displayName: unknown = profile?.display_name;
        const name =
          typeof displayName === "string" && displayName.length > 0
            ? displayName
            : "Cook";
        if (active) setAccount({ status: "signed-in", name });
      } catch {
        // Env missing or the lookup failed: show the signed-out links.
        if (active) setAccount({ status: "signed-out" });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.assign(ROUTES.home);
    }
  }

  return (
    <div
      data-testid={AUTH_TEST_IDS.accountBar}
      className="flex h-11 w-full items-center justify-end gap-2 text-sm"
    >
      {account.status === "loading" && (
        <span aria-hidden="true" className="block h-11 w-40" />
      )}

      {account.status === "signed-out" && (
        <Link href={ROUTES.signIn} className={LINK}>
          {AUTH_LABELS.signIn}
        </Link>
      )}

      {account.status === "signed-in" && (
        <>
          <span className="max-w-32 truncate text-zinc-600 dark:text-zinc-400">
            {account.name}
          </span>
          <Link href={ROUTES.kitchen} className={LINK}>
            {AUTH_LABELS.kitchenLink}
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={BUTTON}
          >
            {AUTH_LABELS.signOut}
          </button>
        </>
      )}
    </div>
  );
}
