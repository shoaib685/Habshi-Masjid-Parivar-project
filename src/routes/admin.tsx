import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  HandCoins,
  LogOut,
  Megaphone,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DutyList } from "@/components/app/DutyCards";
import { FamilyAvatar, PageHeader, Pill, SectionTitle } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, contributionStatus } from "@/lib/contributions";
import { formatDate, formatMonth, shiftMonth } from "@/lib/date";
import { summarizeFamilyPayments } from "@/lib/family-payments";
import {
  formatReminderTime,
  reminderTimeFromParts,
  reminderTimeToParts,
  type ReminderTimeParts,
} from "@/lib/reminder-time";
import {
  checkAdminSession,
  createAnnouncement,
  createFamily,
  createFoodEntry,
  exportAdminData,
  getAdminSnapshot,
  issueFamilyPushCode,
  logoutAdmin,
  recordContribution,
  removeAnnouncement,
  removeFoodEntry,
  saveFamilyPayment,
  setDuty,
  updateAnnouncement,
  updateAppSettings,
  updateFamily,
  updateFoodEntry,
} from "@/lib/admin-api";
import type {
  StoredAnnouncement,
  StoredFamily,
  StoredContribution,
  FoodEntry,
} from "@/lib/data-schemas";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Habshi Masjid Parivar" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const TABS = [
  "Overview",
  "Families",
  "Food",
  "Duties",
  "Payments",
  "Contributions",
  "Announcements",
  "Notifications",
  "Settings",
] as const;
type AdminTab = (typeof TABS)[number];
type AdminSnapshot = Awaited<ReturnType<typeof getAdminSnapshot>>;
type FamilyDraft = Omit<StoredFamily, "id">;
type RunAction = (action: () => Promise<unknown>, success: string) => Promise<boolean>;

function AdminDashboard() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [tab, setTab] = useState<AdminTab>("Overview");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const data = await getAdminSnapshot();
    setSnapshot(data);
  }, []);

  useEffect(() => {
    let active = true;
    const open = async () => {
      try {
        const session = await checkAdminSession();
        if (!active) return;
        if (!session.authenticated) {
          await navigate({ to: "/admin/login", replace: true });
          return;
        }
        await refresh();
      } catch {
        if (active) await navigate({ to: "/admin/login", replace: true });
      } finally {
        if (active) setLoading(false);
      }
    };
    void open();
    return () => {
      active = false;
    };
  }, [navigate, refresh]);

  const run: RunAction = async (action, success) => {
    try {
      await action();
      await refresh();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error("Could not save changes", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return false;
    }
  };

  const signOut = async () => {
    try {
      await logoutAdmin();
      await navigate({ to: "/settings" });
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  if (loading || !snapshot) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Opening secure admin dashboard…
      </p>
    );
  }

  const activeFamilies = snapshot.families.filter((family) => family.active);
  const todayDuty = snapshot.schedule.find((duty) => duty.date === snapshot.today);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Admin dashboard"
        description={formatDate(snapshot.today, { weekday: "long", day: "numeric", month: "long" })}
        action={
          <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        }
      />

      <div
        className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        role="tablist"
        aria-label="Admin sections"
      >
        {TABS.map((item) => (
          <button
            key={item}
            id={`admin-tab-${item.toLowerCase()}`}
            role="tab"
            aria-selected={tab === item}
            aria-controls="admin-tab-panel"
            onClick={() => setTab(item)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div id="admin-tab-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab.toLowerCase()}`}>
        {tab === "Overview" && (
          <Overview
            snapshot={snapshot}
            activeFamilies={activeFamilies}
            todayFamily={todayDuty?.family?.name ?? "No family duty"}
            setTab={setTab}
          />
        )}
        {tab === "Families" && (
          <FamiliesPanel
            families={snapshot.families}
            search={search}
            setSearch={setSearch}
            run={run}
          />
        )}
        {tab === "Food" && <FoodPanel foods={snapshot.foods} run={run} />}
        {tab === "Duties" && (
          <DutiesPanel
            families={activeFamilies}
            schedule={snapshot.schedule}
            today={snapshot.today}
            run={run}
          />
        )}
        {tab === "Payments" && (
          <PaymentsPanel
            families={snapshot.families}
            payments={snapshot.payments}
            month={snapshot.month}
            run={run}
          />
        )}
        {tab === "Contributions" && (
          <ContributionsPanel
            families={snapshot.families}
            contributions={snapshot.contributions}
            month={snapshot.month}
            today={snapshot.today}
            run={run}
          />
        )}
        {tab === "Announcements" && (
          <AnnouncementsPanel
            announcements={snapshot.announcements}
            today={snapshot.today}
            run={run}
          />
        )}
        {tab === "Notifications" && (
          <NotificationsPanel notifications={snapshot.notifications} families={snapshot.families} />
        )}
        {tab === "Settings" && <SettingsPanel snapshot={snapshot} run={run} />}
      </div>
    </>
  );
}

function Overview({
  snapshot,
  activeFamilies,
  todayFamily,
  setTab,
}: {
  snapshot: AdminSnapshot;
  activeFamilies: StoredFamily[];
  todayFamily: string;
  setTab: (tab: AdminTab) => void;
}) {
  const paymentSummary = summarizeFamilyPayments(
    snapshot.month,
    snapshot.families,
    snapshot.payments,
  );
  const recent = snapshot.payments
    .flatMap((payment) =>
      payment.history.map((change) => ({
        id: change.id,
        label: `Payment updated for ${snapshot.families.find((family) => family.id === payment.familyId)?.name ?? payment.familyId}`,
        time: change.at,
      })),
    )
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 5);

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm text-accent-foreground">
        <Check className="mt-0.5 size-4 shrink-0" />
        <p>
          Records are stored on this server. Keep the configured data directory on persistent
          storage and back it up regularly.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Users />} label="Active families" value={String(activeFamilies.length)} />
        <Metric icon={<UtensilsCrossed />} label="Today's duty" value={todayFamily} />
        <Metric
          icon={<CircleDollarSign />}
          label="Voluntary contributions"
          value={formatINR(snapshot.contributionSummary.collected)}
        />
        <Metric
          icon={<HandCoins />}
          label="Outstanding dues"
          value={formatINR(paymentSummary.outstanding)}
        />
      </div>

      <SectionTitle>Monthly family payments</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric label="Done" value={paymentSummary.paid} />
        <MiniMetric label="Partially paid" value={paymentSummary.partial} />
        <MiniMetric label="Pending" value={paymentSummary.pending} />
      </div>

      <SectionTitle
        action={
          <button onClick={() => setTab("Duties")} className="text-sm font-semibold text-primary">
            Manage <ChevronRight className="inline size-4" />
          </button>
        }
      >
        Upcoming food duty
      </SectionTitle>
      <DutyList
        days={snapshot.schedule.filter((day) => day.date >= snapshot.today).slice(0, 5)}
        today={snapshot.today}
      />

      <SectionTitle>Manage community</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          icon={<Users />}
          title="Families"
          detail={`${snapshot.families.length} family records`}
          onClick={() => setTab("Families")}
        />
        <ActionCard
          icon={<UtensilsCrossed />}
          title="Food"
          detail={`${snapshot.foods.length} food arrangements`}
          onClick={() => setTab("Food")}
        />
        <ActionCard
          icon={<HandCoins />}
          title="Payments"
          detail="Private mandatory payment ledger"
          onClick={() => setTab("Payments")}
        />
        <ActionCard
          icon={<FileText />}
          title="Contributions"
          detail="Separate voluntary records"
          onClick={() => setTab("Contributions")}
        />
      </div>

      <SectionTitle>Recent payment updates</SectionTitle>
      {recent.length ? (
        <ul className="surface-card divide-y divide-border">
          {recent.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(item.time.slice(0, 10), { day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="surface-card p-4 text-sm text-muted-foreground">
          No admin changes recorded yet.
        </p>
      )}
    </>
  );
}

function FamiliesPanel({
  families,
  search,
  setSearch,
  run,
}: {
  families: StoredFamily[];
  search: string;
  setSearch: (value: string) => void;
  run: RunAction;
}) {
  const matches = families.filter((family) =>
    `${family.id} ${family.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Community"
        title="Family management"
        description="Family IDs are permanent. Deactivate rather than delete a family."
      />
      <FamilyEditor
        onSave={(values) => run(() => createFamily({ data: values }), "Family added")}
      />
      <Input
        aria-label="Search families by ID or name"
        placeholder="Search by Family ID or name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-3 h-11 rounded-xl bg-card"
      />
      <div className="surface-card divide-y divide-border overflow-hidden">
        {matches.map((family) => (
          <FamilyRow key={family.id} family={family} run={run} />
        ))}
        {!matches.length && (
          <p className="p-5 text-sm text-muted-foreground">No matching families.</p>
        )}
      </div>
    </>
  );
}

function FamilyEditor({
  family,
  onSave,
}: {
  family?: StoredFamily;
  onSave: (values: FamilyDraft) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(!!family);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const values: FamilyDraft = {
      name: String(form.get("name") ?? ""),
      head: String(form.get("head") ?? ""),
      contactNumber: String(form.get("contactNumber") ?? ""),
      members: Number(form.get("members") ?? 1),
      mohalla: String(form.get("mohalla") ?? ""),
      active: form.get("active") === "on",
      order: Number(form.get("order") ?? family?.order ?? 1),
      monthlyFee: Number(form.get("monthlyFee") ?? 0),
    };
    setBusy(true);
    const saved = await onSave(values);
    setBusy(false);
    if (saved && !family) formElement.reset();
    if (saved && !family) setOpen(false);
  };

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="surface-card mb-4 p-4"
    >
      <summary className="cursor-pointer font-semibold text-foreground">
        {family ? `Edit ${family.id}` : "Add a family"}
      </summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Family name">
          <Input name="name" required maxLength={120} defaultValue={family?.name} />
        </Field>
        <Field label="Primary contact number">
          <Input
            name="contactNumber"
            type="tel"
            inputMode="tel"
            required
            defaultValue={family?.contactNumber}
          />
        </Field>
        <Field label="Family head (optional)">
          <Input name="head" maxLength={120} defaultValue={family?.head} />
        </Field>
        <Field label="Mohalla (optional)">
          <Input name="mohalla" maxLength={100} defaultValue={family?.mohalla} />
        </Field>
        <Field label="Monthly family payment amount (₹)">
          <Input
            name="monthlyFee"
            type="number"
            min="0"
            max="1000000"
            step="1"
            required
            defaultValue={family?.monthlyFee ?? 0}
          />
        </Field>
        <Field label="Member count (private admin field)">
          <Input
            name="members"
            type="number"
            min="1"
            max="100"
            step="1"
            required
            defaultValue={family?.members ?? 1}
          />
        </Field>
        {family && (
          <Field label="Rotation order">
            <Input
              name="order"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={family.order}
            />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input name="active" type="checkbox" defaultChecked={family?.active ?? true} />
          Active in rotation
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : family ? "Save family" : "Add family"}
          </Button>
          {family && (
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          )}
        </div>
      </form>
    </details>
  );
}

function FamilyRow({ family, run }: { family: StoredFamily; run: RunAction }) {
  const [registrationCode, setRegistrationCode] = useState("");
  const update = (values: FamilyDraft) =>
    run(
      () => updateFamily({ data: { ...values, id: family.id, order: values.order } }),
      "Family updated",
    );
  const { order: _order, ...editable } = family;
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <FamilyAvatar name={family.name} size="sm" tone={family.active ? "primary" : "muted"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{family.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {family.id} · {family.contactNumber}
          </p>
        </div>
        <Pill tone={family.active ? "success" : "muted"}>
          {family.active ? "Active" : "Inactive"}
        </Pill>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Edit details
        </summary>
        <div className="pt-3">
          <div className="mb-3 rounded-xl bg-muted p-3">
            <p className="text-sm font-semibold text-foreground">Push notification setup</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate a code and share it with this family to register their devices.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await issueFamilyPushCode({ data: { familyId: family.id } });
                    setRegistrationCode(result.code);
                    toast.success("New family setup code generated.");
                  } catch (error) {
                    toast.error("Could not generate setup code", {
                      description: error instanceof Error ? error.message : "Please try again.",
                    });
                  }
                }}
              >
                Generate setup code
              </Button>
              {registrationCode && (
                <code className="rounded bg-background px-2 py-1 text-sm font-bold tracking-wider">
                  {registrationCode}
                </code>
              )}
            </div>
          </div>
          <FamilyEditor
            key={`${family.id}-${family.order}`}
            family={{ ...editable, order: family.order }}
            onSave={update}
          />
        </div>
      </details>
    </div>
  );
}

function FoodPanel({ foods, run }: { foods: FoodEntry[]; run: RunAction }) {
  const [editing, setEditing] = useState<FoodEntry | undefined>();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const entry = {
      date: String(form.get("date") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    };
    const action = editing
      ? () => updateFoodEntry({ data: { ...entry, id: editing.id } })
      : () => createFoodEntry({ data: entry });
    const saved = await run(
      action,
      editing ? "Food arrangement updated" : "Food arrangement added",
    );
    if (!saved) return;
    setEditing(undefined);
    formElement.reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="Food"
        title="Food management"
        description="Add today's arrangements; public pages only show the date and menu description."
      />
      <form onSubmit={submit} className="surface-card mb-4 space-y-3 p-4">
        <Field label="Date">
          <Input name="date" type="date" required defaultValue={editing?.date} />
        </Field>
        <Field label="Food arrangement">
          <Input name="title" required maxLength={120} defaultValue={editing?.title} />
        </Field>
        <Field label="Details">
          <Textarea name="description" maxLength={1000} defaultValue={editing?.description} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Save changes" : "Add food"}</Button>
          {editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
              Cancel edit
            </Button>
          )}
        </div>
      </form>
      <div className="space-y-3">
        {foods.map((food) => (
          <article key={food.id} className="surface-card p-4">
            <div className="flex items-start gap-3">
              <UtensilsCrossed className="mt-1 size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{food.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(food.date, { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {food.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{food.description}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(food)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void run(() => removeFoodEntry({ data: { id: food.id } }), "Food entry removed")
                }
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
        {!foods.length && (
          <p className="surface-card p-5 text-sm text-muted-foreground">
            No food arrangements yet.
          </p>
        )}
      </div>
    </>
  );
}

function DutiesPanel({
  families,
  schedule,
  today,
  run,
}: {
  families: StoredFamily[];
  schedule: AdminSnapshot["schedule"];
  today: string;
  run: RunAction;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Food rotation"
        title="Duty history & schedule"
        description="The daily rotation excludes inactive families. Manual changes are saved by date."
      />
      <div className="space-y-3">
        {schedule.map((duty) => (
          <div key={duty.date} className="surface-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  {formatDate(duty.date, { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {duty.family?.name ?? duty.override?.note ?? "No family duty"}
                </p>
              </div>
              <Pill
                tone={
                  duty.status === "completed"
                    ? "success"
                    : duty.status === "overridden"
                      ? "gold"
                      : duty.status === "skipped"
                        ? "muted"
                        : "primary"
                }
              >
                {duty.status}
              </Pill>
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-primary">
                {duty.date < today ? "Correct history" : "Change assignment"}
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const familyId = String(form.get("familyId") ?? "");
                  const note = String(form.get("note") ?? "");
                  const skipped = !familyId;
                  void run(
                    () =>
                      setDuty({
                        data: {
                          date: duty.date,
                          familyId: skipped ? null : familyId,
                          status: skipped ? "skipped" : "overridden",
                          note,
                        },
                      }),
                    "Duty assignment saved",
                  );
                }}
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              >
                <select
                  name="familyId"
                  defaultValue={duty.family?.id ?? ""}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Skip / no duty</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.id} · {family.name}
                    </option>
                  ))}
                </select>
                <Input
                  name="note"
                  maxLength={500}
                  placeholder="Optional reason"
                  defaultValue={duty.override?.note}
                />
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
              {duty.family && duty.status !== "completed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    void run(
                      () =>
                        setDuty({
                          data: {
                            date: duty.date,
                            familyId: duty.family!.id,
                            status: "completed",
                            note: "",
                          },
                        }),
                      "Duty marked completed",
                    )
                  }
                >
                  Mark completed
                </Button>
              )}
            </details>
          </div>
        ))}
      </div>
    </>
  );
}

function PaymentsPanel({
  families,
  payments,
  month,
  run,
}: {
  families: StoredFamily[];
  payments: AdminSnapshot["payments"];
  month: string;
  run: RunAction;
}) {
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5)).reverse();
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [filter, setFilter] = useState("all");
  const paymentSummary = summarizeFamilyPayments(selectedMonth, families, payments);
  const allRows = families.map((family) => {
    const payment = payments.find(
      (item) => item.familyId === family.id && item.month === selectedMonth,
    );
    const due = payment?.amountDue ?? family.monthlyFee;
    const received = payment?.amountReceived ?? 0;
    const status = contributionStatus(due, received);
    return { family, payment, due, received, status };
  });
  const rows = allRows.filter((row) => filter === "all" || row.status === filter);

  return (
    <>
      <PageHeader
        eyebrow="Private admin ledger"
        title="Mandatory family payments"
        description="Record cash or UPI payments here. This ledger is separate from voluntary contributions."
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select
          aria-label="Payment month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {months.map((item) => (
            <option key={item} value={item}>
              {formatMonth(item)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter payment status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="paid">Done</option>
          <option value="partial">Partially paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <FeeMetric label="Expected" value={paymentSummary.expected} />
        <FeeMetric label="Collected" value={paymentSummary.collected} />
        <FeeMetric label="Outstanding" value={paymentSummary.outstanding} />
      </div>
      <div className="space-y-3">
        {rows.map(({ family, payment, due, received, status }) => (
          <PaymentEditor
            key={`${family.id}-${selectedMonth}`}
            family={family}
            month={selectedMonth}
            due={due}
            received={received}
            status={status}
            history={payment?.history ?? []}
            run={run}
          />
        ))}
        {!rows.length && (
          <p className="surface-card p-5 text-sm text-muted-foreground">
            No payments match this status.
          </p>
        )}
      </div>
    </>
  );
}

function PaymentEditor({
  family,
  month,
  due,
  received,
  status,
  history,
  run,
}: {
  family: StoredFamily;
  month: string;
  due: number;
  received: number;
  status: "paid" | "partial" | "pending";
  history: AdminSnapshot["payments"][number]["history"];
  run: RunAction;
}) {
  const statusLabel =
    status === "paid" ? "Done" : status === "partial" ? "Partially Paid" : "Pending";
  return (
    <details className="surface-card p-4">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{family.name}</p>
          <p className="text-xs text-muted-foreground">
            {family.id} · {formatINR(received)} of {formatINR(due)}
          </p>
        </div>
        <Pill tone={status === "paid" ? "success" : status === "partial" ? "warning" : "pending"}>
          {statusLabel}
        </Pill>
      </summary>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const amountDue = Number(form.get("amountDue"));
          const amountPaid = Number(form.get("amountPaid"));
          const method = form.get("method");
          if (method !== "cash" && method !== "upi") {
            toast.error("Choose a payment method.");
            return;
          }
          const note = String(form.get("note") ?? "");
          const saved = await run(
            () =>
              saveFamilyPayment({
                data: { familyId: family.id, month, amountDue, amountPaid, method, note },
              }),
            "Payment recorded",
          );
          if (saved) formElement.reset();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount due (₹)">
            <Input
              name="amountDue"
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              defaultValue={due}
            />
          </Field>
          <Field label="New payment amount (₹)">
            <Input
              name="amountPaid"
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              defaultValue="0"
            />
          </Field>
          <Field label="Payment method">
            <select
              name="method"
              defaultValue="cash"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </Field>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          Received so far: {formatINR(received)} · Remaining:{" "}
          {formatINR(Math.max(0, due - received))}
        </p>
        <Field label="Admin note">
          <Input name="note" maxLength={300} placeholder="Optional history note" />
        </Field>
        <Button type="submit" size="sm">
          Record payment
        </Button>
      </form>
      {!!history.length && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Payment history</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {[...history].reverse().map((entry) => (
              <li key={entry.id}>
                {formatDate(entry.at.slice(0, 10), { day: "numeric", month: "short" })}:{" "}
                {"amount" in entry
                  ? `${formatINR(entry.amount)} by ${entry.method.toUpperCase()}`
                  : `received ${formatINR(entry.amountReceived)} / due ${formatINR(entry.amountDue)}`}
                {entry.note ? ` · ${entry.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

function ContributionsPanel({
  families,
  contributions,
  month,
  today,
  run,
}: {
  families: StoredFamily[];
  contributions: StoredContribution[];
  month: string;
  today: string;
  run: RunAction;
}) {
  const [selectedMonth, setSelectedMonth] = useState(month);
  const currentRecords = contributions.filter((entry) => entry.month === selectedMonth);
  return (
    <>
      <PageHeader
        eyebrow="Separate voluntary ledger"
        title="Contributions"
        description="Manual records only; not merged with mandatory family payment balances."
      />
      <form
        className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const saved = await run(
            () =>
              recordContribution({
                data: {
                  familyId: String(form.get("familyId") ?? ""),
                  month: String(form.get("month") ?? ""),
                  amount: Number(form.get("amount")),
                  method: form.get("method") === "upi" ? "upi" : "cash",
                  paidOn: String(form.get("paidOn") ?? ""),
                  note: String(form.get("note") ?? ""),
                },
              }),
            "Contribution recorded",
          );
          if (saved) formElement.reset();
        }}
      >
        <Field label="Family">
          <select
            name="familyId"
            required
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose family</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.id} · {family.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Month">
          <Input name="month" type="month" required defaultValue={month} />
        </Field>
        <Field label="Amount (₹)">
          <Input name="amount" type="number" min="1" max="1000000" step="1" required />
        </Field>
        <Field label="Manual method">
          <select
            name="method"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI transfer recorded manually</option>
          </select>
        </Field>
        <Field label="Received date">
          <Input name="paidOn" type="date" required defaultValue={today} />
        </Field>
        <Field label="Note (optional)">
          <Input name="note" maxLength={300} />
        </Field>
        <Button type="submit" className="sm:col-span-2">
          Record contribution
        </Button>
      </form>
      <label className="mb-3 block text-sm font-semibold text-foreground">
        View month
        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-input bg-background px-3"
        >
          {Array.from({ length: 12 }, (_, index) => shiftMonth(month, index - 11))
            .reverse()
            .map((item) => (
              <option key={item} value={item}>
                {formatMonth(item)}
              </option>
            ))}
        </select>
      </label>
      <div className="surface-card divide-y divide-border">
        {currentRecords.map((record) => (
          <div key={record.id} className="flex items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {families.find((family) => family.id === record.familyId)?.name ?? record.familyId}
              </p>
              <p className="text-xs text-muted-foreground">
                {record.paidOn} · {record.method.toUpperCase()}
                {record.note ? ` · ${record.note}` : ""}
              </p>
            </div>
            <span className="font-semibold text-foreground">{formatINR(record.amount)}</span>
          </div>
        ))}
        {!currentRecords.length && (
          <p className="p-5 text-sm text-muted-foreground">
            No contributions recorded for this month.
          </p>
        )}
      </div>
    </>
  );
}

function AnnouncementsPanel({
  announcements,
  today,
  run,
}: {
  announcements: StoredAnnouncement[];
  today: string;
  run: RunAction;
}) {
  const [editing, setEditing] = useState<StoredAnnouncement | undefined>();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawTag = String(form.get("tag") ?? "");
    const values = {
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
      date: String(form.get("date") ?? ""),
      tag: rawTag === "Event" || rawTag === "Reminder" ? rawTag : "Notice",
      pinned: form.get("pinned") === "on",
    } as const;
    const action = editing
      ? () => updateAnnouncement({ data: { ...values, id: editing.id } })
      : () => createAnnouncement({ data: values });
    const saved = await run(action, editing ? "Announcement updated" : "Announcement published");
    if (!saved) return;
    setEditing(undefined);
    formElement.reset();
  };
  return (
    <>
      <PageHeader
        eyebrow="Public updates"
        title="Announcements"
        description="Published notices appear on the public announcements page."
      />
      <form onSubmit={submit} className="surface-card mb-4 space-y-3 p-4">
        <Field label="Title">
          <Input name="title" required maxLength={160} defaultValue={editing?.title} />
        </Field>
        <Field label="Message">
          <Textarea name="body" required maxLength={3000} defaultValue={editing?.body} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input name="date" type="date" required defaultValue={editing?.date ?? today} />
          </Field>
          <Field label="Type">
            <select
              name="tag"
              defaultValue={editing?.tag ?? "Notice"}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option>Notice</option>
              <option>Event</option>
              <option>Reminder</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input name="pinned" type="checkbox" defaultChecked={editing?.pinned} /> Pin announcement
        </label>
        <div className="flex gap-2">
          <Button type="submit">{editing ? "Save announcement" : "Publish announcement"}</Button>
          {editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
      <div className="space-y-3">
        {announcements.map((item) => (
          <article key={item.id} className="surface-card p-4">
            <p className="text-xs font-semibold text-primary">
              {item.tag} · {item.date}
              {item.pinned ? " · Pinned" : ""}
            </p>
            <h2 className="mt-1 font-semibold text-foreground">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void run(
                    () => removeAnnouncement({ data: { id: item.id } }),
                    "Announcement removed",
                  )
                }
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function NotificationsPanel({
  notifications,
  families,
}: {
  notifications: AdminSnapshot["notifications"];
  families: StoredFamily[];
}) {
  const [dateFilter, setDateFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const visible = [...notifications]
    .filter((item) => !dateFilter || item.dutyDate === dateFilter)
    .filter((item) => !familyFilter || item.familyId === familyFilter)
    .filter((item) => statusFilter === "all" || item.status === statusFilter)
    .sort((a, b) => b.dutyDate.localeCompare(a.dutyDate) || b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        eyebrow="Delivery status"
        title="Notifications"
        description="Private delivery history for family-specific duty reminders."
      />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
        <Bell className="mt-0.5 size-4 shrink-0" />
        <p>
          A “not configured” status means that provider credentials or push subscriptions are
          missing. “Accepted” means the provider accepted the request, not that a device displayed
          it. “Queued” records are not retried automatically, to avoid duplicate reminders.
        </p>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Field label="Duty date">
          <Input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </Field>
        <Field label="Family">
          <select
            value={familyFilter}
            onChange={(event) => setFamilyFilter(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All families</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.id} · {family.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery status">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="sent">Accepted</option>
            <option value="failed">Failed</option>
            <option value="not-configured">Not configured</option>
            <option value="queued">Queued</option>
            <option value="skipped">Skipped</option>
          </select>
        </Field>
      </div>
      <div className="surface-card divide-y divide-border">
        {visible.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                {item.familyId} ·{" "}
                {families.find((family) => family.id === item.familyId)?.name ?? "Unknown family"}
              </p>
              <p className="text-xs text-muted-foreground">
                Duty {item.dutyDate} · Scheduled {formatReminderTime(item.scheduledTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.channel.toUpperCase()} ·{" "}
                {item.deliveredAt
                  ? `Accepted ${formatTimestamp(item.deliveredAt)}`
                  : `Attempted ${formatTimestamp(item.createdAt)}`}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
            </div>
            <Pill
              tone={
                item.status === "sent"
                  ? "success"
                  : item.status === "skipped"
                    ? "muted"
                    : item.status === "failed"
                      ? "pending"
                      : "warning"
              }
            >
              {item.status === "sent" ? "Accepted" : item.status}
            </Pill>
          </div>
        ))}
        {!visible.length && (
          <p className="p-5 text-sm text-muted-foreground">
            No notification delivery records match these filters.
          </p>
        )}
      </div>
    </>
  );
}

function SettingsPanel({ snapshot, run }: { snapshot: AdminSnapshot; run: RunAction }) {
  const [reminderParts, setReminderParts] = useState<ReminderTimeParts>(() =>
    reminderTimeToParts(snapshot.settings.reminderTime),
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const backup = async () => {
    const data = await exportAdminData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `habshi-masjid-backup-${snapshot.today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        eyebrow="Application"
        title="Settings & backup"
        description="Community calendar uses Asia/Kolkata. Store data on a persistent server volume."
      />
      <form
        className="surface-card space-y-3 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setSavingSettings(true);
          try {
            const reminderTime = reminderTimeFromParts(reminderParts);
            await run(
              () =>
                updateAppSettings({
                  data: {
                    anchorDate: String(form.get("anchorDate") ?? ""),
                    reminderTime,
                  },
                }),
              `Settings saved. Duty reminders are scheduled for ${formatReminderTime(reminderTime)} IST.`,
            );
          } catch (error) {
            toast.error("Invalid reminder time", {
              description: error instanceof Error ? error.message : "Choose a valid time.",
            });
          } finally {
            setSavingSettings(false);
          }
        }}
      >
        <Field label="Rotation start date">
          <Input
            name="anchorDate"
            type="date"
            required
            defaultValue={snapshot.settings.anchorDate}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Daily reminder time (IST)</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground">
              Hour
              <select
                value={reminderParts.hour}
                onChange={(event) =>
                  setReminderParts((current) => ({ ...current, hour: event.target.value }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Minute
              <select
                value={reminderParts.minute}
                onChange={(event) =>
                  setReminderParts((current) => ({ ...current, minute: event.target.value }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map(
                  (minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              AM / PM
              <select
                value={reminderParts.period}
                onChange={(event) =>
                  setReminderParts((current) => ({
                    ...current,
                    period: event.target.value as ReminderTimeParts["period"],
                  }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Saved time: <strong>{formatReminderTime(snapshot.settings.reminderTime)} IST</strong>. The
          Node scheduler checks the saved setting every 15 seconds; a host cron can also call the
          secured scheduler endpoint.
        </p>
        <Button type="submit" disabled={savingSettings}>
          {savingSettings ? "Saving…" : "Save settings"}
        </Button>
      </form>
      <SectionTitle>Backup</SectionTitle>
      <div className="surface-card p-4">
        <p className="text-sm text-muted-foreground">
          Each updated JSON file keeps up to 10 previous versions under the private data directory.
          Export a full admin-only backup for off-server recovery.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void run(backup, "Backup downloaded")}
        >
          <Download className="size-4" /> Download full backup
        </Button>
      </div>
      <SectionTitle>Hosting requirements</SectionTitle>
      <p className="surface-card p-4 text-sm text-muted-foreground">
        Use a persistent Node.js host with a mounted writable volume. Cloudflare Workers and other
        ephemeral/serverless filesystems cannot store this JSON data safely.
      </p>
    </>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card min-w-0 p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-display text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-3 text-center">
      <p className="font-display text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FeeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card min-w-0 p-3 text-center">
      <p className="truncate font-display text-lg font-semibold text-foreground">
        {formatINR(value)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-card flex items-start gap-3 p-4 text-left transition-transform active:scale-[0.99]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}
