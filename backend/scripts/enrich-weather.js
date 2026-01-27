#!/usr/bin/env node

/**
 * CLI Script: Enrich days with weather data from Open-Meteo
 * Caches by ZIP code for reuse across all users
 *
 * Usage:
 *   node scripts/enrich-weather.js --user=<uuid> [options]
 *
 * Options:
 *   --user=UUID     User ID (required)
 *   --limit=N       Maximum days to enrich (default: all)
 *   --delay=MS      Delay between API calls in ms (default: 200)
 *   --start=DATE    Start date (YYYY-MM-DD)
 *   --end=DATE      End date (YYYY-MM-DD)
 *   --dry-run       Show what would be enriched without calling APIs
 *   --skip-geocode  Don't reverse geocode for ZIP (faster, uses coord fallback)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const WEATHER_CODES = {
  0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  66: 'Freezing Rain', 67: 'Freezing Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Light Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Hail'
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    userId: null,
    limit: null,
    delay: 200,
    startDate: null,
    endDate: null,
    dryRun: false,
    skipGeocode: false
  };

  for (const arg of args) {
    if (arg.startsWith('--user=')) {
      options.userId = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--start=')) {
      options.startDate = arg.split('=')[1];
    } else if (arg.startsWith('--end=')) {
      options.endDate = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-geocode') {
      options.skipGeocode = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Weather Enrichment - Fetch historical weather from Open-Meteo (FREE)
Caches by ZIP code for reuse across all users

USAGE:
  node scripts/enrich-weather.js --user=<uuid> [options]

OPTIONS:
  --user=UUID     User ID from Supabase Auth (required)
  --limit=N       Maximum days to enrich (default: all)
  --delay=MS      Delay between API calls in ms (default: 200)
  --start=DATE    Start date YYYY-MM-DD (default: earliest visit)
  --end=DATE      End date YYYY-MM-DD (default: yesterday)
  --dry-run       Show stats without making API calls
  --skip-geocode  Don't reverse geocode for ZIP (faster, uses coord fallback)
  --help, -h      Show this help message

CACHING:
  Weather is cached by ZIP code + date in the WeatherCache table.
  If another user was in the same ZIP on the same day, cache is reused.
  ZIP is extracted from place addresses or via OSM reverse geocoding.

EXAMPLES:
  # Check how many days need weather
  node scripts/enrich-weather.js --user=abc-123 --dry-run

  # Enrich all days
  node scripts/enrich-weather.js --user=abc-123

  # Fast mode (skip reverse geocoding)
  node scripts/enrich-weather.js --user=abc-123 --skip-geocode
      `);
      process.exit(0);
    }
  }

  return options;
}

function extractZipCode(address) {
  if (!address) return null;
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

async function reverseGeocodeZip(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DejaView/1.0 (location-journal-app)' }
  });
  if (!response.ok) throw new Error(`Nominatim: ${response.status}`);
  const data = await response.json();
  const postcode = data.address?.postcode;
  if (!postcode) return null;
  const match = postcode.match(/^(\d{5})/);
  return match ? match[1] : null;
}

async function getDominantLocation(userId, date) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const visits = await prisma.visit.findMany({
    where: { userId, startTime: { gte: dayStart, lte: dayEnd } },
    include: { place: { select: { name: true, address: true } } }
  });

  if (visits.length === 0) return null;

  const locationMap = new Map();
  for (const visit of visits) {
    const key = `${visit.lat.toFixed(3)},${visit.lon.toFixed(3)}`;
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        lat: visit.lat, lon: visit.lon, totalMinutes: 0,
        placeName: visit.place?.name || null,
        placeAddress: visit.place?.address || null
      });
    }
    const loc = locationMap.get(key);
    loc.totalMinutes += visit.durationMinutes || 0;
    if (!loc.placeAddress && visit.place?.address) loc.placeAddress = visit.place.address;
    if (!loc.placeName && visit.place?.name) loc.placeName = visit.place.name;
  }

  let dominant = null, maxMinutes = 0;
  for (const loc of locationMap.values()) {
    if (loc.totalMinutes > maxMinutes) { maxMinutes = loc.totalMinutes; dominant = loc; }
  }
  if (dominant) dominant.zipCode = extractZipCode(dominant.placeAddress);
  return dominant;
}

async function fetchWeather(lat, lon, date) {
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
    throw new Error(`${response.status}: ${error.slice(0, 100)}`);
  }
  const data = await response.json();
  const daily = data.daily;
  if (!daily?.time?.length) throw new Error('No weather data');
  const weatherCode = daily.weathercode?.[0];
  return {
    tempMax: Math.round(daily.temperature_2m_max?.[0]) || null,
    tempMin: Math.round(daily.temperature_2m_min?.[0]) || null,
    condition: WEATHER_CODES[weatherCode] || 'Unknown',
    precipitation: daily.precipitation_sum?.[0] || 0,
    weatherCode
  };
}

async function main() {
  const options = parseArgs();

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║            Déjà View - Weather Enrichment (ZIP Cache)          ║
╚════════════════════════════════════════════════════════════════╝
  `);

  if (!options.userId) {
    console.error('ERROR: --user=<uuid> is required');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: options.userId } });
  if (!user) {
    console.error(`ERROR: User ${options.userId} not found`);
    process.exit(1);
  }
  console.log(`User: ${user.email}`);

  // Get cache stats
  const cacheCount = await prisma.weatherCache.count();
  console.log(`Global weather cache: ${cacheCount.toLocaleString()} entries`);
  console.log('');

  // Build date filter
  const whereClause = { userId: options.userId };
  if (options.startDate || options.endDate) {
    whereClause.startTime = {};
    if (options.startDate) whereClause.startTime.gte = new Date(`${options.startDate}T00:00:00.000Z`);
    if (options.endDate) whereClause.startTime.lte = new Date(`${options.endDate}T23:59:59.999Z`);
  }

  // Get unique dates
  const visits = await prisma.visit.findMany({
    where: whereClause,
    select: { startTime: true }
  });
  const dateSet = new Set();
  for (const v of visits) dateSet.add(v.startTime.toISOString().split('T')[0]);

  // Filter already enriched
  const existingWeather = await prisma.dayData.findMany({
    where: { userId: options.userId, weather: { not: null } },
    select: { date: true }
  });
  const existingDates = new Set(existingWeather.map(d => d.date.toISOString().split('T')[0]));

  // Filter future dates
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const datesToEnrich = Array.from(dateSet)
    .filter(d => !existingDates.has(d) && d <= yesterdayStr)
    .sort();

  console.log('Current Status:');
  console.log(`  Total days with visits:  ${dateSet.size.toLocaleString()}`);
  console.log(`  Already have weather:    ${existingDates.size.toLocaleString()}`);
  console.log(`  Need enrichment:         ${datesToEnrich.length.toLocaleString()}`);
  console.log('');

  if (options.dryRun) {
    if (datesToEnrich.length > 0) {
      console.log(`Date range: ${datesToEnrich[0]} to ${datesToEnrich[datesToEnrich.length - 1]}`);
    }
    console.log('\nOpen-Meteo API is FREE - no cost!');
    console.log('ZIP caching means future users benefit from cached data.');
    await prisma.$disconnect();
    return;
  }

  if (datesToEnrich.length === 0) {
    console.log('All days already have weather data!');
    await prisma.$disconnect();
    return;
  }

  const finalDates = options.limit ? datesToEnrich.slice(0, options.limit) : datesToEnrich;
  console.log(`Enriching ${finalDates.length} days (delay: ${options.delay}ms)...`);
  if (options.skipGeocode) console.log('Reverse geocoding: DISABLED (using coord fallback)');
  console.log('');

  let success = 0, failed = 0, noVisits = 0, cacheHits = 0, apiCalls = 0;
  const startTime = Date.now();

  for (let i = 0; i < finalDates.length; i++) {
    const date = finalDates[i];
    const progress = `[${i + 1}/${finalDates.length}]`;
    const dayStart = new Date(`${date}T00:00:00.000Z`);

    try {
      const dominant = await getDominantLocation(options.userId, date);
      if (!dominant) { noVisits++; console.log(`${progress} - ${date}: No visits`); continue; }

      // Get ZIP code
      let zipCode = dominant.zipCode;
      if (!zipCode && !options.skipGeocode) {
        await sleep(1100);
        try { zipCode = await reverseGeocodeZip(dominant.lat, dominant.lon); } catch (e) {}
      }
      if (!zipCode) zipCode = `${dominant.lat.toFixed(2)},${dominant.lon.toFixed(2)}`;

      // Check cache
      let weather;
      let fromCache = false;
      const cached = await prisma.weatherCache.findUnique({
        where: { zipCode_date: { zipCode, date: dayStart } }
      });

      if (cached) {
        weather = cached;
        fromCache = true;
        cacheHits++;
      } else {
        weather = await fetchWeather(dominant.lat, dominant.lon, date);
        await prisma.weatherCache.create({
          data: {
            zipCode, date: dayStart,
            tempMax: weather.tempMax, tempMin: weather.tempMin,
            condition: weather.condition, precipitation: weather.precipitation,
            weatherCode: weather.weatherCode,
            lat: dominant.lat, lon: dominant.lon
          }
        });
        apiCalls++;
      }

      // Update DayData
      const weatherData = {
        tempMax: weather.tempMax, tempMin: weather.tempMin,
        condition: weather.condition, precipitation: weather.precipitation,
        weatherCode: weather.weatherCode, zipCode,
        locationName: dominant.placeName,
        cachedFrom: fromCache ? 'cache' : 'api'
      };

      await prisma.dayData.upsert({
        where: { userId_date: { userId: options.userId, date: dayStart } },
        update: { weather: weatherData, updatedAt: new Date() },
        create: {
          userId: options.userId, date: dayStart,
          weather: weatherData, distanceByType: {}, totalDistance: 0
        }
      });

      success++;
      const loc = dominant.placeName || zipCode;
      const src = fromCache ? '📦' : '🌐';
      console.log(`${progress} ${src} ${date}: ${weather.tempMax}°F ${weather.condition} (${loc})`);

    } catch (error) {
      failed++;
      console.log(`${progress} ✗ ${date}: ${error.message}`);
    }

    if (i < finalDates.length - 1 && !options.skipGeocode) {
      await sleep(options.delay);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const newCacheCount = await prisma.weatherCache.count();

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   WEATHER ENRICHMENT COMPLETE                  ║
╠════════════════════════════════════════════════════════════════╣
║  Successful:    ${success.toString().padStart(6)}                                        ║
║  Failed:        ${failed.toString().padStart(6)}                                        ║
║  No visits:     ${noVisits.toString().padStart(6)}                                        ║
║  Cache hits:    ${cacheHits.toString().padStart(6)} 📦                                     ║
║  API calls:     ${apiCalls.toString().padStart(6)} 🌐                                     ║
║  Time:          ${elapsed.padStart(6)}s                                       ║
║  Cost:          $0.00 (Open-Meteo is free!)                    ║
╠════════════════════════════════════════════════════════════════╣
║  Global cache:  ${newCacheCount.toString().padStart(6)} entries (shared with all users)   ║
╚════════════════════════════════════════════════════════════════╝
  `);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
