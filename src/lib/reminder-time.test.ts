import { describe, expect, it } from "vitest";

import {
  formatReminderTime,
  reminderIsDue,
  reminderTimeFromParts,
  reminderTimeToParts,
  zonedClock,
} from "./reminder-time";

describe("IST reminder times", () => {
  it.each([
    ["8", "00", "AM", "08:00"],
    ["10", "30", "AM", "10:30"],
    ["12", "00", "PM", "12:00"],
    ["4", "45", "PM", "16:45"],
    ["8", "00", "PM", "20:00"],
    ["11", "30", "PM", "23:30"],
    ["12", "00", "AM", "00:00"],
  ] as const)("converts %s:%s %s to 24-hour time", (hour, minute, period, expected) => {
    expect(reminderTimeFromParts({ hour, minute, period })).toBe(expected);
    expect(formatReminderTime(expected)).toBe(`${Number(hour)}:${minute} ${period}`);
  });

  it("rejects out-of-range hours and minutes", () => {
    expect(() => reminderTimeFromParts({ hour: "13", minute: "00", period: "PM" })).toThrow();
    expect(() => reminderTimeFromParts({ hour: "1", minute: "60", period: "AM" })).toThrow();
  });

  it("compares wall-clock time in Asia/Kolkata, independently of server timezone", () => {
    const now = new Date("2026-11-13T13:00:00.000Z");
    expect(zonedClock(now)).toEqual({ date: "2026-11-13", time: "18:30" });
    expect(reminderIsDue(now, "18:30")).toBe(true);
    expect(reminderIsDue(now, "18:31")).toBe(false);
  });
});
