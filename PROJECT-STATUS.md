# Project Status - Deja View

**Project Name**: Deja View _(You've been here before)_
**Last Updated**: 2026-01-26
**Current Phase**: Phase 2 Complete - Basic Journal UI Working

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

---

## Current Stats

- **Total Visits**: 18,096
- **Unique Places**: 3,557
- **Date Range**: March 2013 - January 2026
- **Import Speed**: ~15 seconds for full dataset

---

## Next Steps

### Phase 3 - Place Enrichment (Recommended Next)
1. **Resolve place names from Google Place IDs**
   - Many visits have Place IDs (e.g., `ChIJbz386z3GxokRJzyF2woceKs`)
   - Use Google Places API to fetch: name, address, photo, categories
   - Update Place table with enriched data

2. **Reverse geocoding fallback**
   - For visits without Place IDs, reverse geocode coordinates
   - Infer business/POI from address

3. **Enrichment tracking**
   - Use Enrichment table to prevent duplicate API calls
   - Handle rate limits gracefully

### Phase 4 - Weather Enrichment
- Open-Meteo API (free, historical data)
- Store in DayData table
- Display in weather card

### Phase 5 - Additional Enrichments
- Spotify listening history integration
- Photo integration (Google Photos API or local)
- News headlines for historical context

### Future Improvements
- Background import with progress bar (for web UI)
- User authentication (Supabase Auth)
- Mobile-responsive refinements
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

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Query, Leaflet, date-fns |
| Backend | Node.js, Express, Prisma |
| Database | PostgreSQL (Supabase) |
| APIs | Google Places (planned), Open-Meteo (planned) |

---

## Cost Estimates

| Service | Usage | Cost |
|---------|-------|------|
| Supabase | 500MB DB | $0/month (free tier) |
| Vercel | Hosting | $0/month (free tier) |
| Google Places API | ~3,500 places | ~$60 one-time ($200 free credit available) |
| Open-Meteo | Weather history | $0 (free) |

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
      location-import.js # Google Takeout parser
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
