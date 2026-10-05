-- Private storage for step screenshots generated from screen recordings.
-- Path convention: {team_id}/{sop_id}/step-{n}.jpg — the first folder is the team, which RLS keys on.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('sop-images', 'sop-images', false, 5242880, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Team members can view SOP images"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'sop-images'
        AND (storage.foldername(name))[1] = (SELECT team_id::text FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Team members can upload SOP images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'sop-images'
        AND (storage.foldername(name))[1] = (SELECT team_id::text FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Team members can replace SOP images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'sop-images'
        AND (storage.foldername(name))[1] = (SELECT team_id::text FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Team members can delete SOP images"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'sop-images'
        AND (storage.foldername(name))[1] = (SELECT team_id::text FROM public.profiles WHERE id = auth.uid())
    );
