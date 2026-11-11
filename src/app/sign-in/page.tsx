import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Grocery Slots",
};

export default function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-3 py-16 font-sans sm:px-4 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Sign in
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            We'll email you a code. No password.
          </p>
        </header>

        <SignInForm />
      </main>
    </div>
  );
}
