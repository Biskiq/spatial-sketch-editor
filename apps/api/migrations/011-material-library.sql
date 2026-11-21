-- T2.S8 · PR G — the `material` library scope and transfer records.
--
-- The owner-scoped library now admits a second immutable item kind:
--
--   material  an accepted Finish's flattened v1 recipe plus its display name,
--             with pinned private image dependencies and an optional fixed
--             thumbnail derivative.
--
-- A material item's `content_id` covers the canonical payload including the
-- name. Its `recipe_hash` is the portable recipe revision and never includes a
-- display name, a project id, a local texture id or a transport path.
--
-- `material_library_images` is the append-only dependency set of one item. A
-- dependency is exactly one of:
--
--   object   a private copy under this item's own key (source bytes were
--            verified before this row and the metadata committed);
--   shipped  a frozen, allowlisted catalogue URI whose hash is already fixed.
--
-- Its primary key makes one digest have one local source, and the object-key
-- uniqueness means a private copy is owned by exactly one item. The destination
-- project's asset rows never reference these keys.
--
-- `library_receipts` makes Save and Insert retries idempotent: one owner, one
-- operation kind and one caller operation id bind to the canonical request
-- digest and the committed response. A different body is a conflict; a removed
-- item is reported as not found instead of being replayed.
--
-- `library_staging` records one in-progress private key. A success adopts the key
-- into an item or destination asset row and deletes the row; a failure removes
-- both. An abandoned row is collected after 24 hours by the next scoped library
-- or transfer access, and its key is removed only when no committed row owns it.
--
-- Idempotent like every migration in this tree.

ALTER TABLE form_library_items
	DROP CONSTRAINT IF EXISTS form_library_items_kind_check;
ALTER TABLE form_library_items
	ADD CONSTRAINT form_library_items_kind_check
	CHECK (kind IN ('form', 'material'));

ALTER TABLE form_library_items
	ADD COLUMN IF NOT EXISTS recipe_hash text
		CHECK (recipe_hash IS NULL OR recipe_hash ~ '^sha256-[0-9a-f]{64}$');
ALTER TABLE form_library_items
	ADD COLUMN IF NOT EXISTS thumbnail_key text
		CHECK (thumbnail_key IS NULL OR (
			char_length(thumbnail_key) BETWEEN 1 AND 1024
			AND thumbnail_key = btrim(thumbnail_key)
		));
ALTER TABLE form_library_items
	ADD COLUMN IF NOT EXISTS thumbnail_hash text
		CHECK (thumbnail_hash IS NULL OR thumbnail_hash ~ '^sha256-[0-9a-f]{64}$');
ALTER TABLE form_library_items
	ADD COLUMN IF NOT EXISTS thumbnail_recipe_key text
		CHECK (thumbnail_recipe_key IS NULL OR thumbnail_recipe_key ~ '^sha256-[0-9a-f]{64}$');
ALTER TABLE form_library_items
	ADD COLUMN IF NOT EXISTS thumbnail_byte_size bigint
		CHECK (thumbnail_byte_size IS NULL OR thumbnail_byte_size BETWEEN 1 AND 262144);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'form_library_items_material_fields_check'
	) THEN
		ALTER TABLE form_library_items
			ADD CONSTRAINT form_library_items_material_fields_check
			CHECK (
				(kind = 'material' AND recipe_hash IS NOT NULL)
				OR (kind = 'form' AND recipe_hash IS NULL
					AND thumbnail_key IS NULL AND thumbnail_hash IS NULL
					AND thumbnail_recipe_key IS NULL AND thumbnail_byte_size IS NULL)
			);
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'form_library_items_thumbnail_complete_check'
	) THEN
		ALTER TABLE form_library_items
			ADD CONSTRAINT form_library_items_thumbnail_complete_check
			CHECK (
				(thumbnail_key IS NULL AND thumbnail_hash IS NULL
					AND thumbnail_recipe_key IS NULL AND thumbnail_byte_size IS NULL)
				OR (thumbnail_key IS NOT NULL AND thumbnail_hash IS NOT NULL
					AND thumbnail_recipe_key IS NOT NULL AND thumbnail_byte_size IS NOT NULL)
			);
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS form_library_items_thumbnail_key_idx
	ON form_library_items (thumbnail_key)
	WHERE thumbnail_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS material_library_images (
	item_id uuid NOT NULL REFERENCES form_library_items(id) ON DELETE CASCADE,
	hash text NOT NULL CHECK (hash ~ '^sha256-[0-9a-f]{64}$'),
	mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
	byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 26214400),
	source_kind text NOT NULL CHECK (source_kind IN ('object', 'shipped')),
	object_key text,
	source_uri text,
	PRIMARY KEY (item_id, hash),
	CHECK (
		(source_kind = 'object' AND object_key IS NOT NULL AND source_uri IS NULL)
		OR (source_kind = 'shipped' AND object_key IS NULL AND source_uri IS NOT NULL)
	)
);

CREATE UNIQUE INDEX IF NOT EXISTS material_library_images_object_key_idx
	ON material_library_images (object_key)
	WHERE object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS material_library_images_item_idx
	ON material_library_images (item_id, hash);

CREATE TABLE IF NOT EXISTS library_receipts (
	owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	operation_kind text NOT NULL CHECK (operation_kind IN ('material-save', 'material-transfer')),
	operation_id text NOT NULL CHECK (char_length(operation_id) BETWEEN 1 AND 128),
	request_digest text NOT NULL CHECK (request_digest ~ '^sha256-[0-9a-f]{64}$'),
	destination_saved_base text,
	response jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (owner_id, operation_kind, operation_id)
);

CREATE TABLE IF NOT EXISTS library_staging (
	id uuid PRIMARY KEY,
	owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	object_key text NOT NULL UNIQUE CHECK (
		char_length(object_key) BETWEEN 1 AND 1024
		AND object_key = btrim(object_key)
	),
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS library_staging_owner_expiry_idx
	ON library_staging (owner_id, expires_at);
