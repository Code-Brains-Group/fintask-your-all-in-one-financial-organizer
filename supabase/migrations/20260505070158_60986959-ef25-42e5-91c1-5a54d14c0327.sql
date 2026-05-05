
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  currency text not null default 'KES',
  onboarded boolean not null default false,
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- wallets
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other',
  opening_balance numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
create policy "own wallets" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '💰',
  type text not null default 'expense',
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  type text not null check (type in ('income','expense','transfer')),
  category_id uuid references public.categories(id) on delete set null,
  wallet_id uuid references public.wallets(id) on delete set null,
  to_wallet_id uuid references public.wallets(id) on delete set null,
  date date not null default current_date,
  note text,
  method text default 'direct',
  fee numeric not null default 0,
  recurring_rule_id uuid,
  transfer_group uuid,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "own tx" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.transactions(user_id, date desc);

-- budgets
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  monthly_limit numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);
alter table public.budgets enable row level security;
create policy "own budgets" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- savings goals
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '🎯',
  target_amount numeric not null,
  deadline date,
  wallet_id uuid references public.wallets(id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.savings_goals enable row level security;
create policy "own goals" on public.savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric not null,
  wallet_id uuid references public.wallets(id) on delete set null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.savings_contributions enable row level security;
create policy "own contribs" on public.savings_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_date timestamptz,
  labels text[] not null default '{}',
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.subtasks enable row level security;
create policy "own subtasks" on public.subtasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cost providers + tiers
create table public.cost_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default '📱',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cost_providers enable row level security;
create policy "own providers" on public.cost_providers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.cost_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.cost_providers(id) on delete cascade,
  tx_type text not null,
  min_amount numeric not null,
  max_amount numeric not null,
  fee numeric not null,
  created_at timestamptz not null default now()
);
alter table public.cost_tiers enable row level security;
create policy "own tiers" on public.cost_tiers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recurring rules
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  type text not null,
  category_id uuid references public.categories(id) on delete set null,
  wallet_id uuid references public.wallets(id) on delete set null,
  method text default 'direct',
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date date not null default current_date,
  until_date date,
  next_due date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recurring_rules enable row level security;
create policy "own rules" on public.recurring_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
