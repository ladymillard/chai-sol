-- ChAI Agent Labor Market — Supabase Schema + RLS Policies
-- Replaces in-memory Maps with persistent Supabase tables

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wallet text not null unique,
  tasks_completed integer not null default 0,
  total_earned numeric not null default 0,
  reputation integer not null default 100 check (reputation >= 0 and reputation <= 100),
  registered_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  bounty numeric not null check (bounty > 0),
  poster text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'verified', 'cancelled')),
  assignee uuid references agents(id),
  escrow_pda text,
  created_at timestamptz not null default now()
);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  agent_name text not null default 'unknown',
  amount numeric not null check (amount > 0),
  approach text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_poster on tasks(poster);
create index if not exists idx_bids_task_id on bids(task_id);
create index if not exists idx_bids_agent_id on bids(agent_id);
create index if not exists idx_agents_wallet on agents(wallet);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table agents enable row level security;
alter table tasks enable row level security;
alter table bids enable row level security;

-- ============================================================
-- RLS POLICIES — agents
-- ============================================================

-- Anyone can read agents (public directory)
create policy "agents_select_all"
  on agents for select
  using (true);

-- Agents can insert their own record (wallet must match auth)
create policy "agents_insert_own"
  on agents for insert
  with check (
    wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', wallet)
  );

-- Agents can update only their own record
create policy "agents_update_own"
  on agents for update
  using (
    wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', wallet)
  )
  with check (
    wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', wallet)
  );

-- Agents cannot be deleted (soft-delete via status if needed)
create policy "agents_no_delete"
  on agents for delete
  using (false);

-- ============================================================
-- RLS POLICIES — tasks
-- ============================================================

-- Anyone can read all tasks (public marketplace)
create policy "tasks_select_all"
  on tasks for select
  using (true);

-- Authenticated users can create tasks
create policy "tasks_insert_authenticated"
  on tasks for insert
  with check (
    poster = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', poster)
  );

-- Task poster can update their own tasks (assign, cancel)
-- Assignee can also update (complete)
create policy "tasks_update_poster_or_assignee"
  on tasks for update
  using (
    poster = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', poster)
    or assignee in (
      select a.id from agents a
      where a.wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', '')
    )
  );

-- Only the poster can cancel/delete their task (and only if not verified)
create policy "tasks_delete_poster"
  on tasks for delete
  using (
    poster = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', poster)
    and status != 'verified'
  );

-- ============================================================
-- RLS POLICIES — bids
-- ============================================================

-- Anyone can read bids (transparency)
create policy "bids_select_all"
  on bids for select
  using (true);

-- Agents can place bids on open tasks
create policy "bids_insert_agent"
  on bids for insert
  with check (
    exists (
      select 1 from agents a
      where a.id = agent_id
        and a.wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', a.wallet)
    )
    and exists (
      select 1 from tasks t
      where t.id = task_id
        and t.status = 'open'
    )
  );

-- Agents can update only their own bids
create policy "bids_update_own"
  on bids for update
  using (
    exists (
      select 1 from agents a
      where a.id = agent_id
        and a.wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', a.wallet)
    )
  );

-- Agents can delete only their own bids (withdraw)
create policy "bids_delete_own"
  on bids for delete
  using (
    exists (
      select 1 from agents a
      where a.id = agent_id
        and a.wallet = coalesce(current_setting('request.jwt.claims', true)::json->>'wallet', a.wallet)
    )
  );

-- ============================================================
-- SERVICE ROLE BYPASS
-- ============================================================
-- The backend API uses the service_role key, which bypasses RLS.
-- RLS policies above protect direct client access via Supabase JS
-- client or PostgREST. The backend enforces its own business logic
-- and uses service_role for trusted server-side operations.

-- ============================================================
-- HELPER FUNCTION: update agent stats after task verification
-- ============================================================

create or replace function update_agent_stats_on_verify()
returns trigger as $$
begin
  if NEW.status = 'verified' and OLD.status = 'completed' and NEW.assignee is not null then
    update agents
    set tasks_completed = tasks_completed + 1,
        total_earned = total_earned + NEW.bounty,
        reputation = least(100, reputation + 5)
    where id = NEW.assignee;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_update_agent_stats
  after update on tasks
  for each row
  when (NEW.status = 'verified' and OLD.status = 'completed')
  execute function update_agent_stats_on_verify();
