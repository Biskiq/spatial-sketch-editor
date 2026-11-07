# Shared packages context

**Read first:** root [`AGENTS.md`](../AGENTS.md) · [`architecture`](../docs/reference/architecture.md#semantic-authorities-ratified-destination) ·
[`composition`](../docs/reference/composition-execution.md) · [`persistence`](../docs/reference/components/persistence.md).

These are runtime-safe workspace packages. They must not import editor session, UI, history or
authoring stores. Each package owns only its declared domain computation:

| Package | Owns | Do not add |
| --- | --- | --- |
| `layout-core` | Layout schema, validation, planning primitives, canonical architecture compiler and Plan representation | Scene/Camera/Experience ownership or a second compiler |
| `project-model` | F2 envelope, unit codecs, references, canonical bytes, Scene planning and Experience lowering/interpreter | Shell state, renderer handles or a second Camera evaluator |
| `camera-core` | Viewport/projection, Camera routes/motion, framing/evaluation and Guide time map | A navigation graph or pose controller in the editor |
| `geometry-core` | Native-form profile/extrusion evaluation | Scene ownership or persisted UI/form state |

Use the owning contract's tests through the editor suites; check the package with its workspace
`check` script when its types change. Package boundaries are architecture, not a convenience import.
