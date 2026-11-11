# Setup

The app scaffold, database schema, seed data and CI workflow are already in the repo. These steps need your own accounts on GitHub, Supabase and Vercel, so only you can do them. Plan on about 20 minutes.

## Before you start (about 2 minutes)

Run these once. Use the email address on your GitHub account:

```bash
brew install node@22
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Homebrew does not put `node@22` on your PATH. Add it, then install pnpm (recent Node builds no longer include corepack):

```bash
echo 'export PATH="$(brew --prefix node@22)/bin:$PATH"' >> ~/.bash_profile   # zsh users: ~/.zshrc
source ~/.bash_profile
node --version              # should print v22.x
npm install -g pnpm@10.28.0
```

If you use nvm instead, run `nvm install 22`, then the same `npm install -g pnpm@10.28.0`.

## 1. Run it locally (about 3 minutes)

1. Open Terminal and run:

   ```bash
   cd ~/Desktop/claudework/grocery-slots
   pnpm install
   pnpm dev
   ```

2. Open http://localhost:3000. The page works now, before Supabase is set up.

## 2. Put it on GitHub (about 3 minutes)

1. On github.com, create an empty repo named `grocery-slots`. Do not add a README, .gitignore or license.
2. In Terminal, run these. Replace `<your-username>` with your GitHub username.

   ```bash
   cd ~/Desktop/claudework/grocery-slots
   mkdir -p .github/workflows && mv ci.yml.move-me .github/workflows/ci.yml   # first time only
   git init -b main
   git add .
   git commit -m "Week 1: scaffold, schema, CI"
   git remote add origin https://github.com/joshgrodsky3/groceryslots.git
   git push -u origin main
   ```

   If Git asks you to sign in, use your GitHub login. GitHub wants a personal access token in place of a password.
3. On github.com, open the repo's **Actions** tab. CI should go green. It can take a few minutes.

## 3. Create the Supabase project (about 5 minutes)

1. Sign up at supabase.com, click **New project**, and name it `grocery-slots`. Pick a US region close to Texas. Generate a strong database password and save it in a password manager; you need it in section 4.
2. Click **Connect** at the top of the project dashboard, or open **Project Settings > API Keys**. Copy the **Project URL** and the **publishable key**. Older projects show it as the anon key; use that value instead.
3. In Terminal, create your local env file and open it:

   ```bash
   cd ~/Desktop/claudework/grocery-slots
   cp .env.example .env.local
   open -e .env.local
   ```

4. Paste the two values after the `=` signs, then save. Each line looks like `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`. If `pnpm dev` was running, restart it.

- Never commit `.env.local`. Git ignores it, so keep it that way.
- Never use the service-role or secret key. Never put any key in a variable whose name starts with `NEXT_PUBLIC_`, because those values reach every visitor's browser.

## 4. Apply the schema (about 5 minutes)

1. Sign in to the Supabase CLI. Homebrew can't install it on macOS 14, so run it through npx (no install needed):

   ```bash
   cd ~/Desktop/claudework/grocery-slots
   npx supabase login
   ```

2. Set up the repo. Answer any `supabase init` prompts with the defaults. It adds `supabase/config.toml`:

   ```bash
   npx supabase init
   ```

3. Link to your project, then create the tables and policies. The project ref is the part of the Project URL before `.supabase.co`. The link command asks for the database password from section 3:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Load the seed data. Run the command below, paste the output into the Supabase **SQL Editor**, and click **Run**. Then open **Table Editor**, select `ingredients`, and confirm it shows 145 rows.

   ```bash
   pbcopy < supabase/seed.sql
   ```

Fallback without the CLI: in the SQL Editor, paste and run `supabase/migrations/20261025120000_init.sql`, then `supabase/seed.sql`.

## 5. Deploy on Vercel (about 3 minutes)

1. Go to vercel.com, sign in with GitHub, click **Add New > Project**, and import `grocery-slots`.
2. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, using the same values as in `.env.local`. Then click **Deploy**.

From now on, every push to `main` redeploys the site, and every pull request gets its own preview URL.

## 6. Verify (about 1 minute)

- [ ] The page loads at http://localhost:3000 with `pnpm dev`
- [ ] The GitHub Actions run for `main` is green
- [ ] The Supabase `ingredients` table has 145 rows
- [ ] The Vercel URL loads

## What's in the repo

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Home page (placeholder reels for now) |
| `src/lib/supabase/` | Supabase client helpers |
| `supabase/migrations/` | Database schema, tables and policies |
| `supabase/seed.sql` | 145 starter ingredients |
| `.github/workflows/ci.yml` | CI: install, typecheck, lint, build |
| `docs/` | Project docs, including the implementation plan |
