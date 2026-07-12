import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildContribution,
  computeStreaks,
  lastNDays,
  startOfToday,
  toKey,
  type DayCell,
  type HabitMeta,
} from "@/lib/streaks";
import {
  computeXpAndDays,
  levelFromXp,
  unlockedKeys,
  type LevelInfo,
  type Stats,
} from "@/lib/xp";

const GRAPH_DAYS = 371; // ~53 weeks
const MAX_SPAN = 366 * 6; // defensive cap on lifetime range

type LogRow = { habit_id: string; log_date: string };

function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`).getTime();
  const b = new Date(`${bKey}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export type Progress = {
  stats: Stats;
  level: LevelInfo;
  graphCells: DayCell[]; // last ~53 weeks, for the contributions grid
  doneByDay: Map<string, Set<string>>;
};

// Compute lifetime stats (streak, XP, level, perfect-day count) from raw
// habits + done logs, plus the trailing-year cells for the graph.
export function computeProgress(habits: HabitMeta[], logs: LogRow[]): Progress {
  const doneByDay = new Map<string, Set<string>>();
  for (const l of logs) {
    let set = doneByDay.get(l.log_date);
    if (!set) {
      set = new Set<string>();
      doneByDay.set(l.log_date, set);
    }
    set.add(l.habit_id);
  }

  const todayKey = toKey(startOfToday());
  let earliest = todayKey;
  for (const h of habits) {
    const k = h.created_at.slice(0, 10);
    if (k < earliest) earliest = k;
  }
  const span = Math.min(Math.max(daysBetween(earliest, todayKey) + 1, 1), MAX_SPAN);

  const allCells = buildContribution(lastNDays(span), habits, doneByDay);
  const fullyDone = allCells.filter((c) => c.isFullyDone).map((c) => c.date); // sorted asc

  const { current, best } = computeStreaks(new Set(fullyDone));
  const { totalXp, totalFullDays } = computeXpAndDays(fullyDone);
  const stats: Stats = { current, best, totalXp, totalFullDays };
  const level = levelFromXp(totalXp);

  const graphCells = buildContribution(lastNDays(GRAPH_DAYS), habits, doneByDay);

  return { stats, level, graphCells, doneByDay };
}

// Recompute stats and persist any newly-earned achievements. Insert-once:
// existing rows are never rewritten, so unlocked_at stays the true first date.
export async function syncUnlocks(sb: SupabaseClient): Promise<void> {
  const [habitsRes, logsRes, unlockedRes] = await Promise.all([
    sb.from("habits").select("id, created_at"),
    sb.from("habit_logs").select("habit_id, log_date").eq("done", true),
    sb.from("unlocked_achievements").select("achievement_key"),
  ]);

  const habits = (habitsRes.data ?? []) as HabitMeta[];
  const logs = (logsRes.data ?? []) as LogRow[];
  const have = new Set(
    (unlockedRes.data ?? []).map((r: { achievement_key: string }) => r.achievement_key)
  );

  const { stats } = computeProgress(habits, logs);
  const want = unlockedKeys(stats);
  const toInsert = Array.from(want)
    .filter((k) => !have.has(k))
    .map((k) => ({ achievement_key: k }));

  if (toInsert.length) {
    await sb.from("unlocked_achievements").insert(toInsert);
  }
}
