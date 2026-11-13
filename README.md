# Habshi Masjid Parivar

A mobile-first installable PWA for the Habshi Masjid community in Jalore, Rajasthan. Public visitors can see the food-duty rotation, community announcements, and voluntary contribution totals. One administrator manages families, duties, mandatory monthly fees, voluntary contributions, and app settings.

## Requirements

- Node.js 22 or later
- pnpm
- A Node.js host with a persistent, writable disk volume

The app uses private JSON files for storage. Do **not** deploy it to Cloudflare Workers, serverless functions, or an ephemeral filesystem. Run one Node server process against one persistent data directory; the file store does not coordinate writes between multiple processes or replicas.

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env
pnpm generate:admin-hash
pnpm generate:session-secret
```

The password generator reads the administrator password without echoing it and requires at least 12 characters. Copy its `ADMIN_PASSWORD_HASH=...` output into `.env`; copy the generated `ADMIN_SESSION_SECRET=...` value there too. Keep `.env` private and never commit or expose these values. The session secret must be at least 32 bytes.

Then start the app:

```powershell
pnpm dev
```

## Production deployment

1. Configure `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` as private host environment variables. Do not rely on a committed `.env` file in production.
2. Mount a persistent writable volume and set `HMP_DATA_DIR` to its path. Keep this directory outside the web root; it contains private family contact and payment records.
3. Configure push and SMS providers if wanted (see below).
4. Configure a unique random `HMP_SCHEDULER_SECRET` (at least 32 bytes) for the secured cron endpoint. Generate a fresh value with `pnpm generate:session-secret`; do not reuse the admin session secret.
5. Build and start the Node server:

   ```sh
   pnpm install
   pnpm build
   pnpm start
   ```

6. Serve the app over HTTPS. Configure the trusted reverse proxy to set the client IP header used for login throttling.
7. Keep a separate encrypted off-host backup of the data volume. The app also keeps up to 10 private, per-file backups when datasets are updated; the admin can export a complete JSON backup while signed in.

## Push notifications

1. Generate keys locally with `pnpm generate:vapid-keys`.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as host environment variables. Keep the private key server-side; `VAPID_SUBJECT` should be a valid `mailto:` or HTTPS contact URI. Never put the private key in `VITE_*` variables.
3. In Admin → Families, generate a one-time notification setup code and share it privately with that family. Members enter the permanent Family ID and setup code under Settings → Notifications on each device.
4. Use HTTPS and a supported browser/PWA. On Apple devices, Web Push requires iOS/iPadOS 16.4 or newer and the app added to the Home Screen. Permission is requested only after the member taps the enable button.

The browser receives only the VAPID public key. Push subscriptions and their endpoint keys stay in the private `push-subscriptions.json` dataset. Daily jobs resolve the assigned Family ID and target only that family's registered devices. Expired push endpoints are removed. A new endpoint cannot be reassigned to another family without that family's current enrollment code.

## SMS fallback

The SMS provider adapter currently supports Twilio. Set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` as private environment variables. Ensure family contact numbers are usable by the account (prefer E.164, e.g. `+91...`) and that the account is approved for the destination.

Without all provider values, SMS logs are marked `not-configured`; no text is sent. SMS is attempted only when push delivery is missing or fails. The current adapter records provider acceptance/failure; provider delivery receipts/webhooks are not integrated.

## Daily scheduler

The persistent Node process starts an in-process scheduler that reads `settings.json` every 15 seconds. It uses the configured local `Asia/Kolkata` wall-clock time, so changing the AM/PM controls in Admin takes effect without a restart or redeploy. A restart reloads the setting and will run a missed reminder for the current day once the process is back up. Delivery reservations are stored before calling providers to prevent duplicate attempts.

For platforms that suspend application processes or do not guarantee long-running timers, configure a cron job to POST to `/api/scheduler/duty-reminders` every minute:

```sh
* * * * * curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $HMP_SCHEDULER_SECRET" \
  https://your-host.example/api/scheduler/duty-reminders
```

Keep the secret in the cron provider's secret store. The endpoint rejects missing/invalid authorization and does nothing until the configured IST reminder time. Use one Node process and one persistent data volume; multiple processes do not share file locks or in-memory scheduler state.

This repository does not yet include a deployment-provider configuration. Confirm that the selected host supports a persistent Node process and disk before deploying.

## Data and privacy

- Public pages do not expose family phone numbers, member counts, monthly fee settings, individual mandatory fee balances, or individual voluntary contribution records.
- Voluntary contributions and mandatory family fees are separate ledgers. The public contribution page shows only aggregate voluntary totals.
- Mandatory family payments are entered as individual cash or UPI transactions; the private monthly ledger retains their history.
- Admin access uses a server-verified scrypt password hash, an HMAC-signed `HttpOnly` session cookie, and process-local login throttling. Use a single application process; the throttling store is not shared across replicas.
- Family records are deactivated rather than deleted, preserving historical schedules.
- Admin JSON export includes private data. Store downloads and volume backups securely.

## Feature status

- Installable PWA manifest, app icons, service-worker registration, and an offline navigation fallback are configured.
- Web Push/VAPID, family registration codes, SMS fallback adapter, secured cron endpoint, in-process Node scheduler, and private delivery logs are implemented. They remain inactive until configured provider credentials and an appropriate host are tested.
- The scheduled job reserves each family/date/channel attempt in `notifications.json` before sending. A crash during provider delivery can leave a `queued` record; queued attempts are not retried automatically, favoring no duplicates over automatic retries.
- PDF reports are not implemented yet.
- JSON backups and authenticated export are available; automated off-host backup and restore tooling are not configured.
- The backend is intended for persistent Node hosting. It is not deployable as-is to the project's former Cloudflare Worker target.
