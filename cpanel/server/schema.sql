CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar TEXT,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  terms_accepted_at INTEGER, terms_version TEXT, adult_confirmed_at INTEGER
);
CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, pet_name TEXT NOT NULL, pet_type TEXT NOT NULL,
  description TEXT NOT NULL, photo TEXT, location_label TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  last_seen_at INTEGER NOT NULL, instructions TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  join_paused INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  closed_at INTEGER, activity_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS searches_closed_retention_idx ON searches(status, closed_at);
CREATE INDEX IF NOT EXISTS searches_active_retention_idx ON searches(status, activity_at);
CREATE TABLE IF NOT EXISTS memberships (
  search_id TEXT NOT NULL REFERENCES searches(id), guest_id TEXT NOT NULL REFERENCES guests(id),
  role TEXT NOT NULL DEFAULT 'helper', status TEXT NOT NULL DEFAULT 'pending', avatar_hidden INTEGER NOT NULL DEFAULT 0,
  lat REAL, lng REAL, accuracy REAL, location_at INTEGER, location_changed_at INTEGER NOT NULL DEFAULT 0,
  location_version INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL,
  PRIMARY KEY (search_id, guest_id)
);
CREATE INDEX IF NOT EXISTS memberships_guest_idx ON memberships(guest_id);
CREATE INDEX IF NOT EXISTS memberships_location_time_idx ON memberships(location_at);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, search_id TEXT NOT NULL REFERENCES searches(id), author_id TEXT NOT NULL REFERENCES guests(id),
  kind TEXT NOT NULL, content TEXT NOT NULL, flagged INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_search_time_idx ON messages(search_id, created_at);
CREATE INDEX IF NOT EXISTS messages_author_idx ON messages(author_id, created_at);
CREATE TABLE IF NOT EXISTS map_reports (
  id TEXT PRIMARY KEY, search_id TEXT NOT NULL REFERENCES searches(id), author_id TEXT NOT NULL REFERENCES guests(id),
  kind TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius REAL NOT NULL, note TEXT NOT NULL,
  occurred_at INTEGER NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_search_time_idx ON map_reports(search_id, created_at);
CREATE INDEX IF NOT EXISTS reports_author_idx ON map_reports(author_id, created_at);
CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY, search_id TEXT NOT NULL REFERENCES searches(id), reporter_id TEXT NOT NULL REFERENCES guests(id),
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS abuse_search_idx ON abuse_reports(search_id, resolved, created_at);
CREATE INDEX IF NOT EXISTS abuse_reporter_idx ON abuse_reports(reporter_id, created_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits(resets_at);
CREATE TABLE IF NOT EXISTS message_dedupes (
  search_id TEXT NOT NULL REFERENCES searches(id), guest_id TEXT NOT NULL REFERENCES guests(id),
  fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(search_id, guest_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS message_dedupe_expiry_idx ON message_dedupes(created_at);
