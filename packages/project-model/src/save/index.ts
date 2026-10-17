/**
 * `@portfolio/project-model/save` — the conditional Save protocol
 * (`SaveAcceptedSource@1`). Kept off the root barrel: the public route's module
 * graph has no reason to reach Save, and the subpath makes the dependency
 * explicit for the API and the editor client.
 */

export * from './protocol';
