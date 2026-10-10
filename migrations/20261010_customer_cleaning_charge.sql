-- Customer charge persistence and restricted property fee resolution. No backfill, trigger, assignment, or RLS changes.
begin;
alter table public.reservations
  add column customer_cleaning_charge numeric(12,2)
  check (customer_cleaning_charge >= 0);
comment on column public.reservations.customer_cleaning_charge is
  'Optional customer cleaning charge override. NULL resolves the property standard fee; 0 is explicit no charge. Not employee compensation.';

-- An unnamed row argument exposes a PostgREST computed field, not a new RPC.
-- RLS still governs the property rows; only the charge is returned to clients.
create function public.property_standard_cleaning_charge(public.properties)
returns numeric language plpgsql stable security invoker
set search_path = pg_catalog, public
as $$
declare
  property alias for $1;
  details jsonb;
  fee text;
begin
  if property.cleaning_fee is not null then return property.cleaning_fee; end if;
  if property.notes is null or left(property.notes, 21) <> 'AMR_CLEANER_PROPERTY:' then return null; end if;
  begin
    details := substring(property.notes from 22)::jsonb;
    fee := details->>'cleaningFee';
    if fee ~ '^\d+(\.\d+)?$' and fee::numeric <= 9999999999.99 then return round(fee::numeric, 2); end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return null;
  end;
  return null;
end;
$$;
revoke all on function public.property_standard_cleaning_charge(public.properties) from public;
revoke execute on function public.property_standard_cleaning_charge(public.properties) from anon;
grant execute on function public.property_standard_cleaning_charge(public.properties) to authenticated;
notify pgrst, 'reload schema';
commit;
