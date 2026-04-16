begin;

create extension if not exists pgcrypto;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  leaked_count int;
  insert_failed boolean := false;
begin
  insert into public.users (id) values (user_a) on conflict do nothing;
  insert into public.users (id) values (user_b) on conflict do nothing;

  insert into public.activity_events (id, user_id, activity_type, event_type, metadata)
  values
    (gen_random_uuid(), user_a, 'resume', 'resume_saved', '{}'::jsonb),
    (gen_random_uuid(), user_b, 'resume', 'resume_saved', '{}'::jsonb);

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*)
    into leaked_count
  from public.activity_events
  where user_id = user_b;

  if leaked_count <> 0 then
    raise exception 'RLS leak: user A can see user B rows';
  end if;

  begin
    insert into public.activity_events (user_id, activity_type, event_type, metadata)
    values (user_a, 'resume', 'resume_saved', '{}'::jsonb);
  exception
    when insufficient_privilege then
      insert_failed := true;
  end;

  if insert_failed is false then
    raise exception 'Expected direct INSERT from authenticated role to fail';
  end if;
end $$;

rollback;
