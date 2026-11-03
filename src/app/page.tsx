const reels = ["Produce", "Protein", "Wildcard"] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 font-sans text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Grocery Slots
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Pull the lever. Cook what lands.
          </p>
        </header>

        <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {reels.map((label) => (
            <li
              key={label}
              className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span
                aria-hidden="true"
                className="text-7xl font-bold leading-none text-zinc-300 dark:text-zinc-700"
              >
                ?
              </span>
              <span className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {label}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            disabled
            className="rounded-full bg-zinc-950 px-8 py-3 text-base font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
          >
            Pull the lever
          </button>
          <p className="text-sm text-zinc-500">Coming in week 3</p>
        </div>
      </main>
    </div>
  );
}
