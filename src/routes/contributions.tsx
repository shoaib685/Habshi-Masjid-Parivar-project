import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Lock, Smartphone } from "lucide-react";
import { useState } from "react";

import { PageHeader, SectionTitle } from "@/components/app/ui";
import { formatINR } from "@/lib/contributions";
import { formatMonth } from "@/lib/date";
import { getPublicContributions } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contributions")({
  loader: () => getPublicContributions(),
  head: () => ({
    meta: [
      { title: "Contribution Summary — Habshi Masjid Parivar" },
      {
        name: "description",
        content: "Voluntary contribution totals for the Habshi Masjid community.",
      },
      { property: "og:title", content: "Contribution Summary — Habshi Masjid Parivar" },
      {
        property: "og:description",
        content: "Monthly contribution totals for the Habshi Masjid community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContributionsPage,
});

function ContributionsPage() {
  const summaries = Route.useLoaderData();
  const current = summaries.at(-1)?.month ?? "1970-01";
  const months = summaries.map((item) => item.month);
  const [selected, setSelected] = useState(current);
  const s = summaries.find((x) => x.month === selected) ?? summaries.at(-1)!;
  const maxCollected = Math.max(1, ...summaries.map((item) => item.collected));

  return (
    <>
      <PageHeader
        eyebrow="Community funds"
        title="Contributions"
        description="Monthly voluntary contributions for the whole community."
      />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
        {[...months].reverse().map((m) => (
          <button
            key={m}
            onClick={() => setSelected(m)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              m === selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {formatMonth(m, "short")}
          </button>
        ))}
      </div>

      <section className="surface-hero p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          {formatMonth(s.month)}
        </p>
        <p className="mt-3 text-sm text-primary-foreground/80">Total collected</p>
        <p className="font-display text-4xl font-semibold">{formatINR(s.collected)}</p>
        <p className="mt-2 text-xs text-primary-foreground/75">
          {s.entries} manually recorded contribution{s.entries === 1 ? "" : "s"}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Total label="Contribution entries" value={s.entries} currency={false} />
        <Total label="Average entry" value={s.entries ? Math.round(s.collected / s.entries) : 0} />
      </div>

      <SectionTitle>Manual collection methods</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Method icon={<Smartphone className="size-4" />} label="UPI" value={s.upi} />
        <Method icon={<Banknote className="size-4" />} label="Cash" value={s.cash} />
      </div>

      <SectionTitle>Last 6 months</SectionTitle>
      <div className="surface-card p-5">
        <div className="flex h-40 items-end justify-between gap-3">
          {summaries.map((m) => {
            const h = (m.collected / maxCollected) * 100;
            return (
              <button
                key={m.month}
                onClick={() => setSelected(m.month)}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="relative w-full max-w-10 flex-1 overflow-hidden rounded-lg bg-muted">
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-lg transition-all",
                      m.month === selected ? "bg-primary" : "bg-primary/35",
                    )}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    m.month === selected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {formatMonth(m.month, "short").split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm text-accent-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <p>Individual family payments are private. Only the admin can see who paid how much.</p>
      </div>
    </>
  );
}

function Total({
  label,
  value,
  tone = "text-foreground",
  currency = true,
}: {
  label: string;
  value: number;
  tone?: string;
  currency?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold", tone)}>
        {currency ? formatINR(value) : value}
      </p>
    </div>
  );
}

function Method({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold text-foreground">{formatINR(value)}</p>
      </div>
    </div>
  );
}
