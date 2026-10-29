-- Events: admins manage the list and pick a default; each user has a current event
-- (NULL = follow the default) that gets stamped on every contact they capture.

CREATE TABLE events (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE app_settings (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  default_event_id TEXT
);
INSERT INTO app_settings (id, default_event_id) VALUES (1, NULL);

ALTER TABLE users ADD COLUMN event_id TEXT;
ALTER TABLE contacts ADD COLUMN event_id TEXT;
CREATE INDEX idx_contacts_event ON contacts(event_id);
