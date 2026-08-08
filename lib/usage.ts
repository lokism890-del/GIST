const STORAGE_KEY = "gist-usage";
const FREE_LIMIT = 5;

type UsageRecord = {
  month: string; // "2026-07" format
  count: number;
};

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function readUsage(): UsageRecord {
  if (typeof window === "undefined") return { month: currentMonthKey(), count: 0 };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { month: currentMonthKey(), count: 0 };

    const parsed = JSON.parse(raw) as UsageRecord;
    // Reset automatically when the calendar month has rolled over.
    if (parsed.month !== currentMonthKey()) {
      return { month: currentMonthKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { month: currentMonthKey(), count: 0 };
  }
}

function writeUsage(usage: UsageRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

/** How many free voice notes remain this month. */
export function getRemainingFreeUses(): number {
  const usage = readUsage();
  return Math.max(0, FREE_LIMIT - usage.count);
}

/** Whether the person has hit the free monthly limit. */
export function hasReachedFreeLimit(): boolean {
  return getRemainingFreeUses() <= 0;
}

/** Record one use (call this after a successful voice note is processed). */
export function recordUse(): void {
  const usage = readUsage();
  writeUsage({ month: usage.month, count: usage.count + 1 });
}

export const FREE_TIER_LIMIT = FREE_LIMIT;

/** Days remaining until the free tier resets (calendar month boundary). */
export function getDaysUntilReset(): number {
  const now = new Date();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.ceil((firstOfNextMonth.getTime() - now.getTime()) / msPerDay));
}
