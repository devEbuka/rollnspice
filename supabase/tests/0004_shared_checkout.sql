begin;
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000001'),('a1000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
do $$
declare p uuid; c jsonb; placed jsonb; replay jsonb; newer jsonb; oid uuid;
begin
  select id into p from public.products limit 1;
  c := public.mutate_cart('a2000000-0000-0000-0000-000000000001','add',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',2)),null);
  begin
    perform public.checkout_cart('a2000000-0000-0000-0000-000000000002',0,null);
    raise exception 'stale checkout accepted';
  exception when serialization_failure then null; end;
  if (select count(*) from public.orders)<>0 then raise exception 'conflict wrote order'; end if;
  placed := public.checkout_cart('a2000000-0000-0000-0000-000000000002',(c->>'revision')::bigint,'no onions');
  oid := (placed->'order'->>'id')::uuid;
  if jsonb_array_length(public.get_cart()->'items')<>0 then raise exception 'purchased cart not cleared'; end if;
  if (select count(*) from public.order_items where order_id=oid)<>1 then raise exception 'missing order lines'; end if;
  if (placed->'order'->>'subtotal')::int<>(select price*2 from public.products where id=p) then raise exception 'wrong price'; end if;
  newer := public.mutate_cart('a2000000-0000-0000-0000-000000000003','add',jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1)),null);
  replay := public.checkout_cart('a2000000-0000-0000-0000-000000000002',(c->>'revision')::bigint,'no onions');
  if replay->'order'<>placed->'order' or replay->>'replayed'<>'true' then raise exception 'retry not idempotent'; end if;
  if public.get_cart()->'items'<>newer->'items' then raise exception 'retry erased later addition'; end if;
  if (select count(*) from public.orders)<>1 then raise exception 'duplicate order'; end if;
  begin
    perform public.checkout_cart('a2000000-0000-0000-0000-000000000002',(c->>'revision')::bigint,'changed');
    raise exception 'reused request accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
do $$ begin
  if exists(select 1 from public.orders) or exists(select 1 from public.cart_operations) then raise exception 'owner data leaked'; end if;
  begin perform public.checkout_cart('a2000000-0000-0000-0000-000000000002',1,null); raise exception 'empty checkout accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.checkout_cart(uuid,bigint,text)','execute') then raise exception 'anonymous checkout grant'; end if;
  if has_table_privilege('rollnspice_cart_writer','public.orders','update') then raise exception 'writer can change old orders'; end if;
end $$;
select 'shared checkout: conflict, atomic clearing, retry, later additions, ownership and grants passed' as result;
rollback;
