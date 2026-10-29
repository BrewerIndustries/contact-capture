-- Contact Capture schema (D1 / SQLite)

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                   -- NULL until the invite is accepted
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  display_name  TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,          -- HMAC-SHA256(token, SESSION_SECRET)
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- One-time links: account invites and password resets. Only the HMAC of the
-- token is stored, so a leaked row can't be turned back into a working link.
CREATE TABLE tokens (
  id         TEXT PRIMARY KEY,          -- HMAC-SHA256(token, SESSION_SECRET)
  kind       TEXT NOT NULL CHECK (kind IN ('invite','reset')),
  user_id    TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX idx_tokens_user ON tokens(user_id);

-- Failed logins / reset requests, for per-IP and per-email lockout.
CREATE TABLE login_failures (
  key TEXT NOT NULL,                    -- 'ip:<addr>' or 'email:<addr>'
  at  INTEGER NOT NULL
);
CREATE INDEX idx_login_failures ON login_failures(key, at);

-- The capture form. Retired fields keep active = 0 so old data still reports.
CREATE TABLE fields (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('text','email','phone','textarea','select','checkbox','date','number')),
  required   INTEGER NOT NULL DEFAULT 0,
  options    TEXT,                      -- JSON string[] for 'select'
  position   INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- One row per captured contact; values are JSON keyed by field id.
CREATE TABLE contacts (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  email      TEXT,                      -- lowercased copy of the first email field, for duplicate checks
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_by TEXT,
  updated_at INTEGER,
  deleted_at INTEGER,
  deleted_by TEXT
);
CREATE INDEX idx_contacts_created ON contacts(created_at DESC);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Base fields.
INSERT INTO fields (id, label, type, required, options, position, active, created_at) VALUES
  ('name',         'Name',         'text',  1, NULL, 1, 1, 0),
  ('email',        'Email',        'email', 1, NULL, 2, 1, 0),
  ('role',         'Role',         'text',  0, NULL, 3, 1, 0),
  ('organization', 'Organization', 'text',  0, NULL, 4, 1, 0);
