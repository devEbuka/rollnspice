# Shared cart database contract

Database milestone completed 2026-10-02. Neither the website nor native cart uses this contract yet.

## Read

`get_cart()` requires authentication and returns `{revision, items}`. Each item has `product_id`, `quantity`, `name`, `price` (integer kobo), `description`, and `category`. A new account returns revision 0 and an empty list without creating a cart row. Prices come from products.

## Change

`mutate_cart(p_operation_id uuid, p_action text, p_items jsonb, p_expected_revision bigint default null)` requires a durable, client-generated operation UUID. Ownership comes from the verified JWT, never a parameter.

Each item contains `product_id` and integer `quantity`. Non-merge operations accept exactly one item. Merge accepts 0–100 distinct products. Unknown metadata fields cannot change ownership or catalogue prices.

| action | quantity | expected revision | behaviour |
| --- | --- | --- | --- |
| add | 1–99 | optional | Add to latest quantity; cap at 99 with adjustment feedback |
| decrement | 1–99 | optional | Subtract from latest quantity; remove at zero |
| set | 0–99 | required | Set absolute quantity; zero removes |
| remove | 0 | required | Remove item only after checking the cart revision |
| merge | 1–99 per item | optional | Add guest items once, cap at 99, skip deleted products with feedback |

Successful responses include `{revision, items, operation_id, adjustments, replayed}`. Adjustments use `reason: quantity_capped` with quantity 99, or `reason: unavailable`. Revisions advance per changed row and may jump during merges; treat them as opaque monotonically increasing values.

Persist an operation before sending it. Retry with the same UUID and identical payload/revision after an unknown network result. Replays return the original receipt with `replayed: true`; refetch get_cart to avoid presenting stale receipt contents/prices. Reusing a UUID with a different request returns CART_OPERATION_REUSED. Guest data must not be cleared until the merge is acknowledged. Receipts are retained indefinitely until a separately reviewed expiry/retry protocol exists.

Errors: `CART_CONFLICT` (SQLSTATE 40001) includes the fresh snapshot in details; `CART_REVISION_REQUIRED`, `INVALID_CART_OPERATION`, `INVALID_CART_ITEMS`, `DUPLICATE_CART_ITEMS`, `CART_ITEM_LIMIT`, `PRODUCT_UNAVAILABLE`, `CART_OPERATION_REUSED` use 22023; `AUTH_REQUIRED` uses 42501. A conflict should refresh and require review/retry of an absolute edit, not silently overwrite another device. All mutation failures roll back items/revision/receipt together.

Subscribe to owner-filtered changes in public.carts and then refetch get_cart. Reconnect/foreground refresh remains necessary. A catalogue deletion cascades cart lines and bumps affected revisions. Sign-out/account-switch handling, account-scoped pending queues, website integration and checkout transactions remain future client work.

## Validation evidence

- `supabase/tests/0003_shared_cart.sql` is a complete rollback suite with isolated random users and temporary products. It tests ACLs, RLS, input boundaries, duplicate retries, revisions, merge cap/unavailable feedback, zero removal, direct-write denial, 100-item enforcement, partial-merge rollback and product-deletion cleanup.
- Live two-connection tests: concurrent +1/+1 produced quantity 2; concurrent retries of one +3 merge produced quantity 5 with only one merge receipt; two sets using the same revision allowed one and rejected one with CART_CONFLICT. Temporary test identity/data were explicitly removed.
- Anonymous REST requests cannot read carts and rollnspice_private is excluded from REST exposed schemas.
- Website lint and production build passed. No frontend code, dependency or environment changes.

## Website shared cart and retry-safe checkout (2026-10-03)

- Guest carts retain the existing storage format and get current menu metadata when available. Signed-in carts use coherent server snapshots; Realtime revision events, foreground/reconnect, and a 30-second visible-page fallback invalidate them. Browser changes are persisted before optimistic display, with one account-scoped storage entry per operation. Browser locks serialize drains across tabs; receipt IDs make repeated deliveries harmless. Safe guest claiming requires Web Locks, available in supported current browsers; unsupported browsers show a clear message rather than risk a duplicate merge.
- Guest capture/claim is durable before submission and recoverable on reload. Guest data clears only after merge acknowledgement. Missing products/capped quantities produce feedback. Sign-out clears the visible cart and starts an empty guest cart; pending work stays under its original account. Epoch checks reject late responses. Each cart RPC pins the selected account's access token, so an auth transition cannot send an old queue under a new session.
- Relative add/decrement operations may queue offline. Whole-item removal requires a current revision and no earlier pending change; conflicts refetch and ask for review rather than silently overwrite another session.
- Shared checkout is required before enabling remote carts: order/items, cart clearing and the receipt are transactional. The browser saves a checkout ID/revision/instructions before submitting and reuses that payload after uncertain network failures or reload. Definitive 4xx rejections discard that uncommitted attempt; revision conflicts refresh the cart. New items never clear as a side effect of replaying an old order.
- Email sending remains after the database commit. Replays skip it to prevent duplicate confirmation emails. This is not a durable email outbox: a server interruption before the original send may leave email unavailable; the saved order/history remains authoritative.
- No application dependency, environment variable, mobile runtime code or production website deployment changed. This milestone implements the website; mobile synchronization is the next separate task. Google OAuth itself was previously verified by the user; these cart checks used isolated temporary Supabase password sessions, not another manual Google login.
