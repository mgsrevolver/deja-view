/**
 * Weather Enrichment Service
 *
 * Uses Open-Meteo Archive API (free, no key required)
 * Caches weather by ZIP CODE + DATE for reuse across all users
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// WMO Weather Codes -> Human readable conditions
const WEATHER_CODES = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  56: 'Freezing Drizzle',
  57: 'Freezing Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  66: 'Freezing Rain',
  67: 'Freezing Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Light Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  85: 'Light Snow Showers',
  86: 'Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with Hail',
  99: 'Thunderstorm with Hail'
};

// WMO Weather Codes -> Mood categories (for styling/theming)
const WEATHER_MOODS = {
  0: 'clear',
  1: 'clear',
  2: 'partly-cloudy',
  3: 'cloudy',
  45: 'fog',
  48: 'fog',
  51: 'rain',
  53: 'rain',
  55: 'rain',
  56: 'rain',
  57: 'rain',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm'
};

// Mood -> Emoji mapping
const WEATHER_EMOJIS = {
  'clear': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'rain': '🌧️',
  'storm': '⛈️',
  'snow': '❄️',
  'fog': '🌫️'
};

/**
 * Get normalized weather mood and emoji from WMO code
 */
export function getWeatherMood(weatherCode) {
  const mood = WEATHER_MOODS[weatherCode] || 'cloudy';
  const emoji = WEATHER_EMOJIS[mood] || '🌤️';
  return { mood, emoji };
}

/**
 * Extract 5-digit ZIP code from a US address string
 * Returns null if no valid ZIP found
 */
export function extractZipCode(address) {
  if (!address) return null;

  // Match 5-digit ZIP, optionally followed by -4 digit extension
  // Common formats: "NY 10001, USA", "CA 90210-1234", "Philadelphia, PA 19107"
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/**
 * Reverse geocode coordinates to get ZIP code via OSM Nominatim
 * Rate limited: 1 request per second
 */
export async function reverseGeocodeZip(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DejaView/1.0 (location-journal-app)'
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  const data = await response.json();
  const postcode = data.address?.postcode;

  // Handle non-US postcodes or missing data
  if (!postcode) return null;

  // Extract just the 5-digit part if it's a valid US ZIP
  const match = postcode.match(/^(\d{5})/);
  return match ? match[1] : null;
}

/**
 * Find the dominant location for a user on a given date
 * Returns { lat, lon, placeName, placeAddress, zipCode, totalMinutes }
 */
export async function getDominantLocation(userId, date) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const visits = await prisma.visit.findMany({
    where: {
      userId,
      startTime: { gte: dayStart, lte: dayEnd }
    },
    include: {
      place: { select: { name: true, address: true } }
    }
  });

  if (visits.length === 0) return null;

  // Group by coordinates (rounded for grouping)
  const locationMap = new Map();

  for (const visit of visits) {
    const key = `${visit.lat.toFixed(3)},${visit.lon.toFixed(3)}`;

    if (!locationMap.has(key)) {
      locationMap.set(key, {
        lat: visit.lat,
        lon: visit.lon,
        totalMinutes: 0,
        placeName: visit.place?.name || null,
        placeAddress: visit.place?.address || null
      });
    }

    const loc = locationMap.get(key);
    loc.totalMinutes += visit.durationMinutes || 0;

    // Prefer locations with addresses for ZIP extraction
    if (!loc.placeAddress && visit.place?.address) {
      loc.placeAddress = visit.place.address;
    }
    if (!loc.placeName && visit.place?.name) {
      loc.placeName = visit.place.name;
    }
  }

  // Find location with max time spent
  let dominant = null;
  let maxMinutes = 0;

  for (const loc of locationMap.values()) {
    if (loc.totalMinutes > maxMinutes) {
      maxMinutes = loc.totalMinutes;
      dominant = loc;
    }
  }

  if (dominant) {
    // Try to extract ZIP from address
    dominant.zipCode = extractZipCode(dominant.placeAddress);
  }

  return dominant;
}

/**
 * Fetch weather from Open-Meteo Archive API
 */
export async function fetchOpenMeteoWeather(lat, lon, date) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'DejaView/1.0 (location-journal-app)' }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Open-Meteo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const daily = data.daily;

  if (!daily?.time?.length) {
    throw new Error('No weather data available for this date');
  }

  const weatherCode = daily.weathercode?.[0];

  return {
    tempMax: Math.round(daily.temperature_2m_max?.[0]) || null,
    tempMin: Math.round(daily.temperature_2m_min?.[0]) || null,
    condition: WEATHER_CODES[weatherCode] || 'Unknown',
    precipitation: daily.precipitation_sum?.[0] || 0,
    weatherCode
  };
}

/**
 * Get or create cached weather for a ZIP code + date
 * Returns cached record if exists, otherwise fetches and caches
 */
export async function getOrCreateWeatherCache(zipCode, date, lat, lon) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);

  // Check cache first
  const cached = await prisma.weatherCache.findUnique({
    where: {
      zipCode_date: { zipCode, date: dayStart }
    }
  });

  if (cached) {
    return { cached: true, weather: cached };
  }

  // Fetch from Open-Meteo
  const weather = await fetchOpenMeteoWeather(lat, lon, dateStr);

  // Store in cache
  const record = await prisma.weatherCache.create({
    data: {
      zipCode,
      date: dayStart,
      tempMax: weather.tempMax,
      tempMin: weather.tempMin,
      condition: weather.condition,
      precipitation: weather.precipitation,
      weatherCode: weather.weatherCode,
      lat,
      lon
    }
  });

  return { cached: false, weather: record };
}

/**
 * Enrich weather for a single day
 * 1. Find dominant location
 * 2. Get ZIP code (from address or reverse geocode)
 * 3. Check/populate WeatherCache
 * 4. Update DayData
 */
export async function enrichDayWeather(userId, date, options = {}) {
  const { skipReverseGeocode = false } = options;
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);

  // Check if DayData already has weather
  const existing = await prisma.dayData.findFirst({
    where: { userId, date: dayStart }
  });

  if (existing?.weather) {
    return { cached: true, weather: existing.weather, source: 'dayData' };
  }

  // Find dominant location
  const dominant = await getDominantLocation(userId, dateStr);
  if (!dominant) {
    return { error: 'No visits found for this date' };
  }

  // Get ZIP code
  let zipCode = dominant.zipCode;

  if (!zipCode && !skipReverseGeocode) {
    // Reverse geocode to get ZIP
    await sleep(1100); // Nominatim rate limit
    try {
      zipCode = await reverseGeocodeZip(dominant.lat, dominant.lon);
    } catch (e) {
      // Continue without ZIP if geocoding fails
    }
  }

  if (!zipCode) {
    // Fall back to coordinate-based key (rounded to 2 decimals ~1km)
    zipCode = `${dominant.lat.toFixed(2)},${dominant.lon.toFixed(2)}`;
  }

  // Get or create weather cache entry
  const { cached, weather } = await getOrCreateWeatherCache(
    zipCode,
    dateStr,
    dominant.lat,
    dominant.lon
  );

  // Build weather data for DayData
  const { mood, emoji } = getWeatherMood(weather.weatherCode);
  const weatherData = {
    tempMax: weather.tempMax,
    tempMin: weather.tempMin,
    condition: weather.condition,
    precipitation: weather.precipitation,
    weatherCode: weather.weatherCode,
    mood,
    emoji,
    zipCode,
    locationName: dominant.placeName,
    cachedFrom: cached ? 'cache' : 'api'
  };

  // Upsert DayData
  await prisma.dayData.upsert({
    where: {
      userId_date: { userId, date: dayStart }
    },
    update: {
      weather: weatherData,
      updatedAt: new Date()
    },
    create: {
      userId,
      date: dayStart,
      weather: weatherData,
      distanceByType: {},
      totalDistance: 0
    }
  });

  return {
    cached,
    weather: weatherData,
    zipCode,
    location: dominant,
    source: cached ? 'weatherCache' : 'openMeteo'
  };
}

/**
 * Get stats for batch enrichment planning
 */
export async function getEnrichmentStats(userId, options = {}) {
  const { startDate = null, endDate = null } = options;

  // Build where clause for visits
  const whereClause = { userId };
  if (startDate || endDate) {
    whereClause.startTime = {};
    if (startDate) whereClause.startTime.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) whereClause.startTime.lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  // Get unique dates with visits
  const visits = await prisma.visit.findMany({
    where: whereClause,
    select: { startTime: true }
  });

  const dateSet = new Set();
  for (const v of visits) {
    dateSet.add(v.startTime.toISOString().split('T')[0]);
  }

  // Get dates already enriched
  const existingWeather = await prisma.dayData.findMany({
    where: {
      userId,
      weather: { not: null }
    },
    select: { date: true }
  });

  const existingDates = new Set(
    existingWeather.map(d => d.date.toISOString().split('T')[0])
  );

  // Get global cache stats
  const cacheCount = await prisma.weatherCache.count();

  // Filter out future dates
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const datesToEnrich = Array.from(dateSet)
    .filter(d => !existingDates.has(d) && d <= yesterdayStr)
    .sort();

  return {
    totalDays: dateSet.size,
    alreadyEnriched: existingDates.size,
    toEnrich: datesToEnrich.length,
    globalCacheEntries: cacheCount,
    dates: datesToEnrich
  };
}

export default {
  extractZipCode,
  reverseGeocodeZip,
  getDominantLocation,
  fetchOpenMeteoWeather,
  getOrCreateWeatherCache,
  enrichDayWeather,
  getEnrichmentStats,
  getWeatherMood,
  WEATHER_CODES,
  WEATHER_MOODS,
  WEATHER_EMOJIS
};
