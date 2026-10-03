-- Real database tests: all fixtures and attempted changes roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
select set_config('test.operation',gen_random_uuid()::text,true);
select set_config('test.product',(select id::text from public.products order by id limit 1),true);
select set_config('test.missing',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
do $$ begin
  if has_function_privilege('anon','public.get_cart()','execute') or
    has_function_privilege('anon','public.mutate_cart(uuid,text,jsonb,bigint)','execute') then raise exception 'Guest RPC access'; end if;
  if has_table_privilege('authenticated','public.cart_items','insert') or
    has_table_privilege('authenticated','public.carts','update') or
    has_table_privilege('authenticated','public.cart_operations','delete') then raise exception 'Client direct writes'; end if;
  if pg_has_role('authenticated','rollnspice_cart_writer','member') then raise exception 'Client writer membership'; end if;
  if exists(select 1 from pg_roles where rolname='rollnspice_cart_writer' and (rolsuper or rolbypassrls or rolcanlogin)) then raise exception 'Writer elevation'; end if;
  if exists(select 1 from pg_class where oid in ('public.carts'::regclass,'public.cart_items'::regclass,'public.cart_operations'::regclass) and
    (not relrowsecurity or relowner=(select oid from pg_roles where rolname='rollnspice_cart_writer'))) then raise exception 'RLS bypass'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare result jsonb; first_result jsonb; lines jsonb; revision bigint; original_count bigint;
begin
  if public.get_cart() <> '{"revision":0,"items":[]}'::jsonb then raise exception 'Empty snapshot'; end if;
  lines:=jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',2,'price',1,'user_id',current_setting('test.other')));
  result:=public.mutate_cart(current_setting('test.operation')::uuid,'add',lines);
  first_result:=result;
  if result->'items'->0->>'quantity'<>'2' or result->'items'->0->>'price'='1' then raise exception 'Trusted snapshot'; end if;
  if (result->>'revision')::bigint<>1 or result->>'replayed'<>'false' then raise exception 'Revision/result'; end if;
  result:=public.mutate_cart(current_setting('test.operation')::uuid,'add',lines);
  if result->>'replayed'<>'true' or result->'items'<>first_result->'items' then raise exception 'Duplicate retry changed cart'; end if;
  begin
    perform public.mutate_cart(current_setting('test.operation')::uuid,'add',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',3)));
    raise exception 'Operation reuse allowed';
  exception when invalid_parameter_value then if sqlerrm<>'CART_OPERATION_REUSED' then raise; end if; end;
  begin
    perform public.mutate_cart(gen_random_uuid(),'set',lines,0); raise exception 'Stale set accepted';
  exception when sqlstate 'PT409' then if sqlerrm<>'CART_CONFLICT' then raise; end if; end;
  begin
    perform public.mutate_cart(gen_random_uuid(),'remove',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',0)));
    raise exception 'Missing revision accepted';
  exception when invalid_parameter_value then if sqlerrm<>'CART_REVISION_REQUIRED' then raise; end if; end;
  begin
    perform public.mutate_cart(gen_random_uuid(),'add',lines||lines); raise exception 'Duplicate accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.mutate_cart(gen_random_uuid(),'add',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',100)));
    raise exception 'Invalid quantity accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.mutate_cart(gen_random_uuid(),'add',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.missing'),'quantity',1)));
    raise exception 'Missing product accepted';
  exception when invalid_parameter_value then if sqlerrm<>'PRODUCT_UNAVAILABLE' then raise; end if; end;
  if (public.get_cart()->>'revision')::bigint<>1 then raise exception 'Failed request changed cart'; end if;
  lines:=jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',99),jsonb_build_object('product_id',current_setting('test.missing'),'quantity',1));
  perform set_config('test.merge',gen_random_uuid()::text,true);
  result:=public.mutate_cart(current_setting('test.merge')::uuid,'merge',lines);
  if result->'items'->0->>'quantity'<>'99' or jsonb_array_length(result->'adjustments')<>2 then raise exception 'Merge adjustments'; end if;
  result:=public.mutate_cart(current_setting('test.merge')::uuid,'merge',lines);
  if result->>'replayed'<>'true' or result->'items'->0->>'quantity'<>'99' then raise exception 'Merge replay'; end if;
  result:=public.mutate_cart(gen_random_uuid(),'decrement',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',99)));
  if jsonb_array_length(result->'items')<>0 then raise exception 'Decrement to zero'; end if;
  lines:=jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',1));
  result:=public.mutate_cart(gen_random_uuid(),'add',lines);
  revision:=(result->>'revision')::bigint;
  result:=public.mutate_cart(gen_random_uuid(),'set',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',3)),revision);
  if result->'items'->0->>'quantity'<>'3' then raise exception 'Set quantity'; end if;
  perform set_config('test.owner_revision',result->>'revision',true);
  begin insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),current_setting('test.product')::uuid,1); raise exception 'Direct write succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.carts) or exists(select 1 from public.cart_items) or exists(select 1 from public.cart_operations) then raise exception 'Cross-user visibility'; end if;
  if public.get_cart()<>'{"revision":0,"items":[]}'::jsonb then raise exception 'Cross-user snapshot'; end if;
  perform public.mutate_cart(current_setting('test.operation')::uuid,'add',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',1)));
  if public.get_cart()->'items'->0->>'quantity'<>'1' then raise exception 'Owner-scoped operation IDs'; end if;
end $$;
reset role;
-- Even the internal writer cannot access another owner's rows through RLS.
set local role rollnspice_cart_writer;
do $$ begin
  update public.cart_items set quantity=55 where user_id=current_setting('test.owner')::uuid;
  if found then raise exception 'Writer cross-owner update'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$ begin
  begin perform public.get_cart(); raise exception 'Missing identity allowed'; exception when insufficient_privilege then if sqlerrm<>'AUTH_REQUIRED' then raise; end if; end;
  begin perform public.mutate_cart(gen_random_uuid(),'merge','[]'); raise exception 'Missing identity mutation'; exception when insufficient_privilege then if sqlerrm<>'AUTH_REQUIRED' then raise; end if; end;
end $$;
reset role;
-- Temporary catalogue rows test the 100-item database limit; rollback removes them.
insert into public.products(name,price,category) select 'cart-test-'||n,100,'test' from generate_series(1,101) n;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare lines jsonb; result jsonb; revision bigint; before_ops bigint;
begin
  perform public.mutate_cart(gen_random_uuid(),'remove',jsonb_build_array(jsonb_build_object('product_id',current_setting('test.product'),'quantity',0)),(public.get_cart()->>'revision')::bigint);
  select jsonb_agg(jsonb_build_object('product_id',id,'quantity',1)) into lines from (select id from public.products where category='test' order by name limit 100) p;
  result:=public.mutate_cart(gen_random_uuid(),'merge',lines);
  if jsonb_array_length(result->'items')<>100 then raise exception '100 items rejected'; end if;
  revision:=(result->>'revision')::bigint;
  select count(*) into before_ops from public.cart_operations;
  select jsonb_build_array(jsonb_build_object('product_id',id,'quantity',1)) into lines from public.products where category='test' and id not in (select product_id from public.cart_items) limit 1;
  begin perform public.mutate_cart(gen_random_uuid(),'add',lines); raise exception '101 items accepted'; exception when invalid_parameter_value then if sqlerrm<>'CART_ITEM_LIMIT' then raise; end if; end;
  if (public.get_cart()->>'revision')::bigint<>revision or (select count(*) from public.cart_operations)<>before_ops then raise exception 'Limit partial write'; end if;
  lines:=jsonb_build_array(jsonb_build_object('product_id',(result->'items'->0)->>'product_id','quantity',1))||lines;
  begin perform public.mutate_cart(gen_random_uuid(),'merge',lines); raise exception 'Partial merge accepted'; exception when invalid_parameter_value then if sqlerrm<>'CART_ITEM_LIMIT' then raise; end if; end;
  if (public.get_cart()->>'revision')::bigint<>revision or (public.get_cart()->'items'->0->>'quantity')::integer<>1 then raise exception 'Merge partial write'; end if;
end $$;
reset role;
-- Product removal cascades items and invalidates the cart revision.
delete from public.products where id=(select product_id from public.cart_items where user_id=current_setting('test.owner')::uuid limit 1);
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$ begin if jsonb_array_length(public.get_cart()->'items')<>99 then raise exception 'Deleted product cleanup'; end if; end $$;
reset role;
select 'Cart grants/RLS, trusted catalogue, validation, revision conflicts, retries, merge adjustments, limits, rollback and product deletion passed' as result;
rollback;
