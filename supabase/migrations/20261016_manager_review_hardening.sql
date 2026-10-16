-- Security-advisor follow-ups for 20261016_manager_review.sql.
-- Trigger functions run when their trigger fires regardless of EXECUTE grants, so nobody needs to call
-- them through /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_manager() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sop_audit_log_immutable() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.sop_audit_log_immutable() SET search_path = public;
