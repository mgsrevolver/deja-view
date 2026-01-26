# Location-Based Journaling App

Transform your Google Location History into an enriched, browseable journal with place details, weather data, distance analytics, and more.

## Project Structure

```
├── frontend/    # React app (Vite)
├── backend/     # Node.js + Express + Prisma
└── scripts/     # CLI tools for data import and enrichment
```

## Features (MVP)

- Browse location history by date
- View daily visits on interactive map
- Calculate distance traveled (by activity type)
- Import Google Takeout data

## Setup

### Prerequisites

- Node.js v25+
- PostgreSQL (via Supabase)
- Google Takeout location history export

### Getting Started

1. Set up Supabase project and get credentials
2. Configure environment variables (see backend/.env.example)
3. Install dependencies and run migrations
4. Import your Google Takeout data
5. Start frontend and backend

See `/backend/README.md` and `/frontend/README.md` for detailed setup instructions.

## Development Status

Currently in Phase 1: Foundation & Data Import
