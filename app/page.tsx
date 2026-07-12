import { supabaseServer } from "@/lib/supabase";
import { computeStreaks, daysUntil, dueLabel, lastNDays, startOfToday, toKey } from "@/lib/streaks";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 63;
const LOG_DAYS_SHOWN = 14;

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type TaskRow = {
  id: string;
  list_id: string;
  log_date: string;
  due_date: string | null;
  text: string;
  done: boolean;
};

export default async function PublicPage() {
  const sb = supabaseServer();
  const today = startOfToday();
  const todayKey = toKey(today);
  const range = lastNDays(DAYS_SHOWN, today);
  const rangeStartKey = toKey(range[0]);

  const [{ data: habits }, { data: logs }, { data: lists }, { data: tasks }] = await Promise.all([
    sb.from("habits").select("id, name").order("sort_order", { ascending: true }),
    sb
      .from("habit_logs")
      .select("habit_id, log_date, done")
      .gte("log_date", rangeStartKey)
      .eq("done", true),
    sb.from("lists").select("id, name").order("sort_order", { ascending: true }),
    sb
      .from("tasks")
      .select("id, list_id, log_date, due_date, text, done")
      .order("log_date", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(500),
  ]);

  const logsByHabit = new Map<string, Set<string>>();
  for (const row of logs ?? []) {
    const set = logsByHabit.get(row.habit_id) ?? new Set<string>();
    set.add(row.log_date);
    logsByHabit.set(row.habit_id, set);
  }

  const tasksByList = new Map<string, TaskRow[]>();
  for (const t of (tasks ?? []) as TaskRow[]) {
    const list = tasksByList.get(t.list_id) ?? [];
    list.push(t);
    tasksByList.set(t.list_id, list);
  }

  return (
    <div className="pb-20">
      <div className="mx-auto max-w-2xl px-5">
        <header className="grain border-b border-border py-14">
          <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
            Live, updated daily
          </div>
          <h1 className="font-display text-[clamp(30px,7vw,44px)] font-semibold tracking-tight text-ink">
            Proof
          </h1>
          <p className="mt-2.5 max-w-[420px] text-[14.5px] leading-relaxed text-inkdim">
            Everything I say I&apos;m doing, kept in a public ledger. No filter, no
            excuses. Just the record.
          </p>
        </header>

        <section className="border-b border-border py-9">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-inkfaint">
              Habits
            </h2>
            <span className="font-mono text-[11px] text-inkfaint">
              {fmt(range[0])} to {fmt(range[range.length - 1])}
            </span>
          </div>

          {!habits || habits.length === 0 ? (
            <div className="py-5 text-center font-mono text-[13.5px] text-inkfaint">
              No habits tracked yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {habits.map((h) => {
                const doneDates = logsByHabit.get(h.id) ?? new Set<string>();
                const { current, best } = computeStreaks(doneDates, today);
                return (
                  <div
                    key={h.id}
                    className="rounded-[10px] border border-border bg-elev px-[18px] py-4"
                  >
                    <div className="mb-3.5 flex items-start justify-between gap-3">
                      <div className="font-display text-[18px] font-semibold text-ink">
                        {h.name}
                      </div>
                      <div className="flex flex-shrink-0 gap-3.5">
                        <div className="text-right">
                          <div className="font-mono text-[18px] font-medium leading-none text-accent">
                            {current}
                          </div>
                          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-inkfaint">
                            Streak
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[18px] font-medium leading-none text-accent">
                            {best}
                          </div>
                          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-inkfaint">
                            Best
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {range.map((d) => {
                        const key = toKey(d);
                        const on = doneDates.has(key);
                        const isToday = key === todayKey;
                        return (
                          <div
                            key={key}
                            title={key + (on ? " done" : "")}
                            className={`h-3 w-3 flex-shrink-0 rounded-[3px] border ${
                              on ? "border-accent bg-accent" : "border-border bg-elev2"
                            } ${isToday ? "ring-1 ring-inkdim" : ""}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {(lists ?? []).map((list) => {
          const allTasks = tasksByList.get(list.id) ?? [];
          const goals = allTasks
            .filter((t) => t.due_date)
            .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
          const logTasks = allTasks.filter((t) => !t.due_date);

          const dayKeys = Array.from(new Set(logTasks.map((t) => t.log_date)))
            .sort()
            .reverse()
            .slice(0, LOG_DAYS_SHOWN);
          const todayHasTasks = logTasks.some((t) => t.log_date === todayKey);

          return (
            <section key={list.id} className="border-b border-border py-9">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="font-display text-[19px] font-semibold text-ink">{list.name}</h2>
                {dayKeys.length > 0 && (
                  <span className="font-mono text-[11px] text-inkfaint">
                    last {dayKeys.length} days
                  </span>
                )}
              </div>

              {goals.length > 0 && (
                <div className="mb-6 space-y-1.5">
                  {goals.map((t) => {
                    const diff = daysUntil(t.due_date!, today);
                    const overdue = diff < 0 && !t.done;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2.5 rounded-[8px] border border-border bg-elev px-3.5 py-2.5"
                      >
                        <div
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border ${
                            t.done ? "border-accent bg-accent" : "border-inkfaint"
                          }`}
                        >
                          {t.done && (
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path
                                d="M1 3L3 5L7 1"
                                stroke="#131512"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <div
                          className={`flex-1 text-[14.5px] ${
                            t.done ? "text-inkdim line-through" : "text-ink"
                          }`}
                        >
                          {t.text}
                        </div>
                        <div
                          className={`flex-shrink-0 font-mono text-[10.5px] uppercase tracking-[0.05em] ${
                            overdue ? "text-danger" : "text-inkfaint"
                          }`}
                        >
                          {dueLabel(diff)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!todayHasTasks && (
                <div className="mb-5">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-accent">
                    Today, {fmt(today)}
                  </div>
                  <div className="py-2.5 font-mono text-[13.5px] text-inkfaint">
                    Nothing logged yet today.
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {dayKeys.map((key) => {
                  const d = new Date(`${key}T00:00:00`);
                  const isToday = key === todayKey;
                  return (
                    <div key={key}>
                      <div
                        className={`mb-2 font-mono text-[11px] uppercase tracking-[0.06em] ${
                          isToday ? "text-accent" : "text-inkfaint"
                        }`}
                      >
                        {isToday ? "Today, " : ""}
                        {fmt(d)}
                      </div>
                      {logTasks
                        .filter((t) => t.log_date === key)
                        .map((t) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-2.5 border-b border-border py-2 text-[14.5px] last:border-none"
                          >
                            <div
                              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border ${
                                t.done ? "border-accent bg-accent" : "border-inkfaint"
                              }`}
                            >
                              {t.done && (
                                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                  <path
                                    d="M1 3L3 5L7 1"
                                    stroke="#131512"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className={t.done ? "text-inkdim line-through" : "text-ink"}>
                              {t.text}
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
                {dayKeys.length === 0 && goals.length === 0 && (
                  <div className="py-5 text-center font-mono text-[13.5px] text-inkfaint">
                    No entries yet.
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {(!lists || lists.length === 0) && (
          <section className="py-9 text-center font-mono text-[13.5px] text-inkfaint">
            No lists yet.
          </section>
        )}

        <footer className="border-t border-border pt-8 text-center font-mono text-[11px] text-inkfaint">
          proof of work, kept in public
        </footer>
      </div>
    </div>
  );
}
