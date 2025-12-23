# Citizen Client (NagrikGPT)

Separate citizen-facing web app with local login, report submission, community upvotes, map view, profile, and settings. Supports Supabase for syncing reports with the government portal.

## Stack
- React + Vite + TypeScript
- TailwindCSS + next-themes (dark mode)
- React Router
- Leaflet (OSM + Satellite)
- Supabase (optional for sync)

## Setup
1. Node.js 18+
2. Install deps
   - npm install
3. Environment
   - Copy or edit `.env` (already created):
     - VITE_SUPABASE_URL=your_url
     - VITE_SUPABASE_ANON_KEY=your_anon_key
4. Run dev server
   - npm run dev
   - http://localhost:5174/

## Supabase schema
Paste in Supabase SQL editor:

```sql
create table if not exists reports (
  id text primary key,
  category text not null,
  priority text not null check (priority in ('Low','Medium','High','Urgent')),
  status text not null check (status in ('Pending','In Progress','Resolved','Rejected')),
  submitted_at timestamptz not null default now(),
  location_text text not null,
  lat double precision not null,
  lng double precision not null,
  reporter_name text,
  reporter_phone text,
  anonymous boolean not null default false,
  assigned_department text,
  assigned_officer_id text,
  assigned_officer_name text,
  deadline timestamptz,
  summary text,
  description text
);

create table if not exists report_timeline (
  id uuid primary key default gen_random_uuid(),
  report_id text not null references reports(id) on delete cascade,
  actor text not null,
  action text not null,
  at timestamptz not null default now()
);

create table if not exists votes (
  report_id text not null references reports(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'Citizen'
);
```

## Behavior
- If Supabase keys are set, reports are inserted and fetched from Supabase.
- If Supabase is not configured/unreachable, the app stores and reads reports from localStorage.
- Community upvotes use localStorage (can be moved to Supabase `votes` table later).

## Notes
- This app does not use Supabase Auth yet (as requested). Local login persists only in this browser.
- For the government portal, we will wire the same Supabase schema for real-time sync next.
