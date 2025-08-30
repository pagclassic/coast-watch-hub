-- Script to create admin user and assign admin role
-- Run this AFTER the migration is applied

-- Step 1: Create admin user through Supabase auth
-- Go to Authentication > Users in your Supabase dashboard
-- Click "Add User" and create:
-- Email: admin@oceansafety.com
-- Password: admin123456

-- Step 2: Assign admin role (run this after creating the user)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get the user ID for the admin email
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@oceansafety.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'Admin role assigned to user %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user not found. Please create the user first in Authentication > Users';
  END IF;
END $$;

-- Alternative: Make any existing user an admin
-- Replace 'your-email@example.com' with the actual email
/*
DO $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = 'your-email@example.com';
  
  IF user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (user_id, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'Admin role assigned to user %', user_id;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;
*/