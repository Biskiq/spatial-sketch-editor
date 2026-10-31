-- Add credentials without rewriting users or any owner foreign key. Existing
-- sessions may enroll against their exact legacy id. Signed-out recovery is a
-- separate owner decision; registration never claims an existing identity.
CREATE TABLE IF NOT EXISTS local_credentials (
 user_id text PRIMARY KEY REFERENCES users(id),
 username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_.-]{3,32}$'),
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_attempts (
 key text PRIMARY KEY,
 attempts integer NOT NULL CHECK (attempts > 0),
 window_start timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_window_idx ON auth_attempts(window_start);
