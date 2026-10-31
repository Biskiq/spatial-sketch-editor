# Local development

Run these commands from the repository root. For the project overview and demos,
see the [Biskiq README](../README.md).

Needs Node.js 20+ and a WebGL browser.

Install dependencies and create the local environment file if it does not exist.
Then set the local values in `.env` (do not commit it):

```bash
npm install
cp .env.example .env
```

Set a 32-byte `SESSION_KEY` and the `R2_*` values in `.env`, with the editor's
API origin. No username/password account is preconfigured: open the editor's
sign-in page and choose **Create an account**. An already signed-in legacy
account can enroll credentials while keeping its existing projects. There are
no external identity-provider credentials or callback registrations.

```env
PUBLIC_API_ORIGIN=http://localhost:8787
```

## Backend in Docker (recommended)

Needs Docker with Compose v2. One command builds the API image, starts
PostgreSQL 16, applies every migration and returns once the API reports ready
(`/health/ready` reaches the database):

```bash
npm run stack:up
```

That starts the backend only. Then run the editor natively, with Vite hot reload
(two commands by design: the editor is never containerized):

```bash
npm run dev
```

Open <http://localhost:5173>. The Compose stack ([`docker-compose.yml`](../docker-compose.yml))
reads the secrets from `.env` but always uses its own database and origins:
the API serves `http://localhost:8787` and restarts when `apps/api/src` or
`packages/*/src` change. Data lives in the `biskiq_pgdata` volume and survives
restarts; the database is also reachable from the host at
`postgresql://biskiq:biskiq@localhost:5433/biskiq`. `BISKIQ_DB_PORT` and
`BISKIQ_API_PORT` change the host ports; with a different API port, set
`PUBLIC_API_ORIGIN` to match.

```bash
npm run stack:logs      # follow API, migration and database logs
npm run stack:migrate   # re-apply migrations after adding one (idempotent)
npm run stack:down      # stop; data is kept
npm run stack:reset     # stop and delete the database volume
npm run test:api:stack  # API suite against the Compose database
```

**Object storage is not isolated.** Compose replaces the database, but the API
still uses the `R2_*` values from `.env` for real uploads and reads. Point them at
a development-only R2 bucket with credentials scoped to it — never the
production bucket or keys.

**Parallel worktrees.** By default every checkout shares one stack (project,
image and volume `biskiq`); `stack:up` from another worktree rebuilds the shared
API from that checkout and `stack:reset` deletes the shared database. For an
isolated stack per worktree, set a distinct name and host ports in that
worktree's environment before every `stack:*` command, and point its editor at
the matching API origin:

```bash
export BISKIQ_STACK=biskiq-t2 BISKIQ_DB_PORT=5434 BISKIQ_API_PORT=8788
npm run stack:up
```

Its `.env` then needs `PUBLIC_API_ORIGIN=http://localhost:8788`.

The image is for local development only; deployment (`render.yaml`,
`vercel.json`) does not use it.

## Backend on a host Postgres

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

The editor alone can still run without the API. Guest editing remains available;
cloud Save/Load and username/password sign-in are unavailable until
`PUBLIC_API_ORIGIN` and the backend are configured.

## Other commands

```bash
npm run build   # production build (editor)
npm run check   # svelte + TS checks
npm test        # the complete editor suite (all lanes)
```

The API has its own gates: `npm run check:api` and `npm run test:api` (build plus
every API contract; the persistence, Save, publication and auth-seam contracts
need a reachable Postgres — `npm run test:api:stack` uses the Compose database).
Kernel packages have `check:layout-core`, `check:project-model` and
`check:camera-core`.
