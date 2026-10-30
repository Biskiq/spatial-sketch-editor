# Local development image for @biskiq/api (docker-compose.yml only).
# Production stays on Render's native build (render.yaml); this file never ships.
# Build context is the repository root: the API runs workspace packages from TS
# source through vite-node, so their sources must sit beside it.
FROM node:22-bookworm-slim

WORKDIR /repo
ENV NODE_ENV=development \
	npm_config_update_notifier=false \
	npm_config_fund=false \
	npm_config_audit=false

# Manifests first so dependency installs cache across source edits. npm ci
# validates the lockfile against every workspace manifest, so all are copied,
# but only the API workspace (and the workspace packages it depends on) installs.
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/editor/package.json apps/editor/
COPY packages/camera-core/package.json packages/camera-core/
COPY packages/geometry-core/package.json packages/geometry-core/
COPY packages/layout-core/package.json packages/layout-core/
COPY packages/project-model/package.json packages/project-model/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN npm ci --workspace @biskiq/api --include-workspace-root=false --ignore-scripts

COPY packages/tsconfig packages/tsconfig
COPY packages/camera-core packages/camera-core
COPY packages/geometry-core packages/geometry-core
COPY packages/layout-core packages/layout-core
COPY packages/project-model packages/project-model
COPY apps/api apps/api

WORKDIR /repo/apps/api
# Compiled output serves the one-shot migrate service: migrate.ts runs main()
# only when node executes it directly, which vite-node does not.
RUN npm run build
USER node
EXPOSE 8787
# Hot reload restarts the whole process, as the workspace `dev` script does
# (`vite-node --watch` re-ran modules in-process, where the old server still
# held the port). Node runs directly so it receives the container's signals.
CMD ["node", "--watch-path=src", "--watch-path=/repo/packages", "--watch-preserve-output", \
	"/repo/node_modules/vite-node/vite-node.mjs", "src/start.ts"]
