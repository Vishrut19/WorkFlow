-- =====================================================
-- RPC FUNCTION: get_admin_locations
-- =====================================================
-- Single query for admin map: today's latest location per user + status
-- (live / lastSeen / offline). Replaces 2 sequential queries in LiveMap.

create or replace function public.get_admin_locations()
returns table (
  user_id uuid,
  full_name text,
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz,
  check_in_time timestamptz,
  status text
)
language plpgsql
security definer
stable
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  with today_start as (
    select (current_date at time zone 'UTC')::timestamptz as ts
  ),
  thirty_mins_ago as (
    select now() - interval '30 minutes' as t
  ),
  latest_logs as (
    select
      ll.user_id,
      ll.latitude,
      ll.longitude,
      ll.recorded_at,
      row_number() over (partition by ll.user_id order by ll.recorded_at desc) as rn
    from public.location_logs ll
    cross join today_start t
    where ll.recorded_at >= t.ts
  ),
  with_status as (
    select
      rl.user_id,
      rl.latitude,
      rl.longitude,
      rl.recorded_at,
      case
        when rl.recorded_at >= (select thirty_mins_ago.t from thirty_mins_ago) then 'live'::text
        else 'lastSeen'::text
      end as st
    from latest_logs rl
    where rl.rn = 1
  ),
  attendance_today as (
    select a.user_id, a.check_in_time
    from public.attendance a
    where a.attendance_date = current_date
      and a.check_out_time is null
  ),
  loc_rows as (
    select
      w.user_id,
      coalesce(p.full_name, 'Unknown') as full_name,
      w.latitude,
      w.longitude,
      w.recorded_at,
      att.check_in_time,
      w.st as status
    from with_status w
    join public.profiles p on p.id = w.user_id
    left join attendance_today att on att.user_id = w.user_id
  ),
  offline_rows as (
    select
      att.user_id,
      coalesce(p.full_name, 'Unknown') as full_name,
      0::double precision as latitude,
      0::double precision as longitude,
      att.check_in_time as recorded_at,
      att.check_in_time,
      'offline'::text as status
    from attendance_today att
    join public.profiles p on p.id = att.user_id
    where not exists (select 1 from with_status w where w.user_id = att.user_id)
  )
  select * from (
    select lr.user_id, lr.full_name, lr.latitude, lr.longitude, lr.recorded_at, lr.check_in_time, lr.status from loc_rows lr
    union all
    select or_.user_id, or_.full_name, or_.latitude, or_.longitude, or_.recorded_at, or_.check_in_time, or_.status from offline_rows or_
  ) combined
  order by
    case combined.status when 'live' then 1 when 'lastSeen' then 2 else 3 end,
    combined.recorded_at desc nulls last;
end;
$$;

grant execute on function public.get_admin_locations() to authenticated;
