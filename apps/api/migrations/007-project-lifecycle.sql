-- T3.P04.S01 — durable project deletion fences and complete approved-source inventory.
--
-- The deletion and lease tables intentionally have no FK to projects: they are
-- the durable deny/retry records that survive the project-row cascade.

ALTER TABLE model_revisions
	ADD COLUMN IF NOT EXISTS source_keys jsonb;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conrelid = 'model_revisions'::regclass
			AND conname = 'model_revisions_source_keys_array'
	) THEN
		ALTER TABLE model_revisions
			ADD CONSTRAINT model_revisions_source_keys_array
			CHECK (source_keys IS NULL OR jsonb_typeof(source_keys) = 'array');
	END IF;
END $$;

-- Source-copy names are deterministic beside derivative_key. Retained approved
-- imports preserve every source path; an older revision with no retained source
-- rows stays NULL and is explicitly covered by the project-prefix sweep.
UPDATE model_revisions AS r
SET source_keys = (
	SELECT jsonb_agg(
		to_jsonb(
			left(r.derivative_key, char_length(r.derivative_key) - char_length('derivative.glb'))
			|| 'source/' || f.path
		)
		ORDER BY f.path
	)
	FROM (
		SELECT i.id
		FROM model_imports AS i
		WHERE i.revision_id = r.id AND i.state = 'approved'
		ORDER BY i.created_at ASC, i.id ASC
		LIMIT 1
	) AS retained
	JOIN model_import_files AS f
		ON f.import_id = retained.id AND f.role = 'source'
	HAVING count(*) = r.source_file_count
)
WHERE r.source_keys IS NULL
	AND right(r.derivative_key, char_length('derivative.glb')) = 'derivative.glb'
	AND EXISTS (
		SELECT 1
		FROM model_imports AS i
		JOIN model_import_files AS f ON f.import_id = i.id AND f.role = 'source'
		WHERE i.revision_id = r.id AND i.state = 'approved'
		GROUP BY i.id
		HAVING count(*) = r.source_file_count
	);

CREATE TABLE IF NOT EXISTS project_deletions (
	project_id text PRIMARY KEY,
	owner_id text NOT NULL,
	namespace text NOT NULL CHECK (namespace ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
	saved_base_token text NOT NULL CHECK (
		saved_base_token ~ '^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
	),
	status text NOT NULL CHECK (status IN ('pending', 'complete')),
	key_inventory jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(key_inventory) = 'array'),
	sweep_dependent boolean NOT NULL DEFAULT false,
	fenced_at timestamptz NOT NULL,
	handler_timeout_ms integer NOT NULL CHECK (handler_timeout_ms > 0),
	lease_deadline_ms integer NOT NULL CHECK (lease_deadline_ms > 0 AND lease_deadline_ms < handler_timeout_ms),
	renewal_interval_ms integer NOT NULL CHECK (renewal_interval_ms > 0),
	abort_margin_ms integer NOT NULL CHECK (abort_margin_ms > 0),
	cleanup_bound_ms integer NOT NULL CHECK (
		cleanup_bound_ms >= handler_timeout_ms + renewal_interval_ms + abort_margin_ms
	),
	first_empty_at timestamptz,
	last_attempt_at timestamptz,
	attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
	last_error text,
	created_at timestamptz NOT NULL DEFAULT now(),
	completed_at timestamptz,
	CHECK (
		(status = 'pending' AND completed_at IS NULL)
		OR (status = 'complete' AND completed_at IS NOT NULL)
	)
);

CREATE INDEX IF NOT EXISTS project_deletions_pending_idx
	ON project_deletions (fenced_at, project_id)
	WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS project_write_leases (
	id uuid PRIMARY KEY,
	project_id text NOT NULL,
	owner_id text NOT NULL,
	started_at timestamptz NOT NULL,
	heartbeat_at timestamptz NOT NULL,
	deadline_at timestamptz NOT NULL,
	revoked_at timestamptz,
	released_at timestamptz,
	CHECK (deadline_at > started_at),
	CHECK (heartbeat_at >= started_at)
);

CREATE INDEX IF NOT EXISTS project_write_leases_live_idx
	ON project_write_leases (project_id, deadline_at)
	WHERE released_at IS NULL;
