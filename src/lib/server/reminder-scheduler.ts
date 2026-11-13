import { runDueDutyReminders } from "./duty-notifications";

export function startReminderScheduler(intervalMs = 15_000): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void runDueDutyReminders()
      .catch((error: unknown) => {
        console.error("Duty reminder scheduler failed.", error);
      })
      .finally(() => {
        running = false;
      });
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
