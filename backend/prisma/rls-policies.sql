-- Row Level Security Policies for Déjà View
-- Run this in Supabase SQL Editor or via CLI
-- These policies ensure users can only access their own data

-- ============================================
-- USER TABLE
-- ============================================
-- Users can only see/modify their own user record
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY "Users can update own profile" ON "User"
  FOR UPDATE USING (id = auth.uid()::text);

-- Insert handled by auth trigger (see below)

-- ============================================
-- LOCATION TABLE
-- ============================================
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own locations" ON "Location"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own locations" ON "Location"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own locations" ON "Location"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own locations" ON "Location"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- ============================================
-- VISIT TABLE
-- ============================================
ALTER TABLE "Visit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own visits" ON "Visit"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own visits" ON "Visit"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own visits" ON "Visit"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own visits" ON "Visit"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- ============================================
-- DAYDATA TABLE
-- ============================================
ALTER TABLE "DayData" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own day data" ON "DayData"
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can insert own day data" ON "DayData"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own day data" ON "DayData"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own day data" ON "DayData"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- ============================================
-- ENRICHMENT TABLE
-- ============================================
ALTER TABLE "Enrichment" ENABLE ROW LEVEL SECURITY;

-- Users can see their own enrichments OR system-level (null userId)
CREATE POLICY "Users can view own or system enrichments" ON "Enrichment"
  FOR SELECT USING ("userId" = auth.uid()::text OR "userId" IS NULL);

CREATE POLICY "Users can insert own enrichments" ON "Enrichment"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own enrichments" ON "Enrichment"
  FOR UPDATE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can delete own enrichments" ON "Enrichment"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- ============================================
-- PLACE TABLE (Global/Shared - No RLS)
-- ============================================
-- Places are shared across all users (Google Place IDs are global)
-- Anyone can read, but only authenticated users can write
ALTER TABLE "Place" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view places" ON "Place"
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert places" ON "Place"
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update places" ON "Place"
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- No delete policy - places are permanent shared cache

-- ============================================
-- HELPER: Auto-create User on Supabase Auth signup
-- ============================================
-- This trigger creates a User record when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."User" (id, email, "createdAt", "updatedAt")
  VALUES (NEW.id::text, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for re-running)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SERVICE ROLE BYPASS (for backend API)
-- ============================================
-- Note: When using the service_role key, RLS is bypassed.
-- This allows the backend to perform admin operations.
-- NEVER expose the service_role key to the client.
