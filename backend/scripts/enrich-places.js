#!/usr/bin/env node

/**
 * CLI Script: Enrich places with Google Places API
 *
 * Usage:
 *   node scripts/enrich-places.js [--limit=N] [--delay=MS]
 *
 * Options:
 *   --limit=N    Maximum places to enrich (default: all)
 *   --delay=MS   Delay between API calls in ms (default: 100)
 *   --dry-run    Show what would be enriched without calling APIs
 */

// Run from backend directory: cd backend && node ../scripts/enrich-places.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    delay: 100,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Enrich Places - Fetch place details from Google Places API

USAGE:
  node scripts/enrich-places.js [options]

OPTIONS:
  --limit=N     Maximum places to enrich (default: all unenriched)
  --delay=MS    Delay between API calls in ms (default: 100)
  --dry-run     Show stats without making API calls
  --help, -h    Show this help message

REQUIREMENTS:
  Set GOOGLE_PLACES_API_KEY in backend/.env

EXAMPLES:
  # Enrich all unenriched places
  node scripts/enrich-places.js

  # Enrich 100 places with 200ms delay
  node scripts/enrich-places.js --limit=100 --delay=200

  # Check how many places need enrichment
  node scripts/enrich-places.js --dry-run
      `);
      process.exit(0);
    }
  }

  return options;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Google Places API - Fetch place details by Place ID
 */
async function fetchGooglePlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  const fields = 'displayName,formattedAddress,types,photos,primaryType';
  const url = `https://places.googleapis.com/v1/places/${placeId}`;

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fields
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error.slice(0, 100)}`);
  }

  const data = await response.json();

  // Extract photo URL if available
  let photoUrl = null;
  if (data.photos && data.photos.length > 0) {
    const photoRef = data.photos[0].name;
    photoUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=400&key=${apiKey}`;
  }

  return {
    name: data.displayName?.text || null,
    address: data.formattedAddress || null,
    types: data.types || [],
    primaryType: data.primaryType || null,
    photoUrl
  };
}

async function main() {
  const options = parseArgs();

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  Déjà View - Place Enrichment                  ║
╚════════════════════════════════════════════════════════════════╝
  `);

  // Check API key
  if (!process.env.GOOGLE_PLACES_API_KEY && !options.dryRun) {
    console.error('ERROR: GOOGLE_PLACES_API_KEY not set in backend/.env');
    console.error('Get an API key from: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
  }

  // Get stats
  const totalPlaces = await prisma.place.count();
  const enrichedPlaces = await prisma.place.count({ where: { name: { not: null } } });
  const unenrichedPlaces = totalPlaces - enrichedPlaces;
  const googleIdPlaces = await prisma.place.count({
    where: {
      id: { startsWith: 'ChIJ' },
      name: null
    }
  });

  console.log('Current Status:');
  console.log(`  Total places:      ${totalPlaces.toLocaleString()}`);
  console.log(`  Already enriched:  ${enrichedPlaces.toLocaleString()}`);
  console.log(`  Need enrichment:   ${unenrichedPlaces.toLocaleString()}`);
  console.log(`  With Google IDs:   ${googleIdPlaces.toLocaleString()}`);
  console.log('');

  if (options.dryRun) {
    const estimatedCost = (googleIdPlaces * 0.017).toFixed(2);
    console.log(`Estimated cost to enrich all: $${estimatedCost}`);
    console.log('(Google Places API: $17 per 1000 requests)');
    await prisma.$disconnect();
    return;
  }

  if (googleIdPlaces === 0) {
    console.log('All places with Google IDs are already enriched!');
    await prisma.$disconnect();
    return;
  }

  // Fetch unenriched places
  const limit = options.limit || googleIdPlaces;
  const places = await prisma.place.findMany({
    where: {
      id: { startsWith: 'ChIJ' },
      name: null
    },
    take: limit
  });

  console.log(`Enriching ${places.length} places (delay: ${options.delay}ms)...`);
  console.log('');

  let success = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const progress = `[${i + 1}/${places.length}]`;

    try {
      const data = await fetchGooglePlaceDetails(place.id);

      await prisma.place.update({
        where: { id: place.id },
        data: {
          name: data.name,
          address: data.address,
          types: data.types,
          defaultImageUrl: data.photoUrl
        }
      });

      await prisma.enrichment.create({
        data: {
          type: 'google_places',
          status: 'complete',
          placeId: place.id,
          metadata: data
        }
      });

      success++;
      console.log(`${progress} ✓ ${data.name || 'Unknown'}`);

    } catch (error) {
      failed++;
      console.log(`${progress} ✗ ${place.id}: ${error.message}`);

      await prisma.enrichment.create({
        data: {
          type: 'google_places',
          status: 'failed',
          placeId: place.id,
          metadata: { error: error.message }
        }
      });

      // Stop on auth errors
      if (error.message.includes('403') || error.message.includes('401')) {
        console.error('\nAPI key error - stopping enrichment');
        break;
      }
    }

    if (i < places.length - 1) {
      await sleep(options.delay);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const cost = (success * 0.017).toFixed(2);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                     ENRICHMENT COMPLETE                        ║
╠════════════════════════════════════════════════════════════════╣
║  Successful:    ${success.toString().padStart(6)}                                        ║
║  Failed:        ${failed.toString().padStart(6)}                                        ║
║  Time:          ${elapsed.padStart(6)}s                                       ║
║  Est. cost:     $${cost.padStart(5)}                                        ║
╚════════════════════════════════════════════════════════════════╝
  `);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
