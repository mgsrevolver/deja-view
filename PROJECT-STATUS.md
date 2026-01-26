# Project Status - Deja View

**Project Name**: Deja View _(You've been here before)_
**Last Updated**: 2026-01-26
**Current Phase**: Phase 3 In Progress - Place Enrichment Complete

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
- Placeholder cards for future enrichments (weather, music, photos)
- Distance traveled breakdown by activity type

### Phase 3 - Place Enrichment (Partial)
- Google Places API integration
- Enrichment CLI script (`backend/scripts/enrich-places.js`)
- **3,335 places enriched** with names, addresses, types, photo URLs
- 171 failed (expired Place IDs from closed businesses - expected for 13 years of data)
- Enrichment tracking in database to prevent duplicate API calls
- Places cached globally for future users

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

### Phase 3 - Remaining Tasks
1. **OSM Nominatim fallback** - For failed Place IDs and free tier users
2. **Display place photos** - Photo URLs are stored, need to show in VisitCard
3. **Show addresses in UI** - Already stored, just need to display

### Phase 4 - Weather Enrichment
- Open-Meteo API (free, historical data)
- Store in DayData table
- Display in weather card

### Phase 5 - Tier 2 Access (Non-technical users)
- OAuth flow for Google Cloud connection, OR
- Prepaid credits system, OR
- Partner pricing with Google
- Goal: Make premium enrichment accessible without technical setup

### Future Improvements
- Spotify listening history integration
- Photo integration (Google Photos API or local)
- Background import with progress bar (for web UI)
- User authentication (Supabase Auth)
- Export/sharing features

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
| APIs | Google Places (enrichment), Open-Meteo (planned) |

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
      JournalView.jsx   # Main split-screen layout
      MapPane.jsx       # Leaflet map with markers/paths
      Sidebar.jsx       # Day summary + timeline
      VisitCard.jsx     # Individual visit display
      CalendarPicker.jsx # Date navigation modal
    App.jsx             # Root component with React Query

backend/
  src/
    server.js           # Express API server
    services/
      location-import.js   # Google Takeout parser
      place-enrichment.js  # Google Places + OSM integration
  scripts/
    enrich-places.js    # CLI for batch enrichment
  prisma/
    schema.prisma       # Database schema

scripts/
  import-google-takeout.js # CLI import tool
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Overall stats (total visits, date range) |
| `GET /api/days?month=YYYY-MM` | Days with visit counts for calendar |
| `GET /api/days/:date` | Full day data (visits, path, distance) |
| `GET /api/interesting-day` | Day with most unique places |
| `GET /health` | Health check |

---

## Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
GOOGLE_PLACES_API_KEY=...  # For place enrichment
PORT=3001
NODE_ENV=development
```
