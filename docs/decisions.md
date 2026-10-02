# Decisions

## 2026-10-02 — Google session verification confirmed

- The user confirmed: "Google session check manually verified." This resolves the manual verification pending below. With the previously passing lint, build, callback validation, and proxy checks, the Google sign-in task is now Done.
- Only `TASKS.md` and this verification record were updated. No application code changed or commit was made; the previously passing lint/build results still apply.

## 2026-10-02 — Next.js proxy convention rename

- Checked the installed Next.js 16.3.8 documentation and build discovery: this `src/app` project requires `src/proxy.js`, exporting `proxy`. Replaced root `middleware.js` and the `src/middleware.js` forwarding entry with that single entry point. This supersedes the middleware filename decision below.
- Kept the matcher exactly the same and left `src/lib/supabase/middleware.js` unchanged. The helper filename is not a framework convention. Session validation/refresh still calls `getClaims()`, forwards refreshed cookies to both request and response with their options, preserves SDK headers, and marks responses private/no-store.
- Lint and production build passed with no middleware deprecation warning; the build registers Proxy. In-memory checks confirmed refreshed-cookie/header propagation and identical matcher inclusion/exclusion. Production HTTP checks returned the real menu with HTTP 200 and private/no-store headers; favicon remained outside the matcher. No temporary test files were created.
- This rename preserves the existing refresh implementation; a successful real Google session refresh remains subject to the previously documented manual verification. No other application files, dependencies, environment variables, or task status were changed, and no commit was made.

## 2026-10-02 — Google OAuth flow (manual verification subsequently confirmed above)

- Header identity comes from server-validated `getUser()`. Only the display name/email is passed to the browser; editable profile names are presentation only, never authorization. Signed-out users see one Google button; signed-in users see their name/email and Sign out.
- Google OAuth uses the existing browser helper and a PKCE callback at `/auth/callback`. The current pathname, query, and fragment become the return destination. Shared validation accepts only internal slash-prefixed paths and rejects full URLs, protocol-relative URLs, backslashes, encoded equivalents, controls, and malformed encoding. Failed/cancelled callbacks show `/auth/error` with a validated return link and no raw provider details.
- Sign out calls Supabase `signOut({ scope: "local" })`, which revokes the current session and removes its browser cookies; router refresh then re-reads server identity. Auth events also refresh the header, including sign-outs in another tab. Other devices are intentionally unaffected.
- Session refresh implementation lives in root `middleware.js`, delegating client creation to `src/lib/supabase/middleware.js`. Because this app lives in `src/app`, the installed Next.js build discovers only the `src/middleware.js` entry point. Its matcher mirrors the root matcher and excludes Next assets, common static file types, and favicon. The confirmed build registers middleware. Next.js 16 emits a deprecation warning for this requested filename; no migration to proxy was made.
- Middleware validates/refreshes tokens via `getClaims()`, updates both request and response cookies, preserves SDK cache headers, and marks auth-aware responses private/no-store. Server identity still uses remote `getUser()` validation. Only the public URL and publishable key are used; no dependency, environment, schema, checkout, or cart changes were made.
- Validation passed: return-path allow/deny checks, lint, final production build, live six-product signed-out page, Google button navigation, missing/invalid-code callback handling, external-return rejection, and internal `/checkout?from=menu` return preservation. No temporary app scaffolding or commits were added.
- Successful Google sign-in, session persistence/refresh, authenticated header, and sign-out remain unverified: browser security explicitly denied access to `accounts.google.com`. The task stays In progress until the user manually verifies those flows. Production preview runs at `http://localhost:3011` for that verification.
- Documentation: https://supabase.com/docs/guides/auth/server-side/creating-a-client and https://supabase.com/docs/guides/auth/social-login/auth-google. The skill-required changelog fetch and MCP documentation search were unavailable (DNS/transport errors); current official web documentation and installed library/framework source were used.

## 2026-10-01 — Initial database migration (approved and applied)

- Save the migration at `supabase/migrations/0001_init.sql`, as requested, and apply the reviewed SQL through the Supabase plugin.
- Seed the six exact mockup names, descriptions, and prices; store prices in kobo. Categories use lowercase mockup tags; only The Original Beef Roll is featured.
- Keep the documented `timestamp` columns and default foreign-key deletion behavior (no cascading deletes).
- Reject negative money values and non-positive quantities. Index order ownership and line-item foreign keys.
- Explicitly revoke client privileges and grant back public product reads and authenticated order/line-item SELECT and INSERT. RLS restricts order access to the session owner; no client UPDATE or DELETE access.
- Order creation must later derive identity from the server session and calculate prices/subtotal from products; RLS ownership alone does not validate monetary totals.
- Verification: lint/build passed; live transactional SQL checks in `supabase/tests/0001_rls.sql` confirmed public reads, owner SELECT/INSERT, cross-user isolation, denied client writes, and numeric constraints. All test users/orders/items were rolled back. The live public Data API also returned all six correct products using the publishable key.
- Automated browser verification of the public Data API was blocked by `ERR_BLOCKED_BY_CLIENT`. On 2026-10-01, the user manually verified the products table matches the reported seed data and approved marking the schema task Done.
- Advisors reported existing `public.rls_auto_enable()` SECURITY DEFINER execute grants, which need separate review. The initial migration creates no functions. Newly created indexes were reported unused before traffic, so they are retained.
  - Function guidance: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Known limitation (no action required): leaked-password protection is available on Supabase Pro plans and above, not the current free plan. This app uses Google OAuth only and has no password authentication, so the disabled-protection advisory does not materially affect it. No plan upgrade or Auth setting change is needed for this app.

## 2026-10-02 — Supabase client helpers

- `src/lib/supabase/client.js` exports `createClient()` using `createBrowserClient` from the installed `@supabase/ssr`. The library manages its browser singleton.
- `src/lib/supabase/server.js` exports async `createClient()` using `createServerClient` and `await cookies()` for a fresh client on every call. No server client or session is shared globally. Both helpers use only the public URL and publishable key, preserving RLS.
- The server module imports `server-only`, which Next.js handles internally without adding a dependency, to prevent accidental imports into browser code.
- `getUser()` calls `supabase.auth.getUser()` to obtain a server-validated user, rather than trusting the cookie's stored user or a client-sent ID. Missing sessions and HTTP 401/403 auth failures return null; other errors propagate so outages are not mistaken for sign-outs.
- Cookie `getAll`/`setAll` adapters preserve Supabase cookie options. Only Next.js's read-only Server Component cookie-write error is suppressed; other write errors propagate. Session-refresh proxy integration belongs to the later Google sign-in task, since Server Components cannot persist refreshed cookies.
- Temporary verification code confirmed both helpers read six real products, separate server client instances, a null signed-out user, rejection of a fabricated session cookie, and a subsequent signed-out request. Browser logs had no errors/warnings; 40 browser chunks/maps contained no server-only env values. All temporary routes/components were removed and the dev server stopped.
- Final lint and production build passed. No auth callback, permanent UI, new dependencies, env vars, schema changes, or commits were added. A valid signed-in Google session will be verified during the auth task.

## 2026-10-02 — Home page menu

- The home page reads only the six display fields from `products` through the existing request-scoped server helper. Products sort by `featured` descending, then name ascending for a stable order; no product name controls featured styling.
- `MenuGrid.jsx` owns the responsive grid and distinct empty/error messages; `MenuItemCard.jsx` owns each card. Featured cards span two columns above 560px and stack on mobile. Desktop uses three columns above 860px; tablet uses two.
- `src/lib/format.js` exports `formatPrice(kobo)` using one `Intl.NumberFormat` for NGN. Whole naira omit decimals; fractional kobo remain visible up to two decimals. This helper is reusable by cart and checkout.
- Header and hero follow the mockup. Fraunces/Inter use `next/font`; the warm palette remains provisional. Muted/spice colors were darkened for contrast, with the lowest tested text/background pair at 5.18:1. Focus outlines, skip navigation, and reduced-motion styles are included.
- Add-to-cart and header cart buttons are inert with `aria-disabled`, retaining keyboard focus. Cart count is zero until the cart task supplies real state. Auth and cart behavior remain separate tasks.
- Fetch failures show a clear generic message without database details. `unstable_rethrow` preserves Next.js internal control flow inside the catch block, so request cookie access correctly keeps the home route dynamic in production.
- Browser verification confirmed all six real menu names/descriptions/prices, desktop/tablet/mobile layout (including 320px and 390px with no horizontal overflow), featured span, keyboard focus, and no console errors/warnings. Temporary read-only Supabase queries exercised empty and error messages; the verification route was removed without changing data.
- Shared formatter checks, lint, production build, and final production browser verification passed. No dependencies, environment variables, schema changes, or commits were added.
