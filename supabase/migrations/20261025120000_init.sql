-- Grocery Slots: initial schema
--
-- Tables: profiles, kitchens, kitchen_members, ingredients, rounds, dishes, votes, critiques.
-- Every table has row level security enabled. Kitchen data is visible only to kitchen members.
-- Helper functions are security definer with `set search_path = ''`, so policies can check
-- membership without recursing into RLS on the membership table.
-- Ingredients are readable by anon and authenticated, and writable only by admins (no client policy).
-- Critiques have no client write policies; they are written server-side.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by the on_auth_user_created trigger
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- kitchens: a shared group of cooks, joined by invite code
-- ---------------------------------------------------------------------------

create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- kitchen_members: join table between kitchens and profiles
-- ---------------------------------------------------------------------------

create table public.kitchen_members (
  kitchen_id uuid references public.kitchens (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);

create index kitchen_members_user_id_idx on public.kitchen_members (user_id);

create function public.add_kitchen_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.kitchen_members (kitchen_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_kitchen_created
  after insert on public.kitchens
  for each row execute function public.add_kitchen_owner();

-- kitchens.created_by can never change, except to NULL when the creator's profile is deleted
-- (the on delete set null action). Any other change is rejected, including by members.
create function public.protect_kitchen_created_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    if not (
      new.created_by is null
      and not exists (select 1 from public.profiles p where p.id = old.created_by)
    ) then
      raise exception 'kitchens.created_by cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_kitchen_created_by_update
  before update on public.kitchens
  for each row execute function public.protect_kitchen_created_by();

-- ---------------------------------------------------------------------------
-- ingredients: the grocery catalogue used for spins (seeded in supabase/seed.sql)
-- ---------------------------------------------------------------------------

create table public.ingredients (
  id bigint generated always as identity primary key,
  name text not null unique,
  category text not null check (category in ('produce', 'protein', 'pantry', 'wildcard')),
  aisle text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  emoji text,
  image_url text,
  price_band text not null default 'mid' check (price_band in ('cheap', 'mid', 'splurge')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rounds: one spin of three ingredient reels inside a kitchen
-- ---------------------------------------------------------------------------

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens (id) on delete cascade,
  -- Postgres cannot put a foreign key on array elements, so ids are checked by the app.
  ingredient_ids bigint[] not null check (cardinality(ingredient_ids) = 3),
  locked_reels boolean[] not null default '{false,false,false}',
  respins_left smallint not null default 2 check (respins_left >= 0),
  status text not null default 'spinning' check (status in ('spinning', 'cooking', 'judging', 'done')),
  timer_minutes smallint not null default 60,
  started_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index rounds_kitchen_id_idx on public.rounds (kitchen_id);

-- ---------------------------------------------------------------------------
-- dishes: one dish per cook per round
-- ---------------------------------------------------------------------------

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  cook_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (round_id, cook_id),
  -- Target of votes' composite foreign key, so a vote must name a dish in its own round.
  unique (id, round_id)
);

create index dishes_round_id_idx on public.dishes (round_id);

-- ---------------------------------------------------------------------------
-- votes: one vote per voter per dish, scored 1-10 on three axes
-- ---------------------------------------------------------------------------

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  dish_id uuid not null,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  taste smallint not null check (taste between 1 and 10),
  creativity smallint not null check (creativity between 1 and 10),
  ingredient_use smallint not null check (ingredient_use between 1 and 10),
  created_at timestamptz not null default now(),
  unique (voter_id, dish_id),
  -- The dish must belong to the vote's round.
  foreign key (dish_id, round_id) references public.dishes (id, round_id) on delete cascade
);

create index votes_round_id_idx on public.votes (round_id);
create index votes_dish_id_idx on public.votes (dish_id);

-- ---------------------------------------------------------------------------
-- critiques: AI judge write-ups for a dish, written server-side only
-- ---------------------------------------------------------------------------

create table public.critiques (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  body text not null,
  model text,
  created_at timestamptz not null default now()
);

create index critiques_dish_id_idx on public.critiques (dish_id);

-- ---------------------------------------------------------------------------
-- helper functions (security definer so policies do not recurse into RLS)
-- ---------------------------------------------------------------------------

create function public.is_kitchen_member(k uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kitchen_members km
    where km.kitchen_id = k
      and km.user_id = (select auth.uid())
  );
$$;

create function public.is_round_member(r uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rounds rd
    join public.kitchen_members km on km.kitchen_id = rd.kitchen_id
    where rd.id = r
      and km.user_id = (select auth.uid())
  );
$$;

create function public.join_kitchen(code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kitchen_id uuid;
begin
  select k.id into v_kitchen_id
  from public.kitchens k
  where k.invite_code = code;

  if v_kitchen_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.kitchen_members (kitchen_id, user_id, role)
  values (v_kitchen_id, (select auth.uid()), 'member')
  on conflict do nothing;

  return v_kitchen_id;
end;
$$;

-- Helpers and join_kitchen are for signed-in users only. Remove the default PUBLIC grant
-- (which also reaches anon), then grant to authenticated explicitly.
revoke execute on function public.is_kitchen_member(uuid) from public, anon;
revoke execute on function public.is_round_member(uuid) from public, anon;
revoke execute on function public.join_kitchen(text) from public, anon;

grant execute on function public.is_kitchen_member(uuid) to authenticated;
grant execute on function public.is_round_member(uuid) to authenticated;
grant execute on function public.join_kitchen(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_self_or_kitchen_mates
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.kitchen_members me
      join public.kitchen_members other on other.kitchen_id = me.kitchen_id
      where me.user_id = (select auth.uid())
        and other.user_id = profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: kitchens
-- ---------------------------------------------------------------------------

alter table public.kitchens enable row level security;

-- The creator can read their kitchen right away, so insert ... returning works before the
-- owner row (added by the trigger) is visible to a membership check.
create policy kitchens_select_members_or_creator
  on public.kitchens for select
  to authenticated
  using (
    public.is_kitchen_member(id)
    or created_by = (select auth.uid())
  );

create policy kitchens_insert_creator
  on public.kitchens for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy kitchens_update_members
  on public.kitchens for update
  to authenticated
  using (public.is_kitchen_member(id))
  with check (public.is_kitchen_member(id));

-- ---------------------------------------------------------------------------
-- RLS: kitchen_members (no insert policy: rows come from the trigger and join_kitchen)
-- ---------------------------------------------------------------------------

alter table public.kitchen_members enable row level security;

create policy kitchen_members_select_members
  on public.kitchen_members for select
  to authenticated
  using (public.is_kitchen_member(kitchen_id));

create policy kitchen_members_delete_self
  on public.kitchen_members for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: ingredients (public catalogue, read-only for clients)
-- ---------------------------------------------------------------------------

alter table public.ingredients enable row level security;

create policy ingredients_select_all
  on public.ingredients for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RLS: rounds
-- ---------------------------------------------------------------------------

alter table public.rounds enable row level security;

create policy rounds_select_members
  on public.rounds for select
  to authenticated
  using (public.is_kitchen_member(kitchen_id));

create policy rounds_insert_members
  on public.rounds for insert
  to authenticated
  with check (
    public.is_kitchen_member(kitchen_id)
    and created_by = (select auth.uid())
  );

create policy rounds_update_members
  on public.rounds for update
  to authenticated
  using (public.is_kitchen_member(kitchen_id));

-- ---------------------------------------------------------------------------
-- RLS: dishes
-- ---------------------------------------------------------------------------

alter table public.dishes enable row level security;

create policy dishes_select_round_members
  on public.dishes for select
  to authenticated
  using (public.is_round_member(round_id));

-- Dishes can be cooked only once the round has left the spinning stage.
create policy dishes_insert_own
  on public.dishes for insert
  to authenticated
  with check (
    cook_id = (select auth.uid())
    and public.is_round_member(round_id)
    and exists (
      select 1
      from public.rounds rd
      where rd.id = dishes.round_id
        and rd.status in ('cooking', 'judging')
    )
  );

create policy dishes_update_own
  on public.dishes for update
  to authenticated
  using (cook_id = (select auth.uid()))
  with check (
    cook_id = (select auth.uid())
    and public.is_round_member(round_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: votes (blind until the round is done: a voter sees only their own votes
-- until then, and everyone in the round sees all votes once status = 'done')
-- ---------------------------------------------------------------------------

alter table public.votes enable row level security;

create policy votes_select_own_or_done
  on public.votes for select
  to authenticated
  using (
    voter_id = (select auth.uid())
    or (
      public.is_round_member(round_id)
      and exists (
        select 1
        from public.rounds rd
        where rd.id = votes.round_id
          and rd.status = 'done'
      )
    )
  );

-- Votes are cast only while the round is judging, and never on your own dish.
-- The composite foreign key guarantees the dish belongs to the vote's round.
create policy votes_insert_own
  on public.votes for insert
  to authenticated
  with check (
    voter_id = (select auth.uid())
    and public.is_round_member(round_id)
    and exists (
      select 1
      from public.rounds rd
      where rd.id = votes.round_id
        and rd.status = 'judging'
    )
    and not exists (
      select 1
      from public.dishes d
      where d.id = votes.dish_id
        and d.cook_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: critiques (read-only for clients, visible to members of the dish's round)
-- ---------------------------------------------------------------------------

alter table public.critiques enable row level security;

create policy critiques_select_round_members
  on public.critiques for select
  to authenticated
  using (
    exists (
      select 1
      from public.dishes d
      where d.id = critiques.dish_id
        and public.is_round_member(d.round_id)
    )
  );
