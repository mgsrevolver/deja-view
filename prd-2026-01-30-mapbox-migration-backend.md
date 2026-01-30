# PRD: Mapbox Migration - Backend

**Date:** 2026-01-30
**Status:** Planning
**Role:** BACKEND

## Overview

Backend considerations for the Mapbox migration. The core migration is frontend-only, but backend has optional enhancements and coordination responsibilities.

---

## Required Work: None

The Mapbox migration is **entirely frontend**. The map rendering library change does not affect:
- API endpoints
- Database schema
- Data formats
- Authentication

**No backend code changes are required for the core migration.**

---

## Optional Enhancements

### 1. Token Proxy Endpoint (Low Priority)

For added security, some teams prefer to serve the Mapbox token from the backend rather than embedding it in frontend code.

**Why consider:**
- Mapbox public tokens are domain-restricted (safe to expose)
- But a proxy allows token rotation without frontend deploy
- Enables server-side usage logging

**Implementation (if desired):**

```javascript
// backend/src/server.js

// GET /api/config/mapbox
app.get('/api/config/mapbox', authenticateToken, (req, res) => {
  res.json({
    token: process.env.MAPBOX_PUBLIC_TOKEN
  })
})
```

```bash
# backend/.env
MAPBOX_PUBLIC_TOKEN=pk.eyJ1Ijoi...
```

**Recommendation:** Skip this. Mapbox public tokens are designed to be client-side. Domain restrictions provide sufficient security.

---

### 2. Static Map for Share Image (Medium Priority)

The current Share Image feature (Phase 6) uses place photos in a Polaroid stack. A future enhancement could include a map thumbnail.

**Mapbox Static Images API:**
```
https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/
  pin-s+f59e0b(-75.16,39.95),
  pin-s+34d399(-75.17,39.96)
  /-75.165,39.955,13
  /400x400@2x
  ?access_token=YOUR_TOKEN
```

**Use case:**
- Add small map preview to share image (bottom corner)
- Shows visit locations as pins
- Complements the Polaroid photo stack

**Implementation:**

```javascript
// backend/src/services/image-generator.js

async function fetchStaticMap(visits, options = {}) {
  const { width = 400, height = 400 } = options

  // Build pin markers
  const pins = visits.slice(0, 10).map(v => {
    const color = v.semanticType?.includes('home') ? '34d399' :
                  v.semanticType?.includes('work') ? '60a5fa' : 'f59e0b'
    return `pin-s+${color}(${v.lon},${v.lat})`
  }).join(',')

  // Calculate center and zoom (or use 'auto')
  const url = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/auto/${width}x${height}@2x?access_token=${process.env.MAPBOX_SECRET_TOKEN}`

  const response = await fetch(url)
  if (!response.ok) throw new Error('Static map fetch failed')

  return Buffer.from(await response.arrayBuffer())
}
```

**Pricing:**
- Static Images API: 50,000 free/month
- Each share image generation = 1 request

**Environment variable:**
```bash
# backend/.env
MAPBOX_SECRET_TOKEN=sk.eyJ1Ijoi...  # Use secret token for server-side
```

**Recommendation:** Nice-to-have for v2 of share image. Not blocking for migration.

---

### 3. Mapbox Geocoding as Fallback (Medium Priority)

Currently, 171 places have failed Google Places enrichment (expired Place IDs from closed businesses). The planned fallback is OSM Nominatim.

**Alternative: Mapbox Geocoding API**

| Feature | OSM Nominatim | Mapbox Geocoding |
|---------|---------------|------------------|
| Cost | Free | 100k free/month |
| Rate limit | 1 req/sec | 600 req/min |
| Quality | Good | Excellent |
| POI data | Basic | Rich |

**When to use Mapbox over OSM:**
- Need business names (not just addresses)
- Need POI categories
- Processing large batches quickly

**Implementation:**

```javascript
// backend/src/services/place-enrichment.js

async function enrichWithMapbox(lat, lon) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${process.env.MAPBOX_SECRET_TOKEN}&types=poi,address`

  const response = await fetch(url)
  const data = await response.json()

  if (!data.features?.length) return null

  const place = data.features[0]
  return {
    name: place.text,
    address: place.place_name,
    category: place.properties?.category,
    source: 'mapbox'
  }
}
```

**Recommendation:** Evaluate after OSM Nominatim integration. If OSM results are poor for business names, consider Mapbox as upgrade path.

---

## Environment Variables Summary

For **frontend migration only** (required):
```bash
# frontend/.env.local
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...  # Public token
```

For **optional backend features**:
```bash
# backend/.env
MAPBOX_SECRET_TOKEN=sk.eyJ1Ijoi...  # Secret token (server-side only)
```

**Token types:**
- `pk.*` = Public token (safe for client-side, domain-restricted)
- `sk.*` = Secret token (server-side only, never expose)

---

## Coordination Checklist

As backend specialist, verify these before migration is complete:

- [ ] **No API changes needed** - Frontend consumes same `/api/days/:date` response
- [ ] **No schema changes needed** - Visit lat/lon format unchanged
- [ ] **No breaking changes** - Path data format unchanged ([{lat, lon, activityType}])
- [ ] **Document token setup** - Add Mapbox token instructions to README

---

## README Update

Add to project README after migration:

```markdown
### Mapbox Setup

1. Create free account at [mapbox.com](https://www.mapbox.com/)
2. Copy your default public token
3. Add to `frontend/.env.local`:
   ```bash
   VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...
   ```
```

---

## Data Format Reference

For frontend specialist's reference, current API response format (unchanged):

### GET /api/days/:date

```json
{
  "visits": [
    {
      "id": "abc123",
      "lat": 39.9526,
      "lon": -75.1652,
      "startTime": "2026-01-30T09:00:00Z",
      "endTime": "2026-01-30T10:30:00Z",
      "semanticType": "home",
      "place": {
        "name": "Home",
        "address": "123 Main St",
        "imageUrl": "https://..."
      }
    }
  ],
  "path": [
    {
      "lat": 39.9526,
      "lon": -75.1652,
      "timestamp": "2026-01-30T10:31:00Z",
      "activityType": "walking"
    }
  ],
  "weather": {
    "condition": "Clear",
    "emoji": "☀️",
    "high": 72,
    "low": 58
  }
}
```

**Key points for frontend:**
- Coordinates are `lat`/`lon` (not `lng`)
- Path points have `activityType` for segment coloring
- Mapbox uses `[longitude, latitude]` order (opposite of Leaflet)

---

## Migration Timeline

| Phase | Owner | Status |
|-------|-------|--------|
| Frontend MapPane rewrite | FRONTEND | Pending |
| Testing & verification | FRONTEND | Pending |
| README documentation | BACKEND | Pending |
| Optional: Static map API | BACKEND | Future |
| Optional: Geocoding fallback | BACKEND | Future |

---

## Success Criteria

- [ ] Frontend migration complete with no backend changes
- [ ] API responses unchanged
- [ ] README updated with Mapbox setup instructions
- [ ] No new environment variables required for backend
