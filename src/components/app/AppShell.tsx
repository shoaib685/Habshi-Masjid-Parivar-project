import { Link, Outlet } from "@tanstack/react-router";
import { CalendarDays, HandCoins, Home, Megaphone, Settings, UtensilsCrossed } from "lucide-react";
import type { ComponentType } from "react";

import { MASJID } from "@/lib/site-config";

type NavItem = {
  to: "/" | "/duty" | "/schedule" | "/contributions" | "/announcements" | "/settings";
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { to: "/", label: "Home", short: "Home", icon: Home },
  { to: "/duty", label: "Today's Duty", short: "Today", icon: UtensilsCrossed },
  { to: "/schedule", label: "Schedule", short: "Schedule", icon: CalendarDays },
  { to: "/contributions", label: "Contributions", short: "Funds", icon: HandCoins },
  { to: "/announcements", label: "Announcements", short: "Notices", icon: Megaphone },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src="/icons/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-xl shadow-(--shadow-card)"
      />
      <div className="leading-tight">
        <p className="font-display text-[1.05rem] font-semibold text-foreground">{MASJID.name}</p>
        <p className="text-xs text-muted-foreground">{MASJID.city}</p>
      </div>
    </Link>
  );
}

export function AppShell() {
  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop / tablet-landscape side rail */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-border bg-sidebar px-5 py-6 lg:flex">
        <Brand />
        <nav className="mt-10 flex flex-col gap-1">
          {[
            ...NAV,
            { to: "/settings", label: "Settings", short: "Settings", icon: Settings } as NavItem,
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <item.icon className="size-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto overflow-hidden rounded-2xl border border-border bg-card p-4">
          <div className="pattern-strip -mx-4 -mt-4 mb-3 h-6" />
          <p className="font-arabic text-lg text-primary" dir="rtl" lang="ar">
            وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            "Help one another in righteousness and piety." — 5:2
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="top-bar pt-safe sticky top-0 z-30 border-b border-border/60 lg:hidden">
          <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
            <Brand />
            <Link
              to="/settings"
              aria-label="Settings"
              className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-accent data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <Settings className="size-5" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-5 lg:max-w-4xl lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Main"
          className="bottom-nav pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 lg:hidden"
        >
          <ul className="mx-auto grid max-w-2xl grid-cols-5 px-2 pt-1.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="group flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
                >
                  <span className="grid h-8 w-14 place-items-center rounded-full transition-all group-data-[status=active]:bg-primary-soft">
                    <item.icon className="size-5" />
                  </span>
                  {item.short}
                </Link>
              </li>
            ))}
          </ul>
          <div className="h-2" />
        </nav>
      </div>
    </div>
  );
}
