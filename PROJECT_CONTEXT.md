# Trackora - Staff Tracking App

## Project Overview

Trackora is a staff tracking and attendance management app built for internal company use. The app helps track staff live locations and manage attendance, replacing expensive market solutions.

## Key Requirements

### Core Features
1. **OTP Login** - Phone number-based authentication (no passwords)
2. **Attendance Management**
   - Check-in with GPS location
   - Check-out with GPS location
   - Automatic calculation of working hours
   - Prevent multiple check-ins per day
3. **Live Location Tracking**
   - Location update every **2 minutes**
   - Only during work hours (after check-in)
   - Auto-stop after check-out
   - Background tracking on Android
4. **Role-Based Access Control (RBAC)**
   - **Staff**: Can only check-in/check-out, cannot edit anything
   - **Manager**: Can view team attendance, edit same-day attendance, view staff locations
   - **Admin/Board**: Full access - add/remove staff, assign roles, view/edit all data, export reports

### Platform Strategy
- **Android App**: For staff (all staff use Android devices)
- **Web Admin Dashboard**: For board members and managers (3-4 people) - Built with Expo Web in the same project
- **No iOS App Store**: Skipping Apple App Store to avoid approval delays and fees

## Tech Stack

### Single Expo Project (Mobile + Web)
- **Framework**: Expo (React Native) ✅ Already set up
- **Navigation**: Expo Router ✅ Already set up (supports web routing)
- **Web Support**: Expo Web ✅ Built-in support
- **UI Styling**: **NativeWind** (Tailwind CSS for React Native) - Recommended
  - Works on both mobile and web
  - Fast development with utility classes
  - Responsive design built-in
  - Perfect for rapid MVP development
- **Backend**: Supabase (to be integrated)
  - Authentication (OTP)
  - PostgreSQL Database
  - Realtime subscriptions
  - Row Level Security (RLS)
- **Platform Detection**: Use `Platform.OS` or Expo Router's platform-specific routes

### Why Single Project?
- ✅ Simpler architecture - one codebase to maintain
- ✅ Shared authentication logic
- ✅ Shared Supabase client
- ✅ Shared types/interfaces
- ✅ Easier deployment
- ✅ Perfect for 3-4 board members (no need for complex Next.js setup)
- ✅ Expo Router handles web routing automatically

## Database Schema

### Tables
1. **profiles** - User profiles linked to Supabase Auth
   - id (uuid, references auth.users)
   - full_name (text)
   - phone (text, unique)
   - role (staff/manager/admin)
   - is_active (boolean)

2. **attendance** - Daily attendance records
   - id (uuid)
   - user_id (uuid, references profiles)
   - check_in_time (timestamp)
   - check_in_lat, check_in_lng (coordinates)
   - check_out_time (timestamp)
   - check_out_lat, check_out_lng (coordinates)
   - total_minutes (integer)
   - status (present/absent/half-day)
   - Unique constraint: (user_id, date(check_in_time))

3. **location_logs** - Location tracking data (every 2 minutes)
   - id (bigint, auto-increment)
   - user_id (uuid, references profiles)
   - latitude, longitude (double precision)
   - accuracy (double precision)
   - recorded_at (timestamp)

4. **teams** (Optional) - Team management
   - id (uuid)
   - name (text)
   - manager_id (uuid, references profiles)

5. **team_members** - Team membership
   - id (uuid)
   - team_id (uuid, references teams)
   - user_id (uuid, references profiles)

### Security (Row Level Security)
- **Staff**: Can only read/insert their own data
- **Manager**: Can read team members' data, edit same-day attendance
- **Admin**: Full access to all data

## User Flows

### Staff Flow
1. Login with phone number → OTP verification
2. Check-in → Captures time + GPS location → Starts location tracking
3. Location updates every 2 minutes (background)
4. Check-out → Stops tracking → Calculates total minutes

### Manager Flow
1. Login (same OTP system)
2. View team attendance dashboard
3. View staff live locations on map
4. Edit attendance (same day only)
5. Approve corrections
6. View reports

### Admin/Board Flow
1. Login via web dashboard (same Expo app, web version)
2. Full access to all features:
   - Add/remove staff
   - Assign roles
   - View & edit all attendance
   - Full location history
   - Export reports
   - System settings
3. Access via browser (works on iPhone Safari, iPad, desktop)

## Implementation Priority

### Phase 1 (MVP - 1 week)
1. ✅ Project setup (Expo) - DONE
2. Supabase integration
3. OTP authentication
4. Check-in/Check-out functionality
5. Basic location tracking (2-minute interval)
6. Staff app UI
7. Android build

### Phase 2
1. Admin web dashboard (same Expo project, web routes)
2. Manager features
3. Reports and analytics
4. Map visualization
5. Platform-specific UI optimizations (mobile vs web)

### Phase 3 (Future)
1. iOS app (if needed)
2. Geo-fencing
3. Advanced features
4. SaaS conversion

## Important Considerations

### Legal & Ethical
- Inform employees clearly about tracking
- Track only during working hours
- Stop tracking after check-out
- Mention in company policy

### Technical
- 2-minute tracking increases battery usage (acceptable for work apps)
- Android handles background tracking well
- Location logs can grow large - need cleanup/archival strategy
- Use Supabase RLS for security (don't rely on app-level checks)

## Project Structure (Single Expo Project)

### Route Organization
```
app/
├── (auth)/              # Authentication screens (shared)
│   ├── login.tsx        # OTP login (works on mobile & web)
│   └── verify.tsx        # OTP verification
├── (mobile)/            # Mobile-only screens (staff app)
│   ├── _layout.tsx      # Mobile layout
│   ├── checkin.tsx      # Check-in screen
│   ├── checkout.tsx     # Check-out screen
│   └── dashboard.tsx    # Staff dashboard
├── (web)/               # Web-only screens (admin dashboard)
│   ├── _layout.tsx      # Web layout (desktop-friendly)
│   ├── admin/
│   │   ├── staff.tsx    # Staff management
│   │   ├── attendance.tsx # Attendance view
│   │   └── locations.tsx   # Live location map
│   └── manager/
│       └── team.tsx     # Manager dashboard
└── _layout.tsx          # Root layout (handles platform detection)
```

### Platform Detection
- Use `Platform.OS === 'web'` to detect web
- Use Expo Router's platform-specific routes: `app/(mobile)/` and `app/(web)/`
- Or use conditional rendering within components

### Benefits of Single Project
- ✅ One Supabase client configuration
- ✅ Shared authentication logic
- ✅ Shared types/interfaces
- ✅ Shared utilities and helpers
- ✅ Single deployment pipeline
- ✅ Easier maintenance
- ✅ Perfect for small team (3-4 board members)

## Next Steps

1. Set up Supabase project
2. Create database schema (SQL provided in conversation)
3. Configure Supabase Auth for OTP
4. Install required Expo packages:
   - `expo-location` for GPS
   - `@supabase/supabase-js` for backend
   - `expo-task-manager` for background tasks
5. Implement OTP login screen (shared for mobile & web)
6. Implement check-in/check-out screens (mobile routes)
7. Implement background location tracking (mobile only)
8. Build admin dashboard (web routes in same Expo project)
9. Use platform detection to show different UIs for mobile vs web
10. Test web version: `npm run web` or `expo start --web`

## Notes from ChatGPT Conversation

- App name: **Trackora** (Track + Aura)
- Logo concept: Location pin inside circular ring with checkmark
- Colors: Primary #2563EB (Blue), Accent #22C55E (Green)
- Timeline: 1 week for MVP (Android only)
- Cost: ~₹1,000-2,000/month for Supabase, no per-user fees
