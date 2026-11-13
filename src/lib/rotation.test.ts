import { describe, expect, it } from "vitest";

import { contributionStatus, summarizeMonth, type Payment } from "./contributions";
import { getDutyForDate, type Family, type RotationConfig } from "./rotation";

const fam = (id: string, order: number, active = true, monthlyFee = 500): Family => ({
  id,
  name: id,
  head: id,
  members: 4,
  mohalla: "",
  active,
  order,
  monthlyFee,
});

const families = [fam("A", 1), fam("B", 2), fam("C", 3, false), fam("D", 4)];
const base: RotationConfig = { families, anchorDate: "2026-11-01", overrides: [] };
const TODAY = "2026-11-03";

const who = (date: string, config = base) => getDutyForDate(date, config, TODAY).family?.id;

describe("food duty rotation", () => {
  it("rotates sequentially through active families in order", () => {
    expect(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) => who(d))).toEqual([
      "A",
      "B",
      "D",
      "A",
    ]);
  });

  it("never assigns an inactive family", () => {
    for (let i = 1; i <= 20; i++) {
      expect(who(`2026-11-${String(i).padStart(2, "0")}`)).not.toBe("C");
    }
  });

  it("a reassignment changes only that day", () => {
    const config = { ...base, overrides: [{ date: "2026-11-02", kind: "reassign" as const, familyId: "D" }] };
    expect(who("2026-11-02", config)).toBe("D");
    expect(getDutyForDate("2026-11-02", config, TODAY).status).toBe("overridden");
    expect(who("2026-11-03", config)).toBe("D");
  });

  it("a skipped day has no duty and the scheduled family serves the next day", () => {
    const config = { ...base, overrides: [{ date: "2026-11-02", kind: "skip" as const }] };
    expect(getDutyForDate("2026-11-02", config, TODAY).status).toBe("skipped");
    expect(who("2026-11-02", config)).toBeUndefined();
    expect(who("2026-11-03", config)).toBe("B");
  });

  it("marks past days completed and today pending", () => {
    expect(getDutyForDate("2026-11-02", base, TODAY).status).toBe("completed");
    expect(getDutyForDate("2026-11-03", base, TODAY).status).toBe("pending");
  });
});

describe("monthly contributions", () => {
  it("classifies paid, partial and pending", () => {
    expect(contributionStatus(500, 500)).toBe("paid");
    expect(contributionStatus(500, 200)).toBe("partial");
    expect(contributionStatus(500, 0)).toBe("pending");
  });

  it("totals expected, collected and outstanding for active families only", () => {
    const payments: Payment[] = [
      { id: "1", familyId: "A", month: "2026-11", amount: 500, method: "cash", paidOn: "2026-11-02" },
      { id: "2", familyId: "B", month: "2026-11", amount: 200, method: "upi", paidOn: "2026-11-03" },
    ];
    const s = summarizeMonth("2026-11", families, payments);
    expect(s.expected).toBe(1500);
    expect(s.collected).toBe(700);
    expect(s.outstanding).toBe(800);
    expect([s.paid, s.partial, s.pending]).toEqual([1, 1, 1]);
  });
});
