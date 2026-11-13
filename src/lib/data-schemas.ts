import { z } from "zod";

// Validation contracts are shared by client forms and server handlers; stored data stays private.

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/);

export const familySchema = z.object({
  id: z.string().regex(/^HMP-\d{3,}$/),
  name: z.string().trim().min(1).max(120),
  head: z.string().trim().max(120).default(""),
  contactNumber: phone,
  members: z.number().int().min(1).max(100).default(1),
  mohalla: z.string().trim().max(100).default(""),
  active: z.boolean().default(true),
  order: z.number().int().min(1),
  monthlyFee: z.number().int().min(0).max(1_000_000),
  notificationCodeHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});
export type StoredFamily = z.infer<typeof familySchema>;

export const dutySchema = z.object({
  date: calendarDate,
  familyId: z
    .string()
    .regex(/^HMP-\d{3,}$/)
    .nullable(),
  status: z.enum(["pending", "completed", "overridden", "skipped"]),
  note: z.string().trim().max(500).default(""),
});
export type StoredDuty = z.infer<typeof dutySchema>;

export const foodSchema = z.object({
  id: z.string().uuid(),
  date: calendarDate,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  updatedAt: z.string().datetime(),
});
export type FoodEntry = z.infer<typeof foodSchema>;

export const contributionSchema = z.object({
  id: z.string().uuid(),
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  month: monthKey,
  amount: z.number().int().positive().max(1_000_000),
  method: z.enum(["cash", "upi"]),
  paidOn: calendarDate,
  note: z.string().trim().max(300).default(""),
});
export type StoredContribution = z.infer<typeof contributionSchema>;

export const familyPaymentSchema = z
  .object({
    id: z.string().uuid(),
    familyId: z.string().regex(/^HMP-\d{3,}$/),
    month: monthKey,
    amountDue: z.number().int().min(0).max(1_000_000),
    amountReceived: z.number().int().min(0).max(1_000_000),
    history: z.array(
      z.union([
        z.object({
          id: z.string().uuid(),
          at: z.string().datetime(),
          amountDue: z.number().int().min(0),
          amountReceived: z.number().int().min(0),
          note: z.string().max(300),
        }),
        z.object({
          id: z.string().uuid(),
          at: z.string().datetime(),
          amount: z.number().int().positive().max(1_000_000),
          method: z.enum(["cash", "upi"]),
          note: z.string().max(300),
        }),
      ]),
    ),
  })
  .superRefine((payment, context) => {
    if (payment.amountReceived > payment.amountDue) {
      context.addIssue({
        code: "custom",
        message: "Received amount cannot exceed the amount due.",
        path: ["amountReceived"],
      });
    }
    payment.history.forEach((entry, index) => {
      if ("amountReceived" in entry && entry.amountReceived > entry.amountDue) {
        context.addIssue({
          code: "custom",
          message: "Received amount cannot exceed the amount due.",
          path: ["history", index, "amountReceived"],
        });
      }
    });
  });
export type FamilyPayment = z.infer<typeof familyPaymentSchema>;

export const announcementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(3000),
  date: calendarDate,
  tag: z.enum(["Notice", "Event", "Reminder"]),
  pinned: z.boolean().default(false),
});
export type StoredAnnouncement = z.infer<typeof announcementSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  dedupeKey: z.string().min(1).max(200),
  dutyDate: calendarDate,
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  channel: z.enum(["push", "sms"]),
  status: z.enum(["queued", "sent", "failed", "not-configured", "skipped"]),
  createdAt: z.string().datetime(),
  scheduledTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("08:00"),
  deliveredAt: z.string().datetime().optional(),
  subscriptionId: z.string().uuid().optional(),
  detail: z.string().max(500).default(""),
});
export type NotificationLog = z.infer<typeof notificationSchema>;

export const pushSubscriptionSchema = z.object({
  id: z.string().uuid(),
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  endpoint: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
  keys: z.object({
    p256dh: z.string().min(20).max(256),
    auth: z.string().min(16).max(128),
  }),
  expirationTime: z.number().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PushSubscriptionRecord = z.infer<typeof pushSubscriptionSchema>;

const reminderTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const settingsSchema = z.object({
  anchorDate: calendarDate,
  timezone: z.literal("Asia/Kolkata"),
  reminderTime,
});
export type AppSettings = z.infer<typeof settingsSchema>;

export const datasetSchemas = {
  families: z.array(familySchema),
  duties: z.array(dutySchema),
  food: z.array(foodSchema),
  payments: z.array(familyPaymentSchema),
  contributions: z.array(contributionSchema),
  announcements: z.array(announcementSchema),
  notifications: z.array(notificationSchema),
  pushSubscriptions: z.array(pushSubscriptionSchema),
  settings: settingsSchema,
} as const;

export type DatasetName = keyof typeof datasetSchemas;
export type DatasetValue<K extends DatasetName> = {
  families: StoredFamily[];
  duties: StoredDuty[];
  food: FoodEntry[];
  payments: FamilyPayment[];
  contributions: StoredContribution[];
  announcements: StoredAnnouncement[];
  notifications: NotificationLog[];
  pushSubscriptions: PushSubscriptionRecord[];
  settings: AppSettings;
}[K];

export const emptyDatasets = {
  families: [],
  duties: [],
  food: [],
  payments: [],
  contributions: [],
  announcements: [],
  notifications: [],
  pushSubscriptions: [],
  settings: {
    anchorDate: "2026-01-01",
    timezone: "Asia/Kolkata",
    reminderTime: "08:00",
  },
} satisfies { [K in DatasetName]: DatasetValue<K> };

export const familyInputSchema = familySchema
  .omit({ id: true, order: true, notificationCodeHash: true })
  .extend({ active: z.boolean().default(true) });

export const contributionInputSchema = contributionSchema.omit({ id: true });

export const paymentInputSchema = z.object({
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  month: monthKey,
  amountDue: z.number().int().min(0).max(1_000_000),
  amountPaid: z.number().int().min(0).max(1_000_000),
  method: z.enum(["cash", "upi"]),
  note: z.string().trim().max(300).default(""),
});

export const dutyInputSchema = z.object({
  date: calendarDate,
  familyId: z
    .string()
    .regex(/^HMP-\d{3,}$/)
    .nullable(),
  status: z.enum(["pending", "completed", "overridden", "skipped"]),
  note: z.string().trim().max(500).default(""),
});

export const pushSubscriptionInputSchema = z.object({
  familyId: z.string().regex(/^HMP-\d{3,}$/),
  registrationCode: z.string().min(8).max(64),
  endpoint: pushSubscriptionSchema.shape.endpoint,
  keys: pushSubscriptionSchema.shape.keys,
  expirationTime: pushSubscriptionSchema.shape.expirationTime,
});
