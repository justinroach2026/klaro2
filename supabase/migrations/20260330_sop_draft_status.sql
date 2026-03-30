-- Add draft/published status to SOPs
-- When a user starts a SOP from a template, it's created as 'draft'
-- until they explicitly publish it.

ALTER TABLE sops
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published'));

-- Index for fast dashboard queries (fetch all drafts for a team)
CREATE INDEX IF NOT EXISTS idx_sops_status ON sops(status);

COMMENT ON COLUMN sops.status IS
  'draft = created from template, still being edited by creator; published = finalised and visible to all team members';
