# schema.md

Source of truth for the database schema. Update this whenever a table, column, or policy changes in Supabase, don't rely on the dashboard alone as the record.

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
- (empty — first entries go here as tables are actually created in Supabase)
