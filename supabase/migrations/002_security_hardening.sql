-- Security hardening for the shared Supabase schema.
-- RLS policies may still call the helper functions internally.

alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.can_access_module(text) set search_path = public;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_access_module(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_module(text) to authenticated;
