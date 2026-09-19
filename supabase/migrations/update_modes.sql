-- Migration: Add Society Modes
-- Run this in the Supabase SQL Editor

ALTER TABLE public.societies 
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'COMMUNITY' CHECK (mode IN ('COMMUNITY', 'ADMIN_ONLY'));

ALTER TABLE public.societies 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
