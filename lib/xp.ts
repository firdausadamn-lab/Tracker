// ---------------------------------------------------------------------------
// XP, levels, and achievements.
//
// XP MODEL
//   You earn XP once per fully-completed day (every active habit done). The
//   value scales with how deep you are into the current streak, so day 20 of a
//   run is worth more than day 1 — but the bonus is capped so very long streaks
//   don't run away.
//
//     dayXp(streakDay) = BASE_XP + min(streakDay, STREAK_CAP) * STREAK_BONUS
//
//   With the defaults below: day 1 = 12 XP, day 30 = 70 XP, and every day past
//   30 also yields 70. Tune BASE_XP / STREAK_BONUS / STREAK_CAP to taste.
//
// LEVEL CURVE
//   XP required to *reach* level L is a gentle quadratic (classic RPG feel):
//
//     cumulativeXp(L) = LEVEL_K * L * (L - 1)
//
//   With LEVEL_K = 50: level 2 costs 100 total, level 3 costs 300 total,
//   level 4 costs 600, ... The gap between consecutive levels is 100 * (L-1),
//   so each level takes a bit more grind than the last.
// ---------------------------------------------------------------------------

export const BASE_XP = 10;
export const STREAK_BONUS = 2;
export const STREAK_CAP = 30;
export const LEVEL_K = 50;

export function dayXp(streakDay: number): number {
  return BASE_XP + Math.min(streakDay, STREAK_CAP) * STREAK_BONUS;
}

// Total lifetime XP + count of perfect days, from the chronologically-sorted
// list of fully-done day keys. Consecutive days accumulate a bigger per-day
// bonus; a gap resets the streak-day counter to 1.
export function computeXpAndDays(sortedFullyDoneKeys: string[]): {
  totalXp: number;
  totalFullDays: number;
} {
  let totalXp = 0;
  let runPos = 0;
  let prev: number | null = null;
  for (const key of sortedFullyDoneKeys) {
    const t = new Date(`${key}T00:00:00`).getTime();
    if (prev !== null && Math.round((t - prev) / 86400000) === 1) {
      runPos += 1;
    } else {
      runPos = 1;
    }
    totalXp += dayXp(runPos);
    prev = t;
  }
  return { totalXp, totalFullDays: sortedFullyDoneKeys.length };
}

export function cumulativeXp(level: number): number {
  return LEVEL_K * level * (level - 1);
}

export type LevelInfo = {
  level: number;
  xpInto: number; // XP earned inside the current level
  xpNeed: number; // XP required to clear the current level
  progress: number; // 0..1 toward next level
};

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  while (cumulativeXp(level + 1) <= totalXp) level += 1;
  const floor = cumulativeXp(level);
  const need = cumulativeXp(level + 1) - floor;
  const into = totalXp - floor;
  return { level, xpInto: into, xpNeed: need, progress: need === 0 ? 0 : into / need };
}

// ---------------------------------------------------------------------------
// Achievements. Streak badges test against the *longest* streak so they never
// re-lock once earned; day/XP badges are monotonic by nature. Keys, names,
// and copy mirror the seed rows in schema.sql.
// ---------------------------------------------------------------------------

export type Stats = {
  current: number;
  best: number;
  totalXp: number;
  totalFullDays: number;
};

export type Achievement = {
  key: string;
  name: string;
  description: string;
  icon: string;
  test: (s: Stats) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { key: "streak_3", name: "First Blood", description: "Keep every habit three days straight.", icon: "III", test: (s) => s.best >= 3 },
  { key: "streak_7", name: "Warming Up", description: "A full seven-day streak.", icon: "VII", test: (s) => s.best >= 7 },
  { key: "streak_14", name: "Fortnight", description: "Fourteen days without a miss.", icon: "XIV", test: (s) => s.best >= 14 },
  { key: "streak_30", name: "Iron Month", description: "Thirty-day streak. Forged.", icon: "XXX", test: (s) => s.best >= 30 },
  { key: "streak_60", name: "Unbroken", description: "Sixty days, no gaps.", icon: "LX", test: (s) => s.best >= 60 },
  { key: "streak_100", name: "Centurion", description: "One hundred days in a row.", icon: "C", test: (s) => s.best >= 100 },
  { key: "days_25", name: "Grinder", description: "Twenty-five perfect days logged.", icon: "25", test: (s) => s.totalFullDays >= 25 },
  { key: "days_100", name: "Deep Grind", description: "One hundred perfect days logged.", icon: "100", test: (s) => s.totalFullDays >= 100 },
  { key: "xp_1000", name: "Apprentice", description: "Bank one thousand XP.", icon: "1K", test: (s) => s.totalXp >= 1000 },
  { key: "xp_2500", name: "Adept", description: "Bank twenty-five hundred XP.", icon: "2K", test: (s) => s.totalXp >= 2500 },
  { key: "xp_5000", name: "Master", description: "Bank five thousand XP.", icon: "5K", test: (s) => s.totalXp >= 5000 },
  { key: "xp_10000", name: "Ascendant", description: "Bank ten thousand XP.", icon: "10K", test: (s) => s.totalXp >= 10000 },
];

export function unlockedKeys(stats: Stats): Set<string> {
  const s = new Set<string>();
  for (const a of ACHIEVEMENTS) if (a.test(stats)) s.add(a.key);
  return s;
}
