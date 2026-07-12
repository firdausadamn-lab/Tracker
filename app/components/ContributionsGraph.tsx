"use client";

import { useState } from "react";
import type { DayCell } from "@/lib/streaks";
import { cellLevel } from "@/lib/streaks";

type HabitLite = { id: string; name: string; created_at: string };

type Props = {
  cells: DayCell[]; // chronological, oldest -> newest, ending today
  habits: HabitLite[];
  doneByDay: Record<string, string[]>;
};

type Active = {
  cell: DayCell;
  done: string[];
  missed: string[];
  x: number;
  y: number;
};

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;

function weekdayOf(key: string): number {
  return new Date(`${key}T00:00:00`).getDay(); // 0 = Sunday
}

function monthShort(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
  });
}

function formatFull(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function levelClass(level: 0 | 1 | 2): string {
  if (level === 2) return "bg-done border-done";
  if (level === 1) return "bg-donedim border-donedim";
  return "bg-elev2 border-border";
}

export default function ContributionsGraph({ cells, habits, doneByDay }: Props) {
  const [active, setActive] = useState<Active | null>(null);

  // Pad the front so the first column starts on Sunday, then chunk into
  // week-columns of 7 (row 0 = Sunday ... row 6 = Saturday).
  const lead = cells.length > 0 ? weekdayOf(cells[0].date) : 0;
  const flat: (DayCell | null)[] = [...Array<null>(lead).fill(null), ...cells];
  while (flat.length % 7 !== 0) flat.push(null);

  const columns: (DayCell | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) columns.push(flat.slice(i, i + 7));

  // Month labels: mark the first column of each new month.
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = "";
  columns.forEach((col, ci) => {
    const first = col.find((c) => c !== null);
    if (!first) return;
    const m = monthShort(first.date);
    if (m !== lastMonth) {
      monthLabels.push({ col: ci, label: m });
      lastMonth = m;
    }
  });

  function show(e: React.MouseEvent<HTMLButtonElement>, cell: DayCell) {
    const rect = e.currentTarget.getBoundingClientRect();
    const existed = habits.filter((h) => h.created_at.slice(0, 10) <= cell.date);
    const doneIds = new Set(doneByDay[cell.date] ?? []);
    const done = existed.filter((h) => doneIds.has(h.id)).map((h) => h.name);
    const missed = existed.filter((h) => !doneIds.has(h.id)).map((h) => h.name);
    const clampedX = Math.min(
      Math.max(rect.left + rect.width / 2, 90),
      window.innerWidth - 90
    );
    setActive({ cell, done, missed, x: clampedX, y: rect.top });
  }

  const gridWidth = columns.length * STEP - GAP;

  return (
    <div className="relative">
      <div
        className="thin-scroll overflow-x-auto pb-2"
        onScroll={() => setActive(null)}
      >
        <div style={{ width: gridWidth }} className="min-w-full">
          {/* month labels */}
          <div
            className="relative mb-1 h-4 font-mono text-[10px] uppercase tracking-wider text-inkfaint"
            style={{ width: gridWidth }}
          >
            {monthLabels.map(({ col, label }) => (
              <span
                key={`${label}-${col}`}
                className="absolute top-0"
                style={{ left: col * STEP }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* week columns */}
          <div className="flex" style={{ gap: GAP }}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((cell, ri) => {
                  if (!cell) {
                    return (
                      <div
                        key={ri}
                        style={{ width: CELL, height: CELL }}
                        aria-hidden
                      />
                    );
                  }
                  const level = cellLevel(cell);
                  const label =
                    cell.habitsTotal === 0
                      ? `${cell.date}: no habits`
                      : `${cell.date}: ${cell.habitsDone} of ${cell.habitsTotal} habits`;
                  return (
                    <button
                      key={ri}
                      type="button"
                      aria-label={label}
                      onMouseEnter={(e) => show(e, cell)}
                      onMouseLeave={() => setActive(null)}
                      onClick={(e) => show(e, cell)}
                      style={{ width: CELL, height: CELL }}
                      className={`rounded-[3px] border ${levelClass(
                        level
                      )} transition-transform duration-150 ease-out hover:scale-125 focus-visible:scale-125`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-inkfaint">
        <span>less</span>
        <span className="h-3 w-3 rounded-[3px] border border-border bg-elev2" />
        <span className="h-3 w-3 rounded-[3px] border border-donedim bg-donedim" />
        <span className="h-3 w-3 rounded-[3px] border border-done bg-done" />
        <span>more</span>
        <span className="ml-auto normal-case tracking-normal text-inkfaint">
          green = every habit done
        </span>
      </div>

      {/* tooltip */}
      {active && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-borderlit bg-elev2 p-3 shadow-lg"
          style={{ left: active.x, top: active.y - 8 }}
        >
          <div className="font-mono text-[11px] uppercase tracking-wider text-brass">
            {formatFull(active.cell.date)}
          </div>
          {active.cell.habitsTotal === 0 ? (
            <div className="mt-1.5 text-xs text-inkdim">No habits tracked.</div>
          ) : (
            <>
              <div className="mt-1.5 text-xs text-inkdim">
                {active.cell.habitsDone} of {active.cell.habitsTotal} habits
                {active.cell.isFullyDone ? " — all done" : ""}
              </div>
              {active.done.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {active.done.map((n) => (
                    <li key={n} className="flex gap-1.5 text-xs text-ink">
                      <span className="text-done">✓</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
              {active.missed.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {active.missed.map((n) => (
                    <li key={n} className="flex gap-1.5 text-xs text-inkfaint">
                      <span>·</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
