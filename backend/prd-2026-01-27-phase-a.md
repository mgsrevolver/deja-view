# PRD: Phase A - Backend
**Date:** 2026-01-27
**Status:** ✅ COMPLETE

## Context

**Vision:** Déjà View is a memory synthesis app. The magic is connecting disparate data (location, weather, music, photos) into a unified reflection experience. Every piece of context makes the memory richer.

---

## Completed Work

### 1. Import Endpoint ✅
- `POST /api/import` - Accepts Google Takeout JSON files (up to 150MB)
- Multer for file handling with in-memory storage
- Parses all 4 Takeout formats via existing `parseGoogleTakeoutData()`
- Associates imported data with authenticated user
- Returns summary: `locationsImported`, `visitsImported`, `placesCreated`

### 2. Background Enrichment ✅
- `runBackgroundEnrichment(userId)` triggers after import
- In-memory job tracking per user (`enrichmentJobs` Map)
- `GET /api/enrichment-status` returns job status and progress
- Weather enrichment runs automatically for all imported days
- Uses free Open-Meteo API (no cost)

### 3. Day Summary Stats ✅
`/api/days/:date` now returns a `summary` object:
```json
{
  "summary": {
    "placeCount": 7,
    "uniquePlaceCount": 5,
    "totalDistanceMiles": 4.2,
    "distanceByMode": { "walking": 2.1, "driving": 2.1 },
    "weather": {
      "high": 72,
      "low": 58,
      "condition": "clear",
      "description": "Clear Sky",
      "emoji": "☀️"
    },
    "firstVisit": "08:32",
    "lastVisit": "22:15",
    "totalActiveMinutes": 285
  }
}
```

### 4. Weather Mood Normalization ✅
- `getWeatherMood(weatherCode)` maps WMO codes to mood categories
- Moods: `clear`, `partly-cloudy`, `cloudy`, `rain`, `storm`, `snow`, `fog`
- Each mood has an associated emoji
- Stored in DayData.weather alongside raw data

---

## Files Changed
- `src/server.js` - Import endpoint, enrichment status, summary stats
- `src/services/weather-enrichment.js` - Mood mapping, emoji mapping
- `src/services/location-import.js` - Minor refactoring for API use
- `package.json` - Added multer dependency

---

## Next Up (Phase B+)
- Spotify integration
- Google Photos integration
- Place statistics calculation
