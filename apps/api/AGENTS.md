# API area context

Own Fastify, Postgres persistence, local credentials and sessions, project and
version writes, model-resource staging and private R2 access. Shared domain
shapes belong to their codecs; persistence is
[docs/reference/persistence.md](../../docs/reference/persistence.md).

- Scope project, version, asset and publication queries to the authenticated
  owner. Validate client-supplied revision preconditions against persisted
  state.
- Save conditionally and append-only under the project row lock. Preserve
  idempotent receipts for ambiguous retries and refuse stale writers while
  preserving local work.
- Validate the editor's current F2 envelope at the codec. Refuse unknown
  versions and mixed roots without conversion.
- Model and image bytes stay in private object storage with metadata and
  ownership in Postgres. Public releases expose visitor delivery only.
- Verify with `npm run check:api` and zero-skip DB-backed `npm run test:api`
  (setup: `npm run test:api:stack`).
