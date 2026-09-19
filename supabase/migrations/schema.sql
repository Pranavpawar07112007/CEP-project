-- =====================================================
-- SOCIETY MANAGEMENT SYSTEM - FULL SCHEMA v3
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- ================================================
-- 1. Societies (no foreign keys, created first)
-- ================================================
CREATE TABLE public.societies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  admin_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================
-- 2. Profiles (depends on societies + auth.users)
-- ================================================
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  role text CHECK (role IN ('ADMIN', 'SECRETARY', 'OWNER', 'RESIDENT')),
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED')),
  first_name text,
  last_name text,
  phone text,
  flat_number text,
  family_members integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================
-- STEP 0: Helper function (AFTER profiles table exists)
-- ================================================
CREATE OR REPLACE FUNCTION get_my_society_id()
RETURNS uuid AS $$
  SELECT society_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ================================================
-- RLS: societies
-- ================================================
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Societies are viewable by everyone." ON public.societies FOR SELECT USING (true);
CREATE POLICY "Anyone can create a society." ON public.societies FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update their own society." ON public.societies FOR UPDATE USING (
  id IN (SELECT society_id FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- ================================================
-- RLS: profiles
-- ================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view profiles in same society." ON public.profiles FOR SELECT USING (
  society_id = get_my_society_id()
);
CREATE POLICY "Users can insert own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ================================================
-- 3. Join Requests (self-registration pending admin approval)
-- ================================================
CREATE TABLE public.join_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  flat_number text,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own requests." ON public.join_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins see all requests in society." ON public.join_requests FOR SELECT USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Users can create join requests." ON public.join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update join requests." ON public.join_requests FOR UPDATE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);

-- ================================================
-- 4. Properties (Property Tracker Module)
-- ================================================
CREATE TABLE public.properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  property_type text CHECK (property_type IN ('SALE', 'RENT')),
  price numeric NOT NULL,
  privacy text CHECK (privacy IN ('RESIDENT_ONLY', 'EVERYONE')) DEFAULT 'RESIDENT_ONLY',
  status text DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD', 'RENTED')),
  contact_name text,
  contact_phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Properties viewable based on privacy and society." ON public.properties FOR SELECT USING (
  (privacy = 'EVERYONE') OR
  (privacy = 'RESIDENT_ONLY' AND society_id = get_my_society_id())
);
CREATE POLICY "Owners can insert properties." ON public.properties FOR INSERT WITH CHECK (
  owner_id = auth.uid() AND society_id = get_my_society_id()
);
CREATE POLICY "Owners can update their properties." ON public.properties FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete their properties." ON public.properties FOR DELETE USING (owner_id = auth.uid());

-- ================================================
-- 5. Maintenance Bills
-- ================================================
CREATE TABLE public.maintenance_bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  month text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  due_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.maintenance_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own bills." ON public.maintenance_bills FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins view all bills in society." ON public.maintenance_bills FOR SELECT USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Admins can create bills." ON public.maintenance_bills FOR INSERT WITH CHECK (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "System can update bill status (paid)." ON public.maintenance_bills FOR UPDATE USING (true);

-- ================================================
-- 6. Transactions (Razorpay payments)
-- ================================================
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id uuid REFERENCES public.maintenance_bills(id),
  user_id uuid REFERENCES public.profiles(id),
  society_id uuid REFERENCES public.societies(id),
  amount numeric NOT NULL,
  payment_mode text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text UNIQUE,
  status text DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own transactions." ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins view all transactions in society." ON public.transactions FOR SELECT USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "System can insert transactions." ON public.transactions FOR INSERT WITH CHECK (true);

-- ================================================
-- 7. Complaints / Suggestions
-- ================================================
CREATE TABLE public.complaints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  type text CHECK (type IN ('COMPLAINT', 'SUGGESTION')) DEFAULT 'COMPLAINT',
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  admin_reply text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own complaints." ON public.complaints FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins view all complaints in society." ON public.complaints FOR SELECT USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Users can insert complaints." ON public.complaints FOR INSERT WITH CHECK (
  auth.uid() = user_id AND society_id = get_my_society_id()
);
CREATE POLICY "Admins can update complaints." ON public.complaints FOR UPDATE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);

-- ================================================
-- 8. Notices (Notice Board)
-- ================================================
CREATE TABLE public.notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  type text CHECK (type IN ('ANNOUNCEMENT', 'MEETING', 'EVENT', 'ADVERTISEMENT')) DEFAULT 'ANNOUNCEMENT',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users in society can view notices." ON public.notices FOR SELECT USING (
  society_id = get_my_society_id()
);
CREATE POLICY "Admins can create notices." ON public.notices FOR INSERT WITH CHECK (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Admins can delete notices." ON public.notices FOR DELETE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);

-- ================================================
-- 9. Hall Allocations
-- ================================================
CREATE TABLE public.hall_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  attendees integer DEFAULT 0,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.hall_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view allocations in their society." ON public.hall_allocations FOR SELECT USING (
  society_id = get_my_society_id()
);
CREATE POLICY "Users can request hall allocation." ON public.hall_allocations FOR INSERT WITH CHECK (
  auth.uid() = user_id AND society_id = get_my_society_id()
);
CREATE POLICY "Admins can update hall allocations." ON public.hall_allocations FOR UPDATE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);

-- ================================================
-- 10. Elections & Voting
-- ================================================
CREATE TABLE public.elections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  position text NOT NULL CHECK (position IN ('SECRETARY', 'CHAIRMAN', 'TREASURER')),
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_by uuid REFERENCES public.profiles(id),
  ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id uuid REFERENCES public.elections(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  manifesto text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id uuid REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(election_id, user_id)  -- One vote per user per election
);

ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view elections in society." ON public.elections FOR SELECT USING (society_id = get_my_society_id());
CREATE POLICY "Admins can create elections." ON public.elections FOR INSERT WITH CHECK (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Admins can update elections." ON public.elections FOR UPDATE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Users view all candidates." ON public.candidates FOR SELECT USING (
  (SELECT society_id FROM public.elections WHERE id = election_id) = get_my_society_id()
);
CREATE POLICY "Users can nominate themselves." ON public.candidates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view all votes in society elections." ON public.votes FOR SELECT USING (
  (SELECT society_id FROM public.elections WHERE id = election_id) = get_my_society_id()
);
CREATE POLICY "Users can cast one vote per election." ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================
-- 11. Expenses (Annual Report)
-- ================================================
CREATE TABLE public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL,
  category text DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'MAINTENANCE', 'EVENT', 'SALARY', 'UTILITY', 'OTHER')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view expenses in society." ON public.expenses FOR SELECT USING (society_id = get_my_society_id());
CREATE POLICY "Admins can add expenses." ON public.expenses FOR INSERT WITH CHECK (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);
CREATE POLICY "Admins can delete expenses." ON public.expenses FOR DELETE USING (
  society_id = get_my_society_id() AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SECRETARY')
);

-- ================================================
-- 12. Realtime subscriptions
-- ================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hall_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
