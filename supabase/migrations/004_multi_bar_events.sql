-- Multi-bar events: invite co-owners by email (notification pipeline TBD)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS invited_owner_emails text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN events.invited_owner_emails IS 'Emails of other bar owners invited to participate in this event route';
