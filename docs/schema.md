# schema.md

Source of truth for the database schema. Update this whenever a table, column, or policy changes in Supabase, don't rely on the dashboard alone as the record.

Applied SQL: `supabase/migrations/0001_init.sql`.

## Atomic order RPC
- Migration: `supabase/migrations/0002_create_order.sql` (applied 2026-10-02).
- `public.create_order(p_items jsonb, p_special_instructions text default null)` returns JSON `{id, subtotal, status}`. SECURITY INVOKER with an empty search path; authenticated callers retain existing RLS restrictions. PUBLIC/anon execution is revoked; authenticated execution is granted.
- Ownership comes only from `auth.uid()`. No user ID, price, subtotal, or status argument is accepted. Product prices are read in the database and copied to line items; missing products abort the whole operation and return their IDs in error details.
- Validates 1–100 unique UUID product IDs, integer quantities 1–99, instructions at most 250 characters, and subtotal within the existing integer column's range. Order and line-item inserts are in one function transaction; any error rolls back both. No table, column, or policy changes.

## products
Public menu, read-only from the app.
| column      | type      | notes                              |
|-------------|-----------|-------------------------------------|
| id          | uuid      | primary key, default gen_random_uuid() |
| name        | text      | not null                            |
| description | text      |                                      |
| price       | integer   | kobo (₦4,500 = 450000), not null    |
| category    | text      | e.g. signature, classic, side, drink |
| featured    | boolean   | default false                       |
| created_at  | timestamp | default now()                       |

RLS: public SELECT. No public INSERT/UPDATE/DELETE (managed via Supabase dashboard only).

## orders
| column               | type      | notes                                  |
|----------------------|-----------|------------------------------------------|
| id                   | uuid      | primary key, default gen_random_uuid()  |
| user_id              | uuid      | references auth.users(id), not null     |
| status               | text      | default 'pending'                       |
| subtotal             | integer   | kobo, not null                          |
| special_instructions | text      | nullable                                |
| created_at           | timestamp | default now()                           |

RLS: a user may SELECT/INSERT rows where user_id = auth.uid(). No UPDATE/DELETE policy needed yet.

## order_items
Line items per order. Snapshots unit_price at order time so later menu price changes don't alter historical orders.
| column      | type      | notes                                   |
|-------------|-----------|-------------------------------------------|
| id          | uuid      | primary key, default gen_random_uuid()   |
| order_id    | uuid      | references orders(id), not null          |
| product_id  | uuid      | references products(id), not null        |
| quantity    | integer   | not null, > 0                            |
| unit_price  | integer   | kobo, not null, snapshot at order time   |

RLS: a user may SELECT/INSERT rows where the parent order's user_id = auth.uid() (via a policy that checks EXISTS against orders).

## Status log
- 2026-10-02 — Applied `0002_create_order.sql` through the Supabase plugin. Confirmed SECURITY INVOKER, empty search path, anonymous execution denied, authenticated execution granted, and unchanged table RLS. Live rollback tests confirmed atomic order/items, trusted prices/ownership, missing-product error details, validation, and cross-user isolation. All test fixtures and temporary privilege changes were rolled back.
- 2026-10-01 — User manually verified the products table matches the reported seed data and approved marking the schema task Done.
- 2026-10-01 — Applied `0001_init.sql` through the Supabase plugin to `hng-shop` (`kojdjmchgcqeqbnonruk`). Confirmed three tables, RLS on every table, five policies, explicit client grants, constraints, and all six exact mockup menu items with prices in kobo. Transactional RLS allow/deny tests passed; test fixtures were rolled back.

## Initial migration details
- All three tables enable RLS. Client roles receive only the grants described above; `service_role` retains full server-side access.
- `price`, `subtotal`, and `unit_price` reject negative values; `quantity` must be positive.
- Indexes: `orders(user_id)`, `order_items(order_id)`, `order_items(product_id)`.
- Timestamps use `timestamp` as documented. Foreign keys use default NO ACTION deletion behavior.
- Seed: the six exact menu items from `docs/mockup.html`, with naira multiplied by 100 for kobo, lowercase category tags, and only The Original Beef Roll featured.

## Shared cart foundation (2026-10-02)

Applied migrations: `20261002171122_shared_cart.sql` and `20261002172841_shared_cart_auth_identity.sql`. File timestamps match hosted migration history. Both were initially generated with the Supabase CLI and renamed to the versions assigned by the hosted migration tool.

- `public.carts`: `user_id uuid` PK/FK to auth.users (ON DELETE CASCADE), `revision bigint` nonnegative/default 0, `updated_at timestamptz` default now().
- `public.cart_items`: `(user_id, product_id)` composite PK, user FK to carts and product FK to products (both ON DELETE CASCADE), integer quantity 1–99. Product-ID index supports catalogue deletion. The insert/update guard locks the owner cart and enforces at most 100 distinct products; ownership/product IDs cannot be reassigned. An AFTER trigger advances revision/updated_at for each changed row, including deleted catalogue items.
- `public.cart_operations`: `(user_id, operation_id)` composite PK, user FK to carts ON DELETE CASCADE, request/result JSONB, created_at timestamptz. Durable successful-operation receipts prevent duplicate retries; no retention cleanup is enabled. Results include the historical product snapshot; clients must refetch after a replay to obtain current quantities/prices.
- All three tables enable RLS. Authenticated users have owner-only SELECT policies and no direct INSERT/UPDATE/DELETE grants. Anonymous/PUBLIC table access is revoked. The service role retains server-side access.
- `rollnspice_cart_writer` is NOLOGIN, NOINHERIT, NOBYPASSRLS, and owns only the private mutation function, not tables. Client roles are not members. It has explicit cart write privileges and owner-bound policies, plus SELECT/public-read policy on products. `postgres` has membership to maintain the function. No client grant allows switching to this role.
- `rollnspice_private` is not exposed through the REST API; client CREATE is denied. `cart_uid()` is a private, postgres-owned, read-only SECURITY DEFINER bridge to auth.uid(), with an empty search path, anonymous/PUBLIC execution revoked, and execution granted only to authenticated and the writer. It solves hosted Supabase's protected auth-schema USAGE restriction without giving the writer broad auth privileges. It performs no table reads/writes. Mutation remains subject to writer RLS.
- Public RPCs `get_cart()` and `mutate_cart(uuid,text,jsonb,bigint)` are SECURITY INVOKER with empty search paths. Anonymous/PUBLIC execution is revoked; authenticated execution is explicit. Identity is from auth.uid() via the bridge; no user-ID parameter is accepted. The private mutation function is SECURITY DEFINER owned by the non-bypass writer, validates inputs, and locks the owner's cart row to serialize requests.
- Supabase Realtime publishes only `public.carts` among the new tables. Subscribe to your owner row and refetch the authoritative snapshot; do not treat events as complete cart contents.
- Website/mobile UI and checkout remain unchanged. Shared-cart order creation/clearing requires its own next milestone.

Verification: isolated PostgreSQL tests; same live SQL rollback suite; simultaneous live additions, duplicate merge, and stale-set requests; anonymous REST denial and private-schema exclusion; website lint/build. Test fixtures were rolled back or explicitly removed and all new cart tables ended empty. Existing six products and seven orders were preserved.

Advisor follow-ups unrelated to cart functions: existing `public.rls_auto_enable()` has anonymous/authenticated SECURITY DEFINER execute grants; leaked-password protection is disabled. References: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . These were recorded, not changed under this cart task. The new FK product index is currently unused because clients are not integrated; retain it for cascade/delete checks.

## Shared-cart checkout and website integration (2026-10-03)

Applied migration: `20261002182854_shared_cart_checkout.sql`, generated with the CLI and renamed to match hosted migration history. No new tables or client-write grants.

- `public.checkout_cart(uuid,bigint,text)` is SECURITY INVOKER with an empty search path; PUBLIC/anonymous execution is revoked, authenticated execution is explicit. Its private coordinator is owned by the existing NOLOGIN/NOBYPASSRLS cart writer and derives ownership through the narrow `cart_uid()` bridge.
- The coordinator locks the owner cart, checks the durable operation receipt before its expected revision, reuses `create_order` with server-read quantities/prices, deletes purchased cart lines, and records the receipt in one transaction. Retrying an acknowledged operation returns the same order; later additions survive. Conflicting revisions return `CART_CONFLICT` before order creation. A reused ID with different instructions/revision fails.
- The writer gains only SELECT/INSERT on orders/order_items and execute on create_order. Four owner-bound SELECT/INSERT policies use the identity bridge. It cannot UPDATE/DELETE orders or bypass RLS. Temporary private-schema CREATE permission is revoked immediately after transferring function ownership.
- `create_order` remains SECURITY INVOKER and retains its validation and authenticated grants. Its identity lookup now uses the equivalent private bridge so the restricted coordinator can reuse it without broad auth-schema privileges. Legacy website requests remain compatible.
- The website order API verifies the cookie user before any RPC. An optional `X-Cart-Account` header must match that verified user and prevents stale-account submissions; it never supplies database ownership. Shared checkout accepts only operation ID, expected revision and instructions. Client-supplied identity, prices and totals are ignored. Replayed receipts skip email delivery; existing server-only Mailgun stays unchanged.

Verification: isolated and hosted SQL rollback tests cover owner isolation, conflict-before-write, trusted prices, cart clearing, duplicate retry, request reuse, and retention of later additions. Cart/order JavaScript regression tests and real authenticated browser checks cover guest merge, two-session live updates, offline/reconnect, sign-out, second-account isolation, and a deliberately lost checkout response followed by reload/retry. The test order was created exactly once, while the later addition stayed in the cart. Temporary accounts/orders/cart records were removed. No test confirmation email was sent (fixture emails were unverified before ordering).

Security advisors found no new checkout issue; the previously documented rls_auto_enable/password-protection notices remain outside this task.
