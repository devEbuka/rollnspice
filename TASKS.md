# TASKS.md

## In progress


## Up next
- [ ] Review and deploy the website shared-cart integration; mobile synchronization remains a separate task in C:/rollnspice-mobile.

## Done
- [x] Website shared cart and atomic checkout (2026-10-03) — one-time guest merge, durable account-scoped requests, live revision/refetch, offline/reconnect, sign-out isolation and checkout replay recovery. Lint/build, 24 regression tests, local/live SQL tests and real two-session browser checks pass; temporary accounts/order/cart data removed. Prepared locally; production website deployment remains pending.
- [x] Shared cart database foundation — owner RLS, restricted mutation role, snapshot/mutation RPCs, durable retry/merge receipts, revision conflicts, limits and Realtime revision publication; isolated/live rollback and concurrent-request tests, REST denial/exposure checks, lint/build pass. Website/mobile integration and shared checkout remain separate tasks.
- [x] Show an updating quantity badge on the mobile cart icon — additions, stepper quantities, removal, 320px layout, desktop display, lint/build verified
- [x] Move mobile cart beside account controls with an icon-only button — 320px layout, drawer focus restoration, desktop labels, lint/build verified
- [x] Deploy to Vercel — https://rollnspice.vercel.app; user verified production sign-in, checkout, email, history, and sign-out; README updated; lint/build pass
- [x] Implement approved street-food UI mockup across menu, cart, auth, checkout, and history — lint/build and browser checks pass; user accepted the final design after UI refinements
- [x] README with setup instructions — project setup, env/security boundaries, OAuth, Mailgun, commands and routes documented; lint/build pass; verified production URL added
- [x] Order history: authenticated /orders page with own orders, saved line items, and header link — lint/build and signed-out protection pass; authenticated history manually verified by the user
- [x] Accessibility pass: keyboard access, aria-labels, contrast (per DESIGN.md) — keyboard menu/cart/sign-in checks, 320px layout, text contrast, lint/build pass; user verified signed-in checkout focus and keyboard flow
- [x] Mailgun integration: send confirmation email server-side after a successful order — 13 regression tests, lint/build, and browser-secret scan pass; user confirmed delivery works after correcting the Mailgun domain and sender email
- [x] Order API route: create order + order_items in Supabase from the server, using the authenticated session — atomicity/RLS tests, regression tests, lint/build pass; user verified successful checkout, stored ownership/totals/instructions, cart clearing, and rejection of tampered prices
- [x] Checkout page: require auth, show order summary, special instructions field — lint/build and redirect checks pass; authenticated return, summary/instructions, and empty cart manually verified by the user
- [x] Cart: useCart hook (localStorage-backed), CartDrawer UI matching docs/mockup.html — duplicate merging, quantities/removal, totals, persistence, storage recovery, modal keyboard/mobile behavior, and checkout link verified; lint/build pass
- [x] Google sign-in flow: header shows sign-in/sign-out state, auth callback route — lint/build, callback validation, and proxy checks pass; Google session manually verified by the user
- [x] Display the menu on the home page, reading from the products table — live menu, responsive featured cards, shared naira formatting, empty/error states verified; lint/build pass
- [x] Supabase client setup: lib/supabase/client.js (browser) and lib/supabase/server.js (server, cookie-based session) — live browser/server reads verified, getUser rejects forged cookies, lint/build pass
- [x] Create database schema in Supabase (products, orders, order_items) per docs/schema.md, with RLS policies, seeded menu — approved SQL applied; live SQL/RLS checks, lint, and build pass; products manually verified by the user
- [x] Scaffold Next.js app with Tailwind
- [x] Install Supabase client libraries
- [x] Supabase project, Google OAuth, Mailgun accounts set up
- [x] AGENTS.md, DESIGN.md, schema.md written
