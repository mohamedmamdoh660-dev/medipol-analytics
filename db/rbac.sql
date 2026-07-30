-- ============================================================
-- Users & Permissions (RBAC) for Medipol Analytics
-- Security model: "hide in app" — the app reads these tables and
-- filters what each logged-in user sees. Run this once in Supabase.
-- ============================================================

-- 1) Permission levels (roles) ------------------------------------------------
create table if not exists analytics_roles (
  id          text primary key,        -- 'admin' | 'self' | 'custom'
  label       text not null,
  description text
);

insert into analytics_roles (id, label, description) values
  ('admin',  'Admin — sees everything', 'Full access to all agents and leads'),
  ('self',   'Own only',                'Sees only their own assigned leads'),
  ('custom', 'Specific agents',         'Sees a chosen set of agents')
on conflict (id) do nothing;

-- 2) App users (who can log in) + their scope --------------------------------
create table if not exists analytics_users (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,          -- login email
  name           text,
  agent_id       text,                           -- their Bitrix agent id (for 'self')
  role           text not null default 'self' references analytics_roles(id),
  visible_agents text[] not null default '{}',   -- for 'custom': agent ids they may see
  created_at     timestamptz default now()
);

-- Seed the first admin (change if needed)
insert into analytics_users (email, name, agent_id, role) values
  ('mohamed.darwish@medipol.edu.tr', 'Mohammed Darwish', '16254', 'admin')
on conflict (email) do update set role = 'admin';

-- 3) Access (app-level security: any signed-in user may read; the app decides UI)
alter table analytics_roles enable row level security;
alter table analytics_users enable row level security;

drop policy if exists analytics_roles_read on analytics_roles;
create policy analytics_roles_read on analytics_roles
  for select to authenticated using (true);

drop policy if exists analytics_users_all on analytics_users;
create policy analytics_users_all on analytics_users
  for all to authenticated using (true) with check (true);

grant select on analytics_roles to authenticated;
grant select, insert, update, delete on analytics_users to authenticated;
