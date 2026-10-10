-- Permission scenarios for AMR teams. Run against the local replica, before and
-- after the proposed migration:  psql -v mode=current|migrated -f this file.
-- Every action runs as a simulated signed-in user and is rolled back afterwards.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null

-- Test harness ----------------------------------------------------------------------
create schema if not exists t;
grant usage on schema t to anon, authenticated;
create table if not exists t.results (id serial, label text, expected text, actual text, detail text);
grant insert, select on t.results to anon, authenticated;
grant usage on sequence t.results_id_seq to anon, authenticated;

create or replace function t.login(uid uuid, email text default null) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'email', email)::text, false);
$$;
create or replace function t.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false);
$$;
-- Runs `sql`; "ok" if it ran and changed/returned at least one row, else "blocked".
-- Always rolled back so scenarios don't affect each other.
create or replace function t.try(label text, expected text, sql text) returns void language plpgsql as $$
declare n bigint := 0; outcome text; detail text := '';
begin
  begin
    execute sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = '__rollback__:' || n;
  exception when others then
    if sqlerrm like '__rollback__:%' then
      n := substring(sqlerrm from 14)::bigint;
      outcome := case when n > 0 then 'ok' else 'blocked' end;
      detail := n || ' row(s)';
    else
      outcome := 'blocked'; detail := sqlerrm;
    end if;
  end;
  insert into t.results(label, expected, actual, detail) values (label, expected, outcome, detail);
end; $$;
-- Records a single value seen by the current user.
create or replace function t.see(label text, expected text, sql text) returns void language plpgsql as $$
declare v text;
begin
  begin execute sql into v; exception when others then v := 'error: ' || sqlerrm; end;
  insert into t.results(label, expected, actual, detail) values (label, expected, v, '');
end; $$;
grant execute on all functions in schema t to anon, authenticated;

-- Scenario data (inserted as the database owner) -----------------------------------
select t.logout();
insert into public.profiles(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'manager@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'cleaner@test.invalid'),
  ('00000000-0000-0000-0000-00000000000d', 'maint@test.invalid'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@test.invalid'),
  ('00000000-0000-0000-0000-00000000000f', 'newhire@test.invalid'),
  ('00000000-0000-0000-0000-000000000010', 'outsider@test.invalid');

insert into public.groups(id, name, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Test Team', '00000000-0000-0000-0000-00000000000a');
insert into public.group_members(group_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'manager'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'cleaner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'maintenance'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'administrator');

insert into public.properties(id, owner_id, property_name, cleaning_fee, owner_phone, group_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Sea Test', 500, '555-0100', '10000000-0000-0000-0000-000000000001');
insert into public.reservations(id, owner_id, property_id, departure, group_id, assigned_user_id, customer_cleaning_charge, status) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-15', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 100, 'Scheduled'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-10-16', '10000000-0000-0000-0000-000000000001', null, 120, 'Scheduled');
insert into public.cleaner_jobs(id, cleaner_id, customer_name, job_type, scheduled_date, amount_cents, assigned_user_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Client', 'Deep Clean', '2026-10-20', 5000, '00000000-0000-0000-0000-00000000000c');
insert into public.invoices(cleaner_id, customer_name, total_cents, status, group_id) values
  ('00000000-0000-0000-0000-00000000000a', 'Client', 35000, 'sent', '10000000-0000-0000-0000-000000000001');
insert into public.group_invites(id, group_id, email, invited_role, invited_by) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'newhire@test.invalid', 'cleaner', '00000000-0000-0000-0000-00000000000a');

-- Expected results differ before/after the migration where a gap is being closed.
\if :{?mode}
\else
  \set mode current
\endif
select (:'mode' = 'migrated') as migrated \gset

set role authenticated;

-- Manager (cannot promote, cannot touch owners/managers/admins, cannot change own role)
select t.login('00000000-0000-0000-0000-00000000000b');
select t.try('Manager promotes self to owner', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.group_members set role='owner' where user_id='00000000-0000-0000-0000-00000000000b'$$);
select t.try('Manager promotes cleaner to manager', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.group_members set role='manager' where user_id='00000000-0000-0000-0000-00000000000c'$$);
select t.try('Manager demotes the owner', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.group_members set role='cleaner' where user_id='00000000-0000-0000-0000-00000000000a'$$);
select t.try('Manager removes an administrator', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$delete from public.group_members where user_id='00000000-0000-0000-0000-00000000000e'$$);
select t.try('Manager adds a new administrator', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$insert into public.group_members(group_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','administrator')$$);
select t.try('Manager invites a manager', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$insert into public.group_invites(group_id,email,invited_role,invited_by) values ('10000000-0000-0000-0000-000000000001','x@test.invalid','manager','00000000-0000-0000-0000-00000000000b')$$);
select t.try('Manager adds a cleaner', 'ok',
  $$insert into public.group_members(group_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','cleaner')$$);
select t.try('Manager changes cleaner to maintenance', 'ok',
  $$update public.group_members set role='maintenance' where user_id='00000000-0000-0000-0000-00000000000c'$$);
select t.try('Manager removes maintenance staff', 'ok',
  $$delete from public.group_members where user_id='00000000-0000-0000-0000-00000000000d'$$);
select t.try('Manager invites maintenance staff', 'ok',
  $$insert into public.group_invites(group_id,email,invited_role,invited_by) values ('10000000-0000-0000-0000-000000000001','y@test.invalid','maintenance','00000000-0000-0000-0000-00000000000b')$$);
select t.try('Manager revokes a pending invite', 'ok',
  $$update public.group_invites set status='revoked' where id='50000000-0000-0000-0000-000000000001'$$);

-- Owner keeps full control, but a team always keeps an owner
select t.login('00000000-0000-0000-0000-00000000000a');
select t.try('Owner promotes cleaner to manager', 'ok',
  $$update public.group_members set role='manager' where user_id='00000000-0000-0000-0000-00000000000c'$$);
select t.try('Owner invites an administrator', 'ok',
  $$insert into public.group_invites(group_id,email,invited_role,invited_by) values ('10000000-0000-0000-0000-000000000001','z@test.invalid','administrator','00000000-0000-0000-0000-00000000000a')$$);
select t.try('Sole owner demotes self', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.group_members set role='manager' where user_id='00000000-0000-0000-0000-00000000000a'$$);
select t.try('Owner adds an inspector', case when :'migrated'::boolean then 'ok' else 'blocked' end,
  $$insert into public.group_members(group_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','inspector')$$);
select t.try('Owner deletes the whole team (cascade)', 'ok',
  $$delete from public.groups where id='10000000-0000-0000-0000-000000000001'$$);
select t.try('Owner edits reservation charge', 'ok',
  $$update public.reservations set customer_cleaning_charge=150 where id='30000000-0000-0000-0000-000000000001'$$);

-- Assigned cleaner: status, shared notes, timeline only
select t.login('00000000-0000-0000-0000-00000000000c');
select t.try('Cleaner updates status, notes, timeline', 'ok',
  $$update public.reservations set status='In Progress', notes='Started', timeline='["started"]' where id='30000000-0000-0000-0000-000000000001'$$);
select t.try('Cleaner changes customer charge', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.reservations set customer_cleaning_charge=999 where id='30000000-0000-0000-0000-000000000001'$$);
select t.try('Cleaner changes checkout date', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.reservations set departure='2026-12-01' where id='30000000-0000-0000-0000-000000000001'$$);
select t.try('Cleaner completes assigned job', 'ok',
  $$update public.cleaner_jobs set status='completed', notes='Done' where id='40000000-0000-0000-0000-000000000001'$$);
select t.try('Cleaner changes job amount', case when :'migrated'::boolean then 'blocked' else 'ok' end,
  $$update public.cleaner_jobs set amount_cents=1 where id='40000000-0000-0000-0000-000000000001'$$);
select t.try('Cleaner updates unassigned task', 'blocked',
  $$update public.reservations set status='Done' where id='30000000-0000-0000-0000-000000000002'$$);
select t.see('Cleaner sees reservations', '1', $$select count(*) from public.reservations$$);
select t.see('Cleaner sees invoices', '0', $$select count(*) from public.invoices$$);

-- Maintenance: the reported "sees all tasks and payment totals" issue
select t.login('00000000-0000-0000-0000-00000000000d');
select t.see('Maintenance sees reservations', '0', $$select count(*) from public.reservations$$);
select t.see('Maintenance sees invoices', '0', $$select count(*) from public.invoices$$);
select t.see('Maintenance payment total (cents)', '0',
  $$select coalesce(sum(total_cents),0) from public.invoices where status in ('sent','viewed','overdue')$$);
select t.see('Maintenance sees jobs', '0', $$select count(*) from public.cleaner_jobs$$);
select t.try('Maintenance updates a task', 'blocked',
  $$update public.reservations set status='Done' where id='30000000-0000-0000-0000-000000000002'$$);

-- Private business notes (migrated only)
\if :migrated
select t.login('00000000-0000-0000-0000-00000000000a');
reset role;
insert into public.private_business_notes(entity_type, entity_id, group_id, owner_id, body) values
  ('reservation', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Owner pays late');
set role authenticated;
select t.see('Owner reads private note', '1', $$select count(*) from public.private_business_notes$$);
select t.login('00000000-0000-0000-0000-00000000000b');
select t.see('Manager reads private note', '1', $$select count(*) from public.private_business_notes$$);
select t.login('00000000-0000-0000-0000-00000000000c');
select t.see('Assigned cleaner reads private note', '0', $$select count(*) from public.private_business_notes$$);
select t.try('Cleaner writes private note', 'blocked',
  $$insert into public.private_business_notes(entity_type, entity_id, group_id, owner_id, body) values ('reservation','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','x')$$);
\endif

-- Signed-in invitation and workspace flows keep working
select t.login('00000000-0000-0000-0000-00000000000f', 'newhire@test.invalid');
select t.see('Invitee sees pending invite', '1', $$select count(*) from public.get_my_pending_group_invites()$$);
select t.try('Invitee accepts invite', 'ok', $$select public.accept_my_group_invite('50000000-0000-0000-0000-000000000001')$$);
select t.try('Invitee declines invite', 'ok', $$select public.decline_my_group_invite('50000000-0000-0000-0000-000000000001')$$);
select t.try('Signed-in user creates a workspace', 'ok', $$select * from public.create_my_business_workspace('New Biz')$$);

-- Signed-out (anon) callers
reset role;
set role anon;
select t.logout();
select t.try('Anon: accept_my_group_invite', 'blocked', $$select public.accept_my_group_invite('50000000-0000-0000-0000-000000000001')$$);
select t.try('Anon: decline_my_group_invite', 'blocked', $$select public.decline_my_group_invite('50000000-0000-0000-0000-000000000001')$$);
select t.try('Anon: create_my_business_workspace', 'blocked', $$select * from public.create_my_business_workspace('Anon Biz')$$);
select t.try('Anon: add_group_creator_as_owner', 'blocked', $$select public.add_group_creator_as_owner()$$);
select t.try('Anon: link_group_contact_to_active_member', 'blocked', $$select public.link_group_contact_to_active_member()$$);
select t.see('Anon can execute get_my_pending_group_invites', case when :'migrated'::boolean then 'false' else 'true' end,
  $$select has_function_privilege('anon','public.get_my_pending_group_invites()','EXECUTE')::text$$);
select t.see('Anon can execute can_manage_group', case when :'migrated'::boolean then 'false' else 'true' end,
  $$select has_function_privilege('anon','public.can_manage_group(uuid)','EXECUTE')::text$$);
select t.see('Anon can execute has_group_role', case when :'migrated'::boolean then 'false' else 'true' end,
  $$select has_function_privilege('anon','public.has_group_role(uuid,text[])','EXECUTE')::text$$);
select t.see('Anon can execute is_group_member', case when :'migrated'::boolean then 'false' else 'true' end,
  $$select has_function_privilege('anon','public.is_group_member(uuid)','EXECUTE')::text$$);
select t.see('Signed-in can execute is_group_member', 'true',
  $$select has_function_privilege('authenticated','public.is_group_member(uuid)','EXECUTE')::text$$);
reset role;

-- Report -------------------------------------------------------------------------------
\echo
\o
\pset tuples_only off
\echo === Results (mode: :mode) ===
select case when expected = actual then 'PASS' else 'FAIL' end as result, label, expected, actual, detail
from t.results order by id;
select count(*) filter (where expected = actual) as passed,
       count(*) filter (where expected <> actual) as failed
from t.results \gset
\echo :passed passed, :failed failed
select (:failed = 0) as all_passed \gset
\if :all_passed
\else
  \echo SOME CHECKS FAILED
  select 1/0;
\endif
