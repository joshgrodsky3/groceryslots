import { SlotMachine } from "@/components/slot-machine";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-3 py-16 font-sans sm:px-4 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Grocery Slots
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Pull the lever. Cook what lands.
          </p>
        </header>

        <SlotMachine />
      </main>
    </div>
  );
}
