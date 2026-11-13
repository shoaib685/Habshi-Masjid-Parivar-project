import { APP_TIMEZONE } from "./date";

export type ReminderTimeParts = {
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

export function reminderTimeFromParts(parts: ReminderTimeParts): string {
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
    throw new Error("Choose an hour from 1 to 12.");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Choose a minute from 00 to 59.");
  }
  if (parts.period !== "AM" && parts.period !== "PM") {
    throw new Error("Choose AM or PM.");
  }
  const hour24 = (hour % 12) + (parts.period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function reminderTimeToParts(time: string): ReminderTimeParts {
  const match = time.match(/^(?:([01]\d|2[0-3])):([0-5]\d)$/);
  if (!match) throw new Error("Reminder time must be a valid 24-hour time.");
  const hour24 = Number(match[1]);
  return {
    hour: String(hour24 % 12 || 12),
    minute: match[2]!,
    period: hour24 < 12 ? "AM" : "PM",
  };
}

export function formatReminderTime(time: string): string {
  const parts = reminderTimeToParts(time);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

export function zonedClock(now: Date, timeZone = APP_TIMEZONE): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${fields["year"]}-${fields["month"]}-${fields["day"]}`,
    time: `${fields["hour"]}:${fields["minute"]}`,
  };
}

export function reminderIsDue(now: Date, reminderTime: string): boolean {
  return zonedClock(now).time >= reminderTime;
}
