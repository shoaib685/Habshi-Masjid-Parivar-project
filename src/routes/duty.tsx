import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, CircleCheck, Clock } from "lucide-react";

import { DutyList, TodayDutyHero } from "@/components/app/DutyCards";
import { PageHeader, SectionTitle } from "@/components/app/ui";
import { getPublicDutyData } from "@/lib/admin-api";
import type { PublicDutyDay } from "@/lib/rotation";

export const Route = createFileRoute("/duty")({
  loader: () => getPublicDutyData(),
  head: () => ({
    meta: [
      { title: "Today's Food Duty — Habshi Masjid Parivar" },
      {
        name: "description",
        content:
          "Which family is serving food at Habshi Masjid today, plus yesterday, tomorrow and recent duty history.",
      },
      { property: "og:title", content: "Today's Food Duty — Habshi Masjid Parivar" },
      { property: "og:description", content: "Which family is serving food at the masjid today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DutyPage,
});

function DutyPage() {
  const { today, duty, yesterday, tomorrow, history } = Route.useLoaderData();

  return (
    <>
      <PageHeader
        eyebrow="Food duty"
        title="Today's duty"
        description="Families take turns in a fixed order. Inactive families are skipped automatically."
      />

      <TodayDutyHero duty={duty} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniCard label="Yesterday" duty={yesterday} />
        <MiniCard label="Tomorrow" duty={tomorrow} />
      </div>

      <div className="surface-card mt-4 grid grid-cols-3 divide-x divide-border p-4 text-center">
        <Fact
          icon={<CircleCheck className="size-4 text-success" />}
          value={duty.family ? "Active" : "No duty"}
          label="Today's status"
        />
        <Fact
          icon={<Clock className="size-4 text-primary" />}
          value="8:00 AM"
          label="Daily reminder"
        />
        <Fact
          icon={<ArrowLeftRight className="size-4 text-gold-foreground" />}
          value="Admin"
          label="Swaps & changes"
        />
      </div>

      <SectionTitle>Past 7 days</SectionTitle>
      <DutyList days={history} today={today} />
    </>
  );
}

function MiniCard({ label, duty }: { label: string; duty: PublicDutyDay }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 line-clamp-2 font-display text-base font-semibold leading-snug text-foreground">
        {duty.family ? duty.family.name : "No family duty"}
      </p>
      {duty.family && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{duty.family.head}</p>
      )}
    </div>
  );
}

function Fact({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="px-2">
      <div className="flex justify-center">{icon}</div>
      <p className="mt-1 font-display text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
