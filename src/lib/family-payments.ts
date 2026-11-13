import type { FamilyPayment, StoredFamily } from "./data-schemas";

export type FamilyPaymentSummary = {
  expected: number;
  collected: number;
  outstanding: number;
  paid: number;
  partial: number;
  pending: number;
};

export function summarizeFamilyPayments(
  month: string,
  families: Pick<StoredFamily, "id" | "monthlyFee">[],
  payments: Pick<FamilyPayment, "familyId" | "month" | "amountDue" | "amountReceived">[],
): FamilyPaymentSummary {
  const monthPayments = new Map(
    payments
      .filter((payment) => payment.month === month)
      .map((payment) => [payment.familyId, payment]),
  );
  const summary: FamilyPaymentSummary = {
    expected: 0,
    collected: 0,
    outstanding: 0,
    paid: 0,
    partial: 0,
    pending: 0,
  };

  for (const family of families) {
    const payment = monthPayments.get(family.id);
    const due = payment?.amountDue ?? family.monthlyFee;
    const received = payment?.amountReceived ?? 0;
    summary.expected += due;
    summary.collected += received;
    summary.outstanding += Math.max(0, due - received);
    if (received >= due) summary.paid += 1;
    else if (received > 0) summary.partial += 1;
    else summary.pending += 1;
  }

  return summary;
}
