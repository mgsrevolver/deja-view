/**
 * Place Enrichment Service
 *
 * Two-tier approach:
 * - Tier 1 (Free): OSM Nominatim for reverse geocoding
 * - Tier 2 (Premium): Google Places API for rich data
 *
 * All enriched places are cached in the Place table for future users.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Rate limiting for APIs
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Google Places API - Fetch place details by Place ID
 * Requires GOOGLE_PLACES_API_KEY in environment
 */
export async function fetchGooglePlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  const fields = [
    'displayName',
    'formattedAddress',
    'types',
    'photos',
    'primaryType',
    'primaryTypeDisplayName'
  ].join(',');

  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=${fields}&key=${apiKey}`;

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fields
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} - ${error}`);
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

/**
 * OSM Nominatim - Free reverse geocoding
 * Rate limit: 1 request per second
 */
export async function fetchOsmAddress(lat, lon) {
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

  // Extract useful info
  const address = data.address || {};

  // Try to infer a place name from OSM data
  const placeName = address.amenity ||
                    address.shop ||
                    address.tourism ||
                    address.leisure ||
                    address.building ||
                    null;

  // Build formatted address
  const parts = [
    address.house_number,
    address.road,
    address.city || address.town || address.village,
    address.state,
    address.postcode
  ].filter(Boolean);

  return {
    name: placeName,
    address: parts.join(', ') || data.display_name,
    types: data.type ? [data.type] : [],
    osmType: data.osm_type,
    osmId: data.osm_id
  };
}

/**
 * Enrich a single place - tries cache first, then API
 */
export async function enrichPlace(placeId, lat = null, lon = null, useGoogle = false) {
  // Check if already enriched
  const existing = await prisma.place.findUnique({
    where: { id: placeId }
  });

  if (existing?.name) {
    return { cached: true, place: existing };
  }

  let enrichedData = null;

  // Try Google Places API for valid Place IDs
  if (useGoogle && placeId.startsWith('ChIJ')) {
    try {
      enrichedData = await fetchGooglePlaceDetails(placeId);
    } catch (error) {
      console.warn(`Google Places failed for ${placeId}: ${error.message}`);
    }
  }

  // Fallback to OSM if we have coordinates
  if (!enrichedData && lat && lon) {
    try {
      await sleep(1100); // Nominatim rate limit
      enrichedData = await fetchOsmAddress(lat, lon);
    } catch (error) {
      console.warn(`OSM Nominatim failed: ${error.message}`);
    }
  }

  if (!enrichedData) {
    return { cached: false, place: existing, error: 'No enrichment source available' };
  }

  // Update the Place record
  const updated = await prisma.place.update({
    where: { id: placeId },
    data: {
      name: enrichedData.name,
      address: enrichedData.address,
      types: enrichedData.types,
      defaultImageUrl: enrichedData.photoUrl || null
    }
  });

  // Track enrichment
  await prisma.enrichment.create({
    data: {
      type: useGoogle ? 'google_places' : 'osm_nominatim',
      status: 'complete',
      placeId: placeId,
      metadata: enrichedData
    }
  });

  return { cached: false, place: updated };
}

/**
 * Batch enrich places with Google Places API
 * For seeding the global cache
 */
export async function batchEnrichWithGoogle(options = {}) {
  const { limit = 100, delayMs = 100 } = options;

  // Find unenriched places with Google Place IDs
  const places = await prisma.place.findMany({
    where: {
      id: { startsWith: 'ChIJ' },
      name: null
    },
    take: limit
  });

  console.log(`Found ${places.length} places to enrich`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const place of places) {
    try {
      const result = await enrichPlace(place.id, null, null, true);
      if (result.place?.name) {
        results.success++;
        console.log(`  ✓ ${result.place.name}`);
      } else {
        results.failed++;
        results.errors.push({ placeId: place.id, error: result.error });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ placeId: place.id, error: error.message });
      console.error(`  ✗ ${place.id}: ${error.message}`);
    }

    await sleep(delayMs); // Rate limiting
  }

  return results;
}

/**
 * Get coordinates for a place (from any visit to that place)
 */
export async function getPlaceCoordinates(placeId) {
  const visit = await prisma.visit.findFirst({
    where: { placeID: placeId },
    select: { lat: true, lon: true }
  });
  return visit;
}

export default {
  fetchGooglePlaceDetails,
  fetchOsmAddress,
  enrichPlace,
  batchEnrichWithGoogle,
  getPlaceCoordinates
};
