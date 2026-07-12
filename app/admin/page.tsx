import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase";
import { lastNDays, startOfToday, toKey } from "@/lib/streaks";
import LoginForm from "./LoginForm";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 63;

export default async function AdminPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return <LoginForm />;
  }

  const sb = supabaseServer();
  const today = startOfToday();
  const todayKey = toKey(today);
  const rangeStartKey = toKey(lastNDays(DAYS_SHOWN, today)[0]);

  const [{ data: habits }, { data: logs }, { data: lists }, { data: tasks }] = await Promise.all([
    sb.from("habits").select("id, name").order("sort_order", { ascending: true }),
    sb
      .from("habit_logs")
      .select("habit_id, log_date")
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

  const doneByHabit = new Map<string, string[]>();
  for (const row of logs ?? []) {
    const list = doneByHabit.get(row.habit_id) ?? [];
    list.push(row.log_date);
    doneByHabit.set(row.habit_id, list);
  }

  const initialHabits = (habits ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    doneDates: doneByHabit.get(h.id) ?? [],
  }));

  const allTasks = tasks ?? [];
  const recentDayKeys = new Set(
    Array.from(new Set(allTasks.filter((t) => !t.due_date).map((t) => t.log_date)))
      .sort()
      .reverse()
      .slice(0, 14)
      .concat(todayKey)
  );
  const initialTasks = allTasks.filter((t) => t.due_date || recentDayKeys.has(t.log_date));

  return (
    <AdminDashboard
      initialHabits={initialHabits}
      initialLists={lists ?? []}
      initialTasks={initialTasks}
      todayKey={todayKey}
    />
  );
}
