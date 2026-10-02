# TASKS.md

## In progress

## Up next
- [ ] Accessibility pass: keyboard access, aria-labels, contrast (per DESIGN.md)
- [ ] README with setup instructions and live link
- [ ] Deploy to Vercel (add env vars there too)

## Done
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
