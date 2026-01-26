# Deja View

Transform your Google Location History into an enriched, browseable journal with place details, weather data, distance analytics, and more.

**Deja View** - _You've been here before._ Browse your entire location history as an interactive, time-traveling journal.

## Features

- **Interactive Map** - View visits and travel paths on a Leaflet map
- **Timeline Sidebar** - Chronological list of places visited with duration
- **Place Enrichment** - Automatically resolve place names, addresses, and photos
- **Distance Analytics** - Track walking, cycling, and driving distances
- **Calendar Navigation** - Browse any day in your location history
- **Fast Import** - Import 18k+ visits in ~15 seconds

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
- [ ] OSM Nominatim fallback (free tier)
- [ ] Weather data enrichment
- [ ] Spotify integration
- [ ] Photo integration
- [ ] User authentication

## License

MIT

## Contributing

Contributions welcome! See [PROJECT-STATUS.md](PROJECT-STATUS.md) for current status and next steps.
