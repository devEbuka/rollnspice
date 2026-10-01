-- Initial schema and exact menu seed from docs/mockup.html.
-- Review before applying to the configured Supabase project.
begin;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null check (price >= 0),
  category text,
  featured boolean default false,
  created_at timestamp default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text default 'pending',
  subtotal integer not null check (subtotal >= 0),
  special_instructions text,
  created_at timestamp default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0)
);

create index orders_user_id_idx on public.orders(user_id);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Remove inherited default grants before assigning the required privileges.
revoke all on table public.products, public.orders, public.order_items
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select, insert on table public.orders, public.order_items to authenticated;
grant all on table public.products, public.orders, public.order_items to service_role;

create policy products_public_select on public.products
  for select to anon, authenticated using (true);

create policy orders_owner_select on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy orders_owner_insert on public.orders
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy order_items_owner_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  ));

create policy order_items_owner_insert on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  ));

-- Prices are integer kobo: each mockup naira price multiplied by 100.
insert into public.products (name, description, price, category, featured) values
  ('The Original Beef Roll',
   'Slow-grilled beef, pickled cabbage, house garlic sauce, warm pita.',
   450000, 'signature', true),
  ('Chicken Shawarma',
   'Marinated grilled chicken, fresh slaw, chili mayo.',
   400000, 'classic', false),
  ('Suya Shawarma',
   'Beef with suya spice rub, onions, extra chili.',
   480000, 'spicy', false),
  ('Falafel Wrap',
   'Crisp falafel, hummus, pickled vegetables, tahini.',
   320000, 'veg', false),
  ('Spiced Fries',
   'Hand-cut fries tossed in shawarma spice mix.',
   180000, 'side', false),
  ('Zobo',
   'House-made hibiscus drink, ginger and clove.',
   120000, 'drink', false);

commit;
