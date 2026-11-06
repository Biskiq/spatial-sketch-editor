# API area context

**Read first:** root [`AGENTS.md`](../../AGENTS.md) · [`path map`](../../docs/path-map.md) ·
[`persistence`](../../docs/reference/components/persistence.md) · [`architecture`](../../docs/reference/architecture.md#platform-boundary-current).

**Owns:** Fastify routes, Postgres persistence, local credential/session handling, project/version
writes, model-resource staging/approval and private R2 access. Editor UI and shared domain shapes stay
with their owners.

## Invariants

- Validate the same F2 unit envelope the editor writes; reject unknown versions and mixed roots
  without conversion.
- Scope every project, version, asset and publication query to the authenticated owner. Never trust a
  client-supplied owner or expected revision.
- Save is conditional and append-only under the project row lock; an idempotent operation receipt
  protects ambiguous retries. A stale writer preserves local work by refusing.
- Public release reads are visitor-only and never expose authoring internals. Publish stays
  `prepared-reader-required` until T4 activates the prepared reader.
- Keep model bytes in private object storage; metadata and ownership stay in Postgres.

## Commands

```sh
npm run check:api
npm run build:api
npm run test:api                 # requires the database configured by the test contract
npm run test:api:stack           # local Postgres stack
```

`test:api` builds first and runs its suite serially; use the repository test contract for DB setup.
