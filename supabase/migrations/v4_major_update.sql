-- =====================================================
-- SOCIETY MANAGEMENT SYSTEM - v4 MAJOR UPDATE
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- ================================================
-- 1. Extend societies table
-- ================================================
ALTER TABLE public.societies
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'COMMUNITY' CHECK (mode IN ('COMMUNITY', 'ADMIN_ONLY')),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS society_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text;

-- ================================================
-- 2. Add receipt_token to maintenance_bills
--    This enables public shareable receipt links
-- ================================================
ALTER TABLE public.maintenance_bills
  ADD COLUMN IF NOT EXISTS receipt_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'PENDING';

-- ================================================
-- 3. RLS: Allow anonymous read of a bill by token
--    (for public receipt links)
-- ================================================
DROP POLICY IF EXISTS "Public can view bill by receipt token." ON public.maintenance_bills;
CREATE POLICY "Public can view bill by receipt token." ON public.maintenance_bills
  FOR SELECT USING (receipt_token IS NOT NULL AND status = 'PAID');

-- ================================================
-- 4. Allow admins to update bill amounts
-- ================================================
DROP POLICY IF EXISTS "Admins can update bills." ON public.maintenance_bills;
CREATE POLICY "Admins can update bills." ON public.maintenance_bills
  FOR UPDATE USING (
    society_id = get_my_society_id() AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
  );

-- ================================================
-- 5. Allow admins to delete bills (for re-generation)
-- ================================================
DROP POLICY IF EXISTS "Admins can delete bills." ON public.maintenance_bills;
CREATE POLICY "Admins can delete bills." ON public.maintenance_bills
  FOR DELETE USING (
    society_id = get_my_society_id() AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
  );

-- ================================================
-- 6. Allow admins to update member profiles/roles
-- ================================================
DROP POLICY IF EXISTS "Admins can update member profiles." ON public.profiles;
CREATE POLICY "Admins can update member profiles." ON public.profiles
  FOR UPDATE USING (
    society_id = get_my_society_id() AND
    (SELECT role FROM public.profiles p2 WHERE p2.id = auth.uid()) = 'ADMIN'
  );

-- ================================================
-- 7. Allow admins to update their society info
-- ================================================
DROP POLICY IF EXISTS "Admins can update society details." ON public.societies;
CREATE POLICY "Admins can update society details." ON public.societies
  FOR UPDATE USING (
    id IN (SELECT society_id FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY'))
  );

-- ================================================
-- 8. Add indexes for performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_maintenance_bills_receipt_token ON public.maintenance_bills(receipt_token);
CREATE INDEX IF NOT EXISTS idx_maintenance_bills_month ON public.maintenance_bills(month);
CREATE INDEX IF NOT EXISTS idx_maintenance_bills_society_month ON public.maintenance_bills(society_id, month);

-- ================================================
-- 9. Helper function: get society balance dynamically
-- ================================================
CREATE OR REPLACE FUNCTION get_society_net_balance(p_society_id uuid)
RETURNS numeric AS $$
DECLARE
  base_balance numeric;
  total_collected numeric;
  total_expenses numeric;
BEGIN
  SELECT COALESCE(society_balance, 0) INTO base_balance
  FROM public.societies WHERE id = p_society_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_collected
  FROM public.maintenance_bills
  WHERE society_id = p_society_id AND status = 'PAID';

  SELECT COALESCE(SUM(amount), 0) INTO total_expenses
  FROM public.expenses
  WHERE society_id = p_society_id;

  RETURN base_balance + total_collected - total_expenses;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ================================================
-- DONE
-- ================================================
