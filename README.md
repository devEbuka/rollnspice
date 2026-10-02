# Roll N Spice

A shawarma shop website built for the HNG internship Lesson 2 individual task.
Browse the menu, keep a cart, sign in with Google, place an order, receive an email receipt, and view your order history.

**Live site:** [rollnspice.vercel.app](https://rollnspice.vercel.app)

## Features and stack

- Next.js 16 App Router, React, JavaScript, and Tailwind CSS.
- Live Supabase menu with featured products and prices displayed in naira (stored in kobo).
- LocalStorage cart with quantities, removal, and recovery from corrupted data.
- Google OAuth with cookie-based sessions refreshed by `src/proxy.js`.
- Authenticated checkout with optional instructions (250 characters maximum).
- Atomic order/line-item writes with server-verified ownership and database price lookup.
- Plain-text and HTML Mailgun receipts; email failure does not undo a placed order.
- Authenticated order history with 20 orders per page and dates in Lagos time.
- Keyboard navigation, labelled controls, focus handling, and reduced-motion support.

## Local setup

Prerequisites: Node.js 20.9 or newer and npm. Development has been verified with Node.js 24.
You also need a hosted Supabase project with Google OAuth and a US-region Mailgun domain.

From the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env.local` and fill in your project credentials. In PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Never commit `.env.local`. The committed template contains variable names only.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser/server session clients; access respects RLS |
| `SUPABASE_SECRET_KEY` | Server only | Reserved privileged key; not needed by current runtime flows |
| `MAILGUN_API_KEY` | Server only | Account API key or sending key for the configured domain |
| `MAILGUN_DOMAIN` | Server only | Exact sending domain from Mailgun |
| `MAILGUN_FROM_EMAIL` | Server only | Sender address belonging to that domain |

Only the two `NEXT_PUBLIC_` variables may reach browser code. The Supabase secret key bypasses RLS; never expose it or use it for user-scoped order operations.
Restart the server after changing environment variables.

## Supabase database

For a new project, apply these SQL files in order through the Supabase SQL Editor or your migration tooling:

1. `supabase/migrations/0001_init.sql` — tables, grants, RLS, and six seeded menu items.
2. `supabase/migrations/0002_create_order.sql` — atomic `create_order` RPC.

The existing project already has both migrations applied. Do not rerun the initial migration against an initialized database; it creates tables and seed records.
See [docs/schema.md](docs/schema.md) for the schema, constraints, policies, and migration status.

Every table has RLS enabled. Products are publicly readable with no public write access; authenticated users can access only their own orders and line items.
The order RPC derives identity from `auth.uid()` and calculates totals from product prices. The API validates the server-side session and accepts only product IDs, quantities, and instructions, never a trusted client-sent user ID or price.

## Google sign-in

For the existing project, Google OAuth is already configured. For a new project:

1. Create a Google OAuth Web application client and configure its consent screen/audience. If it remains in testing, add the accounts that will test sign-in.
2. Add `http://localhost:3000` as an authorized JavaScript origin. Add the production origin when deployed.
3. Use the Supabase Google provider's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as Google's authorized redirect URI.
4. Enable Google in Supabase Authentication providers and save the Google client ID/secret there. They do not belong in this app's public variables.
5. In Supabase Authentication URL Configuration, set the Site URL and allow local app redirects (for example `http://localhost:3000/**`). After deployment, add the production app callback URL, including support for its `next` query parameter, and update the Site URL.

The app callback is `/auth/callback`. The app validates internal return paths and restores checkout/history destinations after sign-in.
Official setup references: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google) and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Mailgun receipts

The current helper uses the US endpoint `https://api.mailgun.net`; an EU domain requires a deliberate endpoint change.
Set the exact domain and its sender address, such as the sandbox postmaster address. Use an API/sending key, not an SMTP password or webhook signing key. Sending uses HTTP Basic Auth with username `api`.

For a sandbox domain, delivery works only to authorized recipients who have verified their email. Sign in with an authorized Google email when testing receipts.
A queued email means Mailgun accepted it, not that inbox delivery is guaranteed. Check spam and Mailgun delivery events if it does not arrive.

If sending fails, checkout shows “Order placed, email unavailable.” The order remains saved and visible in order history; do not place it again just to retry email.

## Run and verify

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A first build needs network access to download the configured Google fonts.

```sh
npm run lint
npm run build
npm run start
```

`start` serves the production build; stop the dev server first if it uses the same port.
Run the order/email regression tests with:

```sh
node --test src/lib/orders/validate.test.js src/lib/orders/route.test.mjs src/lib/orders/email-content.test.js src/lib/orders/confirmation.test.mjs
```

Database verification scripts live in `supabase/tests/`. They create temporary fixtures inside rollback transactions; review and run them through an administrative SQL connection against a test project.

For a manual smoke check, add menu items, change quantities, refresh to check persistence, and enter checkout while signed out. Sign in and confirm return to checkout, submit a test order, check its saved total/reference, receipt, and `/orders` entry. Verify keyboard access and the empty-cart state too.

## Routes and project docs

| Route | Purpose |
| --- | --- |
| `/` | Menu and cart |
| `/sign-in` | Google sign-in |
| `/checkout` | Authenticated checkout |
| `/orders` | Authenticated order history |
| `/auth/callback` | OAuth session exchange |
| `/api/orders` | POST order creation and receipt sending |

[AGENTS.md](AGENTS.md) contains project rules; [TASKS.md](TASKS.md) tracks progress. Layout guidance is in [docs/DESIGN.md](docs/DESIGN.md) and [docs/mockup.html](docs/mockup.html); implementation decisions are in [docs/decisions.md](docs/decisions.md).

The street-food design follows the approved mockup in docs/approved-ui-mockup.png; generated food images are illustrative. There is no payment collection, cancellation, reordering, or durable request idempotency. Following an ambiguous network failure, check history before submitting again. Historical prices are snapshots; product names reflect the current menu record.

Deployed on Vercel with the two public Supabase variables and three server-only Mailgun variables. The current runtime does not require SUPABASE_SECRET_KEY. Supabase uses https://rollnspice.vercel.app as the production Site URL and allows the production app callback, including its return-path query. Redeploy after changing public environment variables. The user verified production Google sign-in, checkout, confirmation email, order history, and sign-out on 2026-10-02.
