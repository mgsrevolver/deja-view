#!/usr/bin/env node

/**
 * OSM Nominatim Fallback Enrichment
 *
 * Enriches places that failed Google Places API enrichment
 * (typically expired Place IDs from closed businesses)
 *
 * Usage:
 *   node scripts/enrich-osm-fallback.js [--dry-run] [--limit=N]
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchOsmAddress } from '../src/services/place-enrichment.js';

const prisma = new PrismaClient();

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         OSM Nominatim Fallback Enrichment                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Find places without names that have visits (for coordinates)
  const unenrichedPlaces = await prisma.place.findMany({
    where: { name: null },
    include: {
      visits: {
        take: 1,
        select: { lat: true, lon: true }
      }
    }
  });

  // Filter to those with coordinates
  const placesWithCoords = unenrichedPlaces.filter(p => p.visits.length > 0);

  console.log(`Found ${unenrichedPlaces.length} places without names`);
  console.log(`  └─ ${placesWithCoords.length} have visit coordinates for OSM lookup`);
  console.log('');

  if (placesWithCoords.length === 0) {
    console.log('✓ All places are enriched!');
    await prisma.$disconnect();
    return;
  }

  // Apply limit if specified
  const toProcess = limit ? placesWithCoords.slice(0, limit) : placesWithCoords;

  if (dryRun) {
    console.log('DRY RUN - No changes will be made');
    console.log('');
    console.log(`Would enrich ${toProcess.length} places:`);
    for (const place of toProcess.slice(0, 10)) {
      const visit = place.visits[0];
      console.log(`  • ${place.id.substring(0, 25)}... @ ${visit.lat.toFixed(4)}, ${visit.lon.toFixed(4)}`);
    }
    if (toProcess.length > 10) {
      console.log(`  ... and ${toProcess.length - 10} more`);
    }
    await prisma.$disconnect();
    return;
  }

  // Enrich each place
  const results = {
    success: 0,
    partial: 0, // Got address but no name
    failed: 0,
    errors: []
  };

  const startTime = Date.now();
  console.log(`Processing ${toProcess.length} places (1 per second for rate limiting)...`);
  console.log('');

  for (let i = 0; i < toProcess.length; i++) {
    const place = toProcess[i];
    const visit = place.visits[0];
    const progress = `[${i + 1}/${toProcess.length}]`;

    try {
      // Rate limit: Nominatim requires 1 req/sec
      if (i > 0) {
        await sleep(1100);
      }

      const osmData = await fetchOsmAddress(visit.lat, visit.lon);

      if (osmData.address) {
        // Update the Place record
        await prisma.place.update({
          where: { id: place.id },
          data: {
            name: osmData.name || null,
            address: osmData.address,
            types: osmData.types || []
          }
        });

        // Track enrichment
        await prisma.enrichment.create({
          data: {
            type: 'osm_nominatim',
            status: 'complete',
            placeId: place.id,
            metadata: {
              source: 'fallback-script',
              osmType: osmData.osmType,
              osmId: osmData.osmId,
              hadName: !!osmData.name
            }
          }
        });

        if (osmData.name) {
          results.success++;
          console.log(`${progress} ✓ ${osmData.name}`);
          console.log(`        ${osmData.address}`);
        } else {
          results.partial++;
          console.log(`${progress} ~ ${osmData.address.substring(0, 50)}...`);
          console.log(`        (no business name, address only)`);
        }
      } else {
        results.failed++;
        results.errors.push({ placeId: place.id, error: 'No address returned' });
        console.log(`${progress} ✗ No data for ${visit.lat.toFixed(4)}, ${visit.lon.toFixed(4)}`);
      }

    } catch (error) {
      results.failed++;
      results.errors.push({ placeId: place.id, error: error.message });
      console.log(`${progress} ✗ Error: ${error.message}`);
    }

    // Progress update every 25 places
    if ((i + 1) % 25 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round(((toProcess.length - i - 1) * 1.1));
      console.log('');
      console.log(`   ⏱  ${elapsed}s elapsed, ~${remaining}s remaining`);
      console.log('');
    }
  }

  // Summary
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                            ');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Total processed:  ${toProcess.length}`);
  console.log(`  ✓ Full name:    ${results.success}`);
  console.log(`  ~ Address only: ${results.partial}`);
  console.log(`  ✗ Failed:       ${results.failed}`);
  console.log(`Time:             ${totalTime}s`);
  console.log('');

  // Check remaining
  const remaining = await prisma.place.count({ where: { name: null } });
  console.log(`Places still without names: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
