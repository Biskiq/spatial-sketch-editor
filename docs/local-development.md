# Local development

Run these commands from the repository root. For the project overview and demos,
see the [Biskiq README](../README.md).

Needs Node.js 20+, Docker with Compose v2, and a WebGL browser. No cloud account,
remote database or Cloudflare R2 credentials are needed for the self-contained
stack.

## One command: the full self-contained stack (recommended)

```bash
npm install
npm run dev:local
```

That command:

1. starts PostgreSQL 16 and SeaweedFS (the local S3-compatible store) in an
   isolated Compose project;
2. applies every database migration (idempotent);
3. creates and verifies the object-storage bucket with a signed write/read/delete
   probe;
4. starts the existing Fastify API with source watching;
5. starts SvelteKit/Vite with hot reload in the foreground and waits until both
   HTTP services answer.

Open the printed editor URL (usually `http://localhost:<port>`). No username or
password account is preconfigured: choose **Create an account** on the sign-in
page. Accounts, projects, project versions and asset bytes survive restarts.

The first run pulls the `postgres:16-alpine` and `chrislusf/seaweedfs:4.53`
images. Later runs reuse them.

### Lifecycle commands

| Command | Effect |
| --- | --- |
| `npm run dev:local` | Start or resume the stack and run the API/editor in the foreground. |
| `Ctrl+C` | Stop the API, the editor and the Compose services. Data is preserved. |
| `npm run dev:local:stop` | Same stop from another terminal; data is preserved. |
| `npm run dev:local:reset` | **Destructive.** Stop and delete the local PostgreSQL and object-storage volumes and the local stack state. |
| `npm run dev:local:logs` | Follow the PostgreSQL and SeaweedFS logs; `Ctrl+C` stops following only. |
| `npm run dev:local:status` | Print the stack identity, container status and HTTP readiness. |

Startup is idempotent: migrations, bucket creation and service startup may be
repeated. A lock file prevents two supervisors from racing on one worktree; a
stale lock from a crashed process is reclaimed. `stop` and `reset` are safe to
repeat when nothing is running.

`stop` and `reset` authorize the persisted state against the current absolute
worktree path before using its Compose project. A state file copied from another
worktree cannot target that other stack: `stop` falls back to the current
worktree's identity, and `reset` refuses and leaves the state file in place. If
Docker cleanup fails, `reset` reports the failure and also leaves the state file
so the operation can be retried without losing the only recovery record.

The API and editor started by `dev:local` bind to `127.0.0.1`; PostgreSQL and
SeaweedFS publish their ports on loopback too. The API chooses loopback whenever
the development-only local object store is active; the normal R2 path keeps its
`0.0.0.0` listener, and `npm run dev:editor` is unchanged.

### What is isolated, and where the data lives

Every checkout's absolute path determines a short hash. That hash names the
Compose project, both Docker volumes, the database password, the S3 access keys,
the object-key namespace and the S3 bucket. Two worktrees can therefore run side
by side without sharing a port, database, bucket or credential.

The first run writes `.local/dev-stack.json` (mode `0600`, git-ignored) with the
allocated ports, credentials and session key. The ports are reused on the next
start when they are still free. The Compose volumes are named
`<stack>_pgdata` and `<stack>_s3data`; `dev:local:status` prints `<stack>`. Use
`npm run dev:local:logs` to follow the service logs.

`npm run dev:local:reset` deletes both volumes, so the next start creates a fresh
database and bucket. Delete `.local/` only through that command (or after
stopping), because the state file is how a restart finds its existing data.

### No production configuration is read

`dev:local` does not source `.env`. It starts every child with inherited
`DATABASE_URL`, `SESSION_KEY`, `R2_*`, `E2E_TEST_AUTH_SECRET`,
`RENDER_EXTERNAL_URL` and `BISKIQ_*` values removed, then sets the loopback
values from `.local/dev-stack.json`. A developer's deployed database or R2
credentials cannot be reached by this stack.

The test-only authentication seam is deliberately absent: `dev:local` never sets
`E2E_TEST_AUTH_SECRET`. Sign-in uses the normal username/password account flow.

### Object storage and production safety

Local storage is [SeaweedFS](https://github.com/seaweedfs/seaweedfs) 4.53, pinned
by image tag. It is Apache-2.0 licensed and the image's multi-arch index includes
`linux/amd64` and `linux/arm64`. The API talks to it through the same
`@aws-sdk/client-s3` `ObjectStore` used for R2, using S3 Signature V4 with
path-style addressing.

The development-only switch is explicit:

```env
LOCAL_OBJECT_STORE=1
R2_ENDPOINT=http://127.0.0.1:<port>
```

`readConfig` accepts that driver only when all of these hold: the value is exactly
`1`, `NODE_ENV` is not `production`, and `R2_ENDPOINT` is a credential-free HTTP
URL on a loopback host. The production path is unchanged: without
`LOCAL_OBJECT_STORE`, `R2_ENDPOINT` must still be a credential-free HTTPS URL and
the SDK uses its normal virtual-hosted style. A deployed process that sets the
local switch fails closed.

### Technical checks

```bash
npm run test:local-dev   # stack identity, isolation, environment and port allocation
npm run check:api        # API typecheck
npm run test:api         # API contracts; needs DATABASE_URL (see below)
```

The local stack itself is ready for the owner's separate manual T2 review; no
browser journey or Playwright acceptance is part of this command.

## Alternative: Docker backend with a real R2 development bucket

This predates `dev:local` and is **not** self-contained: it still uses the `R2_*`
values in `.env` for uploads and reads. If you use it, point those at a
development-only bucket — never the production bucket or keys.

Install dependencies and create the local environment file if it does not exist.
Then set the local values in `.env` (do not commit it):

```bash
npm install
cp .env.example .env
```

Set a 32-byte `SESSION_KEY` and the `R2_*` values, with the editor's API origin:

```env
PUBLIC_API_ORIGIN=http://localhost:8787
```

One command builds the API image, starts PostgreSQL 16, applies every migration
and returns once the API reports ready (`/health/ready` reaches the database):

```bash
npm run stack:up
```

Then run the editor natively, with Vite hot reload:

```bash
npm run dev
```

Open <http://localhost:5173>. The Compose stack
([`docker-compose.yml`](../docker-compose.yml)) reads secrets from `.env` but
always uses its own database and origins. Data lives in the `biskiq_pgdata`
volume; the database is also reachable at
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

This legacy stack is shared by default: every checkout that does not set
`BISKIQ_STACK`, `BISKIQ_DB_PORT` and `BISKIQ_API_PORT` uses the same project,
image and volume. For parallel work prefer `dev:local`, whose isolation is
automatic.

## Alternative: backend on a host Postgres

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

Open <http://localhost:5173>. The root scripts load `.env` automatically. This
path still needs the `.env` `R2_*` storage configuration described above.

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
need a reachable Postgres — `npm run test:api:stack` uses the legacy Compose
database). Kernel packages have `check:layout-core`, `check:project-model` and
`check:camera-core`.
