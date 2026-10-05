-- 1. Company branding columns that Settings.tsx saves to profiles but which never existed.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS company_website TEXT,
    ADD COLUMN IF NOT EXISTS company_email TEXT,
    ADD COLUMN IF NOT EXISTS company_phone TEXT,
    ADD COLUMN IF NOT EXISTS company_address TEXT;

-- 2. company-logos bucket: public read (logos are embedded in PDFs), writes only inside the
--    user's own folder. Path convention: {user_id}/logo-{timestamp}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 2097152,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
    SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No SELECT policy on purpose: public URLs work without one, and it would allow listing every user's folder.
-- upsert: true in the client needs SELECT on the user's own objects, so scope it to their folder.
CREATE POLICY "Users can view own logos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload own logos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can replace own logos"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own logos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Remove the blanket "any signed-in user can do anything" policies. The scoped policies
--    from 20260401_rls_policies.sql already cover these tables.
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.teams;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sops;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sop_history;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.interview_sessions;

-- 4. Teammates need to read each other's profile (e.g. the suggester's name on an edit suggestion).
--    SECURITY DEFINER avoids policy recursion on profiles.
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT team_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_team_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated;

CREATE POLICY "Users can view teammate profiles"
    ON public.profiles FOR SELECT
    USING (team_id IS NOT NULL AND team_id = public.current_team_id());

-- 5. Users may update their own profile, but not team_id or role (that would let them join any team
--    or promote themselves). Column-level grants enforce it. New profile columns that users should be
--    able to edit must be added to this list.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
    full_name, language_preference, industry, country, agentic_prompt,
    company_name, company_logo_url, company_website, company_email, company_phone, company_address
) ON public.profiles TO authenticated;

-- 6. sop_edit_suggestions had overlapping policies; because policies are OR-ed, the weakest one won.
DROP POLICY IF EXISTS "Users can insert SOP suggestions" ON public.sop_edit_suggestions;
DROP POLICY IF EXISTS "Any team member can create a suggestion" ON public.sop_edit_suggestions;
DROP POLICY IF EXISTS "Only creators can update suggestions" ON public.sop_edit_suggestions;
DROP POLICY IF EXISTS "Creators can update suggestions" ON public.sop_edit_suggestions;
DROP POLICY IF EXISTS "Users can view team SOP suggestions" ON public.sop_edit_suggestions;

CREATE POLICY "Team members can create own suggestions"
    ON public.sop_edit_suggestions FOR INSERT
    WITH CHECK (
        suggested_by = auth.uid()
        AND sop_id IN (SELECT id FROM public.sops WHERE team_id = public.current_team_id())
    );

CREATE POLICY "Team creators can update suggestions"
    ON public.sop_edit_suggestions FOR UPDATE
    USING (
        sop_id IN (SELECT id FROM public.sops WHERE team_id = public.current_team_id())
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'creator')
    );
