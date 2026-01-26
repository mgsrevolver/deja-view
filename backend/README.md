# Déjà View - Backend API

Node.js + Express backend for Déjà View location journaling app.

## Stack

- **Node.js** v25+
- **Express** - REST API
- **Prisma** - ORM for PostgreSQL
- **Supabase** - Managed PostgreSQL database

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

### Days (Coming in Phase 2)
- `GET /api/days?month=YYYY-MM` - Get calendar data for month
- `GET /api/days/:date` - Get full day data (visits, paths, distances)

### Places (Coming in Phase 5)
- `GET /api/places/:id` - Get place details with visit statistics

## Database Schema

See `prisma/schema.prisma` for complete schema:

- **Location** - Raw GPS breadcrumbs
- **Visit** - Time spent at places
- **Place** - Unique destinations (enriched)
- **DayData** - Daily aggregations
- **Enrichment** - API call tracker

## Development

Prisma migrations are in `prisma/migrations/`. To view/edit the database:

```bash
npm run prisma:studio
```
