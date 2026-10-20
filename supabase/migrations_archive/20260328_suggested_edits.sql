-- Migration: Add Suggested Edits table for Viewers
-- Implements Phase 2 feature: Free Viewers can suggest edits to SOPs which Creators can approve.

CREATE TABLE IF NOT EXISTS public.sop_edit_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sop_id UUID NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
    suggested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    suggested_title TEXT NOT NULL,
    suggested_content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.sop_edit_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view suggestions for their team's SOPs"
    ON public.sop_edit_suggestions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sops s
            JOIN public.profiles p ON p.team_id = s.team_id
            WHERE s.id = sop_edit_suggestions.sop_id
            AND p.id = auth.uid()
        )
    );

CREATE POLICY "Any team member can create a suggestion"
    ON public.sop_edit_suggestions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sops s
            JOIN public.profiles p ON p.team_id = s.team_id
            WHERE s.id = sop_edit_suggestions.sop_id
            AND p.id = auth.uid()
        )
    );

CREATE POLICY "Only creators can update suggestions"
    ON public.sop_edit_suggestions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'creator'
        )
    );

-- Indexes for performance
CREATE INDEX idx_sop_edit_suggestions_sop_status ON public.sop_edit_suggestions(sop_id, status);
CREATE INDEX idx_sop_edit_suggestions_suggested_by ON public.sop_edit_suggestions(suggested_by);
