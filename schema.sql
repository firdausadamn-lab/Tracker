-- ---------------------------------------------------------------------------
-- Proof of Work — full schema (clean-slate rebuild).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- WARNING: this DROPS the existing tables. Safe only when there is no real
-- data to keep (that is the case for this rebuild).
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

drop table if exists unlocked_achievements cascade;
drop table if exists achievements cascade;
drop table if exists habit_logs cascade;
drop table if exists tasks cascade;
drop table if exists habits cascade;
drop table if exists lists cascade;

create table habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table habit_logs (
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  done boolean not null default true,
  primary key (habit_id, log_date)
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  log_date date not null default current_date,
  due_date date,
  text text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Badge definitions. The app derives "unlocked?" from live stats, but these
-- rows are the display catalogue and the target for unlocked_achievements.
create table achievements (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text not null,
  icon text,
  sort_order integer not null default 0
);

-- The moment a badge was first earned. Written once on the day it unlocks.
create table unlocked_achievements (
  achievement_key text references achievements(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (achievement_key)
);

-- All access goes through the server (service role key), which bypasses RLS.
-- RLS stays enabled with no policies, so the public anon key can read nothing.
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table lists enable row level security;
alter table tasks enable row level security;
alter table achievements enable row level security;
alter table unlocked_achievements enable row level security;

-- ---------------------------------------------------------------------------
-- Seed the badge catalogue. Names are game-flavored; icons are short sigils
-- rendered inside designed hex badges (not clip-art / not emoji).
-- Keys and thresholds must match ACHIEVEMENTS in lib/xp.ts.
-- ---------------------------------------------------------------------------
insert into achievements (key, name, description, icon, sort_order) values
  ('streak_3',   'First Blood',  'Keep every habit three days straight.',  'III',  0),
  ('streak_7',   'Warming Up',   'A full seven-day streak.',               'VII',  1),
  ('streak_14',  'Fortnight',    'Fourteen days without a miss.',          'XIV',  2),
  ('streak_30',  'Iron Month',   'Thirty-day streak. Forged.',             'XXX',  3),
  ('streak_60',  'Unbroken',     'Sixty days, no gaps.',                   'LX',   4),
  ('streak_100', 'Centurion',    'One hundred days in a row.',             'C',    5),
  ('days_25',    'Grinder',      'Twenty-five perfect days logged.',       '25',   6),
  ('days_100',   'Deep Grind',   'One hundred perfect days logged.',       '100',  7),
  ('xp_1000',    'Apprentice',   'Bank one thousand XP.',                  '1K',   8),
  ('xp_2500',    'Adept',        'Bank twenty-five hundred XP.',           '2K',   9),
  ('xp_5000',    'Master',       'Bank five thousand XP.',                 '5K',  10),
  ('xp_10000',   'Ascendant',    'Bank ten thousand XP.',                  '10K', 11);
