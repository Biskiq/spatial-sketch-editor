# Active blueprints

Multi-PR programmes and approved unbuilt designs only. A programme folder exists while it has
unshipped scope and is deleted in its closing PR; single-PR plans and closeout evidence live on their
GitHub PR. Semantic authority is [docs/reference](../reference/architecture.md); enduring design
authority is [docs/design-system](../design-system.md).

| Programme | Remaining scope | Deletion condition |
| --- | --- | --- |
| [T1 · Spatial World](./t1-spatial-world/README.md) | Connected curves (`C4`), Slice (`SL3`), open Spaces (`SP3`), verticality (`V2`, `V3`) and reconciliation (`R`). Landed slices `A0–A8`, `X0–X2`, `SL1–SL2`, `SP1–SP2`, `C1–C3`, `V1a–d` stay as implementation evidence, not future work. | Delete each plan file when its remaining slices merge; delete the folder when `R` closes. |
| [T2 · Look & Atmosphere](./t2-look-atmosphere/README.md) | `G1` material-library recovery, `D8` material distinctness, §14 open items, `U6` editor Align/Import/repair, and `U7` / F's deferred catalogue distinctness revalidation. | Delete the S8 folder when `G1`, `D8`, `U6` and the distinctness revalidation land; delete the programme when its remaining look work closes. |
| [T4 · Release](./t4-release/README.md) | The prepared visitor package, separate release reader, delivery profiles and activation gate. Nothing here is shipped; Publish/Update still return `prepared-reader-required`. | Delete when the prepared reader is active and the release baseline is declared. |
| [T5 · Expressive Geometry](./t5-expressive-geometry/README.md) | Approach B's bounded depth and the Object Studio journeys. The first Studio profile revision is landed; later journeys and the geometry route are unbuilt. | Delete when the admitted capabilities and Studio journeys land, or the owner retires the direction. |

A blueprint states technical design and unresolved choices; it grants no implementation permission
beyond its approved slices and creates no second authority beside the contracts. Research and
[prototype donors](../../prototypes/README.md) are opt-in inputs.

Design authorities that outlive a programme live in [docs/design-system](../design-system.md), not
in a programme folder. T1's interaction sketches and T5's Object Studio journeys are already there;
closing a programme never deletes them.
