# AM-7 inventory — plan, procedure and results

**Slice:** T3.P01.S04 · **Status:** draft preflight — **not executed, not evidence, not accepted**
**Owner of execution:** T3 (the coordinator runs it read-only; the owner reviews the result)
**Related:** [implementation plan](../implementation-plan.md#authorization-path) item 1 ·
[publication disposition](./publication-disposition.md) · [quiescence and recovery](./quiescence-recovery.md)

This file defines the inventory **procedure**. It contains no measured production value: every
result cell below is `not measured — requires read-only production access`. It is not evidence
until the coordinator executes it against the deployed environment and the owner reviews the
recorded output.

## Why this runs before activation

The [phase cutover mechanics](../../README.md#cutover-mechanics-and-retirement) and the S04 plan require
an inventory of **actual** saved projects, versions, publications and retained bytes before
authorization. Owner evidence says there are no releases; that does not prove there are no saved
projects. A clean local Compose database proves only that the local stack is clean. It must never be
used as, or copied into, an inventory result.

## Provenance contract

A result is valid only when all of the following are recorded with it:

| Field | Required record |
| --- | --- |
| Environment | Named target (e.g. `production`), host/region, database name, object-store bucket, and the deployed revision/commit serving that environment |
| Access mode | Read-only session; a `BEGIN … READ ONLY` transaction or `psql --single-transaction` with `default_transaction_read_only=on` |
| Actor | Who ran it (name/handle), the exact command, and a UTC start/finish timestamp |
| Artifact | The saved raw output file and its SHA-256; output contains counts and format classifications only — no project names, owners, project/publication identifiers or document bodies |
| Non-inference | A signed statement in the record that no number was inferred, scaled or copied from any local stack |

Rules:

- The executable guard refuses an unapproved database name, a loopback/private server address, an
  unresolved socket and any session that is not read-only. A name check alone is not sufficient: the
  Compose database is also named `biskiq`.
- Never publish document bodies, owner identifiers or asset keys in the evidence file.
- One snapshot, one read-only transaction: all counts come from the same `REPEATABLE READ` snapshot
  so totals cannot disagree.
- If a query fails, record the failure. A partial inventory is not a clean inventory.

## Procedure

### 1. Guard and snapshot

```bash
# run only against the deployed database, never the Compose stack
OUT="inventory-$(date -u +%Y%m%dT%H%M%SZ).txt"
psql "$PRODUCTION_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -c "SET default_transaction_read_only = on" \
  -c "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY" \
  -c "SET biskiq.inventory_expected_database = 'PRODUCTION_DATABASE_NAME'" \
  -f inventory.sql > "$OUT"
sha256sum "$OUT"
```

Replace `PRODUCTION_DATABASE_NAME` with the approved deployed database name before running; the guard
refuses when it is absent or different. `inventory.sql` must begin with the refusal guard, so a
mistargeted run stops before reading. The Compose database is named `biskiq`, so a name check alone is
not sufficient: the guard also refuses a loopback/private server address, an unresolved socket, and
any session that is not read-only.

```sql
DO $$
DECLARE
  expected text := current_setting('biskiq.inventory_expected_database', true);
  server text := coalesce(inet_server_addr()::text, '');
BEGIN
  IF current_setting('default_transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'Refusing: default_transaction_read_only must be on';
  END IF;
  IF expected IS NULL OR expected = '' THEN
    RAISE EXCEPTION 'Refusing: set biskiq.inventory_expected_database to the approved production database';
  END IF;
  IF current_database() <> expected THEN
    RAISE EXCEPTION 'Refusing: connected to %, expected %', current_database(), expected;
  END IF;
  IF current_database() LIKE '%compose%' OR current_database() LIKE '%local%' THEN
    RAISE EXCEPTION 'Refusing to inventory a local/Compose database (%)', current_database();
  END IF;
  IF server = '' OR server LIKE '127.%' OR server = '::1'
     OR server ~ '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' THEN
    RAISE EXCEPTION 'Refusing: server address % is not a deployed production host', server;
  END IF;
END $$;
```

### 2. Project and version counts

```sql
SELECT count(*) AS projects,
       count(*) FILTER (WHERE latest_version = 0) AS projects_without_versions
FROM projects;

SELECT count(*) AS versions,
       count(DISTINCT project_id) AS projects_with_versions,
       min(version) AS min_version, max(version) AS max_version
FROM project_versions;

SELECT p.id, p.latest_version, count(v.*) AS stored_versions
FROM projects p LEFT JOIN project_versions v ON v.project_id = p.id
GROUP BY p.id, p.latest_version
ORDER BY p.id;
```

`projects.id` is exposed only to the reviewer, not published; the published artifact keeps the count
and the per-project shape (`latest_version` vs stored versions) without identifiers.

### 3. Source-format coverage

Format is read from the stored document, not inferred from the save path. The landed codec names the
version field **`formatVersion`** on the root, Layout and Scene (`packages/project-model/src/project-codec.ts`),
and on the F2 envelope (`units/types.ts`). Probing a field named `version` would return `absent` for
every real row and silently send an unsupported version to conversion, so the probe reads the actual
field names and the envelope marker.

```sql
WITH shapes AS (
  SELECT document->>'formatVersion' AS root_format_version,
         document->'layout'->>'formatVersion' AS layout_format_version,
         document->'scene'->>'formatVersion' AS scene_format_version,
         (document ? 'units') AS has_units,
         (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(document) AS k) AS root_keys
  FROM project_versions
)
SELECT coalesce(root_format_version, 'absent') AS root_format_version,
       coalesce(layout_format_version, 'absent') AS layout_format_version,
       coalesce(scene_format_version, 'absent') AS scene_format_version,
       has_units,
       root_keys,
       count(*) AS versions
FROM shapes
GROUP BY root_format_version, layout_format_version, scene_format_version, has_units, root_keys
ORDER BY versions DESC;
```

Classify each distinct shape into exactly one bucket from the version values, not the keys alone.
The expected values are the ones the landed codec states; read them from the codec at execution time
rather than trusting this table if it has drifted.

| Bucket | Definition | Expected handling |
| --- | --- | --- |
| `current-source` | Strict root `{id,name,layout,scene}`, root `formatVersion` absent, Layout `formatVersion = 5`, Scene `formatVersion = 1`, no `units` key | Conversion candidate |
| `unit-envelope` | `units` key present, root `formatVersion` equal to the admitted F2 envelope version, Layout/Scene versions absent | Already new format |
| `empty` | Project with zero versions | Boot/wrap only |
| `unknown` | Any other version value (a newer Layout/Scene/envelope version included), malformed JSON shape, or missing required root key | Refuse; never sniff or convert |

`unknown` counts are a **stop condition** for activation and belong in
[owner-decisions.md](./owner-decisions.md).

### 4. Publications and releases

```sql
SELECT count(*) AS publication_rows,
       count(*) FILTER (WHERE active_version IS NULL) AS unpublished,
       count(*) FILTER (WHERE active_version IS NOT NULL) AS published
FROM publications;

SELECT count(*) AS release_rows,
       count(DISTINCT project_id) AS projects_with_releases,
       count(*) FILTER (
         WHERE jsonb_typeof(manifest) <> 'object'
       ) AS non_object_manifests
FROM releases;

SELECT pub.project_id, pub.public_id, pub.active_version, pub.revision,
       r.version AS release_version, r.created_at
FROM publications pub
LEFT JOIN releases r ON r.project_id = pub.project_id AND r.version = pub.active_version
ORDER BY pub.created_at;
```

A publication whose `active_version` has no matching `releases` row, whose `active_version` exceeds
the project's `latest_version`, or whose release manifest is not an object, is a broken publication
and a stop condition.

`projects.id` and `publications.public_id` identify rows. Keep them in a reviewer-only extract; the
hashed evidence artifact carries the counts and classifications with those columns dropped or
redacted, per the provenance contract. (`manifest` is `jsonb NOT NULL` with an object check in the landed schema, so
`manifest IS NULL` cannot occur; the non-object check is retained as a defensive probe only.)

### 5. Retained bytes

Retained bytes means **all stored source bytes plus all stored publication artifacts plus referenced
asset bytes** — not only the latest version:

```sql
SELECT
  (SELECT coalesce(sum(pg_column_size(document)), 0) FROM project_versions) AS version_document_bytes,
  (SELECT coalesce(sum(pg_column_size(manifest)), 0) FROM releases) AS release_manifest_bytes,
  (SELECT coalesce(sum(byte_size), 0)
     FROM assets WHERE storage_kind = 'r2' AND import_state = 'ready') AS ready_asset_bytes,
  (SELECT coalesce(sum(byte_size), 0)
     FROM assets WHERE storage_kind = 'r2' AND import_state <> 'ready') AS staged_asset_bytes,
  (SELECT coalesce(sum(byte_size), 0)
     FROM assets WHERE storage_kind = 'r2') AS all_r2_asset_bytes,
  (SELECT pg_total_relation_size('project_versions')) AS versions_table_total_bytes,
  (SELECT pg_total_relation_size('releases')) AS releases_table_total_bytes;
```

`storage_kind = 'none'` assets hold no object-store bytes; their declared `byte_size` is metadata and
is recorded separately, not added to the retained census. `ready` and `staged` are both retained: a
`pending` or `failed` upload already occupies storage until collection.

Object-store verification (do not trust the SQL `byte_size` alone):

```bash
aws s3api list-objects-v2 --bucket "$PRODUCTION_ASSET_BUCKET" \
  --query "Contents[].{Key:Key,Size:Size}" --output json > asset-objects.json
# compare key set and total size with assets.object_key / assets.byte_size
```

Record separately:

- compressed backup estimate (custom-format dump plus the object-store prefix size);
- largest project and largest version, by stored bytes, without names;
- duplicate/retained-copy note: `project_versions` is append-only and holds **every** version, so
  retained bytes include superseded versions. There is no soft-delete column in the landed schema
  (`projects`, `project_versions`, `publications`, `releases`, `assets`); do not assume hidden
  soft-deleted rows. `assets.object_key` is unique, so duplicate assets are distinct rows only when
  their bytes differ or their key differs.

### 6. Pending and unacknowledged work

```sql
SELECT count(*) AS save_receipt_count,
       count(DISTINCT project_id) AS projects_with_receipts,
       count(*) FILTER (WHERE precondition_kind = 'create-only') AS create_only_receipts
FROM save_receipts;

-- Pre-conditional-Save rows: a backfilled token with no recorded revision/digest.
SELECT count(*) AS pre_conditional_save_projects
FROM projects
WHERE saved_revision IS NULL OR saved_source_content_id IS NULL;

SELECT count(*) AS staged_asset_rows,
       coalesce(sum(byte_size), 0) AS staged_asset_bytes
FROM assets WHERE import_state <> 'ready';
```

Receipts are permanent idempotency records, not a pending queue; the count is named
`save_receipt_count` for that reason. `pending`/`failed` assets are staged bytes and belong in
retained-bytes accounting until collected. A project whose `saved_base_token` exists but
`saved_revision`/`saved_source_content_id` is null is a pre-conditional-save row; it converts like any
other, with no revision to preserve, and the token alone is its precondition.

## Results

Every cell is unmeasured. Fill this table only from the executed artifact above; delete the
`not measured` marker for a row only when the artifact hash is recorded beside it.

| # | Measure | Value | Provenance |
| --- | --- | --- | --- |
| 1 | Deployed revision serving the inventoried environment | not measured — requires read-only production access | — |
| 2 | Projects (total / zero-version) | not measured — requires read-only production access | — |
| 3 | Project versions (total / min / max) | not measured — requires read-only production access | — |
| 4 | Versions by bucket: current-source / unit-envelope / empty / unknown | not measured — requires read-only production access | — |
| 5 | Publication rows (total / published / unpublished) | not measured — requires read-only production access | — |
| 6 | Release rows / projects with releases / non-object manifests | not measured — requires read-only production access | — |
| 7 | Version document bytes / release manifest bytes / ready + staged asset bytes / all R2 bytes | not measured — requires read-only production access | — |
| 8 | Object-store object count / total bytes / orphan or missing-key count | not measured — requires read-only production access | — |
| 9 | Backup estimate (database dump + ready and staged asset prefix) | not measured — requires read-only production access | — |
| 10 | Save receipt count / projects with receipts / pre-conditional-save projects | not measured — requires read-only production access | — |
| 11 | Staged (`pending`/`failed`) asset rows and bytes | not measured — requires read-only production access | — |
| 12 | Local Compose database | **excluded by contract — not evidence** | — |

## Interpretation rules

- **Zero projects and zero publications** is a clean inventory and may support an empty-release gap
  decision, but only as a measured zero with provenance.
- **Any `current-source` version** requires conversion coverage for every distinct shape; counts alone
  are insufficient.
- **Any publication or release** blocks a blanket gap decision and forces a per-publication
  disposition in [publication-disposition.md](./publication-disposition.md).
- **Any `unknown` shape, broken publication or orphan asset** is a stop condition until the owner
  accepts a disposition.
- A clean local stack is **never** cited, compared or extrapolated. If the production environment is
  unreachable, the honest result is `not measured`, and S04 cannot be authorized.

## Review checklist

- [ ] Guard was present, read-only mode was on, the approved database name matched, and the server
      address was not loopback/private.
- [ ] One read-only repeatable-read snapshot produced every number.
- [ ] Raw artifact and SHA-256 are stored; no names, owners, keys or document bodies are published.
- [ ] Bucket classification was reviewed against the actual strict codec, not guessed from keys.
- [ ] Object-store totals were verified independently of `assets.byte_size`.
- [ ] Every `not measured` cell either has a value or is carried into
      [owner-decisions.md](./owner-decisions.md) as a blocker.
