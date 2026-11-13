import { describe, expect, it } from "vitest";

import { familyPaymentSchema } from "./data-schemas";

const validPayment = {
  id: "00000000-0000-4000-8000-000000000001",
  familyId: "HMP-001",
  month: "2026-11",
  amountDue: 500,
  amountReceived: 300,
  history: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      at: "2026-11-13T10:00:00.000Z",
      amountDue: 500,
      amountReceived: 300,
      note: "",
    },
  ],
};

describe("family payment validation", () => {
  it("accepts valid due and received amounts", () => {
    expect(familyPaymentSchema.safeParse(validPayment).success).toBe(true);
  });

  it("accepts cash or UPI transaction history", () => {
    expect(
      familyPaymentSchema.safeParse({
        ...validPayment,
        amountReceived: 100,
        history: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            at: "2026-11-13T10:00:00.000Z",
            amount: 100,
            method: "upi",
            note: "",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects current and historical received amounts greater than due", () => {
    expect(
      familyPaymentSchema.safeParse({
        ...validPayment,
        amountReceived: 501,
      }).success,
    ).toBe(false);
    expect(
      familyPaymentSchema.safeParse({
        ...validPayment,
        history: [{ ...validPayment.history[0], amountReceived: 501 }],
      }).success,
    ).toBe(false);
  });
});
