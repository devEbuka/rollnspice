-- Atomic, RLS-respecting order placement; no client-supplied ownership or prices.
begin;
create function public.create_order(p_items jsonb, p_special_instructions text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_lines jsonb;
  v_missing jsonb;
  v_subtotal bigint;
  v_order uuid;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'INVALID_ITEMS';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_ITEMS';
  end if;
  if char_length(p_special_instructions) > 250 then
    raise exception using errcode = '22023', message = 'INVALID_INSTRUCTIONS';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item->'product_id') is distinct from 'string'
      or (v_item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_item->'quantity') is distinct from 'number'
      or (v_item->>'quantity') !~ '^[0-9]{1,2}$'
    then raise exception using errcode = '22023', message = 'INVALID_ITEMS'; end if;
    if (v_item->>'quantity')::integer < 1 then
      raise exception using errcode = '22023', message = 'INVALID_ITEMS';
    end if;
  end loop;
  if (select count(distinct (value->>'product_id')::uuid) from jsonb_array_elements(p_items))
    <> jsonb_array_length(p_items) then
    raise exception using errcode = '22023', message = 'DUPLICATE_PRODUCTS';
  end if;

  -- Capture missing products and price snapshots from the same database query.
  select
    jsonb_agg(jsonb_build_object('product_id', p.id, 'quantity', i.quantity, 'unit_price', p.price))
      filter (where p.id is not null),
    jsonb_agg(i.product_id) filter (where p.id is null),
    sum(p.price::bigint * i.quantity)
  into v_lines, v_missing, v_subtotal
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
  left join public.products p on p.id = i.product_id;
  if v_missing is not null then
    raise exception using errcode = 'P0001', message = 'PRODUCTS_UNAVAILABLE', detail = v_missing::text;
  end if;
  if v_subtotal > 2147483647 then
    raise exception using errcode = '22023', message = 'ORDER_TOTAL_TOO_LARGE';
  end if;
  insert into public.orders(user_id, subtotal, special_instructions)
  values(v_user, v_subtotal::integer, nullif(btrim(p_special_instructions), ''))
  returning id into v_order;
  insert into public.order_items(order_id, product_id, quantity, unit_price)
  select v_order, i.product_id, i.quantity, i.unit_price
  from jsonb_to_recordset(v_lines) as i(product_id uuid, quantity integer, unit_price integer);
  return jsonb_build_object('id', v_order, 'subtotal', v_subtotal, 'status', 'pending');
end;
$$;
revoke all on function public.create_order(jsonb, text) from public, anon;
grant execute on function public.create_order(jsonb, text) to authenticated;
commit;
