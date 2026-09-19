-- =====================================================
-- DATABASE CLEANUP SCRIPT
-- Wipes ALL society data but KEEPS super admin auth user
-- Super Admin: pranav07112007@gmail.com
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- =====================================================

DO $$
DECLARE
  super_admin_email TEXT := 'pranav07112007@gmail.com';
  super_admin_id UUID;
BEGIN

  -- Get super admin's auth user ID
  SELECT id INTO super_admin_id
  FROM auth.users
  WHERE email = super_admin_email
  LIMIT 1;

  RAISE NOTICE 'Super admin ID: %', super_admin_id;

  -- ── Step 1: Delete votes ─────────────────────────
  DELETE FROM public.votes;
  RAISE NOTICE 'Deleted votes';

  -- ── Step 2: Delete candidates ────────────────────
  DELETE FROM public.candidates;
  RAISE NOTICE 'Deleted candidates';

  -- ── Step 3: Delete elections ─────────────────────
  DELETE FROM public.elections;
  RAISE NOTICE 'Deleted elections';

  -- ── Step 4: Delete transactions ──────────────────
  DELETE FROM public.transactions;
  RAISE NOTICE 'Deleted transactions';

  -- ── Step 5: Delete maintenance_bills ─────────────
  DELETE FROM public.maintenance_bills;
  RAISE NOTICE 'Deleted maintenance_bills';

  -- ── Step 6: Delete expenses ──────────────────────
  DELETE FROM public.expenses;
  RAISE NOTICE 'Deleted expenses';

  -- ── Step 7: Delete hall_allocations ──────────────
  DELETE FROM public.hall_allocations;
  RAISE NOTICE 'Deleted hall_allocations';

  -- ── Step 8: Delete properties ────────────────────
  DELETE FROM public.properties;
  RAISE NOTICE 'Deleted properties';

  -- ── Step 9: Delete complaints ────────────────────
  DELETE FROM public.complaints;
  RAISE NOTICE 'Deleted complaints';

  -- ── Step 10: Delete notices ──────────────────────
  DELETE FROM public.notices;
  RAISE NOTICE 'Deleted notices';

  -- ── Step 11: Delete join_requests ────────────────
  DELETE FROM public.join_requests;
  RAISE NOTICE 'Deleted join_requests';

  -- ── Step 12: Delete ALL profiles ─────────────────
  --   (super admin doesn't have a profile row)
  DELETE FROM public.profiles;
  RAISE NOTICE 'Deleted all profiles';

  -- ── Step 13: Delete ALL societies ────────────────
  DELETE FROM public.societies;
  RAISE NOTICE 'Deleted all societies';

  -- ── Step 14: Delete all auth users EXCEPT super admin ──
  -- This uses auth.users directly via service role
  DELETE FROM auth.users
  WHERE email != super_admin_email;
  RAISE NOTICE 'Deleted all auth users except super admin';

  RAISE NOTICE '✅ Database cleanup complete. Super admin (%) preserved.', super_admin_email;

END $$;

-- Verify only super admin remains
SELECT id, email, created_at
FROM auth.users;
