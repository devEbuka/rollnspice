-- Live tests are fully rolled back, including temporary users and privileges.
begin;
select set_config('test.owner', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('test.owner')::uuid), (current_setting('test.other')::uuid);
do $$ begin
  if has_function_privilege('anon', 'public.create_order(jsonb,text)', 'execute') then
    raise exception 'Anonymous execution allowed';
  end if;
  if not exists (select 1 from pg_proc where oid='public.create_order(jsonb,text)'::regprocedure and not prosecdef) then
    raise exception 'Function must preserve invoker RLS';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  payload jsonb;
  result jsonb;
  original_count bigint;
  details text;
begin
  select jsonb_agg(jsonb_build_object('product_id',id,'quantity',2,'price',1,'user_id',current_setting('test.other')))
  into payload from public.products where name in ('The Original Beef Roll','Spiced Fries');
  result := public.create_order(payload, ' no onions ');
  perform set_config('test.created_order', result->>'id', true);
  if (result->>'subtotal')::integer <> 1260000 then raise exception 'Trusted price total failed'; end if;
  if not exists (select 1 from public.orders where id=(result->>'id')::uuid
    and user_id=auth.uid() and subtotal=1260000 and special_instructions='no onions') then
    raise exception 'Ownership or instruction normalization failed';
  end if;
  if (select count(*) from public.order_items where order_id=(result->>'id')::uuid) <> 2 then
    raise exception 'Missing line items';
  end if;
  if exists (select 1 from public.order_items i join public.products p on p.id=i.product_id
    where i.order_id=(result->>'id')::uuid and i.unit_price <> p.price) then
    raise exception 'Untrusted price was accepted';
  end if;
  select count(*) into original_count from public.orders;
  begin
    perform public.create_order(payload || jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000000','quantity',1)));
    raise exception 'Missing product was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'PRODUCTS_UNAVAILABLE' then raise; end if;
    get stacked diagnostics details = pg_exception_detail;
    if not details::jsonb @> '["00000000-0000-0000-0000-000000000000"]'::jsonb then raise exception 'Missing ID not reported'; end if;
  end;
  if (select count(*) from public.orders) <> original_count then raise exception 'Missing-product partial order'; end if;
  begin
    perform public.create_order(payload || jsonb_build_array(payload->0));
    raise exception 'Duplicate accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_order(jsonb_build_array(jsonb_build_object('product_id',(payload->0)->>'product_id','quantity',0)));
    raise exception 'Zero quantity accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_order(payload, repeat('x',251));
    raise exception 'Long instructions accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.other'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.orders where id=current_setting('test.created_order')::uuid)
    or exists (select 1 from public.order_items where order_id=current_setting('test.created_order')::uuid) then
    raise exception 'Cross-user order visible';
  end if;
end $$;
reset role;
-- Force the second insert to fail after the first succeeds within the RPC.
revoke insert on public.order_items from authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare before_count bigint; payload jsonb;
begin
  select count(*) into before_count from public.orders;
  select jsonb_build_array(jsonb_build_object('product_id',id,'quantity',1)) into payload from public.products limit 1;
  begin
    perform public.create_order(payload);
    raise exception 'Forced item insert failure did not occur';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.orders) <> before_count then raise exception 'First insert was not rolled back'; end if;
end $$;
reset role;
select 'Atomic writes, trusted prices/identity, validation, missing-product details, and RLS isolation passed' as result;
rollback;
