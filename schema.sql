-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS column guards throughout.

create extension if not exists "pgcrypto";

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists habit_logs (
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  done boolean not null default true,
  primary key (habit_id, log_date)
);

-- Lists are your custom to-do categories: Fitness, Work, Study, or anything
-- else you add from /admin.
create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  log_date date not null default current_date,
  due_date date,
  text text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrading from an earlier version of this app (single unlisted task log)?
-- These add the new columns without touching existing rows.
alter table tasks add column if not exists list_id uuid references lists(id) on delete cascade;
alter table tasks add column if not exists due_date date;

-- All access goes through the server (service role key), which bypasses
-- Row Level Security entirely. RLS stays enabled with no policies, so the
-- anon/public key (never used by this app) can't read or write anything.
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table lists enable row level security;
alter table tasks enable row level security;
