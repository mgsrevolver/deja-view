#!/usr/bin/env node
/**
 * Apply Row Level Security policies to Supabase
 * Run: node scripts/apply-rls.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const policies = [
  // USER TABLE
  `ALTER TABLE "User" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own profile" ON "User"`,
  `CREATE POLICY "Users can view own profile" ON "User" FOR SELECT USING (id = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update own profile" ON "User"`,
  `CREATE POLICY "Users can update own profile" ON "User" FOR UPDATE USING (id = auth.uid()::text)`,

  // LOCATION TABLE
  `ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own locations" ON "Location"`,
  `CREATE POLICY "Users can view own locations" ON "Location" FOR SELECT USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can insert own locations" ON "Location"`,
  `CREATE POLICY "Users can insert own locations" ON "Location" FOR INSERT WITH CHECK ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update own locations" ON "Location"`,
  `CREATE POLICY "Users can update own locations" ON "Location" FOR UPDATE USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can delete own locations" ON "Location"`,
  `CREATE POLICY "Users can delete own locations" ON "Location" FOR DELETE USING ("userId" = auth.uid()::text)`,

  // VISIT TABLE
  `ALTER TABLE "Visit" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own visits" ON "Visit"`,
  `CREATE POLICY "Users can view own visits" ON "Visit" FOR SELECT USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can insert own visits" ON "Visit"`,
  `CREATE POLICY "Users can insert own visits" ON "Visit" FOR INSERT WITH CHECK ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update own visits" ON "Visit"`,
  `CREATE POLICY "Users can update own visits" ON "Visit" FOR UPDATE USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can delete own visits" ON "Visit"`,
  `CREATE POLICY "Users can delete own visits" ON "Visit" FOR DELETE USING ("userId" = auth.uid()::text)`,

  // DAYDATA TABLE
  `ALTER TABLE "DayData" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own day data" ON "DayData"`,
  `CREATE POLICY "Users can view own day data" ON "DayData" FOR SELECT USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can insert own day data" ON "DayData"`,
  `CREATE POLICY "Users can insert own day data" ON "DayData" FOR INSERT WITH CHECK ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update own day data" ON "DayData"`,
  `CREATE POLICY "Users can update own day data" ON "DayData" FOR UPDATE USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can delete own day data" ON "DayData"`,
  `CREATE POLICY "Users can delete own day data" ON "DayData" FOR DELETE USING ("userId" = auth.uid()::text)`,

  // ENRICHMENT TABLE
  `ALTER TABLE "Enrichment" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Users can view own or system enrichments" ON "Enrichment"`,
  `CREATE POLICY "Users can view own or system enrichments" ON "Enrichment" FOR SELECT USING ("userId" = auth.uid()::text OR "userId" IS NULL)`,
  `DROP POLICY IF EXISTS "Users can insert own enrichments" ON "Enrichment"`,
  `CREATE POLICY "Users can insert own enrichments" ON "Enrichment" FOR INSERT WITH CHECK ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can update own enrichments" ON "Enrichment"`,
  `CREATE POLICY "Users can update own enrichments" ON "Enrichment" FOR UPDATE USING ("userId" = auth.uid()::text)`,
  `DROP POLICY IF EXISTS "Users can delete own enrichments" ON "Enrichment"`,
  `CREATE POLICY "Users can delete own enrichments" ON "Enrichment" FOR DELETE USING ("userId" = auth.uid()::text)`,

  // PLACE TABLE (Global/Shared)
  `ALTER TABLE "Place" ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Anyone can view places" ON "Place"`,
  `CREATE POLICY "Anyone can view places" ON "Place" FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS "Authenticated users can insert places" ON "Place"`,
  `CREATE POLICY "Authenticated users can insert places" ON "Place" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)`,
  `DROP POLICY IF EXISTS "Authenticated users can update places" ON "Place"`,
  `CREATE POLICY "Authenticated users can update places" ON "Place" FOR UPDATE USING (auth.uid() IS NOT NULL)`,
];

// Auth trigger (separate because it's multi-statement)
const authTrigger = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."User" (id, email, "createdAt", "updatedAt")
  VALUES (NEW.id::text, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const createTrigger = `
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

async function main() {
  console.log('Applying RLS policies...\n');

  let success = 0;
  let failed = 0;

  for (const sql of policies) {
    try {
      await prisma.$executeRawUnsafe(sql);
      const shortSql = sql.length > 60 ? sql.substring(0, 60) + '...' : sql;
      console.log(`✓ ${shortSql}`);
      success++;
    } catch (error) {
      console.error(`✗ ${sql.substring(0, 60)}...`);
      console.error(`  Error: ${error.message}\n`);
      failed++;
    }
  }

  // Apply auth trigger
  console.log('\nApplying auth trigger...');
  try {
    await prisma.$executeRawUnsafe(authTrigger);
    console.log('✓ Created handle_new_user function');
  } catch (error) {
    console.error(`✗ handle_new_user function: ${error.message}`);
    failed++;
  }

  try {
    await prisma.$executeRawUnsafe(createTrigger);
    console.log('✓ Created on_auth_user_created trigger');
  } catch (error) {
    console.error(`✗ on_auth_user_created trigger: ${error.message}`);
    failed++;
  }

  console.log(`\n${success} policies applied, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(console.error);
