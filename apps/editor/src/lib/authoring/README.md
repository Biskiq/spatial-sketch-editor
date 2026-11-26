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
- `studio/` is Object Studio, an independent feature (`studio/studio-feature.svelte.ts`) that the
  World workspace mounts. It is a session-only posture over the same Stage, Camera, selection, history
  and Save. It owns no source, Camera, history or document and serializes nothing. Entry is
  `…/spatial?entry=studio&object=<id>` (`lib/platform/studio-entry.ts`, import-free so `/`, `/projects`
  and `/studio` stay Three-free). Rules that hold for every Studio change:
  - **Scope has owning boundaries.** One `SubjectScope` (`stage/subject-scope.ts`) is read, never
    copied: each domain adapter drops its own out-of-scope pick candidates (the host adds no
    post-filter, so a valid hit behind muted context is still reached and arbitration is
    unchanged); the facade refuses out-of-scope tasks, Find entries, host tools and selections
    (`out-of-scope`), so Find, ⌘K and the dock cannot reach what the posture hides. Instruments read
    the posture through `services.stage.postureScoped()`, never through a route service.
  - **Presentation is session-only.** World context mutes others with cloned materials, Mat context
    unmounts them; shared render resources are never mutated.
  - **Pending work settles or refuses before any transition** (root switch, lens change, return,
    navigation); nothing is silently dropped. Escape unwinds gesture, task and tool first, then a
    World-entered Studio; a standalone Studio leaves through Back to Projects.
  - **Cross-project reuse uses the library.** _Open editable copy_ and _Place copy in World_ move an
    immutable form payload through the form library and the Place instrument's ordinary typed
    Place (`adapters/scene/library/intake.ts`); the source project is saved before the switch, and a
    failed Save or library write keeps the creator in place with a retry message. The journey
    (`studio/place-copy-journey.ts`) asks the controller's `current()` after every await, so a
    transfer the creator has moved on from neither navigates nor reports. The destination may be an
    existing or a new project; `adapters/scene/library/transfer.ts` keeps ids only (tab session
    storage) so a cancelled placement, a destination that fails to load or a refresh always offers
    **Return to object**. Contributed Card actions are scoped at the facade
    (`SubjectScope.admitsCardAction`), so the Card, the Delete key and a held record agree: the root
    being edited is never duplicated or deleted from inside its own Studio.

Editor machinery must not enter visitor or public chunks. See
[`docs/reference/architecture.md`](../../../../../docs/reference/architecture.md) and
[`docs/reference/composition-execution.md`](../../../../../docs/reference/composition-execution.md)
for the ownership and composition boundaries. The test contract is
[`apps/editor/tests/README.md`](../../../tests/README.md).
