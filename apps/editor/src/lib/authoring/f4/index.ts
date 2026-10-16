/**
 * Editor-only F.4 acceptance: the coordinator that installs through the shared
 * boundary and the bounded authoring history it records.
 *
 * **Not** a package barrel and **not** reachable from the public route: the
 * shared AM-4 contracts and the current-source admission live in
 * `@portfolio/project-model` (which the public route's module graph includes),
 * while this coordinator and history are editor machinery. The isolation is
 * proved by `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts`
 * (arch lane) rather than assumed from tree-shaking.
 */

export * from './history';
export * from './acceptance-coordinator';
