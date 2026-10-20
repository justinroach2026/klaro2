-- Klaro schema baseline, generated from the live project (jyvtanzwfysqwqtuivri) on 2026-10-20.
--
-- Builds the whole public schema from nothing: tables, constraints, functions, policies, triggers,
-- storage buckets and explicit grants. It replaces the earlier incremental migrations (kept for
-- reference in supabase/migrations_archive/), which assumed tables created by hand in the dashboard.
--
-- Grants are written out explicitly because, from 2026-10-30, Supabase no longer grants Data API
-- access to new tables in "public" automatically. Any later migration that creates a table must add
-- its own GRANTs (see the "Database changes" rule in CLAUDE.md).


-- ─── Extensions ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Supabase sets this on new projects; restated so the baseline doesn't depend on it.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ─── Sequences ─────────────────────────────────────────────────────────────

CREATE SEQUENCE public.sop_audit_log_seq_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;

-- ─── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE public.interview_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mode text NOT NULL,
    language text DEFAULT 'en'::text,
    transcript jsonb DEFAULT '[]'::jsonb,
    sop_id uuid,
    status text DEFAULT 'in_progress'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    team_id uuid,
    full_name text,
    language_preference text DEFAULT 'en'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    industry text,
    country text,
    agentic_prompt text,
    role text DEFAULT 'creator'::text NOT NULL,
    company_name text,
    company_logo_url text,
    company_website text,
    company_email text,
    company_phone text,
    company_address text,
    manager_id uuid,
    email text
);

CREATE TABLE public.sop_audit_log (
    seq bigint DEFAULT nextval('public.sop_audit_log_seq_seq'::regclass) NOT NULL,
    sop_id uuid NOT NULL,
    team_id uuid NOT NULL,
    sop_title text,
    actor_id uuid,
    actor_name text,
    actor_email text,
    action text NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    from_version integer,
    to_version integer,
    summary text,
    before_title text,
    after_title text,
    before_content text,
    after_content text,
    note text,
    prev_hash text,
    entry_hash text NOT NULL
);

CREATE TABLE public.sop_edit_suggestions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    sop_id uuid NOT NULL,
    suggested_by uuid NOT NULL,
    suggested_title text NOT NULL,
    suggested_content text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid
);

CREATE TABLE public.sop_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    sop_id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    content text,
    tags text[],
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sops (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    title text NOT NULL,
    content text,
    language text DEFAULT 'en'::text,
    tags text[],
    version integer DEFAULT 1,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    owner_id uuid,
    review_interval_days integer,
    last_reviewed_at timestamp with time zone,
    next_review_at timestamp with time zone,
    related_sop_ids uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'published'::text NOT NULL,
    approval_status text DEFAULT 'approved'::text NOT NULL,
    pending_title text,
    pending_content text,
    pending_by uuid,
    pending_at timestamp with time zone,
    review_note text,
    approved_by uuid,
    approved_at timestamp with time zone
);

CREATE TABLE public.team_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'creator'::text NOT NULL,
    token_hash text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    revoked_at timestamp with time zone
);

CREATE TABLE public.teams (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'active'::text,
    trial_ends_at timestamp with time zone,
    logo_url text
);


-- ─── Sequence ownership ────────────────────────────────────────────────────

ALTER SEQUENCE public.sop_audit_log_seq_seq OWNED BY public.sop_audit_log.seq;

-- ─── Primary keys, unique and check constraints ────────────────────────────

ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_mode_check CHECK ((mode = ANY (ARRAY['drive'::text, 'office'::text])));
ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'viewer'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.sop_audit_log ADD CONSTRAINT sop_audit_log_pkey PRIMARY KEY (seq);
ALTER TABLE public.sop_edit_suggestions ADD CONSTRAINT sop_edit_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.sop_edit_suggestions ADD CONSTRAINT sop_edit_suggestions_pkey PRIMARY KEY (id);
ALTER TABLE public.sop_history ADD CONSTRAINT sop_history_pkey PRIMARY KEY (id);
ALTER TABLE public.sops ADD CONSTRAINT sops_approval_status_check CHECK ((approval_status = ANY (ARRAY['approved'::text, 'pending'::text, 'changes_requested'::text])));
ALTER TABLE public.sops ADD CONSTRAINT sops_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])));
ALTER TABLE public.sops ADD CONSTRAINT sops_pkey PRIMARY KEY (id);
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'viewer'::text])));
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.teams ADD CONSTRAINT teams_pkey PRIMARY KEY (id);

-- ─── Foreign keys ──────────────────────────────────────────────────────────

ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id);
ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.sop_edit_suggestions ADD CONSTRAINT sop_edit_suggestions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sop_edit_suggestions ADD CONSTRAINT sop_edit_suggestions_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;
ALTER TABLE public.sop_edit_suggestions ADD CONSTRAINT sop_edit_suggestions_suggested_by_fkey FOREIGN KEY (suggested_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sop_history ADD CONSTRAINT sop_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
ALTER TABLE public.sop_history ADD CONSTRAINT sop_history_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE CASCADE;
ALTER TABLE public.sops ADD CONSTRAINT sops_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
ALTER TABLE public.sops ADD CONSTRAINT sops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.sops ADD CONSTRAINT sops_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_sop_audit_log_sop ON public.sop_audit_log USING btree (sop_id, seq);
CREATE INDEX idx_sop_edit_suggestions_sop_status ON public.sop_edit_suggestions USING btree (sop_id, status);
CREATE INDEX idx_sop_edit_suggestions_suggested_by ON public.sop_edit_suggestions USING btree (suggested_by);
CREATE INDEX idx_sops_next_review ON public.sops USING btree (next_review_at) WHERE (next_review_at IS NOT NULL);
CREATE INDEX idx_sops_owner_id ON public.sops USING btree (owner_id) WHERE (owner_id IS NOT NULL);
CREATE INDEX idx_sops_review_queue ON public.sops USING btree (owner_id) WHERE ((approval_status <> 'approved'::text) OR (pending_content IS NOT NULL));
CREATE INDEX idx_sops_status ON public.sops USING btree (status);

-- ─── Comments ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.profiles.role IS 'User role: creator can build SOPs, viewer can only read & execute them';
COMMENT ON COLUMN public.sops.last_reviewed_at IS 'Timestamp of the last formal review of this SOP';
COMMENT ON COLUMN public.sops.next_review_at IS 'Auto-computed: last_reviewed_at + review_interval_days. Used for dashboard reminders';
COMMENT ON COLUMN public.sops.owner_id IS 'The user responsible for keeping this SOP up to date';
COMMENT ON COLUMN public.sops.related_sop_ids IS 'Array of SOP IDs that this SOP references or depends on. Phase 1 of dependency tracking.';
COMMENT ON COLUMN public.sops.review_interval_days IS 'How often (in days) this SOP should be reviewed. NULL = no scheduled review';

-- ─── Functions ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT team_id FROM public.profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.set_audit_context(p_action text, p_summary text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
    SELECT set_config('klaro.audit_action', COALESCE(p_action, ''), true),
           set_config('klaro.audit_summary', COALESCE(p_summary, ''), true),
           set_config('klaro.audit_note', COALESCE(p_note, ''), true);
$function$
;

CREATE OR REPLACE FUNCTION public.sop_audit_payload(e public.sop_audit_log)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    SELECT jsonb_build_array(
        e.seq, e.sop_id, e.team_id, e.actor_id, e.action,
        to_char(e.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        e.from_version, e.to_version, e.summary,
        e.before_title, e.after_title, e.before_content, e.after_content, e.note
    )::text
$function$
;

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_email text;
    v_old_team uuid;
    v_alone boolean;
    inv public.team_invites;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Please sign in to accept the invite' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO inv FROM public.team_invites
    WHERE token_hash = encode(digest(btrim(p_token), 'sha256'), 'hex') FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'This invite link is not valid' USING ERRCODE = 'P0002';
    END IF;
    IF inv.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'This invite has been withdrawn' USING ERRCODE = '22023';
    END IF;
    IF inv.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This invite has already been used' USING ERRCODE = '22023';
    END IF;
    IF inv.expires_at < now() THEN
        RAISE EXCEPTION 'This invite has expired; ask for a new one' USING ERRCODE = '22023';
    END IF;

    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
    IF v_email IS DISTINCT FROM lower(inv.email) THEN
        RAISE EXCEPTION 'This invite was sent to %. Sign in with that address to accept it.', inv.email
            USING ERRCODE = '42501';
    END IF;

    SELECT team_id INTO v_old_team FROM public.profiles WHERE id = v_uid;

    IF v_old_team IS DISTINCT FROM inv.team_id THEN
        v_alone := NOT EXISTS (SELECT 1 FROM public.profiles WHERE team_id = v_old_team AND id <> v_uid);

        UPDATE public.profiles SET manager_id = NULL WHERE manager_id = v_uid;
        UPDATE public.profiles SET team_id = inv.team_id, role = inv.role, manager_id = NULL WHERE id = v_uid;

        IF v_alone AND v_old_team IS NOT NULL THEN
            -- Their personal team only held their own work: bring it along.
            PERFORM public.set_audit_context('moved_team', 'Moved to a new team when its author joined it');
            UPDATE public.sops SET team_id = inv.team_id WHERE team_id = v_old_team;
            PERFORM public.set_audit_context(NULL);
            UPDATE public.interview_sessions SET team_id = inv.team_id WHERE team_id = v_old_team;
            DELETE FROM public.team_invites WHERE team_id = v_old_team;
            BEGIN
                DELETE FROM public.teams WHERE id = v_old_team;
            EXCEPTION WHEN foreign_key_violation THEN
                NULL;   -- something else still points at it; leave the empty team
            END;
        END IF;
    END IF;

    UPDATE public.team_invites SET accepted_at = now(), accepted_by = v_uid WHERE id = inv.id;
    RETURN inv.team_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_sop(p_sop uuid)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops := public.sop_for_caller(p_sop);
    v_uid uuid := auth.uid();
    v_author text;
BEGIN
    IF s.owner_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Only the owner of this SOP can approve it' USING ERRCODE = '42501';
    END IF;

    IF s.pending_content IS NOT NULL OR s.pending_title IS NOT NULL THEN
        SELECT COALESCE(NULLIF(full_name, ''), email) INTO v_author FROM public.profiles WHERE id = s.pending_by;
        INSERT INTO public.sop_history (sop_id, version, title, content, tags, change_summary, created_by)
        VALUES (s.id, COALESCE(s.version, 1), s.title, s.content, s.tags, 'Replaced by approved revision', v_uid);

        PERFORM public.set_audit_context('revision_approved',
            'Revision by ' || COALESCE(v_author, 'a team member') || ' approved');

        UPDATE public.sops SET
            title = COALESCE(pending_title, title),
            content = COALESCE(pending_content, content),
            version = COALESCE(version, 1) + 1,
            change_summary = 'Revision by ' || COALESCE(v_author, 'a team member') || ' approved',
            pending_title = NULL, pending_content = NULL, pending_by = NULL, pending_at = NULL,
            review_note = NULL,
            status = 'published',
            approval_status = 'approved',
            approved_by = v_uid,
            approved_at = now(),
            review_interval_days = COALESCE(review_interval_days, 365),
            next_review_at = COALESCE(next_review_at, now() + make_interval(days => COALESCE(review_interval_days, 365))),
            updated_at = now()
        WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
        RETURN s;
    END IF;

    IF s.approval_status = 'approved' AND s.status = 'published' THEN
        RAISE EXCEPTION 'There is nothing waiting for approval on this SOP' USING ERRCODE = '22023';
    END IF;

    PERFORM public.set_audit_context('approved', 'Approved');
    UPDATE public.sops SET
        status = 'published',
        approval_status = 'approved',
        approved_by = v_uid,
        approved_at = now(),
        review_note = NULL,
        review_interval_days = COALESCE(review_interval_days, 365),
        next_review_at = COALESCE(next_review_at, now() + make_interval(days => COALESCE(review_interval_days, 365))),
        updated_at = now()
    WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_sop(p_sop uuid)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops := public.sop_for_caller(p_sop);
    v_uid uuid := auth.uid();
    v_author_manager uuid;
    v_role text;
BEGIN
    IF s.owner_id IS NOT NULL THEN
        RAISE EXCEPTION 'This SOP already has an owner' USING ERRCODE = '22023';
    END IF;
    SELECT manager_id INTO v_author_manager FROM public.profiles WHERE id = s.created_by;
    SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

    IF NOT (
        v_uid = v_author_manager
        OR (v_author_manager IS NULL AND v_uid = s.created_by)
        OR (s.created_by IS NULL AND v_role = 'creator')
    ) THEN
        RAISE EXCEPTION 'Only the author''s manager can claim this SOP' USING ERRCODE = '42501';
    END IF;

    PERFORM public.set_audit_context('claimed', 'Claimed and approved');
    UPDATE public.sops SET
        owner_id = v_uid,
        approval_status = CASE WHEN pending_content IS NULL AND pending_title IS NULL THEN 'approved' ELSE approval_status END,
        approved_by = v_uid,
        approved_at = now(),
        review_note = NULL,
        review_interval_days = COALESCE(review_interval_days, 365),
        next_review_at = COALESCE(next_review_at, now() + make_interval(days => COALESCE(review_interval_days, 365))),
        updated_at = now()
    WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_team_invite(p_email text, p_role text DEFAULT 'creator'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_team uuid := public.current_team_id();
    v_email text := lower(btrim(p_email));
    v_token text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'creator') THEN
        RAISE EXCEPTION 'Only creators can invite people' USING ERRCODE = '42501';
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Please enter a valid email address' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(p_role, 'creator') NOT IN ('creator', 'viewer') THEN
        RAISE EXCEPTION 'Unknown role' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE team_id = v_team AND lower(email) = v_email) THEN
        RAISE EXCEPTION 'That person is already on your team' USING ERRCODE = '22023';
    END IF;

    -- One live invite per address: replace any earlier unused one.
    UPDATE public.team_invites SET revoked_at = now()
    WHERE team_id = v_team AND lower(email) = v_email AND accepted_at IS NULL AND revoked_at IS NULL;

    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.team_invites (team_id, email, role, token_hash, invited_by)
    VALUES (v_team, v_email, COALESCE(p_role, 'creator'), encode(digest(v_token, 'sha256'), 'hex'), v_uid);
    RETURN v_token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_full_name text := new.raw_user_meta_data->>'full_name';
    v_team_id uuid;
BEGIN
    INSERT INTO public.teams (name)
    VALUES (COALESCE(NULLIF(v_full_name, ''), split_part(new.email, '@', 1)) || '''s team')
    RETURNING id INTO v_team_id;

    INSERT INTO public.profiles (id, full_name, team_id, email)
    VALUES (new.id, v_full_name, v_team_id, new.email);

    RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_sop_reviewed(p_sop uuid)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops := public.sop_for_caller(p_sop);
BEGIN
    IF s.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the owner of this SOP can mark it as reviewed' USING ERRCODE = '42501';
    END IF;

    PERFORM public.set_audit_context('review_completed',
        'Reviewed' || COALESCE('; next review in ' || s.review_interval_days || ' days', ''));
    UPDATE public.sops SET
        last_reviewed_at = now(),
        next_review_at = CASE WHEN review_interval_days IS NULL THEN NULL
                              ELSE now() + make_interval(days => review_interval_days) END,
        updated_at = now()
    WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_sop_changes(p_sop uuid, p_note text)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops := public.sop_for_caller(p_sop);
BEGIN
    IF s.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the owner of this SOP can request changes' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(btrim(p_note), '') = '' THEN
        RAISE EXCEPTION 'Please say what needs to change' USING ERRCODE = '22023';
    END IF;

    IF s.pending_content IS NOT NULL OR s.pending_title IS NOT NULL THEN
        PERFORM public.set_audit_context('changes_requested', 'Changes requested on the pending revision', p_note);
        UPDATE public.sops SET review_note = p_note, updated_at = now() WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    ELSIF s.approval_status = 'pending' THEN
        PERFORM public.set_audit_context('changes_requested', 'Changes requested before approval', p_note);
        UPDATE public.sops SET approval_status = 'changes_requested', review_note = p_note, updated_at = now()
        WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    ELSE
        RAISE EXCEPTION 'There is nothing waiting for approval on this SOP' USING ERRCODE = '22023';
    END IF;
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_team_invite(p_invite uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'creator') THEN
        RAISE EXCEPTION 'Only creators can manage invites' USING ERRCODE = '42501';
    END IF;
    UPDATE public.team_invites SET revoked_at = now()
    WHERE id = p_invite AND team_id = public.current_team_id() AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_sop_edit(p_sop uuid, p_title text, p_content text, p_summary text DEFAULT NULL::text, p_restore boolean DEFAULT false)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops := public.sop_for_caller(p_sop);
    v_uid uuid := auth.uid();
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
    IF v_role = 'viewer' THEN
        RAISE EXCEPTION 'Viewers can suggest edits but not change SOPs' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(btrim(p_title), '') = '' THEN
        RAISE EXCEPTION 'A title is required' USING ERRCODE = '22023';
    END IF;

    IF s.status = 'draft' THEN
        UPDATE public.sops SET title = p_title, content = p_content, updated_at = now() WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
        RETURN s;
    END IF;

    IF v_uid = s.owner_id OR s.approval_status <> 'approved' THEN
        -- Owner edits go live; edits to a not-yet-approved SOP replace its unapproved text.
        IF p_title = s.title AND p_content IS NOT DISTINCT FROM s.content THEN
            RETURN s;
        END IF;
        INSERT INTO public.sop_history (sop_id, version, title, content, tags, change_summary, created_by)
        VALUES (s.id, COALESCE(s.version, 1), s.title, s.content, s.tags,
                COALESCE(p_summary, CASE WHEN p_restore THEN 'Restored' ELSE 'Edited' END), v_uid);

        PERFORM public.set_audit_context(
            CASE WHEN p_restore THEN 'restored'
                 WHEN s.approval_status = 'changes_requested' THEN 'resubmitted'
                 ELSE 'edited' END,
            COALESCE(p_summary, CASE WHEN s.approval_status = 'changes_requested' THEN 'Changes made and resubmitted for approval' END));

        UPDATE public.sops SET
            title = p_title,
            content = p_content,
            version = COALESCE(version, 1) + 1,
            change_summary = COALESCE(p_summary, 'Edited'),
            updated_at = now(),
            approval_status = CASE WHEN approval_status = 'changes_requested' THEN 'pending' ELSE approval_status END,
            review_note = CASE WHEN approval_status = 'changes_requested' THEN NULL ELSE review_note END
        WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
        RETURN s;
    END IF;

    -- Approved SOP edited by someone else: keep the live version, store the edit for the owner.
    PERFORM public.set_audit_context(
        CASE WHEN s.pending_content IS NOT NULL THEN 'revision_resubmitted' ELSE 'revision_submitted' END,
        COALESCE(p_summary, 'Revision submitted for approval'));

    UPDATE public.sops SET
        pending_title = p_title,
        pending_content = p_content,
        pending_by = v_uid,
        pending_at = now(),
        review_note = NULL,
        updated_at = now()
    WHERE id = s.id RETURNING * INTO s;
        PERFORM public.set_audit_context(NULL);   -- label applies to this update only
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sop_audit_log_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RAISE EXCEPTION 'The SOP audit trail is append-only' USING ERRCODE = '42501';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sop_for_caller(p_sop uuid)
 RETURNS public.sops
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    s public.sops;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO s FROM public.sops WHERE id = p_sop AND team_id = public.current_team_id() FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOP not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sops_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_action text := NULLIF(current_setting('klaro.audit_action', true), '');
    v_note text := NULLIF(current_setting('klaro.audit_note', true), '');
    v_summary text;
    v_owner_name text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.write_sop_audit(OLD.id, OLD.team_id, OLD.title, 'deleted',
            OLD.version, NULL, 'SOP deleted',
            OLD.title, NULL, OLD.content, NULL, NULL);
        RETURN OLD;
    END IF;

    SELECT COALESCE(NULLIF(full_name, ''), email) INTO v_owner_name FROM public.profiles WHERE id = NEW.owner_id;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'draft' THEN
            v_action := 'created';
            v_summary := 'Created as a draft';
        ELSIF NEW.approval_status = 'approved' THEN
            v_action := 'published';
            v_summary := 'Created and published';
        ELSE
            v_action := 'submitted_for_approval';
            v_summary := 'Created and published; awaiting approval by ' || COALESCE(v_owner_name, 'the owner');
        END IF;
        PERFORM public.write_sop_audit(NEW.id, NEW.team_id, NEW.title, v_action,
            NULL, NEW.version, v_summary, NULL, NEW.title, NULL, NEW.content, NULL);
        RETURN NEW;
    END IF;

    -- UPDATE
    IF v_action IS NULL THEN
        IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
            RETURN NEW;                                   -- autosave
        ELSIF OLD.status = 'draft' AND NEW.status = 'published' THEN
            IF NEW.approval_status = 'approved' THEN
                v_action := 'published';
                v_summary := 'Published';
            ELSE
                v_action := 'submitted_for_approval';
                v_summary := 'Published; awaiting approval by ' || COALESCE(v_owner_name, 'the owner');
            END IF;
        ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
            v_action := 'edited';
            v_summary := COALESCE(NEW.change_summary, 'Edited');
        ELSIF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
            v_action := 'moved_team';
            v_summary := 'Moved to another team';
        ELSIF NEW.review_interval_days IS DISTINCT FROM OLD.review_interval_days THEN
            v_action := 'review_schedule_changed';
            v_summary := 'Review schedule: ' || COALESCE('every ' || NEW.review_interval_days || ' days', 'none');
        ELSIF NEW.tags IS DISTINCT FROM OLD.tags
              OR NEW.related_sop_ids IS DISTINCT FROM OLD.related_sop_ids
              OR NEW.language IS DISTINCT FROM OLD.language THEN
            v_action := 'details_changed';
            v_summary := concat_ws(', ',
                CASE WHEN NEW.tags IS DISTINCT FROM OLD.tags THEN 'tags' END,
                CASE WHEN NEW.related_sop_ids IS DISTINCT FROM OLD.related_sop_ids THEN 'linked SOPs' END,
                CASE WHEN NEW.language IS DISTINCT FROM OLD.language THEN 'language' END) || ' changed';
        ELSE
            RETURN NEW;                                   -- nothing audit-worthy (e.g. updated_at only)
        END IF;
    END IF;

    v_summary := COALESCE(v_summary, NULLIF(current_setting('klaro.audit_summary', true), ''), NEW.change_summary);

    IF v_action IN ('revision_submitted', 'revision_resubmitted') THEN
        -- The live text is unchanged; record the proposed text against the approved version.
        PERFORM public.write_sop_audit(NEW.id, NEW.team_id, NEW.title, v_action,
            OLD.version, OLD.version, v_summary,
            NEW.title, NEW.pending_title, NEW.content, NEW.pending_content, v_note);
    ELSIF v_action IN ('published', 'submitted_for_approval') THEN
        -- Draft edits aren't logged, so record the full text as it went live.
        PERFORM public.write_sop_audit(NEW.id, NEW.team_id, NEW.title, v_action,
            OLD.version, NEW.version, v_summary,
            NULL, NEW.title, NULL, NEW.content, v_note);
    ELSE
        PERFORM public.write_sop_audit(NEW.id, NEW.team_id, NEW.title, v_action,
            OLD.version, NEW.version, v_summary,
            CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN OLD.title END,
            CASE WHEN NEW.title IS DISTINCT FROM OLD.title THEN NEW.title END,
            CASE WHEN NEW.content IS DISTINCT FROM OLD.content THEN OLD.content END,
            CASE WHEN NEW.content IS DISTINCT FROM OLD.content THEN NEW.content END,
            v_note);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sops_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_manager uuid;
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT manager_id INTO v_manager FROM public.profiles WHERE id = v_uid;
        NEW.created_by := v_uid;
        NEW.owner_id := COALESCE(v_manager, v_uid);
        NEW.pending_title := NULL;
        NEW.pending_content := NULL;
        NEW.pending_by := NULL;
        NEW.pending_at := NULL;
        NEW.review_note := NULL;
        NEW.last_reviewed_at := NULL;
        IF NEW.owner_id = v_uid THEN
            NEW.approval_status := 'approved';
            NEW.approved_by := CASE WHEN NEW.status = 'published' THEN v_uid END;
            NEW.approved_at := CASE WHEN NEW.status = 'published' THEN now() END;
            IF NEW.status = 'published' THEN
                NEW.review_interval_days := COALESCE(NEW.review_interval_days, 365);
                NEW.next_review_at := now() + make_interval(days => NEW.review_interval_days);
            ELSE
                NEW.next_review_at := NULL;
            END IF;
        ELSE
            NEW.approval_status := 'pending';
            NEW.approved_by := NULL;
            NEW.approved_at := NULL;
            NEW.next_review_at := NULL;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: workflow fields only change through the RPCs.
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.pending_title IS DISTINCT FROM OLD.pending_title
       OR NEW.pending_content IS DISTINCT FROM OLD.pending_content
       OR NEW.pending_by IS DISTINCT FROM OLD.pending_by
       OR NEW.pending_at IS DISTINCT FROM OLD.pending_at
       OR NEW.review_note IS DISTINCT FROM OLD.review_note
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at
       OR NEW.next_review_at IS DISTINCT FROM OLD.next_review_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
        RAISE EXCEPTION 'This change has to go through the SOP review workflow' USING ERRCODE = '42501';
    END IF;

    IF OLD.status = 'published' AND NEW.status <> 'published' THEN
        RAISE EXCEPTION 'A published SOP cannot be turned back into a draft' USING ERRCODE = '42501';
    END IF;

    IF OLD.status = 'published'
       AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content)
       AND v_uid IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Edits to a published SOP must be submitted for review' USING ERRCODE = '42501';
    END IF;

    IF NEW.review_interval_days IS DISTINCT FROM OLD.review_interval_days THEN
        IF v_uid IS DISTINCT FROM OLD.owner_id THEN
            RAISE EXCEPTION 'Only the SOP owner can change its review schedule' USING ERRCODE = '42501';
        END IF;
        NEW.next_review_at := CASE
            WHEN NEW.review_interval_days IS NULL THEN NULL
            ELSE COALESCE(OLD.last_reviewed_at, OLD.approved_at, now()) + make_interval(days => NEW.review_interval_days)
        END;
    END IF;

    -- Publishing a draft: approved if the owner publishes it, otherwise it waits for the owner.
    IF OLD.status = 'draft' AND NEW.status = 'published' THEN
        IF OLD.owner_id IS NULL THEN
            SELECT manager_id INTO v_manager FROM public.profiles WHERE id = v_uid;
            NEW.owner_id := COALESCE(v_manager, v_uid);
        END IF;
        IF NEW.owner_id = v_uid THEN
            NEW.approval_status := 'approved';
            NEW.approved_by := v_uid;
            NEW.approved_at := now();
            NEW.review_interval_days := COALESCE(NEW.review_interval_days, 365);
            NEW.next_review_at := now() + make_interval(days => NEW.review_interval_days);
        ELSE
            NEW.approval_status := 'pending';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_manager()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.manager_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.manager_id = NEW.id THEN
        RAISE EXCEPTION 'You cannot be your own manager' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.manager_id AND team_id = NEW.team_id) THEN
        RAISE EXCEPTION 'Your manager must be a member of your team' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_sop_audit(p_sop uuid)
 RETURNS TABLE(ok boolean, entries integer, first_bad_seq bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    e public.sop_audit_log;
    v_prev text := NULL;
    v_count integer := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.sop_audit_log l
        WHERE l.sop_id = p_sop
          AND (l.team_id = public.current_team_id()
               OR p_sop IN (SELECT id FROM public.sops WHERE team_id = public.current_team_id()))
    ) THEN
        RETURN QUERY SELECT true, 0, NULL::bigint;
        RETURN;
    END IF;

    FOR e IN SELECT * FROM public.sop_audit_log WHERE sop_id = p_sop ORDER BY seq LOOP
        v_count := v_count + 1;
        IF e.prev_hash IS DISTINCT FROM v_prev
           OR e.entry_hash <> encode(digest(COALESCE(e.prev_hash, '') || public.sop_audit_payload(e), 'sha256'), 'hex') THEN
            RETURN QUERY SELECT false, v_count, e.seq;
            RETURN;
        END IF;
        v_prev := e.entry_hash;
    END LOOP;
    RETURN QUERY SELECT true, v_count, NULL::bigint;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.write_sop_audit(p_sop_id uuid, p_team_id uuid, p_title text, p_action text, p_from_version integer, p_to_version integer, p_summary text, p_before_title text, p_after_title text, p_before_content text, p_after_content text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    e public.sop_audit_log;
    v_uid uuid := auth.uid();
BEGIN
    -- Serialise writers per SOP so the chain can't fork.
    PERFORM pg_advisory_xact_lock(hashtext('sop_audit:' || p_sop_id::text));

    e.seq := nextval('public.sop_audit_log_seq_seq');
    e.sop_id := p_sop_id;
    e.team_id := p_team_id;
    e.sop_title := p_title;
    e.actor_id := v_uid;
    SELECT COALESCE(NULLIF(full_name, ''), email), email INTO e.actor_name, e.actor_email
    FROM public.profiles WHERE id = v_uid;
    e.actor_name := COALESCE(e.actor_name, CASE WHEN v_uid IS NULL THEN 'System' END);
    e.action := p_action;
    e.at := clock_timestamp();
    e.from_version := p_from_version;
    e.to_version := p_to_version;
    e.summary := p_summary;
    e.before_title := p_before_title;
    e.after_title := p_after_title;
    e.before_content := p_before_content;
    e.after_content := p_after_content;
    e.note := p_note;

    SELECT entry_hash INTO e.prev_hash
    FROM public.sop_audit_log WHERE sop_id = p_sop_id ORDER BY seq DESC LIMIT 1;

    e.entry_hash := encode(digest(COALESCE(e.prev_hash, '') || public.sop_audit_payload(e), 'sha256'), 'hex');

    INSERT INTO public.sop_audit_log VALUES (e.*);
END;
$function$
;


-- ─── Function privileges ───────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO service_role;
REVOKE ALL ON FUNCTION public.approve_sop(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_sop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sop(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.claim_sop(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_sop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sop(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.create_team_invite(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_invite(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_invite(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.current_team_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.mark_sop_reviewed(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_sop_reviewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_sop_reviewed(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.request_sop_changes(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_sop_changes(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_sop_changes(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.revoke_team_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.save_sop_edit(uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_sop_edit(uuid,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_sop_edit(uuid,text,text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.set_audit_context(text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_audit_context(text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.sop_audit_log_immutable() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sop_audit_log_immutable() TO service_role;
REVOKE ALL ON FUNCTION public.sop_audit_payload(public.sop_audit_log) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sop_audit_payload(public.sop_audit_log) TO service_role;
REVOKE ALL ON FUNCTION public.sop_for_caller(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sop_for_caller(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.sops_audit() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sops_audit() TO service_role;
REVOKE ALL ON FUNCTION public.sops_guard() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sops_guard() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sops_guard() TO anon;
GRANT EXECUTE ON FUNCTION public.sops_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sops_guard() TO service_role;
REVOKE ALL ON FUNCTION public.validate_manager() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_manager() TO service_role;
REVOKE ALL ON FUNCTION public.verify_sop_audit(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_sop_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sop_audit(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.write_sop_audit(uuid,uuid,text,text,integer,integer,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.write_sop_audit(uuid,uuid,text,text,integer,integer,text,text,text,text,text,text) TO service_role;

-- ─── Row level security ────────────────────────────────────────────────────

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_edit_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ─── Policies (public tables and storage.objects) ──────────────────────────

CREATE POLICY "Users can delete own interview sessions" ON public.interview_sessions AS PERMISSIVE FOR DELETE TO public
    USING ((user_id = auth.uid()));

CREATE POLICY "Users can insert interview sessions" ON public.interview_sessions AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (((user_id = auth.uid()) AND (team_id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

CREATE POLICY "Users can update own interview sessions" ON public.interview_sessions AS PERMISSIVE FOR UPDATE TO public
    USING ((user_id = auth.uid()));

CREATE POLICY "Users can view own interview sessions" ON public.interview_sessions AS PERMISSIVE FOR SELECT TO public
    USING ((user_id = auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
    USING ((auth.uid() = id));

CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
    USING ((auth.uid() = id));

CREATE POLICY "Users can view teammate profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public
    USING (((team_id IS NOT NULL) AND (team_id = public.current_team_id())));

CREATE POLICY "Team members can read the audit trail" ON public.sop_audit_log AS PERMISSIVE FOR SELECT TO authenticated
    USING (((team_id = public.current_team_id()) OR (sop_id IN ( SELECT sops.id
   FROM public.sops
  WHERE (sops.team_id = public.current_team_id())))));

CREATE POLICY "Team creators can update suggestions" ON public.sop_edit_suggestions AS PERMISSIVE FOR UPDATE TO public
    USING (((sop_id IN ( SELECT sops.id
   FROM public.sops
  WHERE (sops.team_id = public.current_team_id()))) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'creator'::text))))));

CREATE POLICY "Team members can create own suggestions" ON public.sop_edit_suggestions AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (((suggested_by = auth.uid()) AND (sop_id IN ( SELECT sops.id
   FROM public.sops
  WHERE (sops.team_id = public.current_team_id())))));

CREATE POLICY "Users can view suggestions for their team's SOPs" ON public.sop_edit_suggestions AS PERMISSIVE FOR SELECT TO public
    USING ((EXISTS ( SELECT 1
   FROM (public.sops s
     JOIN public.profiles p ON ((p.team_id = s.team_id)))
  WHERE ((s.id = sop_edit_suggestions.sop_id) AND (p.id = auth.uid())))));

CREATE POLICY "Users can insert SOP history" ON public.sop_history AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((sop_id IN ( SELECT sops.id
   FROM public.sops
  WHERE (sops.team_id = ( SELECT profiles.team_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));

CREATE POLICY "Users can view team SOP history" ON public.sop_history AS PERMISSIVE FOR SELECT TO public
    USING ((sop_id IN ( SELECT sops.id
   FROM public.sops
  WHERE (sops.team_id = ( SELECT profiles.team_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));

CREATE POLICY "Users can delete team SOPs" ON public.sops AS PERMISSIVE FOR DELETE TO public
    USING ((team_id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can insert team SOPs" ON public.sops AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((team_id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can update team SOPs" ON public.sops AS PERMISSIVE FOR UPDATE TO public
    USING ((team_id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can view team SOPs" ON public.sops AS PERMISSIVE FOR SELECT TO public
    USING ((team_id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Team creators can see their invites" ON public.team_invites AS PERMISSIVE FOR SELECT TO authenticated
    USING (((team_id = public.current_team_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'creator'::text))))));

CREATE POLICY "Users can view their own team" ON public.teams AS PERMISSIVE FOR SELECT TO public
    USING ((id = ( SELECT profiles.team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "Team members can delete SOP images" ON storage.objects;
CREATE POLICY "Team members can delete SOP images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
    USING (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.team_id)::text AS team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS "Team members can replace SOP images" ON storage.objects;
CREATE POLICY "Team members can replace SOP images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
    USING (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.team_id)::text AS team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS "Team members can upload SOP images" ON storage.objects;
CREATE POLICY "Team members can upload SOP images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.team_id)::text AS team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS "Team members can view SOP images" ON storage.objects;
CREATE POLICY "Team members can view SOP images" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
    USING (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.team_id)::text AS team_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));

DROP POLICY IF EXISTS "Users can delete own logos" ON storage.objects;
CREATE POLICY "Users can delete own logos" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
    USING (((bucket_id = 'company-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can replace own logos" ON storage.objects;
CREATE POLICY "Users can replace own logos" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
    USING (((bucket_id = 'company-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can upload own logos" ON storage.objects;
CREATE POLICY "Users can upload own logos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (((bucket_id = 'company-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "Users can view own logos" ON storage.objects;
CREATE POLICY "Users can view own logos" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
    USING (((bucket_id = 'company-logos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


-- ─── Triggers (including signup on auth.users) ─────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_validate_manager BEFORE INSERT OR UPDATE OF manager_id, team_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_manager();

CREATE TRIGGER sop_audit_log_no_truncate BEFORE TRUNCATE ON public.sop_audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.sop_audit_log_immutable();

CREATE TRIGGER sop_audit_log_no_update BEFORE DELETE OR UPDATE ON public.sop_audit_log FOR EACH ROW EXECUTE FUNCTION public.sop_audit_log_immutable();

CREATE TRIGGER sops_audit AFTER INSERT OR DELETE OR UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.sops_audit();

CREATE TRIGGER sops_guard BEFORE INSERT OR UPDATE ON public.sops FOR EACH ROW EXECUTE FUNCTION public.sops_guard();


-- ─── Table and sequence privileges (explicit: Supabase stops auto-granting new public tables on 2026-10-30) ───

REVOKE ALL ON TABLE public.interview_sessions FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interview_sessions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interview_sessions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.interview_sessions TO service_role;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.profiles TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE public.profiles TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO service_role;
GRANT UPDATE (full_name, language_preference, industry, country, agentic_prompt, company_name, company_logo_url, company_website, company_email, company_phone, company_address, manager_id) ON TABLE public.profiles TO authenticated;
REVOKE ALL ON TABLE public.sop_audit_log FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.sop_audit_log TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_audit_log TO service_role;
REVOKE ALL ON SEQUENCE public.sop_audit_log_seq_seq FROM anon, authenticated, service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.sop_audit_log_seq_seq TO service_role;
REVOKE ALL ON TABLE public.sop_edit_suggestions FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_edit_suggestions TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_edit_suggestions TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_edit_suggestions TO service_role;
REVOKE ALL ON TABLE public.sop_history FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_history TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_history TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sop_history TO service_role;
REVOKE ALL ON TABLE public.sops FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sops TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sops TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.sops TO service_role;
REVOKE ALL ON TABLE public.team_invites FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.team_invites TO service_role;
GRANT SELECT (id, team_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at) ON TABLE public.team_invites TO authenticated;
REVOKE ALL ON TABLE public.teams FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.teams TO anon;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.teams TO authenticated;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.teams TO service_role;

-- ─── Storage buckets ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('company-logos', 'company-logos', true, 2097152, '{image/png,image/jpeg,image/webp,image/svg+xml}'::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('sop-images', 'sop-images', false, 5242880, '{image/jpeg,image/png}'::text[]) ON CONFLICT (id) DO NOTHING;
