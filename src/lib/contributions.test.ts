import { describe, expect, it } from "vitest";

import { summarizeContributions } from "./contributions";

describe("voluntary community contributions", () => {
  it("summarizes only the selected month without mandatory family dues", () => {
    const summary = summarizeContributions("2026-11", [
      { month: "2026-11", amount: 250, method: "cash" },
      { month: "2026-11", amount: 500, method: "upi" },
      { month: "2026-10", amount: 1000, method: "cash" },
    ]);

    expect(summary).toEqual({
      month: "2026-11",
      collected: 750,
      entries: 2,
      cash: 250,
      upi: 500,
    });
  });
});
