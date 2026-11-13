import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredDuty, StoredFamily } from "../data-schemas";
import { assignedFamily, isSchedulerSecretValid, runDutyReminder } from "./duty-notifications";

const mocks = vi.hoisted(() => ({
  datasets: {} as Record<string, unknown>,
  sendPush: vi.fn(),
  sendSms: vi.fn(),
}));

vi.mock("./store", () => ({
  jsonStore: {
    read: vi.fn(async (name: string) => structuredClone(mocks.datasets[name])),
    update: vi.fn(async (name: string, mutate: (current: unknown) => unknown) => {
      mocks.datasets[name] = mutate(structuredClone(mocks.datasets[name]));
      return structuredClone(mocks.datasets[name]);
    }),
  },
}));
vi.mock("./push-provider", () => ({ sendPush: mocks.sendPush }));
vi.mock("./sms-provider", () => ({ sendSms: mocks.sendSms }));

const families: StoredFamily[] = [
  {
    id: "HMP-001",
    name: "Family One",
    head: "",
    contactNumber: "+919876543210",
    members: 4,
    mohalla: "",
    active: true,
    order: 1,
    monthlyFee: 500,
  },
  {
    id: "HMP-002",
    name: "Family Two",
    head: "",
    contactNumber: "+919876543211",
    members: 3,
    mohalla: "",
    active: true,
    order: 2,
    monthlyFee: 500,
  },
  {
    id: "HMP-003",
    name: "Inactive Family",
    head: "",
    contactNumber: "+919876543212",
    members: 2,
    mohalla: "",
    active: false,
    order: 3,
    monthlyFee: 500,
  },
];

const originalSchedulerSecret = process.env["HMP_SCHEDULER_SECRET"];

beforeEach(() => {
  mocks.datasets = {
    families: [families[0], families[1]],
    duties: [],
    pushSubscriptions: [],
    notifications: [],
    settings: { anchorDate: "2026-01-01", reminderTime: "08:00", timezone: "Asia/Kolkata" },
  };
  mocks.sendPush.mockReset();
  mocks.sendSms.mockReset();
});

afterEach(() => {
  if (originalSchedulerSecret === undefined) delete process.env["HMP_SCHEDULER_SECRET"];
  else process.env["HMP_SCHEDULER_SECRET"] = originalSchedulerSecret;
});

describe("duty reminder targeting", () => {
  it("uses the active family's sequential assignment", () => {
    expect(assignedFamily("2026-01-01", families, [], "2026-01-01")?.id).toBe("HMP-001");
    expect(assignedFamily("2026-01-02", families, [], "2026-01-01")?.id).toBe("HMP-002");
  });

  it("honors a saved reassignment and never targets a skipped day", () => {
    const duties: StoredDuty[] = [
      { date: "2026-01-01", familyId: "HMP-002", status: "overridden", note: "Swap" },
      { date: "2026-01-02", familyId: null, status: "skipped", note: "No duty" },
    ];

    expect(assignedFamily("2026-01-01", families, duties, "2026-01-01")?.id).toBe("HMP-002");
    expect(assignedFamily("2026-01-02", families, duties, "2026-01-01")).toBeNull();
  });

  it("sends push only to the assigned family's subscriptions", async () => {
    mocks.datasets["pushSubscriptions"] = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        familyId: "HMP-002",
        endpoint: "https://push.example/two",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        familyId: "HMP-001",
        endpoint: "https://push.example/one",
        keys: { p256dh: "key", auth: "auth" },
        expirationTime: null,
      },
    ];
    mocks.sendPush.mockResolvedValue({ status: "sent", detail: "accepted" });

    await runDutyReminder("2026-01-01", "08:00", new Date("2026-01-01T02:30:00.000Z"));

    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.sendPush.mock.calls[0]?.[0].endpoint).toBe("https://push.example/one");
    expect(mocks.sendSms).not.toHaveBeenCalled();
  });

  it("uses SMS fallback after push failure and does not send duplicate attempts", async () => {
    mocks.datasets["pushSubscriptions"] = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        familyId: "HMP-001",
        endpoint: "https://push.example/one",
        keys: { p256dh: "key", auth: "auth" },
        expirationTime: null,
      },
    ];
    mocks.sendPush.mockResolvedValue({ status: "failed", detail: "provider unavailable" });
    mocks.sendSms.mockResolvedValue({ status: "sent", detail: "accepted" });

    await runDutyReminder("2026-01-01", "08:00", new Date("2026-01-01T02:30:00.000Z"));
    await runDutyReminder("2026-01-01", "08:00", new Date("2026-01-01T02:31:00.000Z"));

    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.sendSms).toHaveBeenCalledTimes(1);
    expect(mocks.datasets["notifications"]).toHaveLength(2);
  });

  it("rejects absent and weak scheduler secrets and accepts an exact strong bearer token", () => {
    delete process.env["HMP_SCHEDULER_SECRET"];
    expect(isSchedulerSecretValid("Bearer secret")).toBe(false);
    process.env["HMP_SCHEDULER_SECRET"] = "short";
    expect(isSchedulerSecretValid("Bearer short")).toBe(false);

    const secret = "a".repeat(32);
    process.env["HMP_SCHEDULER_SECRET"] = secret;
    expect(isSchedulerSecretValid(`Bearer ${secret}`)).toBe(true);
    expect(isSchedulerSecretValid(`Bearer ${secret}x`)).toBe(false);
  });
});
