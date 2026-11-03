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

| Script      | Command                | What it does                  |
| ----------- | ---------------------- | ----------------------------- |
| `dev`       | `pnpm dev`             | Start the dev server          |
| `build`     | `pnpm build`           | Production build              |
| `typecheck` | `pnpm typecheck`       | Run `tsc --noEmit`            |
| `lint`      | `pnpm lint`            | Run Biome checks              |
| `format`    | `pnpm format`          | Format files with Biome       |

## Docs

Implementation plan: [docs/implementation-plan.md](./docs/implementation-plan.md)
