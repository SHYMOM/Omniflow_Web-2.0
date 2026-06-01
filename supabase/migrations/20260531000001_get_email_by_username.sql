-- Function to securely fetch a user's email by their username for login purposes.
-- This is required because auth.users is not accessible to anonymous users.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email
    FROM auth.users
    JOIN public.profiles ON auth.users.id = public.profiles.id
    WHERE public.profiles.username = p_username;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
