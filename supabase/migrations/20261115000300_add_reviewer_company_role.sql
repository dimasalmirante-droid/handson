-- Add Reviewer as a distinct employer role.
--
-- This migration is intentionally separate from the team-management
-- migration: PostgreSQL requires a newly added enum value to be committed
-- before another migration can use it in statements or function bodies.

alter type public.company_role add value if not exists 'reviewer' after 'viewer';
