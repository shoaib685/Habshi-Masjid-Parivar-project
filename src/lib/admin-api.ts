import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { summarizeContributions } from "@/lib/contributions";
import { addDays, monthKeyOf, shiftMonth, todayIST } from "@/lib/date";
import {
  getDutyForDate,
  getSchedule,
  type DutyDay,
  type DutyOverride,
  type Family,
  type PublicDutyDay,
  type PublicFamily,
  type RotationConfig,
} from "@/lib/rotation";
import {
  announcementSchema,
  contributionInputSchema,
  dutyInputSchema,
  familyInputSchema,
  type FamilyPayment,
  type StoredDuty,
  foodSchema,
  paymentInputSchema,
  pushSubscriptionInputSchema,
  settingsSchema,
  type StoredFamily,
} from "./data-schemas";

const credentialsSchema = z.object({ password: z.string().min(1).max(200) });
const idSchema = z.object({ id: z.string().uuid() });
const foodInputSchema = foodSchema.omit({ id: true, updatedAt: true });
const announcementInputSchema = announcementSchema.omit({ id: true });
const settingsInputSchema = settingsSchema.omit({ timezone: true });
const pushRemovalSchema = z.object({
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  registrationCode: z.string().min(8).max(64),
  endpoint: z.string().url(),
});

async function requireAdmin(): Promise<void> {
  const [{ getRequestHeader }, { getSessionToken, verifyAdminSession }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("./server/auth"),
  ]);
  const token = getSessionToken(getRequestHeader("cookie"));
  if (!verifyAdminSession(token)) throw new Error("Admin authentication is required.");
}

export const loginAdmin = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) => {
    const {
      checkLoginRateLimit,
      clearFailedLogins,
      createAdminSession,
      recordFailedLogin,
      sessionCookie,
      verifyAdminPassword,
    } = await import("./server/auth");
    const [{ getRequestHeader, setResponseHeader }, { env }] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("node:process"),
    ]);
    const clientKey =
      getRequestHeader("x-real-ip") ?? getRequestHeader("cf-connecting-ip") ?? "unknown-client";
    if (!checkLoginRateLimit(clientKey))
      throw new Error("Too many sign-in attempts. Try again later.");

    const matches = await verifyAdminPassword(data.password);
    if (!matches) {
      recordFailedLogin(clientKey);
      throw new Error("Incorrect admin passcode.");
    }

    clearFailedLogins(clientKey);
    setResponseHeader(
      "Set-Cookie",
      sessionCookie(createAdminSession(), env["NODE_ENV"] === "production"),
    );
    return { authenticated: true };
  });

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getRequestHeader }, { getSessionToken, verifyAdminSession }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("./server/auth"),
  ]);
  return {
    authenticated: verifyAdminSession(getSessionToken(getRequestHeader("cookie"))),
  };
});

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const [{ setResponseHeader }, { clearedSessionCookie }, { env }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("./server/auth"),
    import("node:process"),
  ]);
  setResponseHeader("Set-Cookie", clearedSessionCookie(env["NODE_ENV"] === "production"));
  return { authenticated: false };
});

export const getPublicHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const { jsonStore } = await import("./server/store");
  const [storedFamilies, duties, foods, contributions, announcements, settings] = await Promise.all(
    [
      jsonStore.read("families"),
      jsonStore.read("duties"),
      jsonStore.read("food"),
      jsonStore.read("contributions"),
      jsonStore.read("announcements"),
      jsonStore.read("settings"),
    ],
  );
  const today = todayIST();
  const rotation = makeRotationConfig(storedFamilies, duties, settings.anchorDate);
  const schedule = getSchedule(addDays(today, 1), 5, rotation, today);
  const duty = getDutyForDate(today, rotation, today);
  const month = monthKeyOf(today);
  const summary = summarizeContributions(month, contributions);
  const latest = [...announcements].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date),
  )[0];

  return {
    today,
    duty: publicDuty(applyStoredDuty(duty, duties, storedFamilies)),
    schedule: schedule.map((day) => publicDuty(applyStoredDuty(day, duties, storedFamilies))),
    food: foods
      .filter((item) => item.date === today)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map(({ id, title, description, date, updatedAt }) => ({
        id,
        title,
        description,
        date,
        updatedAt,
      })),
    month,
    summary,
    announcement: latest
      ? {
          id: latest.id,
          title: latest.title,
          body: latest.body,
          tag: latest.tag,
          pinned: latest.pinned,
        }
      : null,
  };
});

export const getPublicPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { getPushPublicKey } = await import("./server/push-provider");
  return { publicKey: getPushPublicKey() };
});

export const subscribeFamilyPush = createServerFn({ method: "POST" })
  .validator(pushSubscriptionInputSchema)
  .handler(async ({ data }) => {
    const { jsonStore } = await import("./server/store");
    const { randomUUID } = await import("node:crypto");
    const families = await jsonStore.read("families");
    const family = families.find((item) => item.id === data.familyId && item.active);
    if (!family) throw new Error("Choose an active family.");
    if (
      !family.notificationCodeHash ||
      !(await matchesEnrollmentCode(data.registrationCode, family.notificationCodeHash))
    ) {
      throw new Error("Family ID or notification setup code is incorrect.");
    }

    const now = new Date().toISOString();
    let savedId = "";
    await jsonStore.update("pushSubscriptions", (subscriptions) => {
      const current = subscriptions.find((item) => item.endpoint === data.endpoint);
      savedId = current?.id ?? randomUUID();
      const updated = {
        id: savedId,
        familyId: family.id,
        endpoint: data.endpoint,
        keys: data.keys,
        expirationTime: data.expirationTime,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      return current
        ? subscriptions.map((item) => (item.endpoint === data.endpoint ? updated : item))
        : [...subscriptions, updated];
    });
    return { saved: true, subscriptionId: savedId };
  });

export const removeFamilyPushSubscription = createServerFn({ method: "POST" })
  .validator(pushRemovalSchema)
  .handler(async ({ data }) => {
    const { jsonStore } = await import("./server/store");
    const families = await jsonStore.read("families");
    const family = families.find((item) => item.id === data.familyId);
    if (
      !family?.notificationCodeHash ||
      !(await matchesEnrollmentCode(data.registrationCode, family.notificationCodeHash))
    ) {
      throw new Error("Family ID or notification setup code is incorrect.");
    }
    let removed = false;
    await jsonStore.update("pushSubscriptions", (subscriptions) => {
      const remaining = subscriptions.filter(
        (item) => item.endpoint !== data.endpoint || item.familyId !== family.id,
      );
      removed = remaining.length !== subscriptions.length;
      return remaining;
    });
    return { removed };
  });

export const issueFamilyPushCode = createServerFn({ method: "POST" })
  .validator(z.object({ familyId: z.string().regex(/^HMP-\d{3,}$/) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const { randomBytes } = await import("node:crypto");
    const code = randomBytes(9).toString("base64url").toUpperCase();
    const hash = await enrollmentCodeHash(code);
    let found = false;
    await jsonStore.update("families", (families) =>
      families.map((family) => {
        if (family.id !== data.familyId) return family;
        found = true;
        return { ...family, notificationCodeHash: hash };
      }),
    );
    if (!found) throw new Error("Family not found.");
    return { code };
  });

export const getPublicSchedule = createServerFn({ method: "GET" }).handler(async () => {
  const { jsonStore } = await import("./server/store");
  const [storedFamilies, duties, settings] = await Promise.all([
    jsonStore.read("families"),
    jsonStore.read("duties"),
    jsonStore.read("settings"),
  ]);
  const today = todayIST();
  const schedule = getSchedule(
    addDays(today, -7),
    28,
    makeRotationConfig(storedFamilies, duties, settings.anchorDate),
    today,
  );
  return {
    today,
    schedule: schedule.map((day) => publicDuty(applyStoredDuty(day, duties, storedFamilies))),
  };
});

export const getPublicDutyData = createServerFn({ method: "GET" }).handler(async () => {
  const { jsonStore } = await import("./server/store");
  const [storedFamilies, duties, settings] = await Promise.all([
    jsonStore.read("families"),
    jsonStore.read("duties"),
    jsonStore.read("settings"),
  ]);
  const today = todayIST();
  const config = makeRotationConfig(storedFamilies, duties, settings.anchorDate);
  return {
    today,
    duty: publicDuty(applyStoredDuty(getDutyForDate(today, config, today), duties, storedFamilies)),
    yesterday: publicDuty(
      applyStoredDuty(getDutyForDate(addDays(today, -1), config, today), duties, storedFamilies),
    ),
    tomorrow: publicDuty(
      applyStoredDuty(getDutyForDate(addDays(today, 1), config, today), duties, storedFamilies),
    ),
    history: getSchedule(addDays(today, -7), 7, config, today)
      .reverse()
      .map((day) => publicDuty(applyStoredDuty(day, duties, storedFamilies))),
  };
});

export const getPublicAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { jsonStore } = await import("./server/store");
  const announcements = await jsonStore.read("announcements");
  return [...announcements]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date))
    .map(({ id, title, body, date, tag, pinned }) => ({ id, title, body, date, tag, pinned }));
});

export const getPublicContributions = createServerFn({ method: "GET" }).handler(async () => {
  const { jsonStore } = await import("./server/store");
  const contributions = await jsonStore.read("contributions");
  const currentMonth = monthKeyOf(todayIST());
  return Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(currentMonth, index - 5);
    return summarizeContributions(month, contributions);
  });
});

export const getAdminSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { jsonStore } = await import("./server/store");
  const [families, duties, foods, payments, contributions, announcements, notifications, settings] =
    await Promise.all([
      jsonStore.read("families"),
      jsonStore.read("duties"),
      jsonStore.read("food"),
      jsonStore.read("payments"),
      jsonStore.read("contributions"),
      jsonStore.read("announcements"),
      jsonStore.read("notifications"),
      jsonStore.read("settings"),
    ]);
  const today = todayIST();
  const month = monthKeyOf(today);
  const config = makeRotationConfig(families, duties, settings.anchorDate);
  const familiesForAdmin = families.map((family) => {
    const record = { ...family };
    delete record.notificationCodeHash;
    return record;
  });
  return {
    families: familiesForAdmin,
    duties,
    foods,
    payments,
    contributions,
    announcements,
    notifications,
    settings,
    today,
    month,
    schedule: getSchedule(addDays(today, -7), 35, config, today).map((day) =>
      publicDuty(applyStoredDuty(day, duties, families)),
    ),
    contributionSummary: summarizeContributions(month, contributions),
  };
});

export const createFamily = createServerFn({ method: "POST" })
  .validator(familyInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const [current, duties, settings] = await Promise.all([
      jsonStore.read("families"),
      jsonStore.read("duties"),
      jsonStore.read("settings"),
    ]);
    await materializePastDuties(current, duties, settings.anchorDate);
    let createdFamily: StoredFamily | undefined;
    await jsonStore.update("families", (families) => {
      const nextNumber =
        families.reduce((max, family) => {
          const value = Number(family.id.slice("HMP-".length));
          return Number.isFinite(value) ? Math.max(max, value) : max;
        }, 0) + 1;
      createdFamily = {
        ...data,
        id: `HMP-${String(nextNumber).padStart(3, "0")}`,
        order: Math.max(0, ...families.map((item) => item.order)) + 1,
      };
      return [...families, createdFamily];
    });
    if (!createdFamily) throw new Error("Family was not created.");
    return createdFamily;
  });

export const updateFamily = createServerFn({ method: "POST" })
  .validator(
    familyInputSchema.extend({
      id: z.string().regex(/^HMP-\d{3,}$/),
      order: z.number().int().min(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const [current, duties, settings] = await Promise.all([
      jsonStore.read("families"),
      jsonStore.read("duties"),
      jsonStore.read("settings"),
    ]);
    if (current.some((family) => family.id !== data.id && family.order === data.order)) {
      throw new Error("Each family must have a unique rotation order.");
    }
    await materializePastDuties(current, duties, settings.anchorDate);
    const { id, ...updates } = data;
    let updated = false;
    await jsonStore.update("families", (families) =>
      families.map((family) => {
        if (family.id !== id) return family;
        updated = true;
        return { ...family, ...updates };
      }),
    );
    if (!updated) throw new Error("Family not found.");
    return { id };
  });

export const setDuty = createServerFn({ method: "POST" })
  .validator(dutyInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const families = await jsonStore.read("families");
    if (data.familyId && !families.some((family) => family.id === data.familyId && family.active))
      throw new Error("Only an active family can be assigned a duty.");
    if (data.familyId && data.status === "skipped") {
      throw new Error("A skipped duty cannot have a family assigned.");
    }
    await jsonStore.update("duties", (duties) => {
      const existing = duties.find((duty) => duty.date === data.date);
      const next = { ...data };
      return existing
        ? duties.map((duty) => (duty.date === data.date ? next : duty))
        : [...duties, next];
    });
    return { date: data.date };
  });

export const createFoodEntry = createServerFn({ method: "POST" })
  .validator(foodInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { jsonStore } = await import("./server/store");
    const entry = { ...data, id: randomUUID(), updatedAt: new Date().toISOString() };
    await jsonStore.update("food", (food) => [...food, entry]);
    return entry;
  });

export const removeFoodEntry = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    let removed = false;
    await jsonStore.update("food", (food) => {
      const next = food.filter((entry) => entry.id !== data.id);
      removed = next.length !== food.length;
      return next;
    });
    if (!removed) throw new Error("Food entry not found.");
    return { removed: true };
  });

export const updateFoodEntry = createServerFn({ method: "POST" })
  .validator(foodInputSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const { id, ...updates } = data;
    let found = false;
    await jsonStore.update("food", (food) =>
      food.map((entry) => {
        if (entry.id !== id) return entry;
        found = true;
        return { ...entry, ...updates, updatedAt: new Date().toISOString() };
      }),
    );
    if (!found) throw new Error("Food entry not found.");
    return { id };
  });

export const saveFamilyPayment = createServerFn({ method: "POST" })
  .validator(paymentInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { jsonStore } = await import("./server/store");
    const families = await jsonStore.read("families");
    if (!families.some((family) => family.id === data.familyId)) {
      throw new Error("Choose an existing family.");
    }

    let savedPayment: FamilyPayment | undefined;
    await jsonStore.update("payments", (payments) => {
      const existing = payments.find(
        (payment) => payment.familyId === data.familyId && payment.month === data.month,
      );
      const amountReceived = (existing?.amountReceived ?? 0) + data.amountPaid;
      if (amountReceived > data.amountDue) {
        throw new Error("Total payments cannot exceed the amount due.");
      }

      const history = [
        ...(existing?.history ?? []),
        ...(data.amountPaid > 0
          ? [
              {
                id: randomUUID(),
                at: new Date().toISOString(),
                amount: data.amountPaid,
                method: data.method,
                note: data.note,
              },
            ]
          : []),
      ];
      const record: FamilyPayment = {
        id: existing?.id ?? randomUUID(),
        familyId: data.familyId,
        month: data.month,
        amountDue: data.amountDue,
        amountReceived,
        history,
      };
      savedPayment = record;
      return existing
        ? payments.map((payment) => (payment.id === existing.id ? record : payment))
        : [...payments, record];
    });
    if (!savedPayment) throw new Error("Payment record was not saved.");
    return savedPayment;
  });

export const recordContribution = createServerFn({ method: "POST" })
  .validator(contributionInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { jsonStore } = await import("./server/store");
    const families = await jsonStore.read("families");
    if (!families.some((family) => family.id === data.familyId)) {
      throw new Error("Choose an existing family.");
    }
    const record = { ...data, id: randomUUID() };
    await jsonStore.update("contributions", (contributions) => [...contributions, record]);
    return record;
  });

export const createAnnouncement = createServerFn({ method: "POST" })
  .validator(announcementInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { jsonStore } = await import("./server/store");
    const announcement = { ...data, id: randomUUID() };
    await jsonStore.update("announcements", (items) => [...items, announcement]);
    return announcement;
  });

export const removeAnnouncement = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    let removed = false;
    await jsonStore.update("announcements", (items) => {
      const next = items.filter((item) => item.id !== data.id);
      removed = next.length !== items.length;
      return next;
    });
    if (!removed) throw new Error("Announcement not found.");
    return { removed: true };
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .validator(announcementInputSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const { id, ...updates } = data;
    let found = false;
    await jsonStore.update("announcements", (items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        found = true;
        return { ...item, ...updates };
      }),
    );
    if (!found) throw new Error("Announcement not found.");
    return { id };
  });

export const exportAdminData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { jsonStore } = await import("./server/store");
  return jsonStore.exportAll();
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .validator(settingsInputSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { jsonStore } = await import("./server/store");
    const [settings, duties, families] = await Promise.all([
      jsonStore.read("settings"),
      jsonStore.read("duties"),
      jsonStore.read("families"),
    ]);
    if (data.anchorDate !== settings.anchorDate) {
      await materializePastDuties(families, duties, settings.anchorDate);
    }
    await jsonStore.update("settings", (current) => ({ ...current, ...data }));
    return { saved: true };
  });

function makeRotationConfig(
  families: StoredFamily[],
  records: StoredDuty[],
  anchorDate: string,
): RotationConfig {
  const overrides = records.flatMap<DutyOverride>((duty) => {
    if (duty.status === "skipped") {
      return [{ date: duty.date, kind: "skip", note: duty.note }];
    }
    if (duty.status === "overridden" && duty.familyId) {
      return [{ date: duty.date, kind: "reassign", familyId: duty.familyId, note: duty.note }];
    }
    return [];
  });
  return {
    families: families.map((family) => ({ ...family })),
    anchorDate,
    overrides,
  };
}

function applyStoredDuty(duty: DutyDay, records: StoredDuty[], families: StoredFamily[]): DutyDay {
  const saved = records.find((record) => record.date === duty.date);
  if (!saved) return duty;
  const savedFamily = saved.familyId
    ? (families.find((family) => family.id === saved.familyId) ?? null)
    : null;
  if (saved.status === "completed") {
    return {
      ...duty,
      family: savedFamily,
      status: "completed",
      override: undefined,
    };
  }
  if (saved.status === "overridden" || saved.status === "skipped") {
    return {
      ...duty,
      family: saved.status === "skipped" ? null : savedFamily,
      status: saved.status,
      override: {
        date: saved.date,
        kind: saved.status === "skipped" ? "skip" : "reassign",
        ...(saved.familyId ? { familyId: saved.familyId } : {}),
        ...(saved.note ? { note: saved.note } : {}),
      },
    };
  }
  return duty;
}

async function materializePastDuties(
  families: StoredFamily[],
  existingDuties: StoredDuty[],
  anchorDate: string,
): Promise<void> {
  const today = todayIST();
  const dayCount = Math.max(
    0,
    Math.min(
      20_000,
      Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${anchorDate}T00:00:00Z`)) / 86_400_000,
      ),
    ),
  );
  if (!dayCount) return;
  const scheduled = getSchedule(
    anchorDate,
    dayCount,
    makeRotationConfig(families, existingDuties, anchorDate),
    today,
  );
  const stored = new Map(existingDuties.map((duty) => [duty.date, duty]));
  for (const duty of scheduled) {
    if (stored.has(duty.date)) continue;
    stored.set(duty.date, {
      date: duty.date,
      familyId: duty.family?.id ?? null,
      status: duty.status,
      note: duty.override?.note ?? "",
    });
  }
  const next = [...stored.values()];
  const { jsonStore } = await import("./server/store");
  await jsonStore.update("duties", () => next);
}

function publicDuty(duty: DutyDay): PublicDutyDay {
  return {
    ...duty,
    family: duty.family ? stripPrivateFamilyFields(duty.family) : null,
    scheduledFamily: duty.scheduledFamily ? stripPrivateFamilyFields(duty.scheduledFamily) : null,
    override: duty.override
      ? {
          date: duty.override.date,
          kind: duty.override.kind,
          ...(duty.override.familyId ? { familyId: duty.override.familyId } : {}),
          ...(duty.override.note ? { note: duty.override.note } : {}),
        }
      : undefined,
  };
}

function stripPrivateFamilyFields(family: Family): PublicFamily {
  return {
    id: family.id,
    name: family.name,
    head: family.head,
    mohalla: family.mohalla,
    active: family.active,
    order: family.order,
  };
}

async function enrollmentCodeHash(code: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

async function matchesEnrollmentCode(code: string, expectedHash: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  const actual = hexBytes(await enrollmentCodeHash(code));
  const expected = hexBytes(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hexBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}
