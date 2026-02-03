-- =====================================================
-- MANAGER RECRUITMENT PERMISSIONS
-- =====================================================

-- 1. Allow managers to insert into team_members for teams they manage
drop policy if exists "managers_insert_team_members" on public.team_members;
create policy "managers_insert_team_members"
on public.team_members for insert
with check (
  exists (
    select 1 from public.teams 
    where id = team_members.team_id 
    and manager_id = auth.uid()
  )
);

-- 2. Allow managers to delete from team_members for teams they manage
drop policy if exists "managers_delete_team_members" on public.team_members;
create policy "managers_delete_team_members"
on public.team_members for delete
using (
  exists (
    select 1 from public.teams 
    where id = team_members.team_id 
    and manager_id = auth.uid()
  )
);

-- 3. Ensure staff roles can be seen by everyone (for recruitment search)
drop policy if exists "users_read_all_staff_profiles" on public.profiles;
create policy "users_read_all_staff_profiles"
on public.profiles for select
using (role = 'staff' or id = auth.uid() or public.is_admin());

-- 4. Allow managers to see ALL staff profiles for recruitment
drop policy if exists "managers_and_admins_read_all_profiles" on public.profiles;
create policy "managers_and_admins_read_all_profiles"
on public.profiles for select
using (
  auth.uid() = id -- own profile
  or public.is_admin() -- admins see all
  or public.is_manager() -- managers see all (to recruit)
);

-- 5. Allow managers to create their own teams
drop policy if exists "managers_insert_teams" on public.teams;
create policy "managers_insert_teams"
on public.teams for insert
with check (
  public.is_manager() 
  and manager_id = auth.uid()
);

-- 6. Allow managers to update their own teams
drop policy if exists "managers_update_own_teams" on public.teams;
create policy "managers_update_own_teams"
on public.teams for update
using (manager_id = auth.uid());
