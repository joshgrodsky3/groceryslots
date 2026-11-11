"use client";

import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  createKitchen,
  joinKitchen,
  listKitchens,
} from "@/app/actions/kitchen";
import {
  AUTH_LABELS,
  AUTH_TEST_IDS,
  INVITE_CODE_MAX,
  KITCHEN_NAME_MAX,
  type Kitchen,
  MESSAGES,
  ROUTES,
} from "@/lib/auth/types";

const PRIMARY_BUTTON =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-8 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950";

const SMALL_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";

const INPUT =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-950 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const LABEL = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const SECTION_HEADING =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

function selectText(node: HTMLElement | null) {
  if (!node) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function KitchenCard({ kitchen }: { kitchen: Kitchen }) {
  const codeRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(kitchen.inviteCode);
      setCopied(true);
    } catch {
      // No clipboard access: select the code so the user can copy it by hand.
      selectText(codeRef.current);
    }
  }

  return (
    <article
      data-testid={AUTH_TEST_IDS.kitchenCard}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {kitchen.name}
        </h3>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium capitalize text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          {kitchen.role}
        </span>
      </div>

      <ul aria-label="Members" className="flex flex-wrap gap-2">
        {kitchen.members.map((member) => (
          <li
            key={member.userId}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {member.displayName}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Invite code
          </span>
          <span
            ref={codeRef}
            data-testid={AUTH_TEST_IDS.inviteCode}
            className="font-mono text-base tracking-wider break-all"
          >
            {kitchen.inviteCode}
          </span>
        </div>
        <button type="button" onClick={copyInvite} className={SMALL_BUTTON}>
          {copied ? "Copied" : AUTH_LABELS.copyInvite}
        </button>
      </div>
    </article>
  );
}

export function KitchenPanel() {
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const createId = useId();
  const joinId = useId();

  const load = useCallback(async () => {
    try {
      const result = await listKitchens();
      if (result.ok) {
        setKitchens(result.kitchens);
        setSignedOut(false);
        setError(null);
      } else if (result.error === MESSAGES.notSignedIn) {
        setSignedOut(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null) return;
    const form = event.currentTarget;
    const value = String(new FormData(form).get("kitchenName") ?? "");
    setBusy("create");
    setError(null);
    try {
      const result = await createKitchen(value);
      if (result.ok) {
        form.reset();
        await load();
      } else {
        setError(result.error);
      }
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null) return;
    const form = event.currentTarget;
    const value = String(new FormData(form).get("inviteCode") ?? "");
    setBusy("join");
    setError(null);
    try {
      const result = await joinKitchen(value);
      if (result.ok) {
        form.reset();
        await load();
      } else {
        setError(result.error);
      }
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <output
        aria-label="Loading kitchens"
        aria-busy="true"
        className="flex w-full flex-col gap-4"
      >
        <div className="h-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      </output>
    );
  }

  if (signedOut) {
    return (
      <section className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base text-zinc-700 dark:text-zinc-300">
          Sign in to start a kitchen
        </p>
        <Link href={ROUTES.signIn} className={`${PRIMARY_BUTTON} max-w-xs`}>
          {AUTH_LABELS.signIn}
        </Link>
      </section>
    );
  }

  return (
    <div className="flex w-full flex-col gap-10">
      {error && (
        <p
          data-testid={AUTH_TEST_IDS.kitchenError}
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <section className="flex w-full flex-col gap-4">
        <h2 className={SECTION_HEADING}>Your kitchens</h2>
        {kitchens.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-base text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No kitchen yet. Create one, or paste your partner's invite code.
          </p>
        ) : (
          <ul
            data-testid={AUTH_TEST_IDS.kitchenList}
            className="flex w-full flex-col gap-4"
          >
            {kitchens.map((kitchen) => (
              <li key={kitchen.id}>
                <KitchenCard kitchen={kitchen} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex w-full flex-col gap-4">
        <h2 className={SECTION_HEADING}>Start a kitchen</h2>
        <form onSubmit={handleCreate} className="flex w-full flex-col gap-3">
          <label htmlFor={createId} className={`${LABEL} text-left`}>
            {AUTH_LABELS.kitchenName}
          </label>
          <input
            id={createId}
            name="kitchenName"
            type="text"
            autoComplete="off"
            maxLength={KITCHEN_NAME_MAX}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={busy !== null}
            className={PRIMARY_BUTTON}
          >
            {AUTH_LABELS.createKitchen}
          </button>
        </form>
      </section>

      <section className="flex w-full flex-col gap-4">
        <h2 className={SECTION_HEADING}>Join a kitchen</h2>
        <form onSubmit={handleJoin} className="flex w-full flex-col gap-3">
          <label htmlFor={joinId} className={`${LABEL} text-left`}>
            {AUTH_LABELS.inviteCode}
          </label>
          <input
            id={joinId}
            name="inviteCode"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={INVITE_CODE_MAX}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={busy !== null}
            className={PRIMARY_BUTTON}
          >
            {AUTH_LABELS.joinKitchen}
          </button>
        </form>
      </section>
    </div>
  );
}
