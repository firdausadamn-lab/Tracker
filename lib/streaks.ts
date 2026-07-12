export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function lastNDays(n: number, end: Date = startOfToday()): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

export function computeStreaks(doneDates: Set<string>, today: Date = startOfToday()) {
  let current = 0;
  const cursor = new Date(today);
  if (!doneDates.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (doneDates.has(toKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const keys = Array.from(doneDates).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const d = new Date(`${k}T00:00:00`);
    if (prev) {
      const diffDays = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = d;
  }

  return { current, best };
}

// Signed day difference between a due date and today. Negative = overdue,
// 0 = due today, positive = days remaining.
export function daysUntil(dateKey: string, today: Date = startOfToday()): number {
  const d = new Date(`${dateKey}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function dueLabel(diff: number): string {
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  return `due in ${diff}d`;
}

// ---------------------------------------------------------------------------
// Contribution grid
// ---------------------------------------------------------------------------

export type HabitMeta = {
  id: string;
  created_at: string; // ISO timestamp; only the date portion matters here
};

export type DayCell = {
  date: string; // YYYY-MM-DD
  habitsDone: number;
  habitsTotal: number; // habits that existed on/before this day
  isFullyDone: boolean;
};

// The date a habit started counting toward the grid (its creation day).
function habitStartKey(h: HabitMeta): string {
  return h.created_at.slice(0, 10);
}

// Build one cell per day. A habit only counts toward a day's total once it
// exists (created_at <= day), so adding a new habit today never retroactively
// un-greens past days. A day is fully done only when every habit that existed
// that day was completed, and at least one habit existed.
export function buildContribution(
  days: Date[],
  habits: HabitMeta[],
  doneByDay: Map<string, Set<string>>
): DayCell[] {
  return days.map((d) => {
    const key = toKey(d);
    let total = 0;
    for (const h of habits) {
      if (habitStartKey(h) <= key) total++;
    }

    const doneIds = doneByDay.get(key);
    let done = 0;
    if (doneIds) {
      for (const h of habits) {
        if (habitStartKey(h) <= key && doneIds.has(h.id)) done++;
      }
    }

    return {
      date: key,
      habitsDone: done,
      habitsTotal: total,
      isFullyDone: total > 0 && done >= total,
    };
  });
}

// Intensity for the square: 0 = empty, 1 = partial, 2 = fully done.
export function cellLevel(cell: DayCell): 0 | 1 | 2 {
  if (cell.habitsTotal === 0 || cell.habitsDone === 0) return 0;
  if (cell.isFullyDone) return 2;
  return 1;
}

export function fullyDoneKeys(cells: DayCell[]): Set<string> {
  const s = new Set<string>();
  for (const c of cells) if (c.isFullyDone) s.add(c.date);
  return s;
}
