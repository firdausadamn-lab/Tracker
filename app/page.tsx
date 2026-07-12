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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
      {/* ===== HUD: title + level + XP bar ===== */}
      <section className="rise-in overflow-hidden rounded-xl border border-border bg-elev shadow-[0_0_0_1px_rgba(190,152,98,0.06),0_24px_60px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-b from-oxblood/15 to-transparent p-5 sm:p-7">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-inkdim">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  ok ? "pulse-dot bg-done" : "bg-inkfaint"
                }`}
                aria-hidden
              />
              {ok ? "online" : "offline"}
            </div>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-none tracking-tight text-ink sm:text-5xl">
              Proof of Work
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-inkfaint">
              a daily grind, logged in the open
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-brass">
              Level
            </div>
            <div className="font-display text-6xl font-semibold leading-none text-ink sm:text-7xl">
              {level.level}
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="p-5 sm:p-7">
          <div className="mb-2 flex items-end justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="text-inkdim">XP</span>
            <span className="text-inkdim">
              <span className="text-done">{fmtNum(level.xpInto)}</span>
              {" / "}
              {fmtNum(level.xpNeed)}
              <span className="ml-2 text-inkfaint">
                ({fmtNum(stats.totalXp)} total)
              </span>
            </span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full border border-border bg-elev2">
            {/* notches */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0 9.5%, rgba(0,0,0,0.35) 9.5% 10%)",
              }}
              aria-hidden
            />
            <div
              className="xp-grow h-full rounded-full bg-done shadow-[0_0_12px_rgba(111,149,87,0.55)]"
              style={{ width: `${Math.max(pct, level.xpInto > 0 ? 3 : 0)}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="mt-2 text-right font-mono text-[11px] text-inkfaint">
            {fmtNum(Math.max(level.xpNeed - level.xpInto, 0))} XP to level{" "}
            {level.level + 1}
          </div>
        </div>
      </section>

      {/* ===== Streak stat block ===== */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        <StatCell
          label="Current streak"
          value={stats.current}
          unit="days"
          hot={stats.current > 0}
        />
        <StatCell label="Longest streak" value={stats.best} unit="days" />
      </section>

      {/* ===== Contributions graph ===== */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <Label>The Grind</Label>
          <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
            {fmtNum(stats.totalFullDays)} perfect days
          </span>
        </div>
        <div className="rounded-lg border border-border bg-elev/40 p-4 sm:p-6">
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

      {/* ===== Achievements ===== */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <Label>Achievements</Label>
          <span className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
            {unlockedCount} / {ACHIEVEMENTS.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-6">
          {ACHIEVEMENTS.map((a, i) => {
            const isUnlocked = unlocked.has(a.key);
            return (
              <div
                key={a.key}
                className="badge-in flex flex-col items-center text-center"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div
                  className={`badge-hex flex h-16 w-14 items-center justify-center font-mono text-sm font-medium sm:h-[72px] sm:w-16 ${
                    isUnlocked
                      ? "bg-done/15 text-done shadow-[0_0_16px_rgba(111,149,87,0.35)]"
                      : "bg-elev2 text-inkfaint"
                  }`}
                  style={{
                    // brass rim when unlocked, muted rim when locked
                    ["--rim" as string]: isUnlocked ? "#BE9862" : "#342E27",
                  }}
                  title={`${a.name} — ${a.description}${
                    isUnlocked && unlockedAt[a.key]
                      ? ` (unlocked ${longDate(unlockedAt[a.key].slice(0, 10))})`
                      : ""
                  }`}
                >
                  {a.icon}
                </div>
                <div
                  className={`mt-2 text-[11px] font-semibold leading-tight ${
                    isUnlocked ? "text-ink" : "text-inkfaint"
                  }`}
                >
                  {a.name}
                </div>
                <div className="mt-0.5 hidden text-[10px] leading-tight text-inkfaint sm:block">
                  {isUnlocked ? a.description : "Locked"}
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
                  className={`flex h-5 w-5 items-center justify-center rounded-[4px] border text-[11px] ${
                    done
                      ? "border-done bg-done text-doneink"
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

function StatCell({
  label,
  value,
  unit,
  hot,
}: {
  label: string;
  value: number;
  unit: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-elev px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-inkfaint">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={`font-display text-4xl font-semibold tabular-nums sm:text-5xl ${
            hot ? "text-done" : "text-ink"
          }`}
        >
          {value}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-inkfaint">
          {unit}
        </span>
      </div>
    </div>
  );
}
