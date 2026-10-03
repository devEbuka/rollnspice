begin;
-- Hosted Supabase does not let postgres grant auth schema USAGE to custom roles.
-- This private, read-only bridge returns auth.uid() without granting broader auth access.
create function rollnspice_private.cart_uid() returns uuid
language sql stable security definer set search_path = '' as $$ select auth.uid(); $$;
revoke all on function rollnspice_private.cart_uid() from public, anon;
grant execute on function rollnspice_private.cart_uid() to authenticated, rollnspice_cart_writer;
alter policy carts_writer_owner on public.carts
  using (user_id=(select rollnspice_private.cart_uid())) with check (user_id=(select rollnspice_private.cart_uid()));
alter policy items_writer_owner on public.cart_items
  using (user_id=(select rollnspice_private.cart_uid())) with check (user_id=(select rollnspice_private.cart_uid()));
alter policy operations_writer_owner on public.cart_operations
  using (user_id=(select rollnspice_private.cart_uid())) with check (user_id=(select rollnspice_private.cart_uid()));
-- Preserve the reviewed function bodies and ACLs; only replace their identity lookup.
do $$ begin
  execute replace(pg_get_functiondef('public.get_cart()'::regprocedure),'auth.uid()','rollnspice_private.cart_uid()');
  execute replace(pg_get_functiondef('rollnspice_private.mutate_cart(uuid,text,jsonb,bigint)'::regprocedure),'auth.uid()','rollnspice_private.cart_uid()');
end $$;
commit;
