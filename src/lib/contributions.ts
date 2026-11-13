import type { Family } from "./rotation";

export type PaymentMethod = "cash" | "upi";

export type Payment = {
  id: string;
  familyId: string;
  /** Month the payment counts towards, YYYY-MM. */
  month: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
};

export type ContributionStatus = "paid" | "partial" | "pending";

export function contributionStatus(fee: number, collected: number): ContributionStatus {
  if (collected >= fee) return "paid";
  if (collected > 0) return "partial";
  return "pending";
}

export type MonthSummary = {
  month: string;
  expected: number;
  collected: number;
  outstanding: number;
  paid: number;
  partial: number;
  pending: number;
  cash: number;
  upi: number;
};

export type CommunityContribution = {
  month: string;
  amount: number;
  method: PaymentMethod;
};

export type CommunityContributionSummary = {
  month: string;
  collected: number;
  entries: number;
  cash: number;
  upi: number;
};

/** Voluntary contributions are independent of mandatory family payment balances. */
export function summarizeContributions(
  month: string,
  contributions: CommunityContribution[],
): CommunityContributionSummary {
  return contributions
    .filter((entry) => entry.month === month)
    .reduce<CommunityContributionSummary>(
      (summary, entry) => {
        summary.collected += entry.amount;
        summary.entries += 1;
        summary[entry.method] += entry.amount;
        return summary;
      },
      { month, collected: 0, entries: 0, cash: 0, upi: 0 },
    );
}

/** Public, aggregate-only view of one month. Only active families are expected to pay. */
export function summarizeMonth(
  month: string,
  families: Family[],
  payments: Payment[],
): MonthSummary {
  const summary: MonthSummary = {
    month,
    expected: 0,
    collected: 0,
    outstanding: 0,
    paid: 0,
    partial: 0,
    pending: 0,
    cash: 0,
    upi: 0,
  };

  for (const family of families.filter((f) => f.active)) {
    const familyPayments = payments.filter((p) => p.familyId === family.id && p.month === month);
    const collected = familyPayments.reduce((sum, p) => sum + p.amount, 0);
    summary.expected += family.monthlyFee;
    summary.collected += collected;
    summary.outstanding += Math.max(0, family.monthlyFee - collected);
    summary[contributionStatus(family.monthlyFee, collected)] += 1;
    for (const p of familyPayments) summary[p.method] += p.amount;
  }

  return summary;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
