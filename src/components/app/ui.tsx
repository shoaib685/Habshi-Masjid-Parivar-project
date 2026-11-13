import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { DutyStatus } from "@/lib/rotation";
import type { ContributionStatus } from "@/lib/contributions";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-rise mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-[1.9rem] font-semibold leading-tight text-foreground lg:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function initials(name: string) {
  return name
    .replace(/^(Haji|Mohammed|Abdul)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const avatarVariants = cva("grid shrink-0 place-items-center rounded-2xl font-display font-semibold", {
  variants: {
    tone: {
      primary: "bg-primary-soft text-primary",
      gold: "gold-chip",
      muted: "bg-muted text-muted-foreground",
      onHero: "bg-primary-foreground/15 text-primary-foreground ring-1 ring-primary-foreground/25",
    },
    size: {
      sm: "size-10 text-sm",
      md: "size-12 text-base",
      lg: "size-16 text-xl",
    },
  },
  defaultVariants: { tone: "primary", size: "md" },
});

export function FamilyAvatar({
  name,
  className,
  ...variants
}: { name: string; className?: string } & VariantProps<typeof avatarVariants>) {
  return <div className={cn(avatarVariants(variants), className)}>{initials(name)}</div>;
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        pending: "bg-pending-soft text-pending",
        primary: "bg-primary-soft text-primary",
        muted: "bg-muted text-muted-foreground",
        gold: "gold-chip",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export function Pill({
  children,
  className,
  ...variants
}: { children: ReactNode; className?: string } & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants(variants), className)}>{children}</span>;
}

const DUTY_LABEL: Record<DutyStatus, { label: string; tone: VariantProps<typeof badgeVariants>["tone"] }> = {
  completed: { label: "Completed", tone: "success" },
  pending: { label: "Pending", tone: "primary" },
  overridden: { label: "Changed", tone: "gold" },
  skipped: { label: "No duty", tone: "muted" },
};

export function DutyStatusPill({ status }: { status: DutyStatus }) {
  const s = DUTY_LABEL[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const PAY_LABEL: Record<ContributionStatus, { label: string; tone: VariantProps<typeof badgeVariants>["tone"] }> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Partial", tone: "warning" },
  pending: { label: "Pending", tone: "pending" },
};

export function PaymentStatusPill({ status }: { status: ContributionStatus }) {
  const s = PAY_LABEL[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
