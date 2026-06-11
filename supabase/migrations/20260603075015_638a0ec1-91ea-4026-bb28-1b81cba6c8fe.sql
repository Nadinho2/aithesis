
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Topic generations (batches)
create table public.topic_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  department text not null,
  course text,
  area_of_interest text not null,
  country text,
  research_type text,
  topic_count int not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.topic_generations to authenticated;
grant all on public.topic_generations to service_role;

alter table public.topic_generations enable row level security;

create policy "topic_generations_own_all" on public.topic_generations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.topic_generations (user_id, created_at desc);

-- Topics
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.topic_generations(id) on delete set null,
  title text not null,
  problem_statement text not null,
  research_gap text not null,
  objectives text[] not null default '{}',
  novelty_score numeric(3,1) not null default 0,
  feasibility_score numeric(3,1) not null default 0,
  department text,
  area_of_interest text,
  country text,
  research_type text,
  category text,
  saved boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.topics to authenticated;
grant all on public.topics to service_role;

alter table public.topics enable row level security;

create policy "topics_own_all" on public.topics
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.topics (user_id, created_at desc);
create index on public.topics (user_id, saved) where saved = true;
