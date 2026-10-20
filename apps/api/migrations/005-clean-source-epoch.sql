-- T3.P01.S04 — clean source epoch (AM-9, R1).
--
-- One forward migration, serialized by the runner's session advisory lock (TD-6).
-- It removes every authored project row and installs a schema that structurally
-- admits only the F.2 `unit-envelope-v1` source. `users` and `schema_migrations`
-- are retained.
--
-- The migration is a no-op on rerun: the fence column is the epoch marker, so the
-- destructive block runs exactly once even if an operator replays the file.
--
-- Fence rationale: an API build that predates this epoch inserts
-- `(project_id, version, document)` without `source_format`. The NOT NULL column
-- makes that write fail structurally, whatever the deployment order. The
-- document check additionally refuses a pre-epoch document shape even if a writer
-- learned the column name.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name = 'project_versions'
			AND column_name = 'source_format'
	) THEN
		-- Authored data is disposable (R1). Dependency order, no TRUNCATE: the
		-- runner already holds the migration transaction open.
		DELETE FROM releases;
		DELETE FROM publications;
		DELETE FROM save_receipts;
		DELETE FROM assets;
		DELETE FROM project_versions;
		DELETE FROM projects;

		ALTER TABLE project_versions
			ADD COLUMN source_format text;
		ALTER TABLE project_versions
			ALTER COLUMN source_format SET NOT NULL;
		ALTER TABLE project_versions
			ADD CONSTRAINT project_versions_source_format_fence
			CHECK (source_format = 'unit-envelope-v1');

		ALTER TABLE project_versions
			ADD CONSTRAINT project_versions_unit_envelope_document
			CHECK (
				jsonb_typeof(document) = 'object'
				AND document ? 'formatVersion'
				AND jsonb_typeof(document -> 'formatVersion') = 'number'
				AND document ->> 'formatVersion' = '1'
				-- Key presence is explicit: a missing key makes `jsonb_typeof` NULL, and a
				-- CHECK constraint accepts NULL. Without these predicates a pre-epoch
				-- document missing `id`/`units` would pass the fence.
				AND document ? 'id'
				AND jsonb_typeof(document -> 'id') = 'string'
				AND document ? 'name'
				AND jsonb_typeof(document -> 'name') = 'string'
				AND document ? 'acceptedRevision'
				AND jsonb_typeof(document -> 'acceptedRevision') = 'object'
				AND document ? 'dependencyLock'
				AND jsonb_typeof(document -> 'dependencyLock') = 'object'
				AND document ? 'units'
				AND jsonb_typeof(document -> 'units') = 'object'
				AND document -> 'units' ? 'layout'
				AND jsonb_typeof(document -> 'units' -> 'layout') = 'object'
				AND document -> 'units' ? 'scene'
				AND jsonb_typeof(document -> 'units' -> 'scene') = 'object'
				AND document -> 'units' ? 'camera'
				AND jsonb_typeof(document -> 'units' -> 'camera') = 'object'
				AND document -> 'units' ? 'experience'
				AND jsonb_typeof(document -> 'units' -> 'experience') = 'object'
				AND document -> 'units' ? 'resources'
				AND jsonb_typeof(document -> 'units' -> 'resources') = 'object'
			);
	END IF;
END $$;
