# AGENTS.md

## Project overview
Roll N Spice: a shawarma shop website with a menu, cart, Google sign-in, and checkout that places an order and sends a confirmation email.
Built with AI as part of the HNG internship Lesson 2 individual task.

## Stack
- Next.js (App Router), JavaScript
- Tailwind CSS
- Supabase: Postgres database, Row Level Security, Google OAuth (already configured in the Supabase dashboard)
- Mailgun: order confirmation emails, sent server-side only (API route), never from the browser
- Deployed on Vercel

## Environment variables
Defined in .env.local (never committed). Template lives in .env.example (committed, values left empty).
- NEXT_PUBLIC_SUPABASE_URL — safe for browser
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — safe for browser, respects RLS
- SUPABASE_SECRET_KEY — server-side only, bypasses RLS, NEVER in client components or NEXT_PUBLIC_ vars
- MAILGUN_API_KEY — server-side only
- MAILGUN_DOMAIN — server-side only
- MAILGUN_FROM_EMAIL — server-side only
Any new env var follows this same NEXT_PUBLIC_ vs server-only split. Ask before adding one.

## Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Production build: `npm run build`
- Preview build: `npm run start`

## Project structure
    src/
      app/
        page.jsx              home / menu
        checkout/page.jsx     checkout page (requires auth)
        auth/callback/route.js  Supabase OAuth callback handler
        api/
          orders/route.js     POST: create order, trigger confirmation email
      components/
        layout/                Header, CartButton
        menu/                  MenuGrid, MenuItemCard
        cart/                  CartDrawer, CartRow
        checkout/              CheckoutForm, OrderSummary
        ui/                    reusable primitives
      hooks/                   useCart, useUser
      lib/
        supabase/
          client.js            browser Supabase client
          server.js             server Supabase client (reads cookies)
        mailgun.js              server-side email sending helper
        constants.js
      styles/
    docs/                       DESIGN.md, decisions.md, schema.md, mockup.html
    public/

## Structure rules
- Never import SUPABASE_SECRET_KEY or any Mailgun variable into a file that runs in the browser (a Client Component or anything imported by one). Both only run in Server Components, API routes, or Server Actions.
- All Supabase calls go through the helpers in lib/supabase/, never instantiate a client ad hoc elsewhere.
- All Mailgun calls go through lib/mailgun.js, called only from an API route or Server Action, never from client code.
- Cart state lives in a hook (useCart), persisted in localStorage until checkout; it does not need to be in the database until an order is actually placed.
- Keep files under ~150 lines; split when they grow.
- Ask before adding a new top-level folder or a new dependency.

## Database rules
- Every table has Row Level Security enabled. No exceptions, even for "simple" tables.
- A user can only read/write their own orders. Products are publicly readable, writable only via the Supabase dashboard (no public write policy).
- Record every schema decision (table, column, policy) in docs/schema.md as you create it, since this is the source of truth, not just what's in the Supabase dashboard.

## Auth rules
- Checkout requires a signed-in user. If a signed-out user reaches /checkout, redirect to sign-in, then back to checkout after success.
- Never trust a user ID sent from the client for anything that touches the database. Always read the authenticated user from the server-side Supabase session.

## Design
- Follow docs/DESIGN.md and docs/mockup.html for layout and structure. Colors are placeholder for now and will likely change later; don't treat the current palette as final, but do follow the layout and spacing patterns.

## How to structure work
- Read TASKS.md, docs/DESIGN.md, and docs/schema.md at the start of every session
- Before writing code for a task, write a short plan (3-5 bullets) and wait for my approval
- Work on one task at a time: move it to "In progress" in TASKS.md, then "Done" when finished
- After finishing, summarize what changed and which files were touched
- Record schema and any non-obvious decision in docs/decisions.md or docs/schema.md as appropriate
- Do not rewrite unrelated files

## Workflow rules
- Before saying a task is done, run `npm run lint` and `npm run build` and fix any errors
- Ask before adding any dependency not already in package.json
- Never commit secrets or .env.local. Keep .env.example in sync when a new variable is added.
- Use clear commit messages (feat:, fix:, chore:)

## Definition of done
- Lint and build pass
- The feature works in the browser against the real Supabase project (not mocked data)
- No secret or server-only variable is reachable from client code
- TASKS.md updated, schema.md updated if the database changed
