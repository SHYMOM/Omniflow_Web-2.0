-- Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Update RLS policies to allow admins to manage everything if needed.
-- For example, allowing admins to manage all profiles
CREATE POLICY "Admins can update all profiles." 
    ON public.profiles 
    FOR UPDATE 
    TO authenticated 
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can view all profiles." 
    ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Admins can update system_logs or view them
CREATE POLICY "Admins can view system logs" 
    ON public.system_logs 
    FOR SELECT 
    TO authenticated 
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete system logs" 
    ON public.system_logs 
    FOR DELETE 
    TO authenticated 
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
