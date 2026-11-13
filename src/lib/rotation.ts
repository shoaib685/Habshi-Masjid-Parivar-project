import { addDays, daysBetween } from "./date";

export type Family = {
  id: string;
  name: string;
  head: string;
  members: number;
  mohalla: string;
  active: boolean;
  /** Position in the food duty rotation (lower goes first). */
  order: number;
  /** Individual monthly contribution in rupees. */
  monthlyFee: number;
};

/**
 * reassign / swap: the day is given to another family; the rotation still moves on.
 * skip: no duty that day; the rotation pauses, so the scheduled family serves the next day.
 */
export type DutyOverride = {
  date: string;
  kind: "reassign" | "swap" | "skip";
  familyId?: string;
  note?: string;
};

export type DutyStatus = "completed" | "pending" | "overridden" | "skipped";

export type DutyDay = {
  date: string;
  family: Family | null;
  scheduledFamily: Family | null;
  status: DutyStatus;
  override?: DutyOverride | undefined;
};

export type PublicFamily = Pick<Family, "id" | "name" | "head" | "mohalla" | "active" | "order">;

export type PublicDutyDay = Omit<DutyDay, "family" | "scheduledFamily"> & {
  family: PublicFamily | null;
  scheduledFamily: PublicFamily | null;
};

export type RotationConfig = {
  families: Family[];
  /** First day of the rotation; the first active family serves this day. */
  anchorDate: string;
  overrides: DutyOverride[];
};

export function activeRotation(families: Family[]): Family[] {
  return families.filter((f) => f.active).sort((a, b) => a.order - b.order);
}

export function getDutyForDate(date: string, config: RotationConfig, today: string): DutyDay {
  const queue = activeRotation(config.families);
  const override = config.overrides.find((o) => o.date === date);
  const offset = daysBetween(config.anchorDate, date);

  if (queue.length === 0 || offset < 0) {
    return { date, family: null, scheduledFamily: null, status: "pending", override };
  }

  const skipsBefore = config.overrides.filter(
    (o) => o.kind === "skip" && o.date >= config.anchorDate && o.date < date,
  ).length;
  const scheduledFamily = queue[(offset - skipsBefore) % queue.length] ?? null;

  if (override?.kind === "skip") {
    return { date, family: null, scheduledFamily, status: "skipped", override };
  }

  if (override && override.familyId) {
    const replacement = config.families.find((f) => f.id === override.familyId) ?? null;
    return { date, family: replacement, scheduledFamily, status: "overridden", override };
  }

  return {
    date,
    family: scheduledFamily,
    scheduledFamily,
    status: date < today ? "completed" : "pending",
  };
}

export function getSchedule(
  from: string,
  days: number,
  config: RotationConfig,
  today: string,
): DutyDay[] {
  return Array.from({ length: days }, (_, i) => getDutyForDate(addDays(from, i), config, today));
}
