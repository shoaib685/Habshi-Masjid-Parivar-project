import { randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "node:process";
import type { PushSubscription } from "web-push";

import { formatDate, todayIST } from "@/lib/date";
import { reminderIsDue, zonedClock } from "@/lib/reminder-time";
import type { NotificationLog, StoredDuty, StoredFamily } from "../data-schemas";
import { getDutyForDate, type DutyDay, type DutyOverride, type RotationConfig } from "../rotation";
import { sendPush } from "./push-provider";
import { jsonStore } from "./store";
import { sendSms } from "./sms-provider";

const activeDeliveries = new Set<string>();

export async function runDueDutyReminders(now = new Date()) {
  const settings = await jsonStore.read("settings");
  if (!reminderIsDue(now, settings.reminderTime)) {
    return { status: "not-due" as const, dutyDate: zonedClock(now).date };
  }
  const date = zonedClock(now).date;
  return runDutyReminder(date, settings.reminderTime, now);
}

export async function runDutyReminder(date: string, scheduledTime: string, now = new Date()) {
  const [families, duties, subscriptions, settings] = await Promise.all([
    jsonStore.read("families"),
    jsonStore.read("duties"),
    jsonStore.read("pushSubscriptions"),
    jsonStore.read("settings"),
  ]);
  const family = assignedFamily(date, families, duties, settings.anchorDate);
  if (!family) return { status: "no-duty" as const, dutyDate: date };

  const deliveryKey = `duty:${date}:${family.id}`;
  if (activeDeliveries.has(deliveryKey)) {
    return { status: "already-running" as const, dutyDate: date, familyId: family.id };
  }
  activeDeliveries.add(deliveryKey);
  try {
    const familySubscriptions = subscriptions.filter((item) => item.familyId === family.id);
    const title = "Today's food duty";
    const body = `${family.name}: your family is assigned food duty for ${formatDate(date, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}.`;
    let pushSucceeded = false;
    let pushFailed = false;
    let pushAlreadyAttempted = false;

    if (!familySubscriptions.length) {
      await deliverOnce({
        date,
        family,
        channel: "push",
        scheduledTime,
        now,
        dedupeKey: `duty:${date}:${family.id}:push:none`,
        detail: "No active push subscriptions are registered for this family.",
        deliver: async () => ({
          status: "not-configured",
          detail: "No push subscription registered.",
        }),
      });
      pushFailed = true;
    } else {
      for (const subscription of familySubscriptions) {
        const result = await deliverOnce({
          date,
          family,
          channel: "push",
          scheduledTime,
          subscriptionId: subscription.id,
          now,
          dedupeKey: `duty:${date}:${family.id}:push:${subscription.id}`,
          detail: "Push notification was queued.",
          deliver: async () => {
            if (subscription.expirationTime && subscription.expirationTime <= now.getTime()) {
              await removeExpiredSubscription(subscription.id);
              return { status: "failed", detail: "Push subscription has expired.", expired: true };
            }
            const result = await sendPush(subscription as PushSubscription, {
              title,
              body,
              url: "/duty",
            });
            if (result.status === "failed" && result.expired) {
              await removeExpiredSubscription(subscription.id);
            }
            return result;
          },
        });
        if (result === "sent") pushSucceeded = true;
        else if (result === "failed" || result === "not-configured") pushFailed = true;
        else if (result === "already-attempted") {
          const existing = (await jsonStore.read("notifications")).find(
            (item) => item.dedupeKey === `duty:${date}:${family.id}:push:${subscription.id}`,
          );
          if (existing?.status === "sent") pushSucceeded = true;
          if (existing?.status === "failed" || existing?.status === "not-configured") {
            pushFailed = true;
          }
          if (existing?.status === "queued" || !existing) pushAlreadyAttempted = true;
        }
      }
    }

    if (!pushAlreadyAttempted && (!pushSucceeded || pushFailed)) {
      const result = await deliverOnce({
        date,
        family,
        channel: "sms",
        scheduledTime,
        now,
        dedupeKey: `duty:${date}:${family.id}:sms`,
        detail: "SMS fallback was queued after push was unavailable or failed.",
        deliver: () =>
          family.contactNumber
            ? sendSms(family.contactNumber, body)
            : Promise.resolve({
                status: "not-configured" as const,
                detail: "Family phone is missing.",
              }),
      });
      return {
        status:
          pushSucceeded || result === "sent"
            ? ("sent" as const)
            : result === "failed"
              ? ("failed" as const)
              : result === "not-configured"
                ? ("not-configured" as const)
                : ("already-attempted" as const),
        dutyDate: date,
        familyId: family.id,
        sms: result,
      };
    }

    if (!pushSucceeded && pushAlreadyAttempted) {
      return {
        status: "already-attempted" as const,
        dutyDate: date,
        familyId: family.id,
      };
    }

    await deliverOnce({
      date,
      family,
      channel: "sms",
      scheduledTime,
      now,
      dedupeKey: `duty:${date}:${family.id}:sms`,
      detail: "Skipped because push delivery succeeded.",
      deliver: async () => ({ status: "skipped" as const, detail: "Push delivery succeeded." }),
    });
    return {
      status: "sent" as const,
      dutyDate: date,
      familyId: family.id,
      sms: "skipped" as const,
    };
  } finally {
    activeDeliveries.delete(deliveryKey);
  }
}

export function assignedFamily(
  date: string,
  families: StoredFamily[],
  records: StoredDuty[],
  anchorDate = "1970-01-01",
): StoredFamily | null {
  const config: RotationConfig = {
    families: families.map((family) => ({ ...family })),
    anchorDate,
    overrides: records.flatMap<DutyOverride>((duty) => {
      if (duty.status === "skipped") return [{ date: duty.date, kind: "skip", note: duty.note }];
      if (duty.status === "overridden" && duty.familyId) {
        return [{ date: duty.date, kind: "reassign", familyId: duty.familyId, note: duty.note }];
      }
      return [];
    }),
  };
  const saved = records.find((item) => item.date === date);
  if (saved?.status === "skipped") return null;
  if ((saved?.status === "completed" || saved?.status === "overridden") && saved.familyId) {
    return families.find((item) => item.id === saved.familyId) ?? null;
  }
  const assigned = getDutyForDate(date, config, todayIST()).family;
  return assigned ? (families.find((item) => item.id === assigned.id) ?? null) : null;
}

type DeliveryStatus = "sent" | "failed" | "not-configured" | "skipped";

async function deliverOnce({
  date,
  family,
  channel,
  scheduledTime,
  subscriptionId,
  now,
  dedupeKey,
  detail,
  deliver,
}: {
  date: string;
  family: StoredFamily;
  channel: "push" | "sms";
  scheduledTime: string;
  subscriptionId?: string;
  now: Date;
  dedupeKey: string;
  detail: string;
  deliver: () => Promise<
    | { status: "sent"; detail: string }
    | { status: "failed"; detail: string; expired?: boolean }
    | { status: "not-configured"; detail: string }
    | { status: "skipped"; detail: string }
  >;
}): Promise<DeliveryStatus | "already-attempted"> {
  const createdAt = now.toISOString();
  const log: NotificationLog = {
    id: randomUUID(),
    dedupeKey,
    dutyDate: date,
    familyId: family.id,
    channel,
    status: "queued",
    createdAt,
    scheduledTime,
    ...(subscriptionId ? { subscriptionId } : {}),
    detail,
  };

  let reserved = false;
  await jsonStore.update("notifications", (logs) => {
    if (logs.some((item) => item.dedupeKey === dedupeKey)) return logs;
    reserved = true;
    return [...logs, log];
  });
  if (!reserved) {
    const existing = (await jsonStore.read("notifications")).find(
      (item) => item.dedupeKey === dedupeKey,
    );
    return existing?.status === "queued"
      ? "already-attempted"
      : (existing?.status ?? "already-attempted");
  }

  let result: Awaited<ReturnType<typeof deliver>>;
  try {
    result = await deliver();
  } catch (error) {
    result = {
      status: "failed",
      detail: (error instanceof Error ? error.message : "Notification delivery failed.").slice(
        0,
        500,
      ),
    };
  }
  const deliveredAt = result.status === "sent" ? new Date().toISOString() : undefined;
  await jsonStore.update("notifications", (logs) =>
    logs.map((item) =>
      item.dedupeKey === dedupeKey
        ? {
            ...item,
            status: result.status,
            detail: result.detail.slice(0, 500),
            ...(deliveredAt ? { deliveredAt } : {}),
          }
        : item,
    ),
  );
  return result.status;
}

async function removeExpiredSubscription(id: string): Promise<void> {
  await jsonStore.update("pushSubscriptions", (subscriptions) =>
    subscriptions.filter((item) => item.id !== id),
  );
}

export function isSchedulerSecretValid(authorization: string | undefined): boolean {
  const expected = env["HMP_SCHEDULER_SECRET"];
  if (!expected || Buffer.byteLength(expected) < 32 || !authorization?.startsWith("Bearer "))
    return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const actual = Buffer.from(expected);
  return supplied.length === actual.length && timingSafeEqual(supplied, actual);
}
