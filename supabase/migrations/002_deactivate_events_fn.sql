CREATE OR REPLACE FUNCTION deactivate_all_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE events SET active = false;
$$;

GRANT EXECUTE ON FUNCTION deactivate_all_events() TO service_role;
