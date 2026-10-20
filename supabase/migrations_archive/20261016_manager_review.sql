-- Manager-owned SOPs, approval workflow, append-only audit trail and team invites.
--
-- Rules:
--   * A new SOP is owned by the author's manager (profiles.manager_id), or by the author if they have none.
--   * Only the owner approves. Unapproved SOPs stay visible (approval_status shows the warning in the UI).
--   * Edits to an approved, published SOP by anyone but its owner become a pending revision; the live
--     content stays the last approved version until the owner approves.
--   * Every change after creation is written to sop_audit_log, which clients can read but never write.
--
-- Client requests run as the `authenticated` role. The SECURITY DEFINER functions below run as their
-- owner, so the guard trigger (SECURITY INVOKER) tells them apart with `current_user`.

-- ─── 1. PROFILES: manager + email ────────────────────────────────────────────

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles p SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

-- 20261005_tighten_rls_and_logo_storage.sql replaced blanket UPDATE with a column list; extend it.
GRANT UPDATE (manager_id) ON public.profiles TO authenticated;

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

    INSERT INTO public.profiles (id, full_name, team_id, email)
    VALUES (new.id, v_full_name, v_team_id, new.email);

    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS profiles_validate_manager ON public.profiles;
CREATE TRIGGER profiles_validate_manager
    BEFORE INSERT OR UPDATE OF manager_id, team_id ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.validate_manager();

-- ─── 2. SOPS: approval + pending revision ────────────────────────────────────

ALTER TABLE public.sops
    ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending', 'changes_requested')),
    ADD COLUMN IF NOT EXISTS pending_title text,
    ADD COLUMN IF NOT EXISTS pending_content text,
    -- pending_by / approved_by are deliberately not foreign keys: a second sops→profiles link would make
    -- the existing `profiles(full_name)` embeds ambiguous and break clients still running older code.
    ADD COLUMN IF NOT EXISTS pending_by uuid,
    ADD COLUMN IF NOT EXISTS pending_at timestamptz,
    ADD COLUMN IF NOT EXISTS review_note text,
    ADD COLUMN IF NOT EXISTS approved_by uuid,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Nobody has signed off an unowned SOP.
UPDATE public.sops SET approval_status = 'pending' WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sops_review_queue
    ON public.sops (owner_id)
    WHERE approval_status <> 'approved' OR pending_content IS NOT NULL;

-- ─── 3. AUDIT LOG (append-only, hash-chained per SOP) ────────────────────────

CREATE TABLE IF NOT EXISTS public.sop_audit_log (
    seq             bigserial PRIMARY KEY,
    sop_id          uuid NOT NULL,          -- no FK: entries must outlive a deleted SOP
    team_id         uuid NOT NULL,          -- team at the time of the event
    sop_title       text,
    actor_id        uuid,
    actor_name      text,
    actor_email     text,
    action          text NOT NULL,
    at              timestamptz NOT NULL DEFAULT now(),
    from_version    integer,
    to_version      integer,
    summary         text,
    before_title    text,
    after_title     text,
    before_content  text,
    after_content   text,
    note            text,
    prev_hash       text,
    entry_hash      text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sop_audit_log_sop ON public.sop_audit_log (sop_id, seq);

ALTER TABLE public.sop_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sop_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sop_audit_log TO authenticated;
REVOKE ALL ON SEQUENCE public.sop_audit_log_seq_seq FROM PUBLIC, anon, authenticated;

-- Visible for SOPs the team has now (they may have moved team), and for its deleted SOPs.
CREATE POLICY "Team members can read the audit trail"
    ON public.sop_audit_log FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        OR sop_id IN (SELECT id FROM public.sops WHERE team_id = public.current_team_id())
    );

CREATE OR REPLACE FUNCTION public.sop_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'The SOP audit trail is append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS sop_audit_log_no_update ON public.sop_audit_log;
CREATE TRIGGER sop_audit_log_no_update
    BEFORE UPDATE OR DELETE ON public.sop_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.sop_audit_log_immutable();

DROP TRIGGER IF EXISTS sop_audit_log_no_truncate ON public.sop_audit_log;
CREATE TRIGGER sop_audit_log_no_truncate
    BEFORE TRUNCATE ON public.sop_audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION public.sop_audit_log_immutable();

-- Canonical text of an entry, hashed together with the previous entry's hash.
CREATE OR REPLACE FUNCTION public.sop_audit_payload(e public.sop_audit_log)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT jsonb_build_array(
        e.seq, e.sop_id, e.team_id, e.actor_id, e.action,
        to_char(e.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        e.from_version, e.to_version, e.summary,
        e.before_title, e.after_title, e.before_content, e.after_content, e.note
    )::text
$$;

-- Internal: only called from the triggers and RPCs below (not granted to clients).
CREATE OR REPLACE FUNCTION public.write_sop_audit(
    p_sop_id uuid, p_team_id uuid, p_title text, p_action text,
    p_from_version integer, p_to_version integer, p_summary text,
    p_before_title text, p_after_title text, p_before_content text, p_after_content text,
    p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.write_sop_audit(uuid, uuid, text, text, integer, integer, text, text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_sop_audit(p_sop uuid)
RETURNS TABLE (ok boolean, entries integer, first_bad_seq bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.verify_sop_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_sop_audit(uuid) TO authenticated;

-- ─── 4. GUARD: direct client writes to sops ──────────────────────────────────
-- SECURITY INVOKER on purpose: current_user is `authenticated` for client requests and the
-- function owner inside the RPCs, which are trusted to apply the rules themselves.

CREATE OR REPLACE FUNCTION public.sops_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS sops_guard ON public.sops;
CREATE TRIGGER sops_guard
    BEFORE INSERT OR UPDATE ON public.sops
    FOR EACH ROW EXECUTE FUNCTION public.sops_guard();

-- ─── 5. AUDIT TRIGGER ────────────────────────────────────────────────────────
-- RPCs name the action via the transaction-local setting klaro.audit_action (clients cannot set it);
-- otherwise the action is derived from what changed. Draft autosaves are not logged.

CREATE OR REPLACE FUNCTION public.sops_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS sops_audit ON public.sops;
CREATE TRIGGER sops_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.sops
    FOR EACH ROW EXECUTE FUNCTION public.sops_audit();

-- ─── 6. WORKFLOW RPCs ────────────────────────────────────────────────────────

-- Loads a SOP for the caller (same team), locked for update.
CREATE OR REPLACE FUNCTION public.sop_for_caller(p_sop uuid)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.sop_for_caller(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_audit_context(p_action text, p_summary text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
    SELECT set_config('klaro.audit_action', COALESCE(p_action, ''), true),
           set_config('klaro.audit_summary', COALESCE(p_summary, ''), true),
           set_config('klaro.audit_note', COALESCE(p_note, ''), true);
$$;

REVOKE EXECUTE ON FUNCTION public.set_audit_context(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_sop_edit(
    p_sop uuid, p_title text, p_content text, p_summary text DEFAULT NULL, p_restore boolean DEFAULT false
)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.approve_sop(p_sop uuid)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.request_sop_changes(p_sop uuid, p_note text)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.claim_sop(p_sop uuid)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.mark_sop_reviewed(p_sop uuid)
RETURNS public.sops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Each RPC names its action for its own UPDATE and clears it straight after, so the label can't leak
-- onto a later change in the same transaction.

-- ─── 7. TEAM INVITES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_invites (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    email        text NOT NULL,
    role         text NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'viewer')),
    token_hash   text NOT NULL UNIQUE,
    invited_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL DEFAULT now() + interval '14 days',
    accepted_at  timestamptz,
    accepted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    revoked_at   timestamptz
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, team_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at)
    ON public.team_invites TO authenticated;

CREATE POLICY "Team creators can see their invites"
    ON public.team_invites FOR SELECT TO authenticated
    USING (
        team_id = public.current_team_id()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'creator')
    );

CREATE OR REPLACE FUNCTION public.create_team_invite(p_email text, p_role text DEFAULT 'creator')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.revoke_team_invite(p_invite uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'creator') THEN
        RAISE EXCEPTION 'Only creators can manage invites' USING ERRCODE = '42501';
    END IF;
    UPDATE public.team_invites SET revoked_at = now()
    WHERE id = p_invite AND team_id = public.current_team_id() AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
$$;

-- ─── 8. GRANTS ───────────────────────────────────────────────────────────────

DO $$
DECLARE
    f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.save_sop_edit(uuid, text, text, text, boolean)',
        'public.approve_sop(uuid)',
        'public.request_sop_changes(uuid, text)',
        'public.claim_sop(uuid)',
        'public.mark_sop_reviewed(uuid)',
        'public.create_team_invite(text, text)',
        'public.revoke_team_invite(uuid)',
        'public.accept_team_invite(text)'
    ] LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    END LOOP;
END;
$$;

-- Internal trigger/helper functions are not callable by clients.
REVOKE EXECUTE ON FUNCTION public.sops_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sop_audit_payload(public.sop_audit_log) FROM PUBLIC, anon, authenticated;

-- ─── 9. BASELINE: start the trail for existing SOPs ──────────────────────────

DO $$
DECLARE
    s record;
BEGIN
    FOR s IN SELECT * FROM public.sops ORDER BY created_at LOOP
        IF NOT EXISTS (SELECT 1 FROM public.sop_audit_log WHERE sop_id = s.id) THEN
            PERFORM public.write_sop_audit(s.id, s.team_id, s.title, 'audit_started',
                NULL, s.version,
                'Audit trail started (existing SOP, ' || s.status || ', ' ||
                    CASE WHEN s.approval_status = 'approved' THEN 'approved' ELSE 'not yet approved' END || ')',
                NULL, s.title, NULL, s.content, NULL);
        END IF;
    END LOOP;
END;
$$;
