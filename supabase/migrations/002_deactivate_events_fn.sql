-- Optional: the app deactivates events via a filtered UPDATE (see lib/events-admin.ts).
-- Keep this if you want a DB-only helper or use it from SQL; not required for the API.

CREATE OR REPLACE FUNCTION deactivate_all_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE events SET active = false;
$$;

GRANT EXECUTE ON FUNCTION deactivate_all_events() TO service_role;
