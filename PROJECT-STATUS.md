# Project Status - Deja View

**Project Name**: Deja View _(You've been here before)_
**Last Updated**: 2026-01-29
**Current Phase**: Phase 6 - Polish & Integrations

---

## Completed

### Phase 1 - Foundation
- Project structure and git repository
- Supabase database with Prisma ORM
- 5-table schema: Location, Visit, Place, DayData, Enrichment
- Google Takeout import (all 4 formats supported)
- Batch import optimization (18k visits in ~15 seconds)

### Phase 2 - Basic Journal UI
- 60/40 split-screen layout (map left, sidebar right)
- Leaflet map with visit markers and activity paths
- Path coloring by activity type (walking/cycling/driving)
- Custom markers by semantic type (home/work/other)
- Sidebar with day summary and visit timeline
- Calendar picker with data highlighting
- Prev/Next/Today navigation
- "Interesting day" auto-selection (most unique places)
- Distance traveled breakdown by activity type

### Phase 3 - Place Enrichment
- Google Places API integration
- Enrichment CLI script (`backend/scripts/enrich-places.js`)
- **3,335 places enriched** with names, addresses, types, photo URLs
- 171 failed (expired Place IDs from closed businesses - expected for 13 years of data)
- Enrichment tracking in database to prevent duplicate API calls
- Places cached globally for future users

### Phase 4 - Multi-Tenancy & Authentication
**Database Security:**
- Added User model linked to Supabase Auth UUID
- Row Level Security (RLS) on all 6 tables
- Users can only access their own data
- Auth trigger auto-creates User record on Supabase signup
- Place table remains globally readable (shared cache)

**Backend Auth:**
- Supabase JWT validation middleware
- All `/api/*` routes require Bearer token
- Queries scoped to authenticated user
- CORS restricted to known origins
- Place stats added to API: firstVisitDate, lastVisitDate, totalVisits, totalMinutes

**Frontend Auth:**
- Complete login/signup flow with Supabase Auth
- `AuthContext` with user state and auth methods
- `fetchWithAuth()` helper injects Bearer tokens
- User menu in header (email + sign out)
- Protected routes (shows LoginPage when unauthenticated)

**Migration Scripts:**
- `scripts/apply-rls.js` - Applies RLS policies
- `scripts/migrate-user-data.js` - Assigns existing data to user account

### Phase 5 - Weather & UI Polish
**Backend:**
- Timezone-aware date queries (`tz` parameter on all date endpoints)
- Visits now grouped by local date, not UTC
- Helper functions: `toLocalDateString()`, `getDayBoundaries()`, `getMonthBoundaries()`
- Open-Meteo weather enrichment service (`backend/src/services/weather-enrichment.js`)
- Weather enrichment CLI script (`backend/scripts/enrich-weather.js`)
- Weather data backfilled for historical dates

**Frontend - Import & Data Loading:**
- Drag-and-drop import modal (`ImportModal.jsx`)
- Google Takeout instructions in UI
- Upload progress states and success summary
- Skeleton loaders for place panel and timeline

**Frontend - Map Enhancements:**
- CartoDB Dark Matter tiles (muted dark basemap)
- Weather mood overlay (subtle color tint based on conditions)
- Numbered markers matching timeline order
- Map markers click-to-select (replaced popups)
- Transit paths supported (blue color)

**Frontend - Sidebar Redesign:**
- Compact layout (68/32 split)
- Day summary card: weather emoji + condition + high/low temps
- Stats row: place count, total distance, active time
- Persistent travel stats bar (walking/biking/driving/transit)
- Expanded timeline when no place selected
- Compact timeline when place selected

**Frontend - Place Detail:**
- Hero photo from Google Places
- Place name, address, types
- Today's visit time and duration
- History card: total visits, time spent
- Clickable first/last visit dates for navigation
- Photo thumbnails in timeline items

---

## Current Stats

- **Total Visits**: 18,096
- **Unique Places**: 3,557
- **Enriched Places**: 3,335 (94%)
- **Date Range**: March 2013 - January 2026
- **Import Speed**: ~15 seconds for full dataset
- **Enrichment Cost**: $56.70 (one-time, cached for all users)

---

## Next Steps

### Phase 6 - Polish & Integrations (Current)
1. **OSM Nominatim fallback** - For 171 failed Place IDs (expired businesses)
2. **UI polish** - Any remaining rough edges
3. **Performance optimization** - Large day loading, calendar rendering

### Phase 7 - Tier 2 Access (Non-technical users)
- OAuth flow for Google Cloud connection, OR
- Prepaid credits system, OR
- Partner pricing with Google
- Goal: Make premium enrichment accessible without technical setup

### Future Improvements
- Spotify listening history integration
- Photo integration (Google Photos API or local)
- Background import with progress bar (for web UI)
- Export/sharing features
- User profile/settings page

---

## Quick Start

```bash
# Navigate to project
cd "/Users/clay/Library/Mobile Documents/com~apple~CloudDocs/Documents/projects/location-history/journal"

# Start backend (port 3001)
cd backend && npm run dev

# Start frontend (port 5173) - in another terminal
cd frontend && npm run dev

# Open http://localhost:5173
# Sign up with email/password (Supabase Auth)
```

### Migrate Existing Data to User

```bash
cd backend
# Get user's Supabase Auth UUID from Supabase dashboard
node scripts/migrate-user-data.js <user-uuid>
```

### Import Data

```bash
# Import Google Takeout data
node scripts/import-google-takeout.js ~/path/to/Records.json

# With date filtering
node scripts/import-google-takeout.js ~/path/to/Records.json --start=2020-01-01 --end=2020-12-31
```

### Enrich Places

```bash
cd backend

# Check status (dry run)
node scripts/enrich-places.js --dry-run

# Enrich all places (requires GOOGLE_PLACES_API_KEY in .env)
node scripts/enrich-places.js

# Enrich limited batch
node scripts/enrich-places.js --limit=100
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Query, Leaflet, date-fns |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL (Supabase) |
| APIs | Google Places (enrichment), Open-Meteo (weather) |

---

## Enrichment Strategy

### Tier 1 - Free (Default)
- OSM Nominatim for reverse geocoding (addresses)
- Shared cache of Google-enriched places from other users
- No API key required

### Tier 2 - Premium (BYOK or Credits)
- Full Google Places API enrichment
- Photos, detailed categories, business info
- User provides own API key OR purchases credits

### Cost Model
- Google Places API: ~$17 per 1,000 place lookups
- Cached places: $0 (enriched once, served to all users)
- OSM Nominatim: $0 (free, rate-limited)

---

## Architecture

```
frontend/
  src/
    components/
      JournalView.jsx    # Main 68/32 split layout
      MapPane.jsx        # Dark tiles, numbered markers, mood overlay
      Sidebar.jsx        # Day summary, travel stats, timeline, place detail
      ImportModal.jsx    # Drag-and-drop Google Takeout upload
      CalendarPicker.jsx # Date navigation modal
      LoginPage.jsx      # Auth login/signup form
    contexts/
      AuthContext.jsx    # Auth state + useAuth hook
    lib/
      supabase.js        # Supabase client init
      api.js             # fetchWithAuth() + uploadFile() helpers
    App.jsx              # Root with auth gating
    main.jsx             # AuthProvider + QueryClientProvider

backend/
  src/
    server.js            # Express API + JWT auth middleware
    services/
      location-import.js   # Google Takeout parser
      place-enrichment.js  # Google Places + OSM integration
      weather-enrichment.js # Open-Meteo historical weather
  scripts/
    enrich-places.js       # CLI for batch place enrichment
    enrich-weather.js      # CLI for batch weather enrichment
    apply-rls.js           # Apply RLS policies to Supabase
    migrate-user-data.js   # Assign existing data to user
  prisma/
    schema.prisma          # Database schema (6 tables + User)
    rls-policies.sql       # Row Level Security policies

scripts/
  import-google-takeout.js # CLI import tool
```

---

## API Endpoints

All `/api/*` routes require `Authorization: Bearer <token>` header (Supabase JWT).

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Overall stats (total visits, date range) |
| `GET /api/days?month=YYYY-MM` | Days with visit counts for calendar |
| `GET /api/days/:date` | Full day data (visits, path, distance, place stats) |
| `GET /api/interesting-day` | Day with most unique places |
| `GET /health` | Health check (unauthenticated) |

---

## Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...        # For JWT validation
GOOGLE_PLACES_API_KEY=...      # For place enrichment
PORT=3001
NODE_ENV=development

# frontend/.env.local
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...     # Same as SUPABASE_PUBLISHABLE_KEY
```

## Agent Role Definitions

Use these role definitions when running multi-pane Claude Code sessions. Start each pane with:
```bash
claude "Read PROJECT-STATUS.md. You have the [ROLE] role today."
```

### ORCHESTRATOR Role

**Identity**: Project coordinator for Deja View

**Context**:
- React 19 frontend (Vite, React Query, Leaflet) on port 5173
- Node/Express backend (Prisma ORM) on port 3001
- Supabase PostgreSQL database
- Currently in Phase 6: Polish & Integrations

**Responsibilities**:
- Coordinate work between frontend and backend specialists
- Handle all git operations (commits, pushes, branch management)
- Maintain PROJECT-STATUS.md and README.md documentation
- Resolve integration conflicts between frontend/backend changes
- Track API usage/costs (Google Places at $17/1k lookups, Open-Meteo free)
- Ensure schema changes are synced (Prisma migrations)

**Current Priorities**:
1. OSM Nominatim fallback for 171 failed Place IDs
2. UI polish and bug fixes
3. Performance optimization

**Constraints**:
- Only coordinate and delegate
- Never implement features directly
- All commits must include updated documentation

---

### FRONTEND Role

**Identity**: Frontend specialist for Deja View

**Stack**: React 19, Vite, React Query, Leaflet, date-fns

**Workspace**:
- Port: 5173
- Path: `frontend/src/`

**Components**:
- `JournalView.jsx` - 68/32 split layout with date navigation
- `MapPane.jsx` - Dark tiles, numbered markers, mood overlay, paths
- `Sidebar.jsx` - Day summary, travel stats, timeline, place detail
- `ImportModal.jsx` - Drag-and-drop Google Takeout upload
- `CalendarPicker.jsx` - Date navigation modal
- `LoginPage.jsx` - Auth login/signup form

**Current State**:
- Photos rendering in timeline thumbnails and place detail hero
- Weather showing in day summary card
- Numbered markers correlating map ↔ timeline
- Travel stats bar always visible
- Clickable first/last visit dates

**API Endpoints You Consume**:
- `GET /api/stats` - Overall stats
- `GET /api/days?month=YYYY-MM` - Days with visit counts
- `GET /api/days/:date` - Full day data (visits, path, weather, place stats)
- `GET /api/interesting-day` - Day with most unique places
- `POST /api/import` - Upload Google Takeout file

**Constraints**:
- NEVER touch backend code (`backend/` directory)
- NEVER modify database schema
- If API changes needed, request from backend specialist via orchestrator
- Use React Query for all data fetching
- All state management through React Query or component state

---

### BACKEND Role

**Identity**: Backend specialist for Deja View

**Stack**: Node.js, Express, Prisma, PostgreSQL (Supabase)

**Workspace**:
- Port: 3001
- Path: `backend/src/`

**Schema** (6 tables):
- `User` - Linked to Supabase Auth UUID
- `Location` - Raw lat/lng points (user-scoped via RLS)
- `Visit` - Semantic visits to places (user-scoped via RLS)
- `Place` - Unique locations with enrichment data (globally shared)
- `DayData` - Daily aggregates, weather data (user-scoped via RLS)
- `Enrichment` - API call tracking to prevent duplicates (user-scoped via RLS)

**Services**:
- `location-import.js` - Google Takeout parser (18k visits in ~15s)
- `place-enrichment.js` - Google Places + OSM Nominatim integration
- `weather-enrichment.js` - Open-Meteo historical weather

**Scripts**:
- `enrich-places.js` - Batch place enrichment CLI
- `enrich-weather.js` - Batch weather enrichment CLI

**Current Tasks**:
- Add OSM Nominatim fallback for 171 failed Place IDs (expired businesses)
- Performance optimization for large datasets

**API Endpoints You Maintain**:
- `GET /api/stats`
- `GET /api/days?month=YYYY-MM`
- `GET /api/days/:date`
- `GET /api/interesting-day`
- `POST /api/import`
- `GET /health`

**Environment Variables**:
- `DATABASE_URL` - Supabase PostgreSQL connection
- `GOOGLE_PLACES_API_KEY` - For place enrichment
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`

**Constraints**:
- NEVER touch frontend code (`frontend/` directory)
- All schema changes require Prisma migration AND orchestrator approval
- Track API costs (Google Places: $17/1k, Open-Meteo: free)
- Ensure enrichments are cached globally (shared across all users)
- Maintain backward compatibility for existing API consumers

---

## Multi-Pane Setup

**iTerm2 Layout**:
```
┌─────────────────────────────────┐
│   ORCHESTRATOR (top pane)       │
├─────────────────┬───────────────┤
│   FRONTEND      │   BACKEND     │
│  (bottom left)  │ (bottom right)│
└─────────────────┴───────────────┘
```

**Start Commands**:
```bash
# Top pane
claude "Read PROJECT-STATUS.md. You have the ORCHESTRATOR role today."

# Bottom left pane
claude "Read PROJECT-STATUS.md. You have the FRONTEND role today."

# Bottom right pane
claude "Read PROJECT-STATUS.md. You have the BACKEND role today."
```

**Communication Flow**:
1. User gives high-level request to orchestrator
2. Orchestrator delegates specific tasks to specialists
3. User copies orchestrator's instructions to specialist panes
4. Specialists implement and report completion
5. Orchestrator handles integration, git commits, documentation

---


