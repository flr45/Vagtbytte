CREATE TABLE operational_favorite (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('vehicle', 'place', 'item')),
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT operational_favorite_user_target_unique UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX operational_favorite_user_created_idx
  ON operational_favorite (user_id, created_at DESC);

CREATE TABLE operational_recent (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('vehicle', 'place', 'item')),
  target_id TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT operational_recent_user_target_unique UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX operational_recent_user_viewed_idx
  ON operational_recent (user_id, last_viewed_at DESC);
