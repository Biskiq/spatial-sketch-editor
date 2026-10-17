# Spatial Sketch Editor

Layout-first editor for indoor 3D — **currently mid-foundation-reset.**

PR #115 removed the previous authoring shell (Plan/3D editing, placement, materials,
Camera tour authoring, preview, publish, import/export) so the spatial foundation
could be rebuilt on one camera authority, one architectural compiler, separate
Layout/Scene authorities and a ratified set of cross-domain contracts. What runs
today is the durable remainder: sign-in, the project hub, cloud persistence and the
cold public visitor runtime. Authoring capability returns through the T1–T4 tracks;
it is not merely disabled behind a flag.

This is a deliberate, recorded capability loss, not a regression: see
[`docs/roadmap/parallel-track-cutover/implementation-plan.md`](docs/roadmap/parallel-track-cutover/implementation-plan.md)
§4.4 and the capability-loss list it records.

## What runs today

| Route | Behavior |
| --- | --- |
| `/` | Public entry — guest start or Google sign-in |
| `/projects` | Owned project hub (cloud project list) |
| `/editor` | Redirect to a minted project at `/project/:id/spatial?create=1` |
| `/project/:id/spatial` | Read-only Stage for a stored source, a minted project's starter gallery, an empty project, or explicitly opened source JSON. One Canvas; no write path |
| `/p/:publicationId` | Cold public visitor runtime (strict reader). There are currently no published releases |

Removed routes: `/project/:id/preview`, `/project/:id/publish` (404), and the
`/museum` + `/museum/editor` routes. The frozen Chopin museum project that served
them is an independent, separately versioned project outside this repository; this
product does not serve it and does not import it.

The API (`apps/api`) is functional and current-format only: Save/Load, assets and
publication work against the wall-first Layout (`formatVersion: 5`) and world-local
Scene (`formatVersion: 1`) documents. There is no legacy-format reader, detector or
migration path.

## Start here

- [`AGENTS.md`](AGENTS.md) — bootstrap and hard rules for agents.
- [`docs/README.md`](docs/README.md) — the documentation router; read the smallest
  routed context that can answer the task.
- [`apps/editor/tests/README.md`](apps/editor/tests/README.md) — the test manual:
  lanes, doctrine and what a given change requires.

## Run locally

Needs Node.js 20+ and a WebGL browser.

Create the local environment file once if it does not exist, then set the local
values in [`.env`](.env) (do not commit it):

```bash
cp .env.example .env
```

Keep valid local Google OAuth credentials, a 32-byte `SESSION_KEY` and the
`R2_*` values in `.env`, with the editor's API origin:

```env
PUBLIC_API_ORIGIN=http://localhost:8787
```

Google must allow:

```text
Authorized JavaScript origin: http://localhost:5173
Authorized redirect URI:     http://localhost:8787/auth/callback
```

### Backend in Docker (recommended)

Needs Docker with Compose v2. One command builds the API image, starts
PostgreSQL 16, applies every migration and returns once the API reports ready
(`/health/ready` reaches the database):

```bash
npm run stack:up
```

Then run the editor natively, with Vite hot reload:

```bash
npm run dev
```

Open <http://localhost:5173>. The Compose stack ([`docker-compose.yml`](docker-compose.yml))
reads the secrets from `.env` but always uses its own database and origins:
the API serves `http://localhost:8787` and restarts when `apps/api/src` or
`packages/*/src` change. Data lives in the `biskiq-pgdata` volume and survives
restarts; the database is also reachable from the host at
`postgresql://biskiq:biskiq@localhost:5433/biskiq`. `BISKIQ_DB_PORT` and
`BISKIQ_API_PORT` change the host ports; with a different API port, set
`PUBLIC_API_ORIGIN` and the Google redirect URI to match.

```bash
npm run stack:logs      # follow API, migration and database logs
npm run stack:migrate   # re-apply migrations after adding one (idempotent)
npm run stack:down      # stop; data is kept
npm run stack:reset     # stop and delete the database volume
npm run test:api:stack  # API suite against the Compose database
```

The image is for local development only; deployment (`render.yaml`,
`vercel.json`) does not use it.

### Backend on a host Postgres

Use a local Postgres database:

```bash
brew services start postgresql@14
createdb biskiq
```

Set these local values in `.env`:

```env
DATABASE_URL=postgresql://localhost:5432/biskiq
PORT=8787
EDITOR_ORIGIN=http://localhost:5173
API_ORIGIN=http://localhost:8787
PUBLIC_API_ORIGIN=http://localhost:8787
```

Apply the database schema once:

```bash
npm run migrate:api
```

Start the backend and frontend in separate terminals:

```bash
# Terminal 1
npm run api
```

```bash
# Terminal 2
npm run dev
```

Open <http://localhost:5173>. The root scripts load `.env` automatically.

Stop Postgres when finished:

```bash
brew services stop postgresql@14
```

The editor alone can still run without the API; cloud Save/Load and Google
sign-in stay disabled until `PUBLIC_API_ORIGIN` and the backend are configured.

## Other commands

```bash
npm install
npm run build   # production build (editor)
npm run check   # svelte + TS checks
npm test        # the complete editor suite (all lanes)
```

The API has its own gates: `npm run check:api` and `npm run test:api` (build plus
every API contract; the persistence, Save, publication and auth-seam contracts
need a reachable Postgres — `npm run test:api:stack` uses the Compose database).
Kernel packages have `check:layout-core`, `check:project-model` and
`check:camera-core`.
