# Chopin Museum — frozen legacy project

This folder is a **self-contained, hash-frozen copy** of the two museum products that
the `apps/editor` product served before PR #115: the visitor museum at `/museum`
and the relic Scene · Camera editor at `/museum/editor`, plus the kernel snapshot
they depend on.

It is **not** an npm workspace and **not** part of the product. Everything it needs
— sources, kernel, static assets, dependencies, tests and configuration — lives
inside this folder, and it has its own `package-lock.json`. The product never
imports, aliases or references it.

- **Baseline:** `e90a58224443bdbf44114d7285d55c983b79cc84` (2026-10-13, `main`).
- **Provenance:** [`FREEZE.json`](./FREEZE.json) records, per file, the baseline
  path, the frozen path and a plain `sha256` of the bytes. Files that are new or
  adapted here (this README, the configs, the lockfile, the freeze test) are listed
  separately with a reason.

## Contract

- `/museum` renders the Chopin museum with guided navigation and the HUD.
- `/museum/editor` mounts the relic Scene · Camera editor on Chopin: Paris-only
  room focus, placement arming, the tour selector, the frozen mini-player transport,
  the relic's own ruler/preview controls and relic Flip semantics.
- The relic refuses the Layout workspace and registers no Layout history.
- It keeps its legacy formats, Room frames, Camera node order, CSS and design tokens.
- **No forced modernization.** Change policy: preservation fixes only, each as a
  separate reviewed change that updates `FREEZE.json` with a reason. Dependency
  versions do not move unless a preservation fix requires it.

## Commands

Run everything from inside this folder:

```sh
npm ci          # install from the pinned lockfile
npm test        # vitest (frozen-project guarantees + the freeze test)
npm run check   # svelte-kit sync && svelte-check
npm run build   # vite build
npm run preview # serve the built app
npm run dev     # dev server
```

`npm test` includes `tests/freeze.test.ts`, which re-hashes every file listed in
`FREEZE.json` and fails if a frozen source file has drifted.

## Deployment (owner-handled)

The frozen code and data use root-relative asset URLs (`/museum/models/…`,
`/textures/…`), which the product also uses. Serve this project at **its own
origin** — its own deployment project whose root directory is `legacy/chopin-museum`
— rather than proxying it under a product sub-path.

## Deleting it

`rm -rf legacy/chopin-museum` — nothing in the product references this folder, and
the product's own arch lane asserts that. The rendered product, its tests and its
build are unaffected.
