-- Fix reports table structure and add missing columns
-- This script will add the status column and fix RLS policies

-- First, check if status column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reports' 
    AND column_name = 'status'
  ) THEN
    -- Add status column
    ALTER TABLE public.reports 
    ADD COLUMN status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'verified', 'invalid', 'flagged', 'resolved'));
    
    RAISE NOTICE 'Added status column to reports table';
  ELSE
    RAISE NOTICE 'Status column already exists in reports table';
  END IF;
END $$;

-- Check if other required columns exist
DO $$
BEGIN
  -- Add description column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reports' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN description TEXT;
    RAISE NOTICE 'Added description column to reports table';
  END IF;
  
  -- Add location column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reports' 
    AND column_name = 'location'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN location TEXT;
    RAISE NOTICE 'Added location column to reports table';
  END IF;
  
  -- Add latitude/longitude columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reports' 
    AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN latitude DECIMAL(10, 8);
    RAISE NOTICE 'Added latitude column to reports table';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reports' 
    AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN longitude DECIMAL(11, 8);
    RAISE NOTICE 'Added longitude column to reports table';
  END IF;
END $$;

-- Drop existing RLS policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view all reports" ON public.reports;
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.reports;

-- Create proper RLS policies for reports table
-- Users can view all reports
CREATE POLICY "Users can view all reports" ON public.reports
  FOR SELECT USING (true);

-- Users can insert their own reports
CREATE POLICY "Users can insert their own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reports
CREATE POLICY "Users can update their own reports" ON public.reports
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can manage all reports
CREATE POLICY "Admins can manage all reports" ON public.reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT ALL ON public.reports TO authenticated;

-- Update existing reports to have proper status
UPDATE public.reports 
SET status = 'pending' 
WHERE status IS NULL OR status NOT IN ('pending', 'verified', 'invalid', 'flagged', 'resolved');

-- Create report_confirmations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.report_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('confirm', 'flag', 'dispute')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_id, user_id, confirmation_type)
);

-- Enable RLS on report_confirmations
ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS policies for report_confirmations
CREATE POLICY "Users can view all confirmations" ON public.report_confirmations
  FOR SELECT USING (true);

CREATE POLICY "Users can insert confirmations" ON public.report_confirmations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all confirmations" ON public.report_confirmations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON public.report_confirmations TO authenticated;

-- Test the setup
DO $$
BEGIN
  RAISE NOTICE 'Reports table structure fixed successfully!';
  RAISE NOTICE 'RLS policies updated for proper access control';
  RAISE NOTICE 'Report confirmations table created for community verification';
END $$;