-- T2.S8 · PR C — exact-byte project image repair.
--
-- A repair is not a new asset and not a source revision. It restores the
-- physical object behind an existing ready P20 row to the bytes that the saved
-- head already pins. The attempt row exists so a crashed or abandoned upload
-- leaves a bounded, discoverable staging key for later collection:
--
--   image_repair_attempts  one owner/project/asset attempt with the exact
--                          staging key it will stream to and a 24-hour expiry.
--
-- Storage pushes a fresh private key under the asset's own prefix before any
-- byte is written. Success swaps the ready row's `object_key` and deletes this
-- row; a failure deletes the staged key and the row. The next scoped asset
-- access collects an expired attempt whose key no asset row references, using
-- the same model-staging pattern. `ON DELETE CASCADE` keeps project deletion
-- authoritative over the attempt inventory.
--
-- Idempotent like every migration in this tree.

CREATE TABLE IF NOT EXISTS image_repair_attempts (
	id uuid PRIMARY KEY,
	project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	asset_id uuid NOT NULL,
	expected_pin text NOT NULL CHECK (expected_pin ~ '^sha256-[0-9a-f]{64}$'),
	saved_base_token text NOT NULL CHECK (saved_base_token LIKE 'saved-base:%'),
	staging_key text NOT NULL UNIQUE CHECK (
		char_length(staging_key) BETWEEN 1 AND 1024
		AND staging_key = btrim(staging_key)
	),
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS image_repair_attempts_project_expiry_idx
	ON image_repair_attempts (project_id, owner_id, expires_at);
