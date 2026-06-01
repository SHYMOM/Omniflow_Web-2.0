-- ═══════════════════════════════════════════════════════════════
-- OMNIFLOW DATABASE MIGRATION - FIX RLS RECURSION
-- ═══════════════════════════════════════════════════════════════

-- 1. Create a security definer helper function to determine admin status
-- Because this runs as SECURITY DEFINER, it bypasses RLS on public.profiles,
-- preventing infinite recursion locks when policies are evaluated.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke default public execution privileges to secure internal functions
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles." ON public.profiles;
DROP POLICY IF EXISTS "Admins can view system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Admins can delete system logs" ON public.system_logs;

-- 3. Re-create policies using the secure is_admin() function
CREATE POLICY "Admins can update all profiles." 
    ON public.profiles 
    FOR UPDATE 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can view all profiles." 
    ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can view system logs" 
    ON public.system_logs 
    FOR SELECT 
    TO authenticated 
    USING (public.is_admin());

CREATE POLICY "Admins can delete system logs" 
    ON public.system_logs 
    FOR DELETE 
    TO authenticated 
    USING (public.is_admin());
