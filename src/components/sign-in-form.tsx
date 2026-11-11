"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { saveDisplayName, sendCode, verifyCode } from "@/app/actions/auth";
import { AUTH_LABELS, AUTH_TEST_IDS, MESSAGES, ROUTES } from "@/lib/auth/types";
import {
  cleanDisplayName,
  isValidCode,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth/validate";

type Step = "email" | "code" | "name";

const FIELD =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-950 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const PRIMARY_BUTTON =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-8 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950";

const SECONDARY_BUTTON =
  "inline-flex h-12 w-full items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";

const LABEL = "flex flex-col gap-2 text-left text-sm font-medium";

export function SignInForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailField = useRef<HTMLInputElement>(null);
  const codeField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);

  // Move focus to the first field of each new step.
  useEffect(() => {
    const field =
      step === "email"
        ? emailField.current
        : step === "code"
          ? codeField.current
          : nameField.current;
    field?.focus();
  }, [step]);

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) {
      setError(MESSAGES.invalidEmail);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await sendCode(address);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail(address);
      setCode("");
      setStep("code");
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setPending(false);
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCode(code)) {
      setError(MESSAGES.invalidCode);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await verifyCode(email, code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.needsName) {
        setName(result.suggestedName);
        setStep("name");
        return;
      }
      window.location.assign(ROUTES.kitchen);
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setPending(false);
    }
  }

  async function handleName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = cleanDisplayName(name);
    if (cleaned === null) {
      setError(MESSAGES.invalidName);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await saveDisplayName(cleaned);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.assign(ROUTES.kitchen);
    } catch {
      setError(MESSAGES.generic);
    } finally {
      setPending(false);
    }
  }

  function useDifferentEmail() {
    setError(null);
    setCode("");
    setStep("email");
  }

  const status =
    step === "email"
      ? "Enter your email and we'll send you a code."
      : step === "code"
        ? `We sent a code to ${email}.`
        : "Last thing: what should we call you?";

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <p
        aria-live="polite"
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        {status}
      </p>

      {error !== null && (
        <p
          data-testid={AUTH_TEST_IDS.error}
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {step === "email" && (
        <form
          data-testid={AUTH_TEST_IDS.emailStep}
          onSubmit={handleEmail}
          noValidate
          className="flex flex-col gap-4"
        >
          <label htmlFor="signin-email" className={LABEL}>
            {AUTH_LABELS.email}
            <input
              ref={emailField}
              id="signin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD}
            />
          </label>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {AUTH_LABELS.sendCode}
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          data-testid={AUTH_TEST_IDS.codeStep}
          onSubmit={handleCode}
          noValidate
          className="flex flex-col gap-4"
        >
          <label htmlFor="signin-code" className={LABEL}>
            {AUTH_LABELS.code}
            <input
              ref={codeField}
              id="signin-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${FIELD} tracking-widest`}
            />
          </label>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {AUTH_LABELS.verify}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={useDifferentEmail}
            className={SECONDARY_BUTTON}
          >
            {AUTH_LABELS.useDifferentEmail}
          </button>
        </form>
      )}

      {step === "name" && (
        <form
          data-testid={AUTH_TEST_IDS.nameStep}
          onSubmit={handleName}
          noValidate
          className="flex flex-col gap-4"
        >
          <label htmlFor="signin-name" className={LABEL}>
            {AUTH_LABELS.displayName}
            <input
              ref={nameField}
              id="signin-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FIELD}
            />
          </label>
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {AUTH_LABELS.saveName}
          </button>
        </form>
      )}
    </div>
  );
}
