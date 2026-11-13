<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Domain logic (duty rotation, contribution totals, IST date helpers) lives as pure functions in `src/lib/` with tests beside them; UI never re-implements these rules — keeps preview and future backend consistent.
- Calendar days are `YYYY-MM-DD` strings in Asia/Kolkata (`src/lib/date.ts`); never use the device's local timezone — the community is in one city.
- App shell (top bar, bottom tabs, desktop rail) is `src/components/app/AppShell.tsx`, rendered from `__root.tsx`; new top-level pages are added to its NAV list.
- PWA is manifest-only (`public/manifest.webmanifest`, icons, iOS splash images); no app-shell service worker unless offline support is requested. A push-messaging worker is allowed when notifications are wired.
