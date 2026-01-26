#!/usr/bin/env node
/**
 * Migrate existing data to a specific user
 *
 * Usage:
 *   node scripts/migrate-user-data.js <user-uuid>
 *   node scripts/migrate-user-data.js <user-uuid> --dry-run
 *
 * After a user signs up via Supabase Auth, run this script with their UUID
 * to assign all existing Location, Visit, DayData, and Enrichment records to them.
 *
 * To find the user UUID:
 *   1. Check Supabase Dashboard > Authentication > Users
 *   2. Or query: SELECT id, email FROM "User";
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const userId = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!userId) {
    console.error('Usage: node scripts/migrate-user-data.js <user-uuid> [--dry-run]');
    console.error('\nTo find user UUID:');
    console.error('  1. Check Supabase Dashboard > Authentication > Users');
    console.error('  2. Or sign up first, then check the User table');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('Error: Invalid UUID format');
    console.error('Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    process.exit(1);
  }

  console.log(`\n🔄 Migrating data to user: ${userId}`);
  if (dryRun) {
    console.log('📋 DRY RUN - no changes will be made\n');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`\n❌ User not found: ${userId}`);
    console.error('\nMake sure the user has signed up via Supabase Auth first.');
    console.error('The auth trigger should auto-create the User record.');

    // List existing users
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    if (users.length > 0) {
      console.error('\nExisting users:');
      users.forEach(u => console.error(`  ${u.id} (${u.email})`));
    } else {
      console.error('\nNo users in database. Sign up first via the frontend.');
    }
    process.exit(1);
  }

  console.log(`✓ Found user: ${user.email}\n`);

  // Count records to migrate (null userId)
  const [locationCount, visitCount, dayDataCount, enrichmentCount] = await Promise.all([
    prisma.location.count({ where: { userId: null } }),
    prisma.visit.count({ where: { userId: null } }),
    prisma.dayData.count({ where: { userId: null } }),
    prisma.enrichment.count({ where: { userId: null } })
  ]);

  console.log('Records to migrate (userId = null):');
  console.log(`  Locations:   ${locationCount.toLocaleString()}`);
  console.log(`  Visits:      ${visitCount.toLocaleString()}`);
  console.log(`  DayData:     ${dayDataCount.toLocaleString()}`);
  console.log(`  Enrichments: ${enrichmentCount.toLocaleString()}`);
  console.log('');

  const total = locationCount + visitCount + dayDataCount + enrichmentCount;
  if (total === 0) {
    console.log('✓ No records to migrate. All data already has userId assigned.');
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log('DRY RUN complete. Run without --dry-run to apply changes.');
    await prisma.$disconnect();
    return;
  }

  // Perform migration
  console.log('Migrating...');

  const results = await Promise.all([
    prisma.location.updateMany({
      where: { userId: null },
      data: { userId }
    }),
    prisma.visit.updateMany({
      where: { userId: null },
      data: { userId }
    }),
    prisma.dayData.updateMany({
      where: { userId: null },
      data: { userId }
    }),
    prisma.enrichment.updateMany({
      where: { userId: null },
      data: { userId }
    })
  ]);

  console.log('\n✅ Migration complete:');
  console.log(`  Locations:   ${results[0].count.toLocaleString()} updated`);
  console.log(`  Visits:      ${results[1].count.toLocaleString()} updated`);
  console.log(`  DayData:     ${results[2].count.toLocaleString()} updated`);
  console.log(`  Enrichments: ${results[3].count.toLocaleString()} updated`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Migration failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
