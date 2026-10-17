-- T3.P01.S02 — conditional Save (SaveAcceptedSource@1).
--
-- The saved base is durable metadata beside the strict authored document, never
-- inside it. It is distinct from the local AcceptedRevision, the SQL
-- `latest_version` ordinal (publication status keeps reading that unchanged) and
-- the publication OCC revision.
--
-- Existing rows receive a token; their revision/digest stay absent because no
-- capture recorded them. The token alone is then the precondition, which is why
-- it is backfilled before the NOT NULL contract.
ALTER TABLE projects
	ADD COLUMN IF NOT EXISTS saved_base_token text,
	ADD COLUMN IF NOT EXISTS saved_revision jsonb,
	ADD COLUMN IF NOT EXISTS saved_source_content_id text,
	ADD COLUMN IF NOT EXISTS saved_full_source_hash text;

UPDATE projects
SET saved_base_token = 'saved-base:' || gen_random_uuid()::text
WHERE saved_base_token IS NULL;

ALTER TABLE projects
	ALTER COLUMN saved_base_token SET DEFAULT ('saved-base:' || gen_random_uuid()::text),
	ALTER COLUMN saved_base_token SET NOT NULL;

ALTER TABLE projects
	ADD CONSTRAINT projects_saved_base_token_format
	CHECK (saved_base_token ~ '^saved-base:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- One receipt per (project, Save operation ID). It binds the operation to the
-- full canonical bytes (cursor included) and the precondition, so an identical
-- retry replays the receipt and a changed payload under the same ID refuses.
-- Receipts are never part of the authored document.
CREATE TABLE IF NOT EXISTS save_receipts (
	project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	operation_id text NOT NULL,
	precondition_kind text NOT NULL CHECK (precondition_kind IN ('create-only', 'expected-saved-base')),
	precondition_token text,
	accepted_revision jsonb NOT NULL,
	source_content_id text NOT NULL,
	full_source_hash text NOT NULL,
	version integer NOT NULL CHECK (version > 0),
	saved_base_token text NOT NULL,
	saved_name text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (project_id, operation_id),
	CHECK (
		(precondition_kind = 'create-only' AND precondition_token IS NULL)
		OR (precondition_kind = 'expected-saved-base' AND precondition_token IS NOT NULL)
	)
);
