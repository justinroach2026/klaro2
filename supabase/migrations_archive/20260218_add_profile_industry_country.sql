-- Migration: Add industry, country, and agentic_prompt to profiles
-- Supports the Regional & Industry features and custom AI instructions

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS agentic_prompt TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN profiles.industry IS 'Industry code (e.g. tech, real_estate, healthcare) for AI context';
COMMENT ON COLUMN profiles.country IS 'ISO country code (e.g. gb, us, fr) for regional regulatory research';
COMMENT ON COLUMN profiles.agentic_prompt IS 'Optional custom system prompt that overrides the default AI interviewer behaviour';
