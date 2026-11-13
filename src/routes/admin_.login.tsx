import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAdmin } from "@/lib/admin-api";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Habshi Masjid Parivar" },
      {
        name: "description",
        content: "Secure server-verified administrator sign-in for Habshi Masjid Parivar.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Login — Habshi Masjid Parivar" },
      { property: "og:description", content: "Administrator sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    try {
      await loginAdmin({ data: { password: code } });
      await navigate({ to: "/admin" });
    } catch {
      toast.error("Sign-in failed", {
        description: "Check the passcode or try again later.",
      });
    } finally {
      setBusy(false);
      setCode("");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Link
        to="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <div className="surface-hero animate-rise px-6 pb-14 pt-10 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary-foreground/12 ring-1 ring-primary-foreground/25">
          <LockKeyhole className="size-7 text-gold" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold">Admin access</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-primary-foreground/80">
          Enter the administrator password to securely manage community records.
        </p>
      </div>

      <form onSubmit={submit} className="surface-card relative mx-2 -mt-8 p-5 sm:p-6">
        <label
          htmlFor="admin-password"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Admin password
        </label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          autoFocus
          className="h-12 rounded-xl"
        />
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="mt-6 w-full"
          disabled={!code || busy}
        >
          {busy ? "Checking…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Only the masjid administrator signs in. Families don't need accounts.
        </p>
      </form>
    </div>
  );
}
