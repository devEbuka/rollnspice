begin;
-- Business revision conflicts must not trigger PostgREST serialization retries.
-- Replace only SQLSTATE; CREATE OR REPLACE preserves the existing owners and ACLs.
do $$
declare signature text; definition text;
begin
  foreach signature in array array[
    'rollnspice_private.mutate_cart(uuid,text,jsonb,bigint)',
    'rollnspice_private.checkout_cart(uuid,bigint,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if position('''40001''' in definition) = 0 then
      raise exception 'Expected conflict SQLSTATE missing in %', signature;
    end if;
    execute replace(definition, '''40001''', '''PT409''');
  end loop;
end $$;
commit;
