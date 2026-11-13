import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Download,
  Info,
  MapPin,
  Share,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionTitle } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  getPublicPushConfig,
  removeFamilyPushSubscription,
  subscribeFamilyPush,
} from "@/lib/admin-api";
import { useInstallPrompt, useNotificationPermission } from "@/lib/pwa";
import { MASJID } from "@/lib/site-config";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Habshi Masjid Parivar" },
      {
        name: "description",
        content: "Install the Habshi Masjid Parivar app, manage reminders and open admin access.",
      },
      { property: "og:title", content: "Settings — Habshi Masjid Parivar" },
      { property: "og:description", content: "Install the app and manage reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const install = useInstallPrompt();
  const notify = useNotificationPermission();
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getPublicPushConfig()
      .then(({ publicKey }) => {
        if (active) setPushPublicKey(publicKey);
      })
      .catch((error: unknown) => console.error("Could not load push configuration.", error));
    if ("serviceWorker" in navigator && "PushManager" in window) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => {
          if (active) setPushSubscription(subscription);
        })
        .catch((error: unknown) =>
          console.error("Could not inspect this device's push setup.", error),
        );
    }
    return () => {
      active = false;
    };
  }, []);

  const enablePush = async () => {
    if (!pushPublicKey) {
      toast.error("Push notifications are not configured on this server.");
      return;
    }
    if (!familyId.trim() || !registrationCode.trim()) {
      toast.error("Enter your Family ID and notification setup code.");
      return;
    }
    setPushBusy(true);
    try {
      let permission = notify.state;
      if (permission !== "granted") permission = (await notify.request()) ?? "default";
      if (permission !== "granted") {
        toast.error(
          permission === "denied"
            ? "Allow notifications in your browser's site settings."
            : "Notification permission was not granted.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(pushPublicKey),
        }));
      const values = subscription.toJSON();
      if (!values.endpoint || !values.keys?.["p256dh"] || !values.keys["auth"]) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      await subscribeFamilyPush({
        data: {
          familyId: familyId.trim().toUpperCase(),
          registrationCode: registrationCode.trim(),
          endpoint: values.endpoint,
          keys: { p256dh: values.keys["p256dh"], auth: values.keys["auth"] },
          expirationTime: subscription.expirationTime,
        },
      });
      setPushSubscription(subscription);
      setRegistrationCode("");
      toast.success("This device is registered for its family's duty reminders.");
    } catch (error) {
      toast.error("Could not enable push notifications", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    if (!pushSubscription) return;
    if (!familyId.trim() || !registrationCode.trim()) {
      toast.error("Enter your Family ID and notification setup code to disable this device.");
      return;
    }
    setPushBusy(true);
    try {
      await removeFamilyPushSubscription({
        data: {
          familyId: familyId.trim().toUpperCase(),
          registrationCode: registrationCode.trim(),
          endpoint: pushSubscription.endpoint,
        },
      });
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
      setRegistrationCode("");
      toast.success("Push notifications disabled on this device.");
    } catch (error) {
      toast.error("Could not disable push notifications", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="App" title="Settings" />

      <SectionTitle>Install the app</SectionTitle>
      <div className="surface-card p-5">
        <div className="flex items-start gap-4">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-foreground">{MASJID.shortName}</p>
            <p className="text-sm text-muted-foreground">
              Add to your home screen and open it like any other app.
            </p>
          </div>
        </div>
        <div className="mt-4">
          {install.state === "installed" && (
            <p className="rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
              Installed on this device
            </p>
          )}
          {install.state === "available" && (
            <Button variant="hero" size="lg" className="w-full" onClick={install.install}>
              <Download /> Install app
            </Button>
          )}
          {install.state === "ios" && (
            <ol className="space-y-2 rounded-xl bg-muted p-4 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <span className="font-semibold">1.</span> Tap{" "}
                <Share className="inline size-4 text-primary" /> Share in Safari
              </li>
              <li>
                <span className="font-semibold">2.</span> Choose{" "}
                <span className="font-semibold">Add to Home Screen</span>
              </li>
            </ol>
          )}
          {(install.state === "manual" || install.state === "unknown") && (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              <Smartphone className="mr-1.5 inline size-4 text-primary" />
              Open this app in Chrome on your phone, then tap the menu (⋮) and choose{" "}
              <span className="font-semibold text-foreground">Install app</span> or{" "}
              <span className="font-semibold text-foreground">Add to Home screen</span>.
            </p>
          )}
        </div>
      </div>

      <SectionTitle>Notifications</SectionTitle>
      <div className="surface-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Family-specific duty reminders</p>
            <p className="text-sm text-muted-foreground">
              {notify.state === "granted" && "Notifications are allowed on this device."}
              {notify.state === "denied" && "Blocked — allow them in your browser's site settings"}
              {notify.state === "unsupported" && "Not supported in this browser"}
              {notify.state === "in-frame" && "Open the app in its own tab to allow notifications"}
              {(notify.state === "default" || notify.state === "unknown") &&
                "Subscribe this device to receive reminders for one family, even when the app is closed."}
            </p>
          </div>
        </div>
        {!pushPublicKey && (
          <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Push delivery is not configured on this server yet.
          </p>
        )}
        {pushPublicKey ? (
          <div className="mt-4 space-y-3">
            {pushSubscription && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-success">
                  This device has an existing push subscription.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pushBusy || !familyId.trim() || !registrationCode.trim()}
                  onClick={disablePush}
                >
                  {pushBusy ? "Updating…" : "Disable on this device"}
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {pushSubscription
                ? "Enter the family credentials to link or update this device."
                : "Ask the administrator for your permanent Family ID and a notification setup code."}
            </p>
            <label className="block text-sm font-medium text-foreground">
              Family ID
              <input
                value={familyId}
                onChange={(event) => setFamilyId(event.target.value)}
                placeholder="HMP-001"
                autoCapitalize="characters"
                autoComplete="off"
                className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Notification setup code
              <input
                type="password"
                value={registrationCode}
                onChange={(event) => setRegistrationCode(event.target.value)}
                autoComplete="one-time-code"
                className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3"
              />
            </label>
            <Button
              variant="hero"
              className="w-full"
              disabled={pushBusy || notify.state === "unsupported" || notify.state === "in-frame"}
              onClick={enablePush}
            >
              {pushBusy
                ? "Enabling…"
                : pushSubscription
                  ? "Update family registration"
                  : "Enable family notifications"}
            </Button>
          </div>
        ) : null}
      </div>

      <SectionTitle>About</SectionTitle>
      <div className="surface-card divide-y divide-border text-sm">
        <Row icon={<Info className="size-4" />} label="Community" value={MASJID.name} />
        <Row icon={<MapPin className="size-4" />} label="Location" value={MASJID.city} />
        <Row icon={<Bell className="size-4" />} label="Time zone" value="India (IST)" />
      </div>

      <SectionTitle>Administration</SectionTitle>
      <Link
        to="/admin/login"
        className="surface-card flex items-center gap-3 p-5 transition-transform active:scale-[0.99]"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Admin login</p>
          <p className="text-sm text-muted-foreground">For the masjid administrator only</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Version 1.0 · Made for the Habshi Masjid community
      </p>
    </>
  );
}

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
