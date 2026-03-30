-- Migration: Add Row Level Security (RLS) Policies
-- Implements strict multi-tenant data isolation

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_edit_suggestions ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ───────────────────────────────────────────────────────────────
-- Users can only read and update their own profile.
CREATE POLICY "Users can view own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id);

-- ─── TEAMS ──────────────────────────────────────────────────────────────────
-- Users can view the team they belong to.
CREATE POLICY "Users can view their own team" 
    ON teams FOR SELECT 
    USING (id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- ─── SOPS ───────────────────────────────────────────────────────────────────
-- Users can view SOPs belonging to their team.
CREATE POLICY "Users can view team SOPs" 
    ON sops FOR SELECT 
    USING (team_id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Only 'creator' role can insert/update/delete SOPs in their team.
-- Note: 'creator' logic should be enforced via the app, but RLS offers defense in depth.
CREATE POLICY "Users can insert team SOPs" 
    ON sops FOR INSERT 
    WITH CHECK (team_id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update team SOPs" 
    ON sops FOR UPDATE 
    USING (team_id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete team SOPs" 
    ON sops FOR DELETE 
    USING (team_id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- ─── SOP HISTORY ────────────────────────────────────────────────────────────
-- Users can view history for SOPs in their team.
CREATE POLICY "Users can view team SOP history" 
    ON sop_history FOR SELECT 
    USING (
        sop_id IN (
            SELECT id FROM sops WHERE team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert SOP history" 
    ON sop_history FOR INSERT 
    WITH CHECK (
        sop_id IN (
            SELECT id FROM sops WHERE team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        )
    );

-- ─── INTERVIEW SESSIONS ─────────────────────────────────────────────────────
-- Users can view their own interview sessions.
CREATE POLICY "Users can view own interview sessions" 
    ON interview_sessions FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert interview sessions" 
    ON interview_sessions FOR INSERT 
    WITH CHECK (user_id = auth.uid() AND team_id = (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own interview sessions" 
    ON interview_sessions FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own interview sessions" 
    ON interview_sessions FOR DELETE 
    USING (user_id = auth.uid());

-- ─── SOP EDIT SUGGESTIONS ───────────────────────────────────────────────────
-- Viewers can view and insert suggestions for their team's SOPs
CREATE POLICY "Users can view team SOP suggestions" 
    ON sop_edit_suggestions FOR SELECT 
    USING (
        sop_id IN (
            SELECT id FROM sops WHERE team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert SOP suggestions" 
    ON sop_edit_suggestions FOR INSERT 
    WITH CHECK (suggested_by = auth.uid());

CREATE POLICY "Creators can update suggestions" 
    ON sop_edit_suggestions FOR UPDATE 
    USING (
        sop_id IN (
            SELECT id FROM sops WHERE team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        )
    );
