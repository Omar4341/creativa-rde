-- Supabase grants function EXECUTE to anon/authenticated by default. Removing
-- PUBLIC alone does not remove those direct grants, so make the RPC backend-only.
REVOKE ALL ON FUNCTION public.register_with_capacity(
  UUID, UUID, public.registration_type, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_with_capacity(
  UUID, UUID, public.registration_type, TEXT, TEXT, TEXT, UUID
) TO service_role;
