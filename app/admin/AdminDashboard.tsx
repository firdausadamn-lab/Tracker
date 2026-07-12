"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeStreaks, daysUntil, dueLabel, lastNDays, toKey } from "@/lib/streaks";

type Habit = { id: string; name: string; doneDates: string[] };
type ListRow = { id: string; name: string };
type Task = {
  id: string;
  list_id: string;
  log_date: string;
  due_date: string | null;
  text: string;
  done: boolean;
};

const DAYS_SHOWN = 63;

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Check({ done }: { done: boolean }) {
  if (!done) return null;
  return (
    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
      <path d="M1 3L3 5L7 1" stroke="#131512" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminDashboard({
  initialHabits,
  initialLists,
  initialTasks,
  todayKey,
}: {
  initialHabits: Habit[];
  initialLists: ListRow[];
  initialTasks: Task[];
  todayKey: string;
}) {
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [lists, setLists] = useState<ListRow[]>(initialLists);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newHabit, setNewHabit] = useState("");
  const [newList, setNewList] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const today = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey]);
  const range = useMemo(() => lastNDays(DAYS_SHOWN, today), [today]);

  async function toggleDay(habitId: string, dateKey: string) {
    setBusy(`${habitId}:${dateKey}`);
    setHabits((hs) =>
      hs.map((h) => {
        if (h.id !== habitId) return h;
        const has = h.doneDates.includes(dateKey);
        return { ...h, doneDates: has ? h.doneDates.filter((d) => d !== dateKey) : [...h.doneDates, dateKey] };
      })
    );
    await fetch(`/api/habits/${habitId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey }),
    });
    setBusy(null);
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setNewHabit("");
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { habit } = await res.json();
      setHabits((hs) => [...hs, { id: habit.id, name: habit.name, doneDates: [] }]);
    }
  }

  async function deleteHabit(id: string) {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    await fetch(`/api/habits/${id}`, { method: "DELETE" });
  }

  async function addList(e: React.FormEvent) {
    e.preventDefault();
    const name = newList.trim();
    if (!name) return;
    setNewList("");
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { list } = await res.json();
      setLists((ls) => [...ls, { id: list.id, name: list.name }]);
    }
  }

  async function deleteList(id: string) {
    setLists((ls) => ls.filter((l) => l.id !== id));
    setTasks((ts) => ts.filter((t) => t.list_id !== id));
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
  }

  async function addTask(listId: string, text: string, dueDate: string) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: listId, text, due_date: dueDate || null }),
    });
    if (res.ok) {
      const { task } = await res.json();
      setTasks((ts) => [
        { id: task.id, list_id: task.list_id, log_date: task.log_date, due_date: task.due_date, text: task.text, done: task.done },
        ...ts,
      ]);
    }
  }

  async function toggleTask(id: string, done: boolean) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done } : t)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
  }

  async function deleteTask(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24">
      <header className="flex items-center justify-between border-b border-border py-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-inkfaint">Proof: Admin</div>
          <h1 className="font-display text-[26px] font-semibold text-ink">Today&apos;s ledger</h1>
        </div>
        <button
          onClick={logout}
          className="rounded-[8px] border border-border px-3 py-1.5 font-mono text-[12px] text-inkdim transition hover:border-inkdim active:scale-[0.98]"
        >
          Log out
        </button>
      </header>

      <section className="border-b border-border py-8">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-inkfaint">Habits</h2>

        <div className="space-y-3.5">
          {habits.map((h) => {
            const doneSet = new Set(h.doneDates);
            const { current, best } = computeStreaks(doneSet, today);
            return (
              <div key={h.id} className="rounded-[10px] border border-border bg-elev px-[18px] py-4">
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div className="font-display text-[17px] font-semibold text-ink">{h.name}</div>
                  <div className="flex items-center gap-3.5">
                    <div className="text-right">
                      <div className="font-mono text-[16px] font-medium leading-none text-done">{current}</div>
                      <div className="mt-1 font-mono text-[9px] uppercase text-inkfaint">Streak</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[16px] font-medium leading-none text-done">{best}</div>
                      <div className="mt-1 font-mono text-[9px] uppercase text-inkfaint">Best</div>
                    </div>
                    <button
                      onClick={() => deleteHabit(h.id)}
                      aria-label={`Delete ${h.name}`}
                      className="font-mono text-[12px] text-inkfaint transition hover:text-danger"
                    >
                      remove
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {range.map((d) => {
                    const key = toKey(d);
                    const on = doneSet.has(key);
                    const isToday = key === todayKey;
                    const pending = busy === `${h.id}:${key}`;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleDay(h.id, key)}
                        title={key}
                        disabled={pending}
                        className={`h-4 w-4 flex-shrink-0 rounded-[3px] border transition active:scale-90 ${
                          on ? "border-done bg-done" : "border-border bg-elev2 hover:border-inkdim"
                        } ${isToday ? "ring-1 ring-inkdim" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {habits.length === 0 && (
            <div className="py-2 font-mono text-[13px] text-inkfaint">No habits yet.</div>
          )}
        </div>

        <form onSubmit={addHabit} className="mt-4 flex gap-2">
          <input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="New habit, e.g. Train"
            className="flex-1 rounded-[8px] border border-border bg-elev2 px-3.5 py-2 text-[14px] text-ink outline-none focus:border-done"
          />
          <button
            type="submit"
            className="rounded-[8px] border border-done px-4 py-2 font-mono text-[13px] text-done transition active:translate-y-[1px] active:scale-[0.98]"
          >
            Add
          </button>
        </form>
      </section>

      <section className="border-b border-border py-8">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-inkfaint">Lists</h2>

        <form onSubmit={addList} className="mb-6 flex gap-2">
          <input
            value={newList}
            onChange={(e) => setNewList(e.target.value)}
            placeholder="New list, e.g. Fitness, Work, Study"
            className="flex-1 rounded-[8px] border border-border bg-elev2 px-3.5 py-2 text-[14px] text-ink outline-none focus:border-done"
          />
          <button
            type="submit"
            className="rounded-[8px] border border-done px-4 py-2 font-mono text-[13px] text-done transition active:translate-y-[1px] active:scale-[0.98]"
          >
            Add list
          </button>
        </form>

        <div className="space-y-8">
          {lists.map((list) => (
            <ListPanel
              key={list.id}
              list={list}
              tasks={tasks.filter((t) => t.list_id === list.id)}
              today={today}
              todayKey={todayKey}
              onAddTask={(text, due) => addTask(list.id, text, due)}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onDeleteList={() => deleteList(list.id)}
            />
          ))}
          {lists.length === 0 && (
            <div className="py-2 font-mono text-[13px] text-inkfaint">
              No lists yet, add one above (Fitness, Work, Study...).
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ListPanel({
  list,
  tasks,
  today,
  todayKey,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onDeleteList,
}: {
  list: ListRow;
  tasks: Task[];
  today: Date;
  todayKey: string;
  onAddTask: (text: string, due: string) => void;
  onToggleTask: (id: string, done: boolean) => void;
  onDeleteTask: (id: string) => void;
  onDeleteList: () => void;
}) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAddTask(t, due);
    setText("");
    setDue("");
  }

  const goals = tasks.filter((t) => t.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const logTasks = tasks.filter((t) => !t.due_date);
  const dayKeys = Array.from(new Set(logTasks.map((t) => t.log_date))).sort().reverse();

  return (
    <div className="rounded-[10px] border border-border bg-elev p-[18px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-[17px] font-semibold text-ink">{list.name}</div>
        <button
          onClick={onDeleteList}
          className="font-mono text-[12px] text-inkfaint transition hover:text-danger"
        >
          remove list
        </button>
      </div>

      <form onSubmit={submit} className="mb-5 flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Log something for ${list.name}`}
          className="min-w-[160px] flex-1 rounded-[8px] border border-border bg-elev2 px-3.5 py-2 text-[14px] text-ink outline-none focus:border-done"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          title="Optional due date, leave blank to log it as done today, set a date to make it a goal"
          className="rounded-[8px] border border-border bg-elev2 px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-done"
        />
        <button
          type="submit"
          className="rounded-[8px] border border-done px-4 py-2 font-mono text-[13px] text-done transition active:translate-y-[1px] active:scale-[0.98]"
        >
          {due ? "Set goal" : "Log it"}
        </button>
      </form>

      {goals.length > 0 && (
        <div className="mb-5 space-y-1.5">
          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-inkfaint">Goals</div>
          {goals.map((t) => {
            const diff = daysUntil(t.due_date!, today);
            const overdue = diff < 0 && !t.done;
            return (
              <div key={t.id} className="flex items-center gap-2.5 rounded-[8px] border border-border bg-elev2 px-3 py-2">
                <button
                  onClick={() => onToggleTask(t.id, !t.done)}
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition active:scale-90 ${
                    t.done ? "border-done bg-done" : "border-inkfaint"
                  }`}
                >
                  <Check done={t.done} />
                </button>
                <div className={`flex-1 text-[14px] ${t.done ? "text-inkdim line-through" : "text-ink"}`}>{t.text}</div>
                <div className={`font-mono text-[10px] uppercase ${overdue ? "text-danger" : "text-inkfaint"}`}>
                  {dueLabel(diff)}
                </div>
                <button onClick={() => onDeleteTask(t.id)} className="font-mono text-[11px] text-inkfaint transition hover:text-danger">
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {dayKeys.map((key) => {
          const d = new Date(`${key}T00:00:00`);
          const isToday = key === todayKey;
          return (
            <div key={key}>
              <div className={`mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] ${isToday ? "text-done" : "text-inkfaint"}`}>
                {isToday ? "Today, " : ""}
                {fmt(d)}
              </div>
              {logTasks
                .filter((t) => t.log_date === key)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 border-b border-border py-1.5 text-[14px] last:border-none">
                    <button
                      onClick={() => onToggleTask(t.id, !t.done)}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition active:scale-90 ${
                        t.done ? "border-done bg-done" : "border-inkfaint"
                      }`}
                    >
                      <Check done={t.done} />
                    </button>
                    <div className={`flex-1 ${t.done ? "text-inkdim line-through" : "text-ink"}`}>{t.text}</div>
                    <button onClick={() => onDeleteTask(t.id)} className="font-mono text-[11px] text-inkfaint transition hover:text-danger">
                      x
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
        {dayKeys.length === 0 && goals.length === 0 && (
          <div className="py-2 font-mono text-[13px] text-inkfaint">Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}
