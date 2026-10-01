# Decisions

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
