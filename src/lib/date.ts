// All community dates are calendar days in India Standard Time.
export const APP_TIMEZONE = "Asia/Kolkata";

/** Today's calendar date in IST as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parts(iso: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return [y, m, d];
}

function toUtc(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...options }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function formatMonth(monthKey: string, style: "long" | "short" = "long"): string {
  return formatDate(`${monthKey}-01`, { month: style, year: "numeric" });
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = parts(`${monthKey}-01`);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function relativeDayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDate(iso, { weekday: "long" });
}
