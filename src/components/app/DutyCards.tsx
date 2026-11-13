import { Link } from "@tanstack/react-router";
import { BellRing, ChevronRight, MapPin } from "lucide-react";

import { formatDate, relativeDayLabel } from "@/lib/date";
import type { PublicDutyDay } from "@/lib/rotation";
import { MASJID } from "@/lib/site-config";
import { DutyStatusPill, FamilyAvatar } from "./ui";

export function TodayDutyHero({
  duty,
  showDate = true,
  showReminder = true,
}: {
  duty: PublicDutyDay;
  showDate?: boolean;
  showReminder?: boolean;
}) {
  return (
    <section className="surface-hero animate-rise p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Today's food duty
        </p>
        {showDate && (
          <p className="text-xs text-primary-foreground/75">
            {formatDate(duty.date, { weekday: "short", day: "numeric", month: "short" })}
          </p>
        )}
      </div>

      {duty.family ? (
        <>
          <div className="mt-5 flex items-center gap-4">
            <FamilyAvatar name={duty.family.head} tone="onHero" size="lg" />
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-[1.45rem] font-semibold leading-tight lg:text-3xl">
                {duty.family.name}
              </h2>
              <p className="mt-0.5 text-sm text-primary-foreground/80">{duty.family.head}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1.5">
              <MapPin className="size-3.5" /> {duty.family.mohalla}
            </span>
            {duty.status === "overridden" && (
              <span className="gold-chip inline-flex items-center rounded-full px-3 py-1.5 font-semibold">
                Changed by admin
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <h2 className="text-[1.6rem] font-semibold leading-tight">No family duty today</h2>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {duty.override?.note ?? "The rotation continues tomorrow."}
          </p>
        </div>
      )}

      {showReminder && (
        <div className="mt-6 flex items-center gap-2 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/75">
          <BellRing className="size-3.5 text-gold" />
          Reminder goes out every day at {MASJID.reminderTime}
        </div>
      )}
    </section>
  );
}

export function DutyRow({ duty, today }: { duty: PublicDutyDay; today: string }) {
  const isToday = duty.date === today;
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-12 shrink-0 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {formatDate(duty.date, { weekday: "short" })}
        </p>
        <p
          className={
            isToday
              ? "font-display text-xl font-semibold text-primary"
              : "font-display text-xl font-semibold text-foreground"
          }
        >
          {formatDate(duty.date, { day: "numeric" })}
        </p>
      </div>
      <div className="h-9 w-px bg-border" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {duty.family ? duty.family.name : "No family duty"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {duty.family
            ? duty.status === "overridden"
              ? `In place of ${duty.scheduledFamily?.name ?? "—"}`
              : `${relativeDayLabel(duty.date, today)} · ${duty.family.mohalla}`
            : (duty.override?.note ?? relativeDayLabel(duty.date, today))}
        </p>
      </div>
      <DutyStatusPill status={duty.status} />
    </li>
  );
}

export function DutyList({ days, today }: { days: PublicDutyDay[]; today: string }) {
  return (
    <ul className="surface-card divide-y divide-border overflow-hidden">
      {days.map((d) => (
        <DutyRow key={d.date} duty={d} today={today} />
      ))}
    </ul>
  );
}

export function SeeAllLink({
  to,
  label = "See all",
}: {
  to: "/schedule" | "/announcements" | "/contributions" | "/duty";
  label?: string;
}) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary">
      {label} <ChevronRight className="size-4" />
    </Link>
  );
}
