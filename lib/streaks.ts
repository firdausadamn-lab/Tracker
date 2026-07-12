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
