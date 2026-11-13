import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, Pin, UtensilsCrossed } from "lucide-react";

import { DutyList, SeeAllLink, TodayDutyHero } from "@/components/app/DutyCards";
import { Pill, SectionTitle } from "@/components/app/ui";
import { formatINR } from "@/lib/contributions";
import { formatMonth } from "@/lib/date";
import { getPublicHomeData } from "@/lib/admin-api";

export const Route = createFileRoute("/")({
  loader: () => getPublicHomeData(),
  head: () => ({
    meta: [
      { title: "Habshi Masjid Parivar — Today's food duty & community updates" },
      {
        name: "description",
        content:
          "See which family has food duty today, the upcoming rotation, monthly contribution totals and masjid announcements.",
      },
      { property: "og:title", content: "Habshi Masjid Parivar" },
      {
        property: "og:description",
        content:
          "Today's food duty, upcoming schedule and community updates for Habshi Masjid, Jalore.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const {
    today,
    duty,
    schedule: upcoming,
    food,
    month,
    summary,
    announcement: latest,
  } = Route.useLoaderData();

  return (
    <div className="lg:grid lg:grid-cols-[1.25fr_1fr] lg:gap-8">
      <div>
        <div className="animate-rise mb-5">
          <p className="font-arabic text-2xl leading-relaxed text-primary" dir="rtl" lang="ar">
            بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </p>
          <div className="mt-1">
            <h1
              className="text-[1.75rem] font-semibold text-foreground lg:text-4xl"
              suppressHydrationWarning
            >
              {greeting()}
            </h1>
          </div>
        </div>

        <TodayDutyHero duty={duty} showDate={false} showReminder={false} />

        <SectionTitle>Today's food</SectionTitle>
        <section className="surface-card p-5" aria-live="polite">
          {food.length ? (
            <ul className="space-y-4">
              {food.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
                    <UtensilsCrossed className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground">{item.title}</h2>
                    {item.description && (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                <UtensilsCrossed className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Menu not announced yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Today's food information will appear here when it is available.
                </p>
              </div>
            </div>
          )}
        </section>

        <SectionTitle action={<SeeAllLink to="/schedule" />}>Coming up</SectionTitle>
        <DutyList days={upcoming} today={today} />
      </div>

      <div>
        <SectionTitle action={<SeeAllLink to="/contributions" label="Details" />}>
          {formatMonth(month, "long")} contributions
        </SectionTitle>
        <Link
          to="/contributions"
          className="surface-card block p-5 transition-transform active:scale-[0.99]"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Collected so far</p>
              <p className="font-display text-3xl font-semibold text-foreground">
                {formatINR(summary.collected)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Records" value={summary.entries} tone="text-primary" />
            <Stat label="Cash" value={formatINR(summary.cash)} tone="text-foreground" />
            <Stat label="UPI" value={formatINR(summary.upi)} tone="text-foreground" />
          </div>
        </Link>

        {latest && (
          <>
            <SectionTitle action={<SeeAllLink to="/announcements" />}>Latest notice</SectionTitle>
            <Link to="/announcements" className="surface-card block p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-gold-soft text-gold-foreground">
                  <Megaphone className="size-4" />
                </span>
                <Pill tone="gold">{latest.tag}</Pill>
                {latest.pinned && <Pin className="ml-auto size-4 text-muted-foreground" />}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{latest.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{latest.body}</p>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl bg-muted px-2 py-2.5">
      <p className={`font-display text-xl font-semibold ${tone}`}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
