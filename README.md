# Grocery Slots

A slot-machine cooking challenge for two. Pull the lever: three reels land on random grocery ingredients, and both cooks must use all three.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- Biome (lint and format)
- Supabase (database, auth, `@supabase/ssr`)
- Vercel (hosting)

## Getting started

See [SETUP.md](./SETUP.md) for the one-time setup steps (Supabase project, `.env.local`, migrations, Vercel).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script      | Command                | What it does                           |
| ----------- | ---------------------- | -------------------------------------- |
| `dev`       | `pnpm dev`             | Start the dev server                   |
| `build`     | `pnpm build`           | Production build                       |
| `typecheck` | `pnpm typecheck`       | Run `tsc --noEmit`                     |
| `lint`      | `pnpm lint`            | Run Biome checks                       |
| `format`    | `pnpm format`          | Format files with Biome                |
| `test`      | `pnpm test`            | Run unit tests (Vitest)                |
| `test:e2e`  | `pnpm test:e2e`        | Run end-to-end tests (Playwright)      |

## Testing

- **Unit tests** (`pnpm test`): Vitest, in `src/**/*.test.ts`. Pure logic (pick, reducer, feedback) and the server action.
- **End-to-end tests** (`pnpm test:e2e`): Playwright, Chromium only, in `e2e/`. The config builds and starts the app on http://localhost:3000 with `SPIN_FIXTURE=1`, so the spin uses a built-in 12-ingredient fixture pool instead of Supabase. No database or `.env.local` is needed.
- First run only: `pnpm exec playwright install chromium` downloads the browser. CI does this in the `e2e` job.
- If something is already running on port 3000, Playwright reuses it locally (not on CI), so stop the dev server first to be sure the fixture is active.
- Failed CI runs upload `test-results/` as an artifact.
- Never set `SPIN_FIXTURE` on Vercel or any real deployment: it replaces the real database with 12 sample ingredients.

## Docs

Implementation plan: [docs/implementation-plan.md](./docs/implementation-plan.md)
