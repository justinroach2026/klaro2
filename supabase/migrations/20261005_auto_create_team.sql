-- Every user needs a team: sops and interview_sessions require team_id NOT NULL,
-- but handle_new_user previously created a profile with team_id = NULL.

-- New signups get their own team, linked from the profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text := new.raw_user_meta_data->>'full_name';
  v_team_id uuid;
BEGIN
  INSERT INTO public.teams (name)
  VALUES (COALESCE(NULLIF(v_full_name, ''), split_part(new.email, '@', 1)) || '''s team')
  RETURNING id INTO v_team_id;

  INSERT INTO public.profiles (id, full_name, team_id)
  VALUES (new.id, v_full_name, v_team_id);

  RETURN new;
END;
$$;

-- Backfill existing profiles that have no team.
DO $$
DECLARE
  r record;
  v_team_id uuid;
BEGIN
  FOR r IN
    SELECT p.id, COALESCE(NULLIF(p.full_name, ''), split_part(u.email, '@', 1)) AS label
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.team_id IS NULL
  LOOP
    INSERT INTO public.teams (name) VALUES (r.label || '''s team') RETURNING id INTO v_team_id;
    UPDATE public.profiles SET team_id = v_team_id WHERE id = r.id;
  END LOOP;
END;
$$;
