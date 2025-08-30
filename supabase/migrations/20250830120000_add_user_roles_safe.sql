-- Safe migration to add user roles table
-- This script checks for existing tables and handles errors gracefully

-- Check if user_roles table already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) THEN
    -- Create user_roles table
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('user', 'moderator', 'admin')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    RAISE NOTICE 'Created user_roles table';
  ELSE
    RAISE NOTICE 'user_roles table already exists';
  END IF;
END $$;

-- Enable Row Level Security if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_roles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on user_roles table';
  ELSE
    RAISE NOTICE 'RLS already enabled on user_roles table';
  END IF;
END $$;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;

-- Create RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

RAISE NOTICE 'Created RLS policies for user_roles';

-- Create function to update updated_at timestamp if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    RAISE NOTICE 'Created update_updated_at_column function';
  ELSE
    RAISE NOTICE 'update_updated_at_column function already exists';
  END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_user_roles_updated_at'
  ) THEN
    CREATE TRIGGER update_user_roles_updated_at 
      BEFORE UPDATE ON public.user_roles 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'Created update_user_roles_updated_at trigger';
  ELSE
    RAISE NOTICE 'update_user_roles_updated_at trigger already exists';
  END IF;
END $$;

-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can manage all confirmations" ON public.report_confirmations;

-- Grant admin user access to all reports
CREATE POLICY "Admins can manage all reports" ON public.reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant admin user access to all report confirmations
CREATE POLICY "Admins can manage all confirmations" ON public.report_confirmations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

RAISE NOTICE 'Created admin policies for reports and confirmations';

-- Create function to automatically assign user role on signup if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (new.id, 'user');
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Created handle_new_user function';
  ELSE
    RAISE NOTICE 'handle_new_user function already exists';
  END IF;
END $$;

-- Create trigger to automatically assign user role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    
    RAISE NOTICE 'Created on_auth_user_created trigger';
  ELSE
    RAISE NOTICE 'on_auth_user_created trigger already exists';
  END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.reports TO authenticated;
GRANT ALL ON public.report_confirmations TO authenticated;

RAISE NOTICE 'Migration completed successfully!';