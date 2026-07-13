import { supabaseServer } from "@/lib/supabase";
import { toKey, startOfToday, type HabitMeta } from "@/lib/streaks";
import { computeProgress } from "@/lib/progress";
import { ACHIEVEMENTS, unlockedKeys } from "@/lib/xp";
import ContributionsGraph from "@/app/components/ContributionsGraph";

export const dynamic = "force-dynamic";

type Habit = { id: string; name: string; created_at: string };
type LogRow = { habit_id: string; log_date: string };
type TaskRow = {
  id: string;
  text: string;
  log_date: string;
  list: { name: string } | { name: string }[] | null;
};

type PageData = {
  habits: Habit[];
  logs: LogRow[];
  todayDone: Set<string>;
  tasksByDay: { date: string; items: { text: string; list: string | null }[] }[];
  unlockedAt: Record<string, string>;
  ok: boolean;
};

async function getData(): Promise<PageData> {
  const empty: PageData = {
    habits: [],
    logs: [],
    todayDone: new Set(),
    tasksByDay: [],
    unlockedAt: {},
    ok: false,
  };
  try {
    const sb = supabaseServer();
    const todayKey = toKey(startOfToday());

    const [habitsRes, logsRes, tasksRes, unlockedRes] = await Promise.all([
      sb.from("habits").select("id, name, created_at").order("sort_order"),
      sb.from("habit_logs").select("habit_id, log_date").eq("done", true),
      sb
        .from("tasks")
        .select("id, text, log_date, list:lists(name)")
        .eq("done", true)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120),
      sb.from("unlocked_achievements").select("achievement_key, unlocked_at"),
    ]);

    if (habitsRes.error || logsRes.error) return empty;

    const habits = (habitsRes.data ?? []) as Habit[];
    const logs = (logsRes.data ?? []) as LogRow[];
    const tasks = (tasksRes.data ?? []) as TaskRow[];

    const todayDone = new Set<string>();
    for (const l of logs) if (l.log_date === todayKey) todayDone.add(l.habit_id);

    const grouped = new Map<string, { text: string; list: string | null }[]>();
    for (const t of tasks) {
      const listName = Array.isArray(t.list)
        ? (t.list[0]?.name ?? null)
        : (t.list?.name ?? null);
      const arr = grouped.get(t.log_date) ?? [];
      arr.push({ text: t.text, list: listName });
      grouped.set(t.log_date, arr);
    }
    const tasksByDay = Array.from(grouped.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items }));

    const unlockedAt: Record<string, string> = {};
    for (const r of (unlockedRes.data ?? []) as {
      achievement_key: string;
      unlocked_at: string;
    }[]) {
      unlockedAt[r.achievement_key] = r.unlocked_at;
    }

    return { habits, logs, todayDone, tasksByDay, unlockedAt, ok: true };
  } catch {
    return empty;
  }
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function longDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-brass">
      {children}
    </h2>
  );
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.5 2c.4 3-1.6 4.2-2.7 5.6C8.6 9 8 10.2 8 11.9 8 15.3 9.8 18 12.4 18c2.7 0 4.6-2.3 4.6-5.3 0-1.6-.6-2.9-1.6-4.2.2 1-.3 1.8-1 2-.9.3-1.4-.4-1.3-1.4.2-2-.2-4.2-.6-7.1z" />
      <path d="M11.4 12.4c-.6.5-1 1.3-1 2.2 0 1.4 1 2.6 2.3 2.6 1.3 0 2.2-1 2.2-2.3 0-.8-.3-1.4-.8-1.9.1.6-.2 1-.6 1.1-.5.1-.8-.3-.7-.8.1-.9-.6-1.2-1.6-.9z" opacity=".55" />
    </svg>
  );
}

function TrophyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M6 5H3.5v.8A3.2 3.2 0 0 0 6.7 9M18 5h2.5v.8A3.2 3.2 0 0 1 17.3 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.4 12.3h3.2l-.5 3.2h-2.2l-.5-3.2zM8.5 19.4c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6v.6H8.5v-.6z" />
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5.5" y="10.5" width="13" height="9" rx="1.6" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

export default async function CharacterSheet() {
  const { habits, logs, todayDone, tasksByDay, unlockedAt, ok } = await getData();

  const habitMeta: HabitMeta[] = habits.map((h) => ({
    id: h.id,
    created_at: h.created_at,
  }));
  const { stats, level, graphCells, doneByDay } = computeProgress(habitMeta, logs);
  const unlocked = unlockedKeys(stats);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked.has(a.key)).length;

  const doneByDayRecord: Record<string, string[]> = {};
  doneByDay.forEach((set, key) => (doneByDayRecord[key] = Array.from(set)));

  const pct = Math.round(level.progress * 100);
  const fillPct = Math.max(pct, level.xpInto > 0 ? 4 : 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
      {/* ===== HERO HUD ===== */}
      <section className="rise-in overflow-hidden rounded-2xl border border-borderlit/60 bg-elev shadow-[0_1px_0_rgba(190,152,98,0.08),0_30px_70px_-45px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-5 border-b border-border/70 bg-gradient-to-br from-oxblood/20 via-transparent to-done/5 p-5 sm:gap-7 sm:p-7">
          {/* Level shield */}
          <div className="shrink-0 text-center">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-brass">
              Level
            </div>
            <div className="shield flex h-24 w-[84px] items-center justify-center bg-gradient-to-b from-elev2 to-bg sm:h-28 sm:w-24">
              <span className="font-stat text-5xl font-bold leading-none tracking-tight text-ink txtglow-green sm:text-6xl">
                {level.level}
              </span>
            </div>
          </div>

          {/* Title + status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-inkdim">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  ok ? "pulse-dot glow-green bg-done" : "bg-inkfaint"
                }`}
                aria-hidden
              />
              {ok ? "online" : "offline"}
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-5xl">
              Proof of Work
            </h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-inkfaint">
              a daily grind, logged in the open
            </p>
          </div>
        </div>

        {/* XP bar */}
        <div className="p-5 sm:p-7">
          <div className="mb-2 flex items-end justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-inkdim">XP</span>
            <span className="text-inkdim">
              <span className="font-stat text-base tracking-tight text-done">
                {fmtNum(level.xpInto)}
              </span>
              <span className="mx-1 text-inkfaint">/</span>
              <span className="font-stat text-base tracking-tight text-inkdim">
                {fmtNum(level.xpNeed)}
              </span>
              <span className="ml-2 text-inkfaint">
                ({fmtNum(stats.totalXp)} total)
              </span>
            </span>
          </div>
          <div className="xp-track relative h-5 overflow-hidden rounded-full border border-black/40 bg-elev2">
            <div
              className="xp-shimmer absolute inset-y-0 left-0 overflow-hidden rounded-full"
              style={{ width: `${fillPct}%` }}
            >
              <div className="xp-grow xp-fill h-full w-full rounded-full" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 9.5%, rgba(0,0,0,0.4) 9.5% 10%)",
              }}
              aria-hidden
            />
          </div>
          <div className="mt-2 text-right font-mono text-[11px] text-inkfaint">
            <span className="font-stat text-xs tracking-tight text-inkdim">
              {fmtNum(Math.max(level.xpNeed - level.xpInto, 0))}
            </span>{" "}
            XP to level {level.level + 1}
          </div>
        </div>
      </section>

      {/* ===== Streak stat block ===== */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-elev px-5 py-4">
          <FlameIcon
            className={`h-8 w-8 shrink-0 ${
              stats.current > 0
                ? "text-done drop-shadow-[0_0_8px_rgba(111,149,87,0.6)]"
                : "text-inkfaint"
            }`}
          />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inkfaint">
              Current streak
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-stat text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl ${
                  stats.current > 0 ? "text-done txtglow-green" : "text-ink"
                }`}
              >
                {stats.current}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                days
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-elev px-5 py-4">
          <TrophyIcon className="h-8 w-8 shrink-0 text-brass drop-shadow-[0_0_8px_rgba(190,152,98,0.4)]" />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inkfaint">
              Longest streak
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-stat text-4xl font-bold leading-none tracking-tight tabular-nums text-ink sm:text-5xl">
                {stats.best}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                days
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Contributions graph ===== */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <Label>The Grind</Label>
          <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
            <span className="font-stat text-sm tracking-tight text-inkdim">
              {fmtNum(stats.totalFullDays)}
            </span>{" "}
            perfect days
          </span>
        </div>
        <div className="rounded-xl border border-border bg-elev/40 p-4 sm:p-6">
          {habits.length === 0 ? (
            <p className="py-8 text-center text-sm text-inkdim">
              No habits tracked yet.
            </p>
          ) : (
            <ContributionsGraph
              cells={graphCells}
              habits={habits}
              doneByDay={doneByDayRecord}
            />
          )}
        </div>
      </section>

      {/* ===== Achievements — trophy case ===== */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <Label>Trophy Case</Label>
          <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
            <span className="font-stat text-sm tracking-tight text-done">
              {unlockedCount}
            </span>{" "}
            / {ACHIEVEMENTS.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-6">
          {ACHIEVEMENTS.map((a, i) => {
            const isUnlocked = unlocked.has(a.key);
            return (
              <div
                key={a.key}
                className={`group relative flex flex-col items-center text-center ${
                  isUnlocked ? "badge-pop" : "badge-in"
                }`}
                style={{ animationDelay: `${i * 45}ms` }}
                tabIndex={0}
              >
                <div
                  className={`badge-hex flex h-16 w-14 items-center justify-center sm:h-[72px] sm:w-16 ${
                    isUnlocked
                      ? "badge-lit bg-gradient-to-b from-done/25 to-done/5 text-done"
                      : "bg-elev2 text-inkfaint"
                  }`}
                  style={{ ["--rim" as string]: isUnlocked ? "#BE9862" : "#342E27" }}
                >
                  {isUnlocked ? (
                    <span className="font-stat text-base font-bold tracking-tight">
                      {a.icon}
                    </span>
                  ) : (
                    <LockIcon className="h-5 w-5 opacity-70" />
                  )}
                </div>
                <div
                  className={`mt-2 text-[11px] font-semibold leading-tight ${
                    isUnlocked ? "text-ink" : "text-inkfaint"
                  }`}
                >
                  {a.name}
                </div>

                {/* tooltip */}
                <div className="badge-tip pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-44 rounded-lg border border-borderlit bg-elev2 p-3 text-left shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)]">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-brass">
                    {a.name}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-inkdim">
                    {a.description}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-inkfaint">
                    {isUnlocked
                      ? unlockedAt[a.key]
                        ? `Earned ${longDate(unlockedAt[a.key].slice(0, 10))}`
                        : "Unlocked"
                      : "Locked"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Today's habits ===== */}
      <section className="mt-10">
        <Label>Today&apos;s Quests</Label>
        <ul className="mt-4 divide-y divide-border">
          {habits.length === 0 && (
            <li className="py-4 text-sm text-inkdim">No habits tracked yet.</li>
          )}
          {habits.map((h) => {
            const done = todayDone.has(h.id);
            return (
              <li key={h.id} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-[5px] border text-[11px] transition ${
                    done
                      ? "border-done bg-done text-doneink glow-green"
                      : "border-border bg-elev2 text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className={done ? "text-ink" : "text-inkdim"}>{h.name}</span>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                  {done ? "cleared" : "open"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ===== Build log ===== */}
      <section className="mt-10">
        <Label>Build Log</Label>
        {tasksByDay.length === 0 ? (
          <p className="mt-4 text-sm text-inkdim">Nothing shipped yet.</p>
        ) : (
          <div className="mt-4 space-y-7">
            {tasksByDay.map((group) => (
              <div key={group.date}>
                <div className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                  {longDate(group.date)}
                </div>
                <ul className="mt-2.5 space-y-2">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex items-baseline gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                      <span className="text-ink">{item.text}</span>
                      {item.list && (
                        <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-inkfaint">
                          {item.list}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-16 border-t border-border pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-inkfaint">
          proof over promises · built with CRAFT-grade craft
        </p>
      </footer>
    </main>
  );
}
