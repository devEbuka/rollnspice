begin;
-- This non-login role owns only the mutation function, never the tables.
-- It cannot bypass RLS; client roles have no membership or table-write grants.
create role rollnspice_cart_writer nologin noinherit nobypassrls;
grant rollnspice_cart_writer to postgres;
create schema rollnspice_private;
revoke all on schema rollnspice_private from public, anon, authenticated;
grant usage on schema rollnspice_private to authenticated, rollnspice_cart_writer;
grant usage on schema public, auth to rollnspice_cart_writer;
grant execute on function auth.uid() to rollnspice_cart_writer;

create table public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  user_id uuid not null references public.carts(user_id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  primary key (user_id, product_id)
);
create index cart_items_product_id_idx on public.cart_items(product_id);
create table public.cart_operations (
  user_id uuid not null references public.carts(user_id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.cart_operations enable row level security;
revoke all on public.carts, public.cart_items, public.cart_operations from public, anon, authenticated;
grant select on public.carts, public.cart_items, public.cart_operations to authenticated;
grant select, insert, update on public.carts to rollnspice_cart_writer;
grant select, insert, update, delete on public.cart_items to rollnspice_cart_writer;
grant select, insert on public.cart_operations to rollnspice_cart_writer;
grant select on public.products to rollnspice_cart_writer;
create policy products_cart_writer_read on public.products for select to rollnspice_cart_writer using (true);
grant all on public.carts, public.cart_items, public.cart_operations to service_role;
create policy carts_owner_read on public.carts for select to authenticated using (user_id = (select auth.uid()));
create policy items_owner_read on public.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy operations_owner_read on public.cart_operations for select to authenticated using (user_id = (select auth.uid()));
create policy carts_writer_owner on public.carts for all to rollnspice_cart_writer using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy items_writer_owner on public.cart_items for all to rollnspice_cart_writer using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy operations_writer_owner on public.cart_operations for all to rollnspice_cart_writer using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function rollnspice_private.guard_cart_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.product_id <> old.product_id) then
    raise exception using errcode='22023', message='CART_ID_IMMUTABLE';
  end if;
  perform 1 from public.carts where user_id=new.user_id for update;
  if tg_op = 'INSERT' and (select count(*) from public.cart_items where user_id=new.user_id) >= 100 then
    raise exception using errcode='22023', message='CART_ITEM_LIMIT';
  end if;
  return new;
end $$;
create function rollnspice_private.bump_cart_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.carts set revision=revision+1, updated_at=clock_timestamp()
    where user_id=case when tg_op='DELETE' then old.user_id else new.user_id end;
  return null;
end $$;
revoke all on function rollnspice_private.guard_cart_item(), rollnspice_private.bump_cart_revision() from public, anon, authenticated;
create trigger cart_item_guard before insert or update on public.cart_items
  for each row execute function rollnspice_private.guard_cart_item();
create trigger cart_revision_changed after insert or update or delete on public.cart_items
  for each row execute function rollnspice_private.bump_cart_revision();

create function public.get_cart() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  select jsonb_build_object('revision', c.revision, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('product_id',i.product_id,'quantity',i.quantity,
      'name',p.name,'price',p.price,'description',p.description,'category',p.category) order by i.product_id)
    from public.cart_items i join public.products p on p.id=i.product_id where i.user_id=c.user_id
  ), '[]'::jsonb)) into v_result from public.carts c where c.user_id=v_user;
  return coalesce(v_result, jsonb_build_object('revision',0,'items','[]'::jsonb));
end $$;
revoke all on function public.get_cart() from public, anon;
grant execute on function public.get_cart() to authenticated, rollnspice_cart_writer;

create function rollnspice_private.mutate_cart(p_operation_id uuid, p_action text, p_items jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_request jsonb; v_receipt public.cart_operations%rowtype;
  v_revision bigint; v_line jsonb; v_id uuid; v_quantity integer; v_old integer; v_next integer;
  v_adjustments jsonb := '[]'::jsonb; v_result jsonb;
begin
  if v_user is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  if p_operation_id is null or p_action is null or p_action not in ('add','decrement','set','remove','merge') then
    raise exception using errcode='22023', message='INVALID_CART_OPERATION';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception using errcode='22023', message='INVALID_CART_ITEMS'; end if;
  if jsonb_array_length(p_items)>100 or (p_action<>'merge' and jsonb_array_length(p_items)<>1) then
    raise exception using errcode='22023', message='INVALID_CART_ITEMS';
  end if;
  if p_expected_revision < 0 or (p_action in ('set','remove') and p_expected_revision is null) then
    raise exception using errcode='22023', message='CART_REVISION_REQUIRED';
  end if;
  for v_line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line) is distinct from 'object' or jsonb_typeof(v_line->'product_id') is distinct from 'string'
      or (v_line->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_line->'quantity') is distinct from 'number' or (v_line->>'quantity') !~ '^[0-9]{1,2}$'
      or (v_line->>'quantity')::integer > 99
      or (p_action in ('add','decrement','merge') and (v_line->>'quantity')::integer < 1)
      or (p_action='remove' and (v_line->>'quantity')::integer <> 0) then
      raise exception using errcode='22023', message='INVALID_CART_ITEMS';
    end if;
  end loop;
  if (select count(distinct (value->>'product_id')::uuid) from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception using errcode='22023', message='DUPLICATE_CART_ITEMS';
  end if;
  v_request := jsonb_build_object('action',p_action,'items',p_items,'expected_revision',p_expected_revision);
  insert into public.carts(user_id) values(v_user) on conflict (user_id) do nothing;
  select revision into v_revision from public.carts where user_id=v_user for update;
  select * into v_receipt from public.cart_operations where user_id=v_user and operation_id=p_operation_id;
  if found then
    if v_receipt.request <> v_request then raise exception using errcode='22023', message='CART_OPERATION_REUSED'; end if;
    return v_receipt.result || jsonb_build_object('replayed',true);
  end if;
  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using errcode='40001', message='CART_CONFLICT', detail=public.get_cart()::text;
  end if;
  for v_line in select value from jsonb_array_elements(p_items) loop
    v_id := (v_line->>'product_id')::uuid; v_quantity := (v_line->>'quantity')::integer;
    -- The foreign key also protects against deletion racing this lookup.
    if p_action in ('add','set','merge') and v_quantity>0 then
      perform 1 from public.products where id=v_id;
      if not found then
        if p_action<>'merge' then raise exception using errcode='22023', message='PRODUCT_UNAVAILABLE', detail=v_id::text; end if;
        v_adjustments := v_adjustments || jsonb_build_array(jsonb_build_object('product_id',v_id,'reason','unavailable'));
        continue;
      end if;
    end if;
    select quantity into v_old from public.cart_items where user_id=v_user and product_id=v_id;
    v_old := coalesce(v_old,0);
    v_next := case p_action when 'add' then least(99,v_old+v_quantity)
      when 'merge' then least(99,v_old+v_quantity) when 'decrement' then greatest(0,v_old-v_quantity)
      when 'remove' then 0 else v_quantity end;
    if p_action in ('add','merge') and v_old+v_quantity>99 then
      v_adjustments := v_adjustments || jsonb_build_array(jsonb_build_object('product_id',v_id,'reason','quantity_capped','quantity',99));
    end if;
    if v_next=0 then delete from public.cart_items where user_id=v_user and product_id=v_id;
    elsif v_next<>v_old then
      if v_old=0 then insert into public.cart_items(user_id,product_id,quantity) values(v_user,v_id,v_next);
      else update public.cart_items set quantity=v_next where user_id=v_user and product_id=v_id; end if;
    end if;
  end loop;
  v_result := public.get_cart() || jsonb_build_object('operation_id',p_operation_id,'adjustments',v_adjustments,'replayed',false);
  insert into public.cart_operations(user_id,operation_id,request,result) values(v_user,p_operation_id,v_request,v_result);
  return v_result;
end $$;
-- The function owner has only explicit table privileges and remains subject to RLS.
grant create on schema rollnspice_private to rollnspice_cart_writer;
alter function rollnspice_private.mutate_cart(uuid,text,jsonb,bigint) owner to rollnspice_cart_writer;
revoke create on schema rollnspice_private from rollnspice_cart_writer;
revoke all on function rollnspice_private.mutate_cart(uuid,text,jsonb,bigint) from public, anon;
grant execute on function rollnspice_private.mutate_cart(uuid,text,jsonb,bigint) to authenticated;
create function public.mutate_cart(p_operation_id uuid, p_action text, p_items jsonb, p_expected_revision bigint default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select rollnspice_private.mutate_cart(p_operation_id,p_action,p_items,p_expected_revision);
$$;
revoke all on function public.mutate_cart(uuid,text,jsonb,bigint) from public, anon;
grant execute on function public.mutate_cart(uuid,text,jsonb,bigint) to authenticated;
alter publication supabase_realtime add table public.carts;
commit;
