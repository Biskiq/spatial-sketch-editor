/**
 * `@portfolio/project-model/migration` — the sole current-source converter
 * (AM-7), behind its own migration-only entry.
 *
 * This entry exists to be *retired*: it is the only code in the repository that
 * knows the legacy Scene/Camera order fields, it is wired to no route, and it is
 * removed once the covered migration inventory is completed or discharged and
 * recovery is verified, before the Source Baseline. Nothing here is exported
 * from the package's root barrel, and no normal reader, writer, API route,
 * visitor runtime or editor host imports it.
 */

export * from './types';
export * from './convert';
