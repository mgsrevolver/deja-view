import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { parseGoogleTakeoutData, importToDatabase } from './services/location-import.js';
import { enrichDayWeather, getEnrichmentStats, getWeatherMood } from './services/weather-enrichment.js';
import { enrichPlace, getPlaceCoordinates } from './services/place-enrichment.js';
import { generateDayImage, generateTestImage } from './services/image-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_IMAGES_DIR = path.join(__dirname, '../generated-images');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// File upload configuration (in-memory, 150MB limit for large Takeout files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB
});

// In-memory enrichment job tracking (per user)
// Structure: { [userId]: { status, startedAt, completedAt, progress, error } }
const enrichmentJobs = new Map();

// Initialize Supabase client for auth verification
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ============================================
// MIDDLEWARE
// ============================================

// CORS - restrict to known origins in production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc) in dev
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Auth middleware - validates Supabase JWT
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Optional auth - allows unauthenticated requests but attaches user if token present
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) req.user = user;
    } catch (e) {
      // Ignore auth errors for optional auth
    }
  }
  next();
}

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Déjà View API is running',
    timestamp: new Date().toISOString()
  });
});

// Backfill place lat/lon from visits (one-time migration)
app.post('/api/admin/backfill-place-coords', authMiddleware, async (req, res) => {
  try {
    console.log('[BACKFILL] Starting place coordinates backfill...');

    // Find places without lat/lon
    const placesWithoutCoords = await prisma.place.findMany({
      where: {
        OR: [
          { lat: null },
          { lon: null }
        ]
      },
      select: { id: true }
    });

    console.log(`[BACKFILL] Found ${placesWithoutCoords.length} places without coordinates`);

    let updated = 0;
    for (const place of placesWithoutCoords) {
      // Get first visit for this place to get coordinates
      const firstVisit = await prisma.visit.findFirst({
        where: { placeID: place.id },
        orderBy: { startTime: 'asc' },
        select: { lat: true, lon: true }
      });

      if (firstVisit) {
        await prisma.place.update({
          where: { id: place.id },
          data: {
            lat: firstVisit.lat,
            lon: firstVisit.lon
          }
        });
        updated++;
      }
    }

    console.log(`[BACKFILL] Updated ${updated} places with coordinates`);

    res.json({
      success: true,
      placesChecked: placesWithoutCoords.length,
      placesUpdated: updated
    });
  } catch (error) {
    console.error('[BACKFILL] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Database connection successful',
      database: 'Supabase PostgreSQL'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================

// Get overall stats and date range for current user
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [visitCount, placeCount, dateRange] = await Promise.all([
      prisma.visit.count({ where: { userId } }),
      prisma.visit.groupBy({
        by: ['placeID'],
        where: { userId },
        _count: true
      }).then(groups => groups.length),
      prisma.visit.aggregate({
        where: { userId },
        _min: { startTime: true },
        _max: { startTime: true }
      })
    ]);

    res.json({
      totalVisits: visitCount,
      totalPlaces: placeCount,
      firstDate: dateRange._min.startTime,
      lastDate: dateRange._max.startTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get days with visit counts (for calendar highlighting)
app.get('/api/days', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, tz } = req.query; // month: YYYY-MM, tz: IANA timezone

    let whereClause = { userId };
    if (month) {
      const { startOfMonth, endOfMonth } = getMonthBoundaries(month, tz);
      whereClause.startTime = {
        gte: startOfMonth,
        lte: endOfMonth
      };
    }

    // Group visits by date and count unique places
    const visits = await prisma.visit.findMany({
      where: whereClause,
      select: {
        startTime: true,
        placeID: true
      }
    });

    // Aggregate by date (using local timezone)
    const dayMap = new Map();
    for (const visit of visits) {
      const dateKey = toLocalDateString(visit.startTime, tz);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { date: dateKey, visitCount: 0, uniquePlaces: new Set() });
      }
      const day = dayMap.get(dateKey);
      day.visitCount++;
      day.uniquePlaces.add(visit.placeID);
    }

    // Convert to array and serialize
    const days = Array.from(dayMap.values()).map(d => ({
      date: d.date,
      visitCount: d.visitCount,
      uniquePlaces: d.uniquePlaces.size
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json(days);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single day with full visit details and locations
app.get('/api/days/:date', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    const { tz } = req.query; // IANA timezone (e.g., 'America/Los_Angeles')
    const { dayStart, dayEnd } = getDayBoundaries(date, tz);

    const [visits, locations, dayData, placeStats] = await Promise.all([
      // Get visits with place info
      prisma.visit.findMany({
        where: {
          userId,
          startTime: { gte: dayStart, lte: dayEnd }
        },
        include: {
          place: true
        },
        orderBy: { startTime: 'asc' }
      }),

      // Get GPS points for path drawing
      prisma.location.findMany({
        where: {
          userId,
          timestamp: { gte: dayStart, lte: dayEnd }
        },
        orderBy: { timestamp: 'asc' }
      }),

      // Get day-level enrichments if they exist
      // Note: DayData stores dates at midnight UTC, not timezone-adjusted
      prisma.dayData.findFirst({
        where: { userId, date: new Date(`${date}T00:00:00.000Z`) }
      }),

      // Get place stats for all places the user visited that day
      // This is computed dynamically per-user
      prisma.visit.groupBy({
        by: ['placeID'],
        where: {
          userId,
          startTime: { gte: dayStart, lte: dayEnd }
        }
      }).then(async (todaysPlaces) => {
        const placeIds = todaysPlaces.map(p => p.placeID);

        // Get aggregated stats for each place the user has ever visited
        const stats = await prisma.visit.groupBy({
          by: ['placeID'],
          where: {
            userId,
            placeID: { in: placeIds }
          },
          _min: { startTime: true },
          _max: { startTime: true },
          _count: true,
          _sum: { durationMinutes: true }
        });

        return stats.reduce((acc, s) => {
          acc[s.placeID] = {
            firstVisitDate: s._min.startTime,
            lastVisitDate: s._max.startTime,
            totalVisits: s._count,
            totalMinutes: s._sum.durationMinutes || 0
          };
          return acc;
        }, {});
      })
    ]);

    // Calculate distance by activity type from locations (in meters)
    const distanceByTypeMeters = {};
    let prevLoc = null;
    for (const loc of locations) {
      if (prevLoc && loc.activityType) {
        const dist = haversineDistance(prevLoc.lat, prevLoc.lon, loc.lat, loc.lon);
        const type = loc.activityType.toLowerCase();
        distanceByTypeMeters[type] = (distanceByTypeMeters[type] || 0) + dist;
      }
      prevLoc = loc;
    }

    // Convert to miles for display
    const metersToMiles = (m) => Math.round((m / 1609.34) * 10) / 10;
    const distanceByModeMiles = {};
    for (const [mode, meters] of Object.entries(distanceByTypeMeters)) {
      distanceByModeMiles[mode] = metersToMiles(meters);
    }
    const totalDistanceMeters = Object.values(distanceByTypeMeters).reduce((a, b) => a + b, 0);
    const totalDistanceMiles = metersToMiles(totalDistanceMeters);

    // Calculate summary stats
    const uniquePlaces = new Set(visits.map(v => v.placeID));
    const totalActiveMinutes = visits.reduce((sum, v) => sum + (v.durationMinutes || 0), 0);

    // First and last visit times (formatted as HH:MM)
    const formatTime = (date, tz) => {
      if (!date) return null;
      try {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: tz || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      } catch {
        return date.toISOString().slice(11, 16);
      }
    };
    const firstVisitTime = visits.length > 0 ? formatTime(visits[0].startTime, tz) : null;
    const lastVisitTime = visits.length > 0 ? formatTime(visits[visits.length - 1].startTime, tz) : null;

    // Build weather summary with mood
    let weatherSummary = null;
    if (dayData?.weather) {
      const w = dayData.weather;
      // Ensure mood exists (backfill for older data)
      const mood = w.mood || (w.weatherCode !== undefined ? getWeatherMood(w.weatherCode).mood : null);
      const emoji = w.emoji || (w.weatherCode !== undefined ? getWeatherMood(w.weatherCode).emoji : null);
      weatherSummary = {
        high: w.tempMax,
        low: w.tempMin,
        condition: mood,
        description: w.condition,
        emoji
      };
    }

    // Build summary object
    const summary = {
      placeCount: visits.length,
      uniquePlaceCount: uniquePlaces.size,
      totalDistanceMiles,
      distanceByMode: distanceByModeMiles,
      weather: weatherSummary,
      firstVisit: firstVisitTime,
      lastVisit: lastVisitTime,
      totalActiveMinutes
    };

    res.json({
      date,
      summary,
      visits: visits.map(v => ({
        id: v.id,
        placeID: v.placeID,
        lat: v.lat,
        lon: v.lon,
        startTime: v.startTime,
        endTime: v.endTime,
        durationMinutes: v.durationMinutes,
        semanticType: v.semanticType,
        place: v.place ? {
          name: v.place.name,
          address: v.place.address,
          imageUrl: v.place.defaultImageUrl,
          types: v.place.types,
          // User-specific place stats
          firstVisitDate: placeStats[v.placeID]?.firstVisitDate,
          lastVisitDate: placeStats[v.placeID]?.lastVisitDate,
          totalVisits: placeStats[v.placeID]?.totalVisits,
          totalMinutes: placeStats[v.placeID]?.totalMinutes
        } : null
      })),
      path: locations.map(l => ({
        lat: l.lat,
        lon: l.lon,
        timestamp: l.timestamp,
        activityType: l.activityType
      })),
      distanceByType: distanceByTypeMeters,
      totalDistance: totalDistanceMeters,
      weather: dayData?.weather || null,
      spotifyTracks: dayData?.spotifyTracks || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find an "interesting" day (most unique places visited)
app.get('/api/interesting-day', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tz } = req.query; // IANA timezone (e.g., 'America/Los_Angeles')

    const visits = await prisma.visit.findMany({
      where: { userId },
      select: {
        startTime: true,
        placeID: true
      }
    });

    // Group by date and count unique places (using local timezone)
    const dayMap = new Map();
    for (const visit of visits) {
      const dateKey = toLocalDateString(visit.startTime, tz);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, new Set());
      }
      dayMap.get(dateKey).add(visit.placeID);
    }

    // Find day with most unique places
    let bestDay = null;
    let maxPlaces = 0;
    for (const [date, places] of dayMap) {
      if (places.size > maxPlaces) {
        maxPlaces = places.size;
        bestDay = date;
      }
    }

    res.json({
      date: bestDay,
      uniquePlaces: maxPlaces
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top places ranked by visit count or time spent
app.get('/api/places/top', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sortBy = 'visits', limit = '10', offset = '0', search, tz } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 100);
    const offsetNum = parseInt(offset) || 0;

    // Step 1: Aggregate visits by place for this user
    const placesAgg = await prisma.visit.groupBy({
      by: ['placeID'],
      where: { userId },
      _count: { id: true },
      _sum: { durationMinutes: true },
      _min: { startTime: true, lat: true, lon: true },
      _max: { startTime: true }
    });

    // Step 2: Get all place details for matching places
    const allPlaceIds = placesAgg.map(p => p.placeID);
    const places = await prisma.place.findMany({
      where: { id: { in: allPlaceIds } },
      select: { id: true, name: true, defaultImageUrl: true, lat: true, lon: true }
    });
    const placeMap = new Map(places.map(p => [p.id, p]));

    // Step 3: Merge and filter by search
    let merged = placesAgg.map(agg => {
      const place = placeMap.get(agg.placeID) || {};
      return {
        placeId: agg.placeID,
        lat: place.lat || agg._min.lat,
        lon: place.lon || agg._min.lon,
        name: place.name || 'Unknown',
        photoUrl: place.defaultImageUrl || null,
        visitCount: agg._count.id,
        totalMinutes: agg._sum.durationMinutes || 0,
        firstVisit: toLocalDateString(agg._min.startTime, tz),
        lastVisit: toLocalDateString(agg._max.startTime, tz)
      };
    });

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      merged = merged.filter(p => p.name.toLowerCase().includes(searchLower));
    }

    // Step 4: Sort by chosen metric
    merged.sort((a, b) => {
      if (sortBy === 'time') {
        return b.totalMinutes - a.totalMinutes;
      }
      return b.visitCount - a.visitCount;
    });

    const total = merged.length;
    const paginated = merged.slice(offsetNum, offsetNum + limitNum);

    res.json({
      places: paginated,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      }
    });
  } catch (error) {
    console.error('[TOP PLACES] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get paginated visits for a specific place
app.get('/api/places/:id/visits', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: placeId } = req.params;
    const { limit = '50', offset = '0', tz } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;

    // Get place details and visit aggregates in parallel
    const [place, visits, countResult] = await Promise.all([
      prisma.place.findUnique({
        where: { id: placeId },
        select: { id: true, name: true, defaultImageUrl: true, lat: true, lon: true }
      }),
      prisma.visit.findMany({
        where: { userId, placeID: placeId },
        orderBy: { startTime: 'desc' },
        skip: offsetNum,
        take: limitNum,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          durationMinutes: true,
          lat: true,
          lon: true
        }
      }),
      prisma.visit.aggregate({
        where: { userId, placeID: placeId },
        _count: { id: true },
        _sum: { durationMinutes: true },
        _min: { startTime: true, lat: true, lon: true },
        _max: { startTime: true }
      })
    ]);

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Use place lat/lon if available, otherwise fall back to first visit
    const lat = place.lat || countResult._min.lat;
    const lon = place.lon || countResult._min.lon;

    res.json({
      place: {
        placeId: place.id,
        lat,
        lon,
        name: place.name || 'Unknown',
        photoUrl: place.defaultImageUrl || null,
        visitCount: countResult._count.id,
        totalMinutes: countResult._sum.durationMinutes || 0,
        firstVisit: toLocalDateString(countResult._min.startTime, tz),
        lastVisit: toLocalDateString(countResult._max.startTime, tz)
      },
      visits: visits.map(v => ({
        id: v.id,
        date: toLocalDateString(v.startTime, tz),
        startTime: formatTimeForViewport(v.startTime, tz),
        endTime: v.endTime ? formatTimeForViewport(v.endTime, tz) : null,
        duration: v.durationMinutes || 0
      })),
      pagination: {
        total: countResult._count.id,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < countResult._count.id
      }
    });
  } catch (error) {
    console.error('[PLACE VISITS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get place details with user-specific visit statistics
app.get('/api/places/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: placeId } = req.params;
    const { tz } = req.query;

    // Get place details
    const place = await prisma.place.findUnique({
      where: { id: placeId }
    });

    if (!place) {
      return res.status(404).json({ error: 'Place not found' });
    }

    // Get user-specific visit stats
    const visitStats = await prisma.visit.aggregate({
      where: { userId, placeID: placeId },
      _min: { startTime: true },
      _max: { startTime: true },
      _count: true,
      _sum: { durationMinutes: true }
    });

    // Get recent visits (last 10)
    const recentVisits = await prisma.visit.findMany({
      where: { userId, placeID: placeId },
      orderBy: { startTime: 'desc' },
      take: 10,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        durationMinutes: true
      }
    });

    // Calculate unique days visited
    const allVisits = await prisma.visit.findMany({
      where: { userId, placeID: placeId },
      select: { startTime: true }
    });
    const uniqueDays = new Set(
      allVisits.map(v => toLocalDateString(v.startTime, tz))
    ).size;

    // Calculate average visit duration
    const avgDuration = visitStats._count > 0 && visitStats._sum.durationMinutes
      ? Math.round(visitStats._sum.durationMinutes / visitStats._count)
      : null;

    res.json({
      id: place.id,
      lat: place.lat,
      lon: place.lon,
      name: place.name,
      address: place.address,
      imageUrl: place.defaultImageUrl,
      types: place.types,
      stats: {
        firstVisit: visitStats._min.startTime,
        lastVisit: visitStats._max.startTime,
        totalVisits: visitStats._count,
        totalMinutes: visitStats._sum.durationMinutes || 0,
        uniqueDays,
        avgDurationMinutes: avgDuration
      },
      recentVisits: recentVisits.map(v => ({
        id: v.id,
        date: toLocalDateString(v.startTime, tz),
        startTime: v.startTime,
        endTime: v.endTime,
        durationMinutes: v.durationMinutes
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get visits within a geographic viewport (for history layer)
app.get('/api/visits/viewport', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { north, south, east, west, excludeDate, tz } = req.query;

    // Validate required params
    if (!north || !south || !east || !west) {
      return res.status(400).json({
        error: 'Missing required parameters: north, south, east, west'
      });
    }

    const northFloat = parseFloat(north);
    const southFloat = parseFloat(south);
    const eastFloat = parseFloat(east);
    const westFloat = parseFloat(west);

    // Validate bounds
    if (isNaN(northFloat) || isNaN(southFloat) || isNaN(eastFloat) || isNaN(westFloat)) {
      return res.status(400).json({
        error: 'Invalid bounds: north, south, east, west must be valid numbers'
      });
    }

    // Build where clause
    const whereClause = {
      userId,
      lat: { gte: southFloat, lte: northFloat },
      lon: { gte: westFloat, lte: eastFloat }
    };

    // Exclude current day if specified
    if (excludeDate) {
      const { dayStart, dayEnd } = getDayBoundaries(excludeDate, tz);
      whereClause.NOT = {
        startTime: {
          gte: dayStart,
          lte: dayEnd
        }
      };
    }

    // Query visits within bounding box
    const visits = await prisma.visit.findMany({
      where: whereClause,
      include: {
        place: {
          select: {
            id: true,
            name: true,
            defaultImageUrl: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    // Group by place
    const placeMap = new Map();

    for (const visit of visits) {
      const placeId = visit.placeID;
      if (!placeMap.has(placeId)) {
        placeMap.set(placeId, {
          placeId,
          lat: visit.lat,
          lon: visit.lon,
          name: visit.place?.name || 'Unknown',
          photoUrl: visit.place?.defaultImageUrl || null,
          visits: [],
          totalMinutes: 0
        });
      }

      const place = placeMap.get(placeId);
      place.visits.push({
        date: toLocalDateString(visit.startTime, tz),
        startTime: formatTimeForViewport(visit.startTime, tz),
        duration: visit.durationMinutes || 0
      });
      place.totalMinutes += visit.durationMinutes || 0;
    }

    // Compute aggregates and format response
    const places = Array.from(placeMap.values()).map(place => ({
      placeId: place.placeId,
      lat: place.lat,
      lon: place.lon,
      name: place.name,
      photoUrl: place.photoUrl,
      visitCount: place.visits.length,
      totalMinutes: place.totalMinutes,
      firstVisit: place.visits[place.visits.length - 1]?.date || null,
      lastVisit: place.visits[0]?.date || null,
      visits: place.visits.slice(0, 50) // Cap at 50 most recent
    }));

    // Sort by visit count (most visited first)
    places.sort((a, b) => b.visitCount - a.visitCount);

    res.json({
      places,
      summary: {
        totalPlaces: places.length,
        totalVisits: visits.length
      }
    });
  } catch (error) {
    console.error('[VIEWPORT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run background enrichment for a user
 * Enriches weather for all days without weather data
 * Enriches places with OSM Nominatim for basic reverse geocoding
 */
async function runBackgroundEnrichment(userId) {
  const job = {
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    progress: { weather: { total: 0, completed: 0 }, places: { total: 0, completed: 0 } },
    error: null
  };
  enrichmentJobs.set(userId, job);

  try {
    console.log(`[ENRICH] Starting background enrichment for user ${userId}`);

    // Get weather enrichment stats
    const weatherStats = await getEnrichmentStats(userId);
    job.progress.weather.total = weatherStats.toEnrich;
    console.log(`[ENRICH] Weather: ${weatherStats.toEnrich} days to enrich`);

    // Enrich weather for each day
    for (const date of weatherStats.dates) {
      try {
        await enrichDayWeather(userId, date);
        job.progress.weather.completed++;

        if (job.progress.weather.completed % 50 === 0) {
          console.log(`[ENRICH] Weather progress: ${job.progress.weather.completed}/${job.progress.weather.total}`);
        }
      } catch (err) {
        console.warn(`[ENRICH] Weather failed for ${date}: ${err.message}`);
      }
    }

    // Get places needing OSM enrichment (no name, have coordinates from visits)
    const unenrichedPlaces = await prisma.place.findMany({
      where: { name: null },
      take: 500 // Limit batch size
    });

    job.progress.places.total = unenrichedPlaces.length;
    console.log(`[ENRICH] Places: ${unenrichedPlaces.length} places to enrich with OSM`);

    // Enrich places with OSM Nominatim
    for (const place of unenrichedPlaces) {
      try {
        const coords = await getPlaceCoordinates(place.id);
        if (coords) {
          await enrichPlace(place.id, coords.lat, coords.lon, false); // false = OSM only
        }
        job.progress.places.completed++;

        if (job.progress.places.completed % 50 === 0) {
          console.log(`[ENRICH] Places progress: ${job.progress.places.completed}/${job.progress.places.total}`);
        }
      } catch (err) {
        console.warn(`[ENRICH] Place failed for ${place.id}: ${err.message}`);
      }
    }

    job.status = 'complete';
    job.completedAt = new Date().toISOString();
    console.log(`[ENRICH] Complete for user ${userId}`);

  } catch (error) {
    console.error(`[ENRICH] Error for user ${userId}:`, error);
    job.status = 'error';
    job.error = error.message;
    job.completedAt = new Date().toISOString();
  }
}

// Import Google Takeout location history
app.post('/api/import', authMiddleware, upload.single('file'), async (req, res) => {
  const errors = [];

  try {
    const userId = req.user.id;
    const enrich = req.query.enrich !== 'false'; // Default to true

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Expected multipart/form-data with "file" field.'
      });
    }

    console.log(`[IMPORT] Starting import for user ${userId}`);
    console.log(`[IMPORT] File: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Parse JSON from buffer
    let jsonData;
    try {
      const fileContent = req.file.buffer.toString('utf8');
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON file. Could not parse file contents.',
        details: parseError.message
      });
    }

    // Parse the Google Takeout format
    let parsedData;
    try {
      parsedData = parseGoogleTakeoutData(jsonData);
      console.log(`[IMPORT] Detected format: ${parsedData.format}`);
    } catch (formatError) {
      return res.status(400).json({
        success: false,
        error: 'Unrecognized file format. Expected Google Takeout location history JSON.',
        details: formatError.message
      });
    }

    // Check if there's any data to import
    if (parsedData.points.length === 0 && parsedData.visits.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No location data found in file. The file may be empty or in an unsupported format.'
      });
    }

    // Import to database
    const result = await importToDatabase(parsedData, userId, prisma);

    console.log(`[IMPORT] Complete: ${result.locations} locations, ${result.visits} visits`);

    // Kick off background enrichment if enabled
    if (enrich && result.visits > 0) {
      console.log(`[IMPORT] Triggering background enrichment for user ${userId}`);
      // Run async - don't await
      runBackgroundEnrichment(userId).catch(err => {
        console.error(`[ENRICH] Background enrichment failed:`, err);
      });
    }

    res.json({
      success: true,
      imported: {
        locations: result.locations,
        visits: result.visits
      },
      skipped: result.skipped.locations + result.skipped.visits,
      enrichmentStarted: enrich && result.visits > 0,
      errors
    });

  } catch (error) {
    console.error('[IMPORT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed due to server error.',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

// Get enrichment status for current user
app.get('/api/enrichment-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const job = enrichmentJobs.get(userId);

    if (!job) {
      // No active job - check if there's work to do
      const stats = await getEnrichmentStats(userId);
      return res.json({
        status: 'idle',
        pending: {
          weatherDays: stats.toEnrich,
          places: 0 // Would need to query, but keeping it simple
        }
      });
    }

    res.json({
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: job.progress,
      error: job.error
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHARE IMAGE ENDPOINTS
// ============================================

// Generate shareable day image
app.post('/api/share/generate-image', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, placeIds, options = {} } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get day boundaries
    const { dayStart, dayEnd } = getDayBoundaries(date, options.tz);

    console.log(`[SHARE] Generate request: user=${userId}, date=${date}, tz=${options.tz || 'UTC'}`);
    console.log(`[SHARE] Day boundaries: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);

    // Fetch visits for the date
    let visits = await prisma.visit.findMany({
      where: {
        userId,
        startTime: { gte: dayStart, lte: dayEnd }
      },
      include: { place: true },
      orderBy: { startTime: 'asc' }
    });

    console.log(`[SHARE] Found ${visits.length} visits for date`);

    // Filter to selected places if provided
    if (placeIds && placeIds.length > 0) {
      console.log(`[SHARE] placeIds filter requested:`, placeIds.slice(0, 3));
      console.log(`[SHARE] Actual visit placeIDs:`, visits.slice(0, 3).map(v => v.placeID));
      visits = visits.filter(v => placeIds.includes(v.placeID));
      console.log(`[SHARE] After placeIds filter: ${visits.length} visits`);
    }

    // Filter to visits with photos
    const visitsWithPhotos = visits.filter(v => v.place?.defaultImageUrl);
    console.log(`[SHARE] Visits with photos: ${visitsWithPhotos.length}`);

    // Debug: log places and their photo status
    if (visitsWithPhotos.length === 0 && visits.length > 0) {
      console.log(`[SHARE] Places without photos:`);
      visits.slice(0, 5).forEach(v => {
        console.log(`  - ${v.place?.name || 'unnamed'}: imageUrl=${v.place?.defaultImageUrl ? 'YES' : 'NO'}`);
      });
    }

    if (visitsWithPhotos.length === 0) {
      // Get visits before placeIds filter for debug
      const allVisitsForDay = await prisma.visit.findMany({
        where: {
          userId,
          startTime: { gte: dayStart, lte: dayEnd }
        },
        include: { place: true }
      });

      return res.status(400).json({
        error: 'No visits with photos found for this date',
        hint: placeIds?.length > 0
          ? 'The selected placeIds do not match any visits for this date'
          : 'Select at least one place with a photo',
        debug: {
          totalVisitsForDay: allVisitsForDay.length,
          visitsAfterFilter: visits.length,
          placeIdsRequested: placeIds?.slice(0, 3) || [],
          actualPlaceIds: allVisitsForDay.slice(0, 5).map(v => v.placeID),
          placesWithPhotos: allVisitsForDay.filter(v => v.place?.defaultImageUrl).map(v => ({
            placeID: v.placeID,
            name: v.place?.name
          }))
        }
      });
    }

    // Get day data for weather
    const dayData = await prisma.dayData.findFirst({
      where: { userId, date: new Date(`${date}T00:00:00.000Z`) }
    });

    // Calculate total distance in miles
    const totalDistanceMeters = dayData?.totalDistance || 0;
    const totalDistanceMiles = totalDistanceMeters / 1609.34;

    // Map visits to expected format
    const mappedVisits = visitsWithPhotos.map(v => ({
      id: v.id,
      placeID: v.placeID,
      startTime: v.startTime,
      endTime: v.endTime,
      durationMinutes: v.durationMinutes,
      place: {
        name: v.place?.name,
        imageUrl: v.place?.defaultImageUrl
      }
    }));

    // Generate image
    const imageBuffer = await generateDayImage({
      date,
      visits: mappedVisits,
      weather: dayData?.weather || null,
      totalDistance: totalDistanceMiles,
      options: {
        showTimes: options.showTimes ?? false,
        showDurations: options.showDurations ?? true,
        showPlaceNames: options.showPlaceNames ?? true
      }
    });

    // Generate filename and save
    const imageId = `${userId.substring(0, 8)}_${date}_${Date.now()}`;
    const filename = `${imageId}.png`;
    const filepath = path.join(GENERATED_IMAGES_DIR, filename);

    await fs.writeFile(filepath, imageBuffer);

    // Store reference in database
    const sharedImage = await prisma.sharedImage.create({
      data: {
        userId,
        date,
        filename,
        options: {
          placeIds: placeIds || visitsWithPhotos.map(v => v.placeID),
          showTimes: options.showTimes ?? false,
          showDurations: options.showDurations ?? true,
          showPlaceNames: options.showPlaceNames ?? true
        }
      }
    });

    console.log(`[SHARE] Generated image ${sharedImage.id} for user ${userId}, date ${date}`);

    res.json({
      imageId: sharedImage.id,
      imageUrl: `/api/share/images/${sharedImage.id}.png`
    });

  } catch (error) {
    console.error('[SHARE] Generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve generated image
app.get('/api/share/images/:imageId.png', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageId } = req.params;

    // Find image record
    const sharedImage = await prisma.sharedImage.findUnique({
      where: { id: imageId }
    });

    if (!sharedImage) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Verify ownership
    if (sharedImage.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Read and serve file
    const filepath = path.join(GENERATED_IMAGES_DIR, sharedImage.filename);

    try {
      const imageBuffer = await fs.readFile(filepath);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'private, max-age=3600');
      res.send(imageBuffer);
    } catch (fileError) {
      console.error('[SHARE] File read error:', fileError);
      return res.status(404).json({ error: 'Image file not found' });
    }

  } catch (error) {
    console.error('[SHARE] Serve error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List user's generated images
app.get('/api/share/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const images = await prisma.sharedImage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({
      images: images.map(img => ({
        imageId: img.id,
        date: img.date,
        createdAt: img.createdAt,
        imageUrl: `/api/share/images/${img.id}.png`
      }))
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint for image generation (development only)
app.get('/api/share/test-image', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const imageBuffer = await generateTestImage();
    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error) {
    console.error('[SHARE] Test image error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPERS
// ============================================

/**
 * Convert a UTC Date to a date string (YYYY-MM-DD) in the given timezone
 * @param {Date} date - UTC date
 * @param {string} tz - IANA timezone (e.g., 'America/Los_Angeles')
 * @returns {string} Date string in local timezone
 */
function toLocalDateString(date, tz) {
  if (!tz) return date.toISOString().split('T')[0];

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // Returns YYYY-MM-DD
  } catch (e) {
    // Invalid timezone, fall back to UTC
    return date.toISOString().split('T')[0];
  }
}

/**
 * Get midnight-to-midnight boundaries in a specific timezone as UTC Dates
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} tz - IANA timezone (e.g., 'America/Los_Angeles')
 * @returns {{ dayStart: Date, dayEnd: Date }}
 */
function getDayBoundaries(dateStr, tz) {
  if (!tz) {
    // Default to UTC
    return {
      dayStart: new Date(`${dateStr}T00:00:00.000Z`),
      dayEnd: new Date(`${dateStr}T23:59:59.999Z`)
    };
  }

  try {
    // Parse the date parts
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create a date at midnight in the target timezone
    // We use a workaround: create a date string with the timezone and parse it
    const midnightLocal = new Date(`${dateStr}T00:00:00`);

    // Get the UTC offset for this date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(midnightLocal);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '+00:00';

    // Parse offset (e.g., "GMT-8" -> -8, "GMT+5:30" -> 5.5)
    const offsetMatch = offsetPart.match(/GMT([+-])?(\d+)?(?::(\d+))?/);
    let offsetHours = 0;
    if (offsetMatch) {
      const sign = offsetMatch[1] === '-' ? -1 : 1;
      const hours = parseInt(offsetMatch[2] || '0');
      const minutes = parseInt(offsetMatch[3] || '0');
      offsetHours = sign * (hours + minutes / 60);
    }

    // Calculate UTC times for local midnight and 23:59:59
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetHours * 3600000);
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetHours * 3600000);

    return { dayStart, dayEnd };
  } catch (e) {
    // Fall back to UTC
    return {
      dayStart: new Date(`${dateStr}T00:00:00.000Z`),
      dayEnd: new Date(`${dateStr}T23:59:59.999Z`)
    };
  }
}

/**
 * Get month boundaries in a specific timezone
 * @param {string} monthStr - Month string (YYYY-MM)
 * @param {string} tz - IANA timezone
 * @returns {{ startOfMonth: Date, endOfMonth: Date }}
 */
function getMonthBoundaries(monthStr, tz) {
  const [year, month] = monthStr.split('-').map(Number);

  // First day of month
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { dayStart: startOfMonth } = getDayBoundaries(firstDay, tz);
  const { dayEnd: endOfMonth } = getDayBoundaries(lastDayStr, tz);

  return { startOfMonth, endOfMonth };
}

/**
 * Format a timestamp to HH:MM in the given timezone
 * @param {Date} date - UTC date
 * @param {string} tz - IANA timezone
 * @returns {string} Time string (HH:MM)
 */
function formatTimeForViewport(date, tz) {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

// Haversine distance calculation (meters)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================
// ERROR HANDLING
// ============================================

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ============================================
// LIFECYCLE
// ============================================

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Déjà View API server running on http://localhost:${PORT}`);
  console.log(`📊 Database: Connected to Supabase`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Auth: Supabase JWT validation enabled`);
});
