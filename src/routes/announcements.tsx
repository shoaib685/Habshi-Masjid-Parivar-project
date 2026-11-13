import { createFileRoute } from "@tanstack/react-router";
import { CalendarHeart, Info, Pin, BellRing } from "lucide-react";

import { PageHeader, Pill } from "@/components/app/ui";
import { formatDate } from "@/lib/date";
import { getPublicAnnouncements } from "@/lib/admin-api";

export const Route = createFileRoute("/announcements")({
  loader: () => getPublicAnnouncements(),
  head: () => ({
    meta: [
      { title: "Announcements — Habshi Masjid Parivar" },
      {
        name: "description",
        content: "Notices, events and reminders from the Habshi Masjid committee in Jalore.",
      },
      { property: "og:title", content: "Announcements — Habshi Masjid Parivar" },
      {
        property: "og:description",
        content: "Notices, events and reminders from Habshi Masjid, Jalore.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnnouncementsPage,
});

const ICON: Record<"Event" | "Reminder" | "Notice", React.ReactNode> = {
  Event: <CalendarHeart className="size-4" />,
  Reminder: <BellRing className="size-4" />,
  Notice: <Info className="size-4" />,
};

function AnnouncementsPage() {
  const list = Route.useLoaderData();

  return (
    <>
      <PageHeader eyebrow="From the committee" title="Announcements" />
      <div className="space-y-3">
        {list.map((a, i) => (
          <article
            key={a.id}
            className={
              a.pinned
                ? "surface-card animate-rise border-gold/60 p-5"
                : "surface-card animate-rise p-5"
            }
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-gold-soft text-gold-foreground">
                {ICON[a.tag]}
              </span>
              <Pill tone={a.tag === "Event" ? "gold" : a.tag === "Reminder" ? "primary" : "muted"}>
                {a.tag}
              </Pill>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                {a.pinned && <Pin className="size-3.5" />}
                {formatDate(a.date, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{a.title}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{a.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}
