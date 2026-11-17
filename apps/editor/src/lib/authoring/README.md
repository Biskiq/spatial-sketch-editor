# `lib/authoring/` — editor authoring

This directory contains the live editor authoring system, including Svelte components,
session controllers and domain-specific interaction logic as well as pure semantics.
The spatial route composes the Stage, its adapters and the Experience authoring homes.

- `stage/` owns the shared Stage host, session and shell.
- `adapters/` contributes domain-owned interaction and tools to that host.
- `experience/` owns Experience authoring homes and session behavior.
- `camera/`, `layout/` and `scene/` contain editor-side authoring logic for their
  respective domains; shared domain semantics belong in the corresponding packages.
- `f4/` owns editor acceptance and history; authored edits pass through that authority.
- `studio/` is Object Studio: a session-only posture over the same Stage, Camera, selection, history
  and Save. It scopes picking to one native form (`stage/subject-scope.ts`) and mutes or hides the
  rest; it owns no source, Camera, history or document and serializes nothing. Entry is
  `…/spatial?entry=studio&object=<id>` (`lib/platform/studio-entry.ts`, import-free so `/`, `/projects`
  and `/studio` stay Three-free). Cross-project placement and the full resume/library journeys are T5.2.

Editor machinery must not enter visitor or public chunks. See
[`docs/reference/architecture.md`](../../../../../docs/reference/architecture.md) and
[`docs/reference/composition-execution.md`](../../../../../docs/reference/composition-execution.md)
for the ownership and composition boundaries. The test contract is
[`apps/editor/tests/README.md`](../../../tests/README.md).
