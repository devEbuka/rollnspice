begin;
select set_config('test.owner', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
select set_config('test.order', gen_random_uuid()::text, true);
select set_config('test.other_order', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('test.owner')::uuid), (current_setting('test.other')::uuid);
insert into public.orders(id,user_id,subtotal) values
  (current_setting('test.other_order')::uuid,current_setting('test.other')::uuid,120000);
insert into public.order_items(order_id,product_id,quantity,unit_price)
  select current_setting('test.other_order')::uuid,id,1,price
  from public.products where name='Zobo';
set local role anon;
do $test$
begin
  if (select count(*) from public.products) <> 6 then raise exception 'Public menu failed'; end if;
  begin
    perform 1 from public.orders;
    raise exception 'Anonymous orders read was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.products(name,price) values ('RLS test',1);
    raise exception 'Anonymous product write was allowed';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $test$
begin
  insert into public.orders(id,user_id,subtotal) values
    (current_setting('test.order')::uuid,(select auth.uid()),120000);
  insert into public.order_items(order_id,product_id,quantity,unit_price)
    select current_setting('test.order')::uuid,id,1,price
    from public.products where name='Zobo';
  if (select count(*) from public.orders where id=current_setting('test.order')::uuid) <> 1
    then raise exception 'Own order read failed'; end if;
  if (select count(*) from public.order_items where order_id=current_setting('test.order')::uuid) <> 1
    then raise exception 'Own line-item read failed'; end if;
  if exists (select 1 from public.orders where id=current_setting('test.other_order')::uuid)
    then raise exception 'Other order visible'; end if;
  if exists (select 1 from public.order_items where order_id=current_setting('test.other_order')::uuid)
    then raise exception 'Other line item visible'; end if;
  begin
    insert into public.orders(user_id,subtotal) values (current_setting('test.other')::uuid,0);
    raise exception 'Other user order insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.order_items(order_id,product_id,quantity,unit_price)
      select current_setting('test.other_order')::uuid,id,1,price from public.products where name='Zobo';
    raise exception 'Other user line-item insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.order_items(order_id,product_id,quantity,unit_price)
      select current_setting('test.order')::uuid,id,0,price from public.products where name='Zobo';
    raise exception 'Zero quantity allowed';
  exception when check_violation then null; end;
  begin
    insert into public.orders(user_id,subtotal) values ((select auth.uid()),-1);
    raise exception 'Negative subtotal allowed';
  exception when check_violation then null; end;
  begin
    insert into public.products(name,price) values ('RLS test',1);
    raise exception 'Authenticated product insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.orders set subtotal=0 where id=current_setting('test.order')::uuid;
    raise exception 'Order update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.order_items where order_id=current_setting('test.order')::uuid;
    raise exception 'Line-item delete allowed';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback;
select 'PASS: public menu, owner access, cross-user isolation, denied writes, and numeric constraints; fixtures rolled back' as result;
