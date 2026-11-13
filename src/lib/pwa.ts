import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = "unknown" | "installed" | "available" | "ios" | "manual";

/** Tracks whether the app can be installed to the home screen on this device. */
export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>("unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setState("installed");
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setState(isIOS ? "ios" : "manual");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setState("available");
    };
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setState("installed");
    setDeferred(null);
  };

  return { state, install };
}

export type NotifyState = "unknown" | "unsupported" | "default" | "granted" | "denied" | "in-frame";

export function useNotificationPermission() {
  const [state, setState] = useState<NotifyState>("unknown");

  useEffect(() => {
    if (!("Notification" in window)) setState("unsupported");
    else if (window.top !== window.self && Notification.permission === "default")
      setState("in-frame");
    else setState(Notification.permission);
  }, []);

  const request = async (): Promise<NotificationPermission | null> => {
    if (!("Notification" in window)) return null;
    if (window.top !== window.self) {
      setState("in-frame");
      return null;
    }
    const result = await Notification.requestPermission();
    setState(result);
    return result;
  };

  return { state, request };
}
