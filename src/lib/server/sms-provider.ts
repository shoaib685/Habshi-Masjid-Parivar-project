import { env } from "node:process";

type SmsResult =
  | { status: "sent"; detail: string }
  | { status: "failed"; detail: string }
  | { status: "not-configured"; detail: string };

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const provider = env["SMS_PROVIDER"];
  if (!provider) {
    return { status: "not-configured", detail: "SMS provider credentials are not configured." };
  }
  if (provider !== "twilio") {
    return { status: "not-configured", detail: `Unsupported SMS provider "${provider}".` };
  }

  const accountSid = env["TWILIO_ACCOUNT_SID"];
  const authToken = env["TWILIO_AUTH_TOKEN"];
  const from = env["TWILIO_FROM_NUMBER"];
  if (!accountSid || !authToken || !from) {
    return { status: "not-configured", detail: "Twilio credentials or sender number are missing." };
  }

  const recipient = to.replace(/[ ()-]/g, "");
  const normalizedRecipient = /^\d{10}$/.test(recipient)
    ? `+91${recipient}`
    : /^0\d{10}$/.test(recipient)
      ? `+91${recipient.slice(1)}`
      : /^91\d{10}$/.test(recipient)
        ? `+${recipient}`
        : recipient;
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedRecipient)) {
    return { status: "failed", detail: "Family contact number must be a valid E.164 number." };
  }

  const request = new URLSearchParams({ To: normalizedRecipient, From: from, Body: body });
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: request,
      },
    );
    if (!response.ok) {
      return {
        status: "failed",
        detail: `Twilio returned HTTP ${response.status}: ${(await response.text()).slice(0, 350)}`,
      };
    }
    return { status: "sent", detail: "SMS accepted by Twilio." };
  } catch (error) {
    return {
      status: "failed",
      detail: (error instanceof Error ? error.message : "SMS network request failed.").slice(
        0,
        500,
      ),
    };
  }
}
