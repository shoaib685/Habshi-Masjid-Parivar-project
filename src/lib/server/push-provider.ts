import { env } from "node:process";
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";

type DeliveryResult =
  | { status: "sent"; detail: string }
  | { status: "failed"; detail: string; expired: boolean }
  | { status: "not-configured"; detail: string };

export function getPushPublicKey(): string | null {
  const key = env["VAPID_PUBLIC_KEY"];
  return key && env["VAPID_PRIVATE_KEY"] && env["VAPID_SUBJECT"] ? key : null;
}

export async function sendPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; url: string },
): Promise<DeliveryResult> {
  const publicKey = env["VAPID_PUBLIC_KEY"];
  const privateKey = env["VAPID_PRIVATE_KEY"];
  const subject = env["VAPID_SUBJECT"];
  if (!publicKey || !privateKey || !subject) {
    return { status: "not-configured", detail: "VAPID keys or subject are not configured." };
  }

  try {
    setVapidDetails(subject, publicKey, privateKey);
    await sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
    return { status: "sent", detail: "Push delivered to device." };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    const expired = statusCode === 404 || statusCode === 410;
    const detail =
      error instanceof Error
        ? error.message.replace(/https?:\/\/\S+/g, "[push endpoint]")
        : "Push failed.";
    return {
      status: "failed",
      detail: `Push provider ${statusCode ? `(${statusCode}) ` : ""}${detail}`.slice(0, 500),
      expired,
    };
  }
}
