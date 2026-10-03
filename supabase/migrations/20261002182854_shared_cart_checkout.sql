begin;
-- Preserve legacy checkout while allowing the restricted cart coordinator to reuse it.
do $$ begin
  execute replace(pg_get_functiondef('public.create_order(jsonb,text)'::regprocedure),
    'auth.uid()', 'rollnspice_private.cart_uid()');
end $$;
grant select, insert on public.orders, public.order_items to rollnspice_cart_writer;
grant execute on function public.create_order(jsonb,text) to rollnspice_cart_writer;
create policy orders_cart_writer_read on public.orders for select to rollnspice_cart_writer
  using (user_id = (select rollnspice_private.cart_uid()));
create policy orders_cart_writer_insert on public.orders for insert to rollnspice_cart_writer
  with check (user_id = (select rollnspice_private.cart_uid()));
create policy lines_cart_writer_read on public.order_items for select to rollnspice_cart_writer
  using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select rollnspice_private.cart_uid())));
create policy lines_cart_writer_insert on public.order_items for insert to rollnspice_cart_writer
  with check (exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select rollnspice_private.cart_uid())));

create function rollnspice_private.checkout_cart(p_operation_id uuid, p_expected_revision bigint, p_special_instructions text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := rollnspice_private.cart_uid(); v_revision bigint;
  v_request jsonb; v_receipt public.cart_operations%rowtype; v_items jsonb; v_order jsonb; v_result jsonb;
begin
  if v_user is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_operation_id is null or p_expected_revision is null or p_expected_revision<0 then
    raise exception using errcode='22023', message='CART_REVISION_REQUIRED';
  end if;
  if char_length(p_special_instructions)>250 then raise exception using errcode='22023', message='INVALID_INSTRUCTIONS'; end if;
  v_request := jsonb_build_object('action','checkout','expected_revision',p_expected_revision,
    'instructions',nullif(btrim(p_special_instructions),''));
  select revision into v_revision from public.carts where user_id=v_user for update;
  if not found then raise exception using errcode='22023', message='CART_EMPTY'; end if;
  select * into v_receipt from public.cart_operations where user_id=v_user and operation_id=p_operation_id;
  if found then
    if v_receipt.request<>v_request then raise exception using errcode='22023', message='CART_OPERATION_REUSED'; end if;
    return v_receipt.result || jsonb_build_object('replayed',true);
  end if;
  if p_expected_revision<>v_revision then
    raise exception using errcode='40001', message='CART_CONFLICT', detail=public.get_cart()::text;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity) order by product_id),'[]'::jsonb)
    into v_items from public.cart_items where user_id=v_user;
  v_order := public.create_order(v_items,p_special_instructions);
  delete from public.cart_items where user_id=v_user;
  v_result := jsonb_build_object('order',v_order,'replayed',false);
  insert into public.cart_operations(user_id,operation_id,request,result) values(v_user,p_operation_id,v_request,v_result);
  return v_result;
end $$;
grant create on schema rollnspice_private to rollnspice_cart_writer;
alter function rollnspice_private.checkout_cart(uuid,bigint,text) owner to rollnspice_cart_writer;
revoke create on schema rollnspice_private from rollnspice_cart_writer;
revoke all on function rollnspice_private.checkout_cart(uuid,bigint,text) from public,anon;
grant execute on function rollnspice_private.checkout_cart(uuid,bigint,text) to authenticated;
create function public.checkout_cart(p_operation_id uuid, p_expected_revision bigint, p_special_instructions text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select rollnspice_private.checkout_cart(p_operation_id,p_expected_revision,p_special_instructions)
$$;
revoke all on function public.checkout_cart(uuid,bigint,text) from public,anon;
grant execute on function public.checkout_cart(uuid,bigint,text) to authenticated;
commit;
