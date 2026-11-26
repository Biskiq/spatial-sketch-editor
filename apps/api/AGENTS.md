# API area context

**Read when relevant:** [path map](../../docs/path-map.md),
[persistence](../../docs/reference/components/persistence.md),
[platform boundary](../../docs/reference/architecture.md#platform-boundary-current),
[verification](../editor/tests/README.md#what-a-change-requires).

Own Fastify, Postgres persistence, local credentials and sessions, project/version writes,
model-resource staging and private R2 access. Shared domain shapes belong to their codecs.

- Validate the editor's current F2 envelope. Refuse unknown versions and mixed roots at the
  codec without conversion. Keep format fixtures and refusal tests with their owning codec.
- Scope project, version, asset and publication queries to the authenticated owner.
  Validate client-supplied revision preconditions against persisted state.
- Save conditionally and append-only under the project row lock. Preserve idempotent receipts
  for ambiguous retries and refuse stale writers while preserving local work.
- Public releases expose visitor delivery only. Publishing requires a prepared reader.
  Model bytes stay in private object storage with metadata and ownership in Postgres.
- Keep route, persistence and library operation families local. Verify affected contracts
  with `npm run check:api` and DB-backed `npm run test:api` with zero skips. The test command
  builds first. Use the shared verification contract for test database setup.
