-- T5.P01.S04 — the `form` library scope of the typed resource system.
--
-- My Objects is owner-scoped, not project data: an item survives project
-- deletion, and no project, release or visitor route can read it. Each row is
-- one immutable saved revision:
--
--   id               a server-allocated logical identity;
--   content_id       sha256 over the exact canonical payload bytes;
--   canonical_bytes  the strict format-1 `form` payload (source only, never a
--                    generated mesh), bounded at 256 KiB;
--   format_version   the payload format the item was written with. Until beta
--                    an older item stays listed and removable but is never
--                    inserted or migrated.
--
-- The 1,000-item owner bound is enforced by the API in the same transaction as
-- the insert (an owner-scoped advisory lock serializes the count), not by a
-- per-row constraint. Idempotent like every migration in this tree.

CREATE TABLE IF NOT EXISTS form_library_items (
	id uuid PRIMARY KEY,
	owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind text NOT NULL CHECK (kind = 'form'),
	name text NOT NULL CHECK (
		char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)
	),
	format_version integer NOT NULL CHECK (format_version > 0),
	content_id text NOT NULL CHECK (content_id ~ '^sha256-[0-9a-f]{64}$'),
	canonical_bytes bytea NOT NULL CHECK (octet_length(canonical_bytes) BETWEEN 1 AND 262144),
	created_at timestamptz NOT NULL DEFAULT now()
);

-- The list reads one owner's newest-first page; the read/remove routes use the
-- primary key plus the owner predicate, so an item is never visible across
-- owners even by guessing its id.
CREATE INDEX IF NOT EXISTS form_library_items_owner_created_idx
	ON form_library_items (owner_id, created_at DESC, id);
