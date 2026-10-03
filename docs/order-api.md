# Authenticated order API

The website hosts `/api/orders`. Native clients call its HTTPS URL using the current Supabase session access token. No new API key or login flow is needed.

## Authentication

- Native: `Authorization: Bearer <access_token>`.
- Website: the existing Supabase session cookies.
- If Authorization is present, it takes precedence over cookies. Malformed, invalid or expired credentials return 401 and never fall back to a cookie account.
- The server calls Supabase `getUser(token)` to verify identity. A new request-scoped client carries that same token to database reads/RPCs under owner RLS. No secret/service-role key is used.
- Send `X-Cart-Account: <current_user_id>` to reject an account change (409). This optional assertion never determines database ownership. Identity/price/total fields in request bodies or query strings cannot select another user or override database prices.
- Auth service failures return 503. Responses are `private, no-store` and vary by Authorization/Cookie. Bearer requests skip unrelated cookie refresh in the website proxy.
- Native requests normally have no Origin. POST continues to reject a supplied foreign Origin with 403. No permissive browser CORS access was added.

## POST /api/orders

Native checkout requires the shared cart. Persist this payload before sending it, scoped to its owner:

```json
{
  "cart_operation_id": "client-generated-uuid",
  "cart_revision": 7,
  "special_instructions": "No onions"
}
```

Instructions are optional (maximum 250 characters). Get the revision from `get_cart()` after queued cart edits finish. Mobile legacy `items` requests are rejected with 400; existing cookie-based website legacy checkout remains supported.

201 returns `{order: {id, subtotal, status}, email: {status}, replayed}`. Subtotal and saved unit prices are integer kobo read by the database. Order creation, line items, purchased-cart clearing and operation receipt are atomic.

Retry uncertain responses with the **same operation ID, revision and instructions**. A receipt replay returns the same order, skips duplicate email delivery, and preserves later cart additions. Refresh the shared cart after success/replay.

- 400: invalid payload/limits or an operation ID reused with changed arguments.
- 401: sign in/refresh the session; do not submit under a different owner.
- 409 `conflict: true`: refresh the cart and require quantity review before a new attempt.
- 409 `missingProductIds`: remove unavailable products before retrying.
- 503/network failure: keep the saved operation and retry; an order may already have committed.

Email is best effort after commit; the saved order is authoritative. Receipt retries do not retry email sending. This endpoint places an order; it does not process payment.

## GET /api/orders?page=1

Returns only the verified user's orders, newest first by `created_at` then `id`. Page must be an integer 1–10000; default 1. Each page includes up to 20 orders plus `hasNext`:

```json
{"orders": [], "page": 1, "hasNext": false}
```

Each order exposes `id,status,subtotal,special_instructions,created_at` and `order_items(id,quantity,unit_price,products(name))`. Prices are the saved order snapshots. Product names come from the current catalogue relation. There is no user selector. Account checks and RLS both constrain reads. Empty history is 200; invalid page is 400, unsigned request 401, and a query failure 503 with a generic message.

## Checks

Run `node --test src/lib/orders/*.test.* src/lib/cart/*.test.* src/lib/supabase/*.test.*`, `npm run lint`, and `npm run build` in the website repository. Regression tests cover both auth paths, malformed headers, account mismatch, owner filters, pagination, trusted totals, conflict and checkout receipt handling. Live checks use isolated Supabase users and remove their orders/cart/session records afterward.

References: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Supabase client initialization](https://supabase.com/docs/reference/javascript/initializing), [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
