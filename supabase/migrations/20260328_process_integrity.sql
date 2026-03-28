-- Migration: Add Process Integrity fields
-- Implements the three P0 gaps from the Strategic Alignment Report:
--   1. Creator/Viewer roles on profiles
--   2. Owner/Reminder logic on sops
--   3. Dependency linking (Phase 1) on sops

-- ─── 1. CREATOR / VIEWER ROLES ─────────────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'creator'
    CHECK (role IN ('creator', 'viewer'));

COMMENT ON COLUMN profiles.role IS 
  'User role: creator can build SOPs, viewer can only read & execute them';

-- ─── 2. OWNER / REMINDER LOGIC ──────────────────────────────────────────────
ALTER TABLE sops
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS review_interval_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE 
        WHEN last_reviewed_at IS NOT NULL AND review_interval_days IS NOT NULL
        THEN last_reviewed_at + (review_interval_days || ' days')::INTERVAL
        ELSE NULL
    END
) STORED;

COMMENT ON COLUMN sops.owner_id IS 
  'The user responsible for keeping this SOP up to date';
COMMENT ON COLUMN sops.review_interval_days IS 
  'How often (in days) this SOP should be reviewed. NULL = no scheduled review';
COMMENT ON COLUMN sops.last_reviewed_at IS 
  'Timestamp of the last formal review of this SOP';
COMMENT ON COLUMN sops.next_review_at IS 
  'Auto-computed: last_reviewed_at + review_interval_days. Used for dashboard reminders';

-- Index for efficiently querying overdue SOPs
CREATE INDEX IF NOT EXISTS idx_sops_next_review 
  ON sops(next_review_at) 
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sops_owner_id 
  ON sops(owner_id) 
  WHERE owner_id IS NOT NULL;

-- ─── 3. DEPENDENCY LINKING (Phase 1 — simple related SOPs) ──────────────────
ALTER TABLE sops
ADD COLUMN IF NOT EXISTS related_sop_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN sops.related_sop_ids IS 
  'Array of SOP IDs that this SOP references or depends on. Phase 1 of dependency tracking.';

-- ─── 4. BACKFILL: Set all existing SOPs owner to the created_by user ─────────
UPDATE sops 
SET owner_id = created_by::UUID
WHERE owner_id IS NULL AND created_by IS NOT NULL;
