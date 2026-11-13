import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DutyList } from "@/components/app/DutyCards";
import { PageHeader } from "@/components/app/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, formatDate } from "@/lib/date";
import { getPublicSchedule } from "@/lib/admin-api";
import type { PublicDutyDay } from "@/lib/rotation";

export const Route = createFileRoute("/schedule")({
  loader: () => getPublicSchedule(),
  head: () => ({
    meta: [
      { title: "Food Duty Schedule — Habshi Masjid Parivar" },
      {
        name: "description",
        content:
          "The upcoming daily food duty rotation for Habshi Masjid families, with swaps and changes marked.",
      },
      { property: "og:title", content: "Food Duty Schedule — Habshi Masjid Parivar" },
      {
        property: "og:description",
        content: "Upcoming daily food duty rotation for Habshi Masjid families.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

function groupByWeek(days: PublicDutyDay[]) {
  const groups: { label: string; days: PublicDutyDay[] }[] = [];
  for (const day of days) {
    // Weeks start on Monday.
    const weekday = (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addDays(day.date, -weekday);
    const label = `Week of ${formatDate(monday, { day: "numeric", month: "short" })}`;
    const last = groups.at(-1);
    if (last && last.label === label) last.days.push(day);
    else groups.push({ label, days: [day] });
  }
  return groups;
}

function SchedulePage() {
  const { today, schedule } = Route.useLoaderData();
  const [view, setView] = useState<"upcoming" | "history">("upcoming");
  const days =
    view === "upcoming"
      ? schedule.filter((day) => day.date >= today).slice(0, 28)
      : schedule
          .filter((day) => day.date < today)
          .slice(-28)
          .reverse();

  return (
    <>
      <PageHeader
        eyebrow="Rotation"
        title="Duty schedule"
        description="Next four weeks of food duty, in order."
      />

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-5">
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-full bg-muted p-1">
          <TabsTrigger
            value="upcoming"
            className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Upcoming
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            History
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        {groupByWeek(days).map((g) => (
          <section key={g.label}>
            <h2 className="mb-2 px-1 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {g.label}
            </h2>
            <DutyList days={g.days} today={today} />
          </section>
        ))}
      </div>
    </>
  );
}
