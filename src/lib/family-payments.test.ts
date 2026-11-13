import { describe, expect, it } from "vitest";

import { summarizeFamilyPayments } from "./family-payments";

describe("mandatory family payment summaries", () => {
  it("includes fees without payment records and excludes other months", () => {
    const summary = summarizeFamilyPayments(
      "2026-11",
      [
        { id: "HMP-001", monthlyFee: 500 },
        { id: "HMP-002", monthlyFee: 300 },
      ],
      [
        { familyId: "HMP-002", month: "2026-11", amountDue: 300, amountReceived: 100 },
        { familyId: "HMP-001", month: "2026-10", amountDue: 500, amountReceived: 500 },
      ],
    );

    expect(summary).toEqual({
      expected: 800,
      collected: 100,
      outstanding: 700,
      paid: 0,
      partial: 1,
      pending: 1,
    });
  });
});
