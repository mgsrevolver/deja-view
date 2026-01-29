# Deja View

Transform your Google Location History into an enriched, browseable journal with place details, weather data, distance analytics, and more.

**Deja View** - _You've been here before._ Browse your entire location history as an interactive, time-traveling journal.

## Features

- **Interactive Map** - Dark-themed map with visit markers, travel paths, and weather mood overlay
- **Timeline Sidebar** - Chronological list of places with photos, durations, and visit history
- **Place Enrichment** - Automatically resolve place names, addresses, and photos via Google Places
- **Weather Data** - Historical weather conditions displayed for each day
- **Distance Analytics** - Track walking, cycling, driving, and transit distances
- **Calendar Navigation** - Browse any day in your location history
- **Share Image** - Generate Instagram-style Polaroid collage of your day
- **Authentication** - Secure multi-user support with Supabase Auth
- **Fast Import** - Drag-and-drop import of 18k+ visits in ~15 seconds

## Screenshots

_Coming soon_

## Quick Start

```bash
# Clone and install
git clone https://github.com/mgsrevolver/deja-view.git
cd deja-view

# Install backend dependencies
cd backend && npm install

# Set up environment (copy and edit with your Supabase credentials)
cp .env.example .env

# Run database migrations
npx prisma db push

# Start backend
npm run dev

# In another terminal - install and start frontend
cd ../frontend && npm install && npm run dev

# Open http://localhost:5173
```

## Import Your Data

1. Export your location history from [Google Takeout](https://takeout.google.com)
   - Select only "Location History"
   - Choose JSON format
2. Run the import:
   ```bash
   node scripts/import-google-takeout.js ~/Downloads/Records.json
   ```

## Enrich Places (Optional)

To resolve place names and addresses:

```bash
cd backend

# Check how many places need enrichment
node scripts/enrich-places.js --dry-run

# Enrich with Google Places API (requires API key in .env)
node scripts/enrich-places.js
```

## Project Structure

```
├── frontend/          # React + Vite app
│   └── src/
│       └── components/
│           ├── JournalView.jsx
│           ├── MapPane.jsx
│           ├── Sidebar.jsx
│           └── ...
├── backend/           # Node.js + Express + Prisma
│   ├── src/
│   │   ├── server.js
│   │   └── services/
│   │       ├── location-import.js
│   │       └── place-enrichment.js
│   └── scripts/
│       └── enrich-places.js
└── scripts/           # CLI tools
    └── import-google-takeout.js
```

## Tech Stack

- **Frontend**: React 19, Vite, React Query, Leaflet, date-fns
- **Backend**: Node.js, Express, Prisma
- **Database**: PostgreSQL (Supabase)
- **APIs**: Google Places, Open-Meteo (weather)

## Roadmap

- [x] Google Takeout import (all 4 formats)
- [x] Interactive map with visit markers
- [x] Timeline sidebar with visit cards
- [x] Calendar navigation
- [x] Distance analytics by activity type
- [x] Google Places enrichment
- [x] Weather data enrichment
- [x] User authentication
- [x] Shareable day image export
- [ ] OSM Nominatim fallback (free tier)
- [ ] Spotify integration
- [ ] Google Photos integration

## License

MIT

## Contributing

Contributions welcome! See [PROJECT-STATUS.md](PROJECT-STATUS.md) for current status and next steps.
