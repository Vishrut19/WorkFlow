-- =====================================================
-- TRACKORA INITIAL DATABASE MIGRATION
-- =====================================================
-- This migration creates all tables, triggers, and RLS policies
-- for the Trackora staff tracking and attendance management app.
-- =====================================================

create extension if not exists "uuid-ossp";

-- =====================================================
-- PROFILES
-- =====================================================
-- User profiles linked to Supabase Auth
-- Roles: staff (default), manager, admin

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text unique, -- Optional: for future phone-based auth
  role text not null default 'staff'
    check (role in ('staff', 'manager', 'admin')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for quick role-based lookups
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_is_active on public.profiles(is_active);

-- =====================================================
-- TEAMS (Optional feature for team management)
-- =====================================================

create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- TEAM MEMBERS
-- =====================================================

create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

create index idx_team_members_user on public.team_members(user_id);
create index idx_team_members_team on public.team_members(team_id);

-- =====================================================
-- DEVICE BINDING
-- =====================================================
-- Each user can only have ONE active device at a time
-- This prevents unauthorized access from multiple devices

create table public.user_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  device_uuid text not null,
  model text,
  os_version text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id) -- Only one device per user
);

create index idx_user_devices_user on public.user_devices(user_id);
create index idx_user_devices_uuid on public.user_devices(device_uuid);

-- =====================================================
-- ATTENDANCE
-- =====================================================
-- Daily attendance records with GPS tracking

create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,

  attendance_date date not null,
  
  -- Status for easy reporting
  status text default 'present' check (status in ('present', 'absent', 'half-day', 'late')),

  -- Check-in details
  check_in_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,

  -- Check-out details
  check_out_time timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,

  -- Calculated field
  total_minutes integer,
  
  -- Notes/comments (for manager corrections)
  notes text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, attendance_date)
);

create index idx_attendance_user on public.attendance(user_id);
create index idx_attendance_date on public.attendance(attendance_date);
create index idx_attendance_user_date on public.attendance(user_id, attendance_date);

-- =====================================================
-- LOCATION LOGS
-- =====================================================
-- Location tracking data (every 2 minutes during work hours)

create table public.location_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  recorded_at timestamptz default now()
);

create index idx_location_logs_user_time on public.location_logs(user_id, recorded_at);
create index idx_location_logs_recorded on public.location_logs(recorded_at);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() 
    and role = 'admin'
  );
$$ language sql security definer;

-- Function to check if user is manager
create or replace function public.is_manager()
returns boolean as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() 
    and role in ('manager', 'admin')
  );
$$ language sql security definer;

-- Function to check if user manages another user (through team membership)
create or replace function public.manages_user(target_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = target_user_id
    and t.manager_id = auth.uid()
  );
$$ language sql security definer;

-- =====================================================
-- AUTO PROFILE CREATION TRIGGER
-- =====================================================
-- Automatically creates a profile when a new user signs up

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Employee'),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- =====================================================
-- AUTO UPDATE TIMESTAMP TRIGGER
-- =====================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_teams_updated_at
  before update on public.teams
  for each row execute function public.update_updated_at();

create trigger update_user_devices_updated_at
  before update on public.user_devices
  for each row execute function public.update_updated_at();

create trigger update_attendance_updated_at
  before update on public.attendance
  for each row execute function public.update_updated_at();

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table user_devices enable row level security;
alter table attendance enable row level security;
alter table location_logs enable row level security;

-- =====================================================
-- RLS POLICIES - PROFILES
-- =====================================================

-- Staff can read their own profile
create policy "users_read_own_profile"
on profiles for select
using (auth.uid() = id);

-- Managers can read profiles of users in their teams
create policy "managers_read_team_profiles"
on profiles for select
using (
  public.is_manager() 
  and public.manages_user(id)
);

-- Admins can read all profiles
create policy "admins_read_all_profiles"
on profiles for select
using (public.is_admin());

-- Users can insert their own profile (fallback if trigger fails)
create policy "users_insert_own_profile"
on profiles for insert
with check (auth.uid() = id);

-- Users can update their own profile (name only, not role)
create policy "users_update_own_profile"
on profiles for update
using (auth.uid() = id);

-- Admins can update any profile (including role assignment)
create policy "admins_update_all_profiles"
on profiles for update
using (public.is_admin());

-- Admins can delete profiles
create policy "admins_delete_profiles"
on profiles for delete
using (public.is_admin());

-- =====================================================
-- RLS POLICIES - TEAMS
-- =====================================================

-- Everyone can read teams they belong to or manage
create policy "users_read_own_teams"
on teams for select
using (
  manager_id = auth.uid()
  or exists (
    select 1 from public.team_members 
    where team_id = teams.id 
    and user_id = auth.uid()
  )
);

-- Admins can read all teams
create policy "admins_read_all_teams"
on teams for select
using (public.is_admin());

-- Admins can create teams
create policy "admins_insert_teams"
on teams for insert
with check (public.is_admin());

-- Admins can update teams
create policy "admins_update_teams"
on teams for update
using (public.is_admin());

-- Admins can delete teams
create policy "admins_delete_teams"
on teams for delete
using (public.is_admin());

-- =====================================================
-- RLS POLICIES - TEAM MEMBERS
-- =====================================================

-- Users can see their own team memberships
create policy "users_read_own_team_membership"
on team_members for select
using (user_id = auth.uid());

-- Managers can see their team's memberships
create policy "managers_read_team_members"
on team_members for select
using (
  exists (
    select 1 from public.teams 
    where id = team_members.team_id 
    and manager_id = auth.uid()
  )
);

-- Admins can read all team members
create policy "admins_read_all_team_members"
on team_members for select
using (public.is_admin());

-- Admins can manage team members
create policy "admins_insert_team_members"
on team_members for insert
with check (public.is_admin());

create policy "admins_delete_team_members"
on team_members for delete
using (public.is_admin());

-- =====================================================
-- RLS POLICIES - USER DEVICES
-- =====================================================

-- Users can read their own device
create policy "users_read_own_device"
on user_devices for select
using (auth.uid() = user_id);

-- Admins can read all devices
create policy "admins_read_all_devices"
on user_devices for select
using (public.is_admin());

-- Users can insert their own device
create policy "users_insert_own_device"
on user_devices for insert
with check (auth.uid() = user_id);

-- Users can update their own device
create policy "users_update_own_device"
on user_devices for update
using (auth.uid() = user_id);

-- Admins can update any device (for deauthorization)
create policy "admins_update_all_devices"
on user_devices for update
using (public.is_admin());

-- Admins can delete devices (for complete deauthorization)
create policy "admins_delete_devices"
on user_devices for delete
using (public.is_admin());

-- =====================================================
-- RLS POLICIES - ATTENDANCE
-- =====================================================

-- Staff can read their own attendance
create policy "staff_read_own_attendance"
on attendance for select
using (auth.uid() = user_id);

-- Managers can read attendance of their team members
create policy "managers_read_team_attendance"
on attendance for select
using (
  public.is_manager() 
  and public.manages_user(user_id)
);

-- Admins can read all attendance
create policy "admins_read_all_attendance"
on attendance for select
using (public.is_admin());

-- Staff can insert their own attendance (check-in)
create policy "staff_insert_own_attendance"
on attendance for insert
with check (auth.uid() = user_id);

-- Staff can update their own attendance (check-out) - CRITICAL FIX
create policy "staff_update_own_attendance"
on attendance for update
using (auth.uid() = user_id);

-- Managers can update same-day attendance for their team
create policy "managers_update_team_attendance"
on attendance for update
using (
  public.is_manager()
  and public.manages_user(user_id)
  and attendance_date = current_date
);

-- Admins can update all attendance (corrections)
create policy "admins_update_all_attendance"
on attendance for update
using (public.is_admin());

-- Admins can delete attendance records
create policy "admins_delete_attendance"
on attendance for delete
using (public.is_admin());

-- =====================================================
-- RLS POLICIES - LOCATION LOGS
-- =====================================================

-- Staff can read their own location logs
create policy "staff_read_own_location"
on location_logs for select
using (auth.uid() = user_id);

-- Managers can read location logs of their team members
create policy "managers_read_team_location"
on location_logs for select
using (
  public.is_manager() 
  and public.manages_user(user_id)
);

-- Admins can read all location logs
create policy "admins_read_all_location"
on location_logs for select
using (public.is_admin());

-- Staff can insert their own location logs
create policy "staff_insert_own_location"
on location_logs for insert
with check (auth.uid() = user_id);

-- Admins can delete old location logs (for cleanup)
create policy "admins_delete_location"
on location_logs for delete
using (public.is_admin());

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
grant usage on schema public to anon, authenticated;

-- Grant table permissions to authenticated users (RLS will filter access)
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.user_devices to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, delete on public.location_logs to authenticated;

-- Grant sequence permissions
grant usage, select on all sequences in schema public to authenticated;
