# Déjà View - Backend API

Node.js + Express backend for Déjà View location journaling app.

## Stack

- **Node.js** v25+
- **Express** - REST API
- **Prisma** - ORM for PostgreSQL
- **Supabase** - Managed PostgreSQL + Auth
- **Multer** - File upload handling
- **Sharp** - Image generation for sharing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials

3. Run migrations:
```bash
npm run prisma:migrate
```

4. Start development server:
```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start server with watch mode
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## API Endpoints

### Health Check
- `GET /health` - API health status
- `GET /api/test-db` - Test database connection

### Import
- `POST /api/import` - Upload Google Takeout JSON file (multipart/form-data)
- `GET /api/enrichment-status` - Check background enrichment progress

### Stats
- `GET /api/stats` - User's overall statistics
- `GET /api/interesting-day` - Find the most interesting day to display

### Days
- `GET /api/days?month=YYYY-MM` - Get calendar data for month
- `GET /api/days/:date` - Get full day data with summary:
  - Visits with place details
  - GPS path for map drawing
  - Distance by activity type
  - Weather with mood/emoji
  - Summary stats (place count, distance, active time)

### Places
- `GET /api/places/:id` - Get place details with user-specific visit stats:
  - Place info (name, address, image, types)
  - Stats (first/last visit, total visits, unique days, avg duration)
  - Recent visits (last 10)

### Share Images
- `POST /api/share/generate-image` - Generate shareable day summary image
  - Request body: `{ date, placeIds?, options: { showTimes, showDurations, showPlaceNames } }`
  - Returns: `{ imageId, imageUrl }`
- `GET /api/share/images/:imageId.png` - Download generated image
- `GET /api/share/history` - List user's previously generated images

## Database Schema

See `prisma/schema.prisma` for complete schema:

- **User** - Linked to Supabase Auth
- **Location** - Raw GPS breadcrumbs
- **Visit** - Time spent at places
- **Place** - Unique destinations (enriched)
- **DayData** - Daily aggregations (weather, distance, etc.)
- **Enrichment** - API call tracker
- **WeatherCache** - Shared weather data by ZIP+date
- **SharedImage** - Generated share images metadata

## Enrichment

### Automatic (after import)
Weather enrichment runs automatically after import:
- Uses free Open-Meteo Archive API
- ZIP code caching for efficiency
- Mood categories (clear, rain, snow, etc.) for UI theming

### CLI Scripts

**Place enrichment with Google Places API:**
```bash
node scripts/enrich-places.js [--dry-run] [--limit=N]
```

**OSM Nominatim fallback for failed places:**
```bash
node scripts/enrich-osm-fallback.js [--dry-run] [--limit=N]
```
Use this for places where Google Place IDs have expired (closed businesses).
Gets address and business names from OpenStreetMap (free, rate-limited 1 req/sec).

**Weather enrichment:**
```bash
node scripts/enrich-weather.js [--dry-run] [--limit=N]
```

## Development

Prisma migrations are in `prisma/migrations/`. To view/edit the database:

```bash
npm run prisma:studio
```
