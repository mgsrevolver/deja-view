# Project Status - Déjà View

**Project Name**: Déjà View _(You've been here before)_
**Last Updated**: 2026-01-26
**Current Phase**: Phase 1 - Foundation (95% Complete - Ready for Testing!)

---

## ✅ Completed

### Project Initialization
- ✅ Created project directory
- ✅ Initialized git repository
- ✅ Named project "Déjà View"

### Database Setup (Supabase + Prisma)
- ✅ Supabase project created and connected
- ✅ Prisma schema created (5 tables: Location, Visit, Place, DayData, Enrichment)
- ✅ Initial migration applied successfully
- ✅ Database connection tested and working

### Backend (Node.js + Express + Prisma)
- ✅ Package.json with dependencies installed
- ✅ Express server with health check endpoints
- ✅ Prisma client generated and configured
- ✅ Environment variables configured
- ✅ README documentation

### Frontend (React + Vite)
- ✅ React app scaffolded with Vite
- ✅ Dependencies installed (React Router, React Query, Leaflet, date-fns)
- ✅ Environment variables configured
- ✅ README documentation

### Data Import System
- ✅ **Location import service** (`backend/src/services/location-import.js`)
  - Ported all 4 Python parsers to Node.js
  - Support for semanticSegments (Android)
  - Support for timelineObjects (iOS)
  - Support for locations (old E7 format)
  - Support for root array format
  - Timestamp parsing for all formats
  - Coordinate parsing (E7 and geo strings)
  - Visit extraction with metadata
  - Activity segment parsing
- ✅ **CLI import script** (`scripts/import-google-takeout.js`)
  - User-friendly interface
  - Date range filtering (--start, --end)
  - Progress indicators
  - Error handling
  - Help documentation

---

## 🧪 Ready for Testing

### Next Action: Test Import with Sample Data

You can now test the import with your Google Takeout data!

---

## 📋 How to Test the Import

### Option 1: Test with Sample Data (Recommended First)

If you have a Google Takeout export with location data:

```bash
# Navigate to project directory
cd "/Users/clay/Library/Mobile Documents/com~apple~CloudDocs/Documents/projects/location-history/journal"

# Test with a small date range first (e.g., 1 month)
node scripts/import-google-takeout.js ~/path/to/Records.json --start=2020-03-01 --end=2020-03-31

# Or import everything
node scripts/import-google-takeout.js ~/path/to/Records.json
```

### Option 2: Get Google Takeout Data

If you don't have your data yet:

1. Go to [https://takeout.google.com](https://takeout.google.com)
2. Click "Deselect all"
3. Scroll down and check only **"Location History"**
4. Click "Next step" → Choose file format: **JSON**
5. Click "Create export" and wait for email
6. Download and extract the archive
7. Look for `Records.json` or files in `Semantic Location History` folder

---

## 📋 Next Steps After Import Works

### Phase 1 Remaining Tasks

1. **Initialize Frontend** (React with Vite)
   - Run `npm create vite@latest frontend -- --template react`
   - Install dependencies: React Query, Leaflet, date-fns, TailwindCSS
   - Set up basic routing

2. **Initialize Backend** (Node.js + Express + Prisma)
   - Create `package.json`
   - Install: Express, Prisma, @prisma/client, @supabase/supabase-js
   - Create `.env` file with Supabase credentials

3. **Create Prisma Schema**
   - Define 5 tables: `Location`, `Visit`, `Place`, `DayData`, `Enrichment`
   - Run initial migration to Supabase

4. **Port Python Parsers to Node.js**
   - Reference: `/timeline_google-maps/generate_heatmap.py` (lines 1250-1693)
   - Create `backend/src/services/location-import.js`
   - Support all Google Takeout formats (semanticSegments, etc.)

5. **Build CLI Import Script**
   - Create `scripts/import-google-takeout.js`
   - Accept file path, optional date range
   - Progress tracking and error handling

6. **Test Import**
   - Import sample data (1-3 months) to verify parsing works
   - Verify data in Supabase dashboard

---

## 🗓️ 5-Day MVP Plan

### Day 1-2: Phase 1 - Foundation
- ✅ Project setup & git init
- 🚧 Supabase setup (in progress)
- ⏳ Frontend/backend initialization
- ⏳ Prisma schema & migrations
- ⏳ Port Python parsers to Node.js
- ⏳ CLI import script
- ⏳ Test with sample data

### Day 3-4: Phase 2 - Basic Journal UI
- ⏳ Split-screen layout (60% map, 40% sidebar)
- ⏳ Calendar picker modal
- ⏳ Backend API endpoints (`GET /api/days`, `GET /api/days/:date`)
- ⏳ Leaflet map with visit markers + paths
- ⏳ Sidebar with timeline, visit cards, hyperlinked dates
- ⏳ Navigation (Prev/Next/Today buttons)

### Day 5: Phase 3 - Distance Analytics (MVP Complete)
- ⏳ Calculate distance from activity segments
- ⏳ Display distance breakdown by type (walking, biking, driving)
- ⏳ Polish and bug fixes

### Post-MVP (Phases 4-6)
- Weather enrichment (Open-Meteo API)
- Google Places enrichment (names, photos, addresses)
- Spotify integration (listening history)

---

## 📊 Database Schema Overview

### Core Tables

1. **Location** - Raw GPS breadcrumbs
   - Fields: `id`, `lat`, `lon`, `timestamp`, `source`, `activityType`
   - Purpose: Draw paths, calculate distances

2. **Visit** - Time spent at places
   - Fields: `id`, `placeID`, `lat`, `lon`, `startTime`, `endTime`, `durationMinutes`, `semanticType`
   - Purpose: "You were at Starbucks 9-10am"

3. **Place** - Unique destinations (enriched)
   - Fields: `id` (Google Place ID), `name`, `defaultImageUrl`, `address`, `types`, visit statistics
   - Purpose: Place details and enrichment

4. **DayData** - Daily aggregations
   - Fields: `id`, `date`, `distanceByType`, `weather`, `spotifyTracks`
   - Purpose: Fast queries for journal view

5. **Enrichment** - API call tracker
   - Fields: `id`, `type`, `status`, `visitId`, `placeId`, `date`, `metadata`
   - Purpose: Prevent duplicate API calls, track enrichment status

---

## 🎯 Key Design Decisions

1. **Separate app from legacy viewer** - Both will coexist independently
2. **Cloud-based with Supabase** - Managed PostgreSQL, zero ops
3. **Support any date range** - Not hardcoded to specific years, handles whatever is in Takeout export
4. **Incremental enrichment** - Import data first, enrich later (weather/places/Spotify)
5. **Split-screen UI** - Map (left) + enriched timeline data (right)
6. **Hyperlinked dates** - Click any date reference to jump to that day

---

## 💰 Cost Estimates

| Service | Usage | Cost | Notes |
|---------|-------|------|-------|
| **Supabase** | 500MB DB | $0/month | Free tier (upgradable) |
| **Vercel** | Frontend hosting | $0/month | Free tier |
| **Google Places API** | ~5,000 places | ~$85 one-time | $200 free credit available |
| **Weather API** | Unlimited history | $0 | Open-Meteo free tier |
| **Spotify API** | Unlimited | $0 | Free |

**MVP cost: $0** (Supabase + Vercel free tiers)

---

## 📁 Project Structure

```
/journal/
├── .git/
├── .gitignore
├── README.md
├── PROJECT-STATUS.md        # This file
│
├── frontend/                # React app (to be created)
│   ├── src/
│   │   ├── components/
│   │   │   ├── JournalView.jsx
│   │   │   ├── MapPane.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── CalendarPicker.jsx
│   │   └── App.jsx
│   └── package.json
│
├── backend/                 # Node.js + Express (to be created)
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── location-import.js
│   │   └── server.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
└── scripts/                 # CLI tools (to be created)
    ├── import-google-takeout.js
    ├── enrich-weather.js
    └── enrich-places.js
```

---

## 🔗 Reference Files

- **Original plan**: See the full implementation plan you provided
- **Legacy viewer**: `/timeline_google-maps/` (do not modify)
- **Parser reference**: `/timeline_google-maps/generate_heatmap.py` (lines 1250-1693)

---

## 🚀 Quick Start (When You Return)

1. ✅ Check that Supabase project is created
2. Run: `cd "/Users/clay/Library/Mobile Documents/com~apple~CloudDocs/Documents/projects/location-history/journal"`
3. Continue with frontend/backend initialization
4. Ask Claude to continue from "Phase 1: Initialize frontend"

---

## 📝 Notes

- **Data flexibility**: App supports any date range from user's Takeout export (not limited to specific years)
- **Privacy**: Supabase RLS will ensure data isolation (add later)
- **Performance**: Designed to handle large datasets (100k+ GPS points)
- **Incremental development**: MVP first (browse + distances), then enrich with APIs

---

**STATUS**: Ready to continue when you have Supabase credentials. Next step is backend initialization.
