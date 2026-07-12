-- ---------------------------------------------------------------------------
-- SAMPLE DATA — smoke-test the contributions graph, streaks, and build log.
-- Run once in Supabase (SQL Editor) AFTER schema.sql. This is throwaway demo
-- data; to remove it later:  truncate tasks, habit_logs, lists, habits;
-- ---------------------------------------------------------------------------

-- Four habits. Two are older, two started more recently, so you can confirm
-- the graph never un-greens days from before a habit existed.
insert into habits (name, sort_order, created_at) values
  ('Train',      0, now() - interval '150 days'),
  ('Read',       1, now() - interval '150 days'),
  ('Deep work',  2, now() - interval '90 days'),
  ('Sleep 7h',   3, now() - interval '60 days');

-- A live streak: every existing habit completed for the last 24 days.
insert into habit_logs (habit_id, log_date, done)
select h.id, d::date, true
from habits h
cross join generate_series(current_date - 23, current_date, interval '1 day') as d
where (h.created_at)::date <= d::date
on conflict (habit_id, log_date) do nothing;

-- Scattered history before the streak: roughly 55% of habit-days completed,
-- which produces a natural mix of full-green, partial, and empty squares.
insert into habit_logs (habit_id, log_date, done)
select h.id, d::date, true
from habits h
cross join generate_series(current_date - 140, current_date - 25, interval '1 day') as d
where (h.created_at)::date <= d::date
  and random() < 0.55
on conflict (habit_id, log_date) do nothing;

-- A couple of lists and a handful of shipped tasks for the build log.
insert into lists (name, sort_order) values ('Fitness', 0), ('Work', 1);

insert into tasks (list_id, text, log_date, done)
select
  (select id from lists where name = v.list),
  v.text,
  current_date - v.days_ago,
  true
from (values
  ('Work',    'Shipped the contributions graph rebuild', 0),
  ('Work',    'Wired the intake form to the backend',    0),
  ('Fitness', '5km run, negative split',                 1),
  ('Work',    'Cleaned up the streak calculation',       1),
  ('Fitness', 'Heavy squats, new 3-rep PR',              2),
  ('Work',    'Rewrote the admin dashboard',             3),
  ('Fitness', 'Long zone-2 ride',                        4)
) as v(list, text, days_ago);
