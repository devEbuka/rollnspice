# TASKS.md

## In progress
- (nothing yet)

## Up next
- [ ] Display the menu on the home page, reading from the products table
- [ ] Google sign-in flow: header shows sign-in/sign-out state, auth callback route
- [ ] Cart: useCart hook (localStorage-backed), CartDrawer UI matching docs/mockup.html
- [ ] Checkout page: require auth, show order summary, special instructions field
- [ ] Order API route: create order + order_items in Supabase from the server, using the authenticated session
- [ ] Mailgun integration: send confirmation email server-side after a successful order
- [ ] Accessibility pass: keyboard access, aria-labels, contrast (per DESIGN.md)
- [ ] README with setup instructions and live link
- [ ] Deploy to Vercel (add env vars there too)

## Done
- [x] Supabase client setup: lib/supabase/client.js (browser) and lib/supabase/server.js (server, cookie-based session) — live browser/server reads verified, getUser rejects forged cookies, lint/build pass
- [x] Create database schema in Supabase (products, orders, order_items) per docs/schema.md, with RLS policies, seeded menu — approved SQL applied; live SQL/RLS checks, lint, and build pass; products manually verified by the user
- [x] Scaffold Next.js app with Tailwind
- [x] Install Supabase client libraries
- [x] Supabase project, Google OAuth, Mailgun accounts set up
- [x] AGENTS.md, DESIGN.md, schema.md written
