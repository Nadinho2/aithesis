-- Retire user_roles.
--
-- Global roles (admin, future community_manager) live in Clerk publicMetadata.
-- Relational roles (mentor → mentor_profiles, rep/moderator → scoped tables)
-- ship in Phase 4. The app never used user_roles for production authorization
-- — admin gating has always been Clerk publicMetadata.role === 'admin'. This
-- drops the vestigial table, its helper function, and the enum type.

DROP TABLE IF EXISTS public.user_roles;

DROP FUNCTION IF EXISTS public.has_role(text, text);
DROP FUNCTION IF EXISTS public.has_role(text, public.app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

DROP TYPE IF EXISTS public.app_role;
