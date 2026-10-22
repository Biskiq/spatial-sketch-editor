-- T2.P02.S01 — model resource storage (creator model imports).
--
-- Beside the image asset registry, never widening it: `assets` keeps admitting
-- only image textures with its mutable `pending -> ready` rows. A creator model
-- is a different lifecycle —
--
--   model_imports / model_import_files  one staging record per import, owned by
--                                      the project and the owner, deleting
--                                      itself (and its bytes) after 24 hours;
--   model_revisions                     one immutable approved revision per
--                                      content-addressed import, retained while
--                                      a stored project version references it.
--
-- The owner-accepted bounds (batch E, E4) are structural here: a source file set
-- of at most 50 MiB per import and a derivative of at most 25 MiB. The server
-- checks structure only; it never produces or transforms the derivative.
--
-- Idempotent like every migration in this tree: CREATE ... IF NOT EXISTS and
-- guarded constraints, so a replayed file is a no-op.

CREATE TABLE IF NOT EXISTS model_imports (
	id uuid PRIMARY KEY,
	project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	recipe_id text NOT NULL CHECK (
		char_length(recipe_id) BETWEEN 1 AND 128 AND recipe_id = btrim(recipe_id)
	),
	recipe_version integer NOT NULL CHECK (recipe_version > 0),
	source_manifest_hash text NOT NULL CHECK (source_manifest_hash ~ '^sha256-[0-9a-f]{64}$'),
	source_bytes bigint NOT NULL CHECK (source_bytes BETWEEN 1 AND 52428800),
	derivative_bytes bigint NOT NULL CHECK (derivative_bytes BETWEEN 1 AND 26214400),
	state text NOT NULL CHECK (state IN ('staging', 'approved', 'cancelled', 'expired')),
	revision_id uuid,
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS model_imports_project_state_idx
	ON model_imports (project_id, state, expires_at);

-- One declared file of the import. A declaration is not an upload: `size` and
-- `sha256` are what the creator promised, and an upload whose stream disagrees
-- with either fails without being adopted.
CREATE TABLE IF NOT EXISTS model_import_files (
	import_id uuid NOT NULL REFERENCES model_imports(id) ON DELETE CASCADE,
	file_id uuid NOT NULL,
	role text NOT NULL CHECK (role IN ('source', 'derivative')),
	path text NOT NULL CHECK (
		char_length(path) BETWEEN 1 AND 256
		AND path ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$'
		AND path NOT LIKE '%..%'
	),
	byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 52428800),
	sha256 text NOT NULL CHECK (sha256 ~ '^sha256-[0-9a-f]{64}$'),
	object_key text UNIQUE,
	upload_state text NOT NULL CHECK (upload_state IN ('declared', 'uploading', 'uploaded', 'failed')),
	uploaded_at timestamptz,
	PRIMARY KEY (import_id, file_id),
	CHECK (
		(upload_state = 'uploaded' AND object_key IS NOT NULL AND uploaded_at IS NOT NULL)
		OR (upload_state = 'uploading' AND object_key IS NOT NULL AND uploaded_at IS NULL)
		OR (upload_state IN ('declared', 'failed') AND object_key IS NULL)
	)
);

CREATE UNIQUE INDEX IF NOT EXISTS model_import_files_declared_path_idx
	ON model_import_files (import_id, path);

-- One approved revision. `content_hash` addresses the whole retained revision —
-- derivative bytes, source manifest, recipe, report and placement — so the same
-- approval is reused and one derivative under a second placement is a distinct
-- revision rather than a silent overwrite. `unique (project_id, content_hash)`
-- is the create-or-reuse key.
CREATE TABLE IF NOT EXISTS model_revisions (
	id uuid PRIMARY KEY,
	project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	content_hash text NOT NULL CHECK (content_hash ~ '^sha256-[0-9a-f]{64}$'),
	derivative_hash text NOT NULL CHECK (derivative_hash ~ '^sha256-[0-9a-f]{64}$'),
	derivative_mime text NOT NULL CHECK (derivative_mime = 'model/gltf-binary'),
	derivative_bytes bigint NOT NULL CHECK (derivative_bytes BETWEEN 1 AND 26214400),
	derivative_key text NOT NULL UNIQUE,
	source_manifest_hash text NOT NULL CHECK (source_manifest_hash ~ '^sha256-[0-9a-f]{64}$'),
	source_bytes bigint NOT NULL CHECK (source_bytes BETWEEN 1 AND 52428800),
	source_file_count integer NOT NULL CHECK (source_file_count > 0),
	recipe_id text NOT NULL CHECK (
		char_length(recipe_id) BETWEEN 1 AND 128 AND recipe_id = btrim(recipe_id)
	),
	recipe_version integer NOT NULL CHECK (recipe_version > 0),
	report_digest text NOT NULL CHECK (report_digest ~ '^sha256-[0-9a-f]{64}$'),
	placement jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (project_id, content_hash)
);

CREATE INDEX IF NOT EXISTS model_revisions_project_derivative_idx
	ON model_revisions (project_id, derivative_hash);

-- Retention (E4): an approved revision lives while a stored project version
-- references it, and project deletion (C3) deletes the project's revisions with
-- it — the ON DELETE CASCADE above is that obligation, inherited by C3. Nothing
-- in this slice deletes an approved revision on its own.
