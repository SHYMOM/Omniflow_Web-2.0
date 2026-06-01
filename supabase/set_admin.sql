-- Run this in your Supabase SQL Editor AFTER you have signed up on the frontend
-- Replace 'your_username' with the username you chose during sign up.

UPDATE public.profiles 
SET role = 'admin' 
WHERE username = 'your_username';

-- To verify the change:
SELECT id, username, role FROM public.profiles WHERE username = 'your_username';
