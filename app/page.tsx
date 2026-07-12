import { supabaseServer } from "@/lib/supabase";
import {
  buildContribution,
  computeStreaks,
  fullyDoneKeys,
  lastNDays,
  toKey,
  startOfToday,
  type HabitMeta,
} from "@/lib/streaks";
import ContributionsGraph from "@/app/components/ContributionsGraph";

export const dynamic = "force-dynamic";

const DAYS = 371; // ~53 weeks

type Habit = { id: string; name: string; created_at: string };
type LogRow = { habit_id: string; log_date: string };
type TaskRow = {
  id: string;
  text: string;
  log_date: string;
  list: { name: string } | { name: string }[] | null;
};

type PublicData = {
  habits: Habit[];
  doneByDay: Map<string, Set<string>>;
  todayDone: Set<string>;
  tasksByDay: { date: string; items: { text: string; list: string | null }[] }[];
  ok: boolean;
};

async function getData(): Promise<PublicData> {
  const empty: PublicData = {
    habits: [],
    doneByDay: new Map(),
    todayDone: new Set(),
    tasksByDay: [],
    ok: false,
  };

  try {
    const sb = supabaseServer();
    const startKey = toKey(lastNDays(DAYS)[0]);
    const todayKey = toKey(startOfToday());

    const [habitsRes, logsRes, tasksRes] = await Promise.all([
      sb.from("habits").select("id, name, created_at").order("sort_order"),
      sb
        .from("habit_logs")
        .select("habit_id, log_date")
        .eq("done", true)
        .gte("log_date", startKey),
      sb
        .from("tasks")
        .select("id, text, log_date, list:lists(name)")
        .eq("done", true)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (habitsRes.error || logsRes.error || tasksRes.error) return empty;

    const habits = (habitsRes.data ?? []) as Habit[];
    const logs = (logsRes.data ?? []) as LogRow[];
    const tasks = (tasksRes.data ?? []) as TaskRow[];

    const doneByDay = new Map<string, Set<string>>();
    for (const l of logs) {
      let set = doneByDay.get(l.log_date);
      if (!set) {
        set = new Set<string>();
        doneByDay.set(l.log_date, set);
      }
      set.add(l.habit_id);
    }
    const todayDone = doneByDay.get(todayKey) ?? new Set<string>();

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

    return { habits, doneByDay, todayDone, tasksByDay, ok: true };
  } catch {
    return empty;
  }
}

function longDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-brass">
      {children}
    </h2>
  );
}

export default async function PublicPage() {
  const { habits, doneByDay, todayDone, tasksByDay, ok } = await getData();

  const days = lastNDays(DAYS);
  const habitMeta: HabitMeta[] = habits.map((h) => ({
    id: h.id,
    created_at: h.created_at,
  }));
  const cells = buildContribution(days, habitMeta, doneByDay);
  const { current, best } = computeStreaks(fullyDoneKeys(cells));

  const doneByDayRecord: Record<string, string[]> = {};
  doneByDay.forEach((set, key) => {
    doneByDayRecord[key] = Array.from(set);
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      {/* Hero */}
      <header className="rise-in">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-inkdim">
          <span
            className="pulse-dot inline-block h-2 w-2 rounded-full bg-done"
            aria-hidden
          />
          <span>{ok ? "live" : "offline"}</span>
        </div>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          Proof of Work
        </h1>
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-inkdim">
          Every day, in the open. Habits kept and work shipped, with no editing
          the past.
        </p>
      </header>

      {/* Contributions + streaks */}
      <section className="mt-16 rise-in" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionLabel>Contributions</SectionLabel>
          <div className="flex gap-8">
            <div>
              <div className="font-display text-3xl font-semibold tabular-nums text-done">
                {current}
              </div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                day streak
              </div>
            </div>
            <div>
              <div className="font-display text-3xl font-semibold tabular-nums text-ink">
                {best}
              </div>
              <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                longest
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-elev/40 p-4 sm:p-6">
          {habits.length === 0 ? (
            <p className="py-8 text-center text-sm text-inkdim">
              No habits tracked yet.
            </p>
          ) : (
            <ContributionsGraph
              cells={cells}
              habits={habits}
              doneByDay={doneByDayRecord}
            />
          )}
        </div>
      </section>

      {/* Today's habits (read-only) */}
      <section className="mt-16 rise-in" style={{ animationDelay: "120ms" }}>
        <SectionLabel>Habits — Today</SectionLabel>
        <ul className="mt-6 divide-y divide-border">
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
                <span className={done ? "text-ink" : "text-inkdim"}>
                  {h.name}
                </span>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                  {done ? "done" : "open"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Build log */}
      <section className="mt-16 rise-in" style={{ animationDelay: "180ms" }}>
        <SectionLabel>Build Log</SectionLabel>
        {tasksByDay.length === 0 ? (
          <p className="mt-6 text-sm text-inkdim">Nothing shipped yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {tasksByDay.map((group) => (
              <div key={group.date}>
                <div className="font-mono text-[11px] uppercase tracking-wider text-inkfaint">
                  {longDate(group.date)}
                </div>
                <ul className="mt-3 space-y-2">
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

      {/* Footer */}
      <footer className="mt-24 border-t border-border pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-inkfaint">
          proof over promises · built with CRAFT-grade craft
        </p>
      </footer>
    </main>
  );
}
