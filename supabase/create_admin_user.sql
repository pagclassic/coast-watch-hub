-- This script creates an admin user manually
-- Run this AFTER applying the migration

-- First, create the admin user through Supabase auth (you'll need to do this manually)
-- Go to Authentication > Users in your Supabase dashboard and create:
-- Email: admin@oceansafety.com
-- Password: admin123456

-- Then run this SQL to assign admin role:

-- Get the admin user ID (replace with actual email if different)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get the user ID for the admin email
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@oceansafety.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Update the user role to admin
    UPDATE public.user_roles 
    SET role = 'admin' 
    WHERE user_id = admin_user_id;
    
    -- If no role exists yet, create one
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role) 
      VALUES (admin_user_id, 'admin');
    END IF;
    
    RAISE NOTICE 'Admin role assigned to user %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user not found. Please create the user first in Authentication > Users';
  END IF;
END $$;

-- Alternative: Create admin role for any existing user
-- Replace 'your-email@example.com' with the actual email of the user you want to make admin
/*
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'your-email@example.com';
  
  IF user_id IS NOT NULL THEN
    UPDATE public.user_roles 
    SET role = 'admin' 
    WHERE user_id = user_id;
    
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role) 
      VALUES (user_id, 'admin');
    END IF;
    
    RAISE NOTICE 'Admin role assigned to user %', user_id;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;
*/