# Shared packages context

**Read when relevant:** [domain boundaries](../docs/reference/architecture.md#semantic-authorities-ratified-destination),
[composition and versions](../docs/reference/composition-execution.md),
[persistence](../docs/reference/components/persistence.md), [test contract](../apps/editor/tests/README.md).

| Package | Owns |
| --- | --- |
| `layout-core` | Layout schema, validation, planning, the architectural compiler and Plan representation |
| `project-model` | F2 envelope, unit codecs, references, canonical bytes, Scene planning and Experience lowering/interpreter |
| `camera-core` | Viewport/projection, Camera routes, motion, framing, evaluation and Guide time mapping |
| `geometry-core` | Native-form profile and extrusion evaluation |

Keep these packages runtime-safe and free of editor UI, session, history and authoring stores.
Group operation families by their inputs and invariants and index them in their authority's planner
registry. Observe geometry through per-call options. Keep package-pure tests and fixtures in the
owning workspace. Run its type check and verify affected editor/API consumers.

Use the owning codec's sole admitted version. On a format bump update current fixtures together.
Assert version refusal at the codec boundary. Keep separately versioned authored and delivery data.
