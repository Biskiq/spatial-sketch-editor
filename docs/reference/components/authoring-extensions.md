# Extending Stage authoring

Add a capability inside its owning domain. The domain adapter connects it to the existing Stage
and F4 entry points. Use the current owner when the capability shares its lifetime, inputs and
authority. Give it a bounded owner when it has a distinct capture, cancellation or projection
lifetime that can be expressed through typed inputs and outputs.

| Capability work | Where it belongs |
| --- | --- |
| Plan or validate an edit | Reuse the owning domain's planner and runtime-safe algorithms. The adapter factory supplies its planners to the project epoch's acceptance host through `StageAdapterServices.authoring.registerPlanner`. Task, gesture and Card writers submit intents through the same F4 acceptance path. |
| Capture a gesture or run typed entry | Keep the proposal and its teardown in the adapter's binding-scoped session. Use Stage's gesture lease and route input dispatch. Layout's Wall and Opening sessions, Scene's placement and mark sessions, and Light's gesture session follow this pattern. |
| Publish contributions | The domain binding supplies subjects, tasks, Find entries, Card facts and actions, mark descriptors, and guides. Keep domain reads in the domain contribution owner. The Stage contribution view orders and projects the current binding outputs. |
| Preview a proposal | Publish candidate polygons, segments, labels or ghost descriptors through the binding. Use the existing Layout candidate presenter and project-epoch compile context for Layout proposals. Stage projects through the current evaluation and its existing overlay and Canvas draw the result. |
| Mount an adapter | The spatial route supplies its factories to the project epoch. The epoch mounts them through `mountStageAdapter`. Use the public adapter context and services for Stage reads and explicit requests. The binding ends on rebind and the registration ends on unmount. |

The [Stage facade](../../../apps/editor/src/lib/authoring/stage/stage-facade.ts) is the public
host seam. Its owners under `apps/editor/src/lib/authoring/stage/facade/` divide the work
by lifetime. Adapter bindings own registration, disposal and notifications. The Plan view retains
the Layout evaluation and reads its parameters and Reveal inputs. The contribution view retains
projected results and owns mark disclosure. Selection and picking qualify the active binding and
arbitrate hits over the current evaluation. Leaves receive typed ports from the facade. The
facade coordinates accepted content, selection writes, Camera tickets and task/input dispatch.

Use the canonical owners throughout. `StageSession` owns selection and gesture leases. The Camera
session and Camera core own the live evaluation and viewing intents. Layout core owns compilation
and Plan evaluation. The project epoch's acceptance host and F4 own writes and chronological
history. The Stage Canvas and its existing renderers own realization. Adapter bindings and
presenters hold proposal or view state within those lifetimes.
