# P1 count census

The count side of P3: what a presented frame costs in draws, triangles, programs, lights, shadow
work, materials and texture bytes. Counts only; no timing. Timing is P2's job
([`../README.md`](../README.md)).

## Method

`census-snippet.js` defines `window.__BISKIQ_PERF__` and `window.__BISKIQ_PERF_ON_RENDERER__`. The
editor's existing perf marks hand each renderer to that callback at creation, and the snippet
wraps `renderer.render` only to remember the last `scene` and `camera`. Nothing in the product is
modified and no build is required.

1. Open the editor's project list in a browser tab.
2. Paste the whole of `census-snippet.js` into the console. The snippet is session-bound; a full
   page reload removes it, so re-paste after reloading.
3. Open a World, hold one fixed Stage view, and run `__BISKIQ_CENSUS_READ__('stage')`.
4. Enter Visitor Preview and run `__BISKIQ_CENSUS_READ__('preview')`.

The result is plain JSON from the last presented frame: `renderer.info` for draws, triangles and
programs, plus a scene walk for meshes, materials, lights, shadow casters, shadow maps and texture
bytes. Materials and textures are deduplicated by UUID. Texture bytes assume the declared
format/type, the image dimensions and mipmaps (4/3 unless disabled); compressed textures use their
mip byte lengths. Shadow-map bytes use `mapSize² × 4` per map. The walk covers textures referenced
by the rendered materials, not render targets or environment maps outside that set.

## Table

Counts are from one frame of the recorded view. "Programs" is `renderer.info.programs.length`;
materials and textures are deduplicated by UUID.

| World · view | Draws | Triangles | Programs | Lights | Shadow-casting | Shadow casters | Shadow maps | Materials / meshes | Textures | Texture bytes |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | ---: | ---: |
| **Untitled project** · Stage (`project:f924b61c…`, 31 Walls, 10 Rooms) | 64 | 44,937 | 7 | 3: 1 Ambient, 2 Directional | 0 | 32 | 0 | 34 / 64 | 2 × RGB8 256² | 524,288 B |
| **Untitled project** · visitor view (same World, draft Experience) | 58 | 25,203 | 5 | 3: 1 Ambient, 2 Directional | 0 | 32 | 0 | 34 / 64 | 2 × RGB8 256² | 524,288 B |
| **Untitled project** · Stage (new empty project, `project:caca181e…`) | 2 | 16,384 | 2 | 3: 1 Ambient, 2 Directional | 0 | 0 | 0 | 2 / 2 | 0 | 0 B |
| **S01 Main lifecycle** (`layout formatVersion 6`) | — refused | — | — | — | — | — | — | — | — | — |
| **Enclosed room** (`layout formatVersion 6`) | — refused | — | — | — | — | — | — | — | — | — |
| **Cinematic-scale reference** (arithmetic, not built) | 6,600 / pass + ≈6,600 shadow | ≈9,000,000 | n/a | 12 authored | 1 directional | ≈6,600 (assumed) | 1, size unspecified | 40 / ≈6,600 | 120 × 2K RGBA8 | 2,560 MiB |

The saved World's source document is the dev-stack `project:f924b61c…`; it was opened as source JSON
in a guest session, so the counts describe that World, not the guest project id. The new empty
project is the editor's blank baseline, not a content World; it is included because it
prices the fixed Stage floor and shows how small the render load is before any authored geometry.
Its visit view was not measured (no Experience was created in it).

The two legacy Worlds are real local files but the current product refuses their layout format:
`$.units.layout.header.formatVersion … must be 7`. They are recorded as refusals, not as census
rows, because no frame was presented. Their document counts are 24 Walls / 9 Rooms / 24 Openings
(`S01 Main lifecycle`) and 4 Walls / 1 Room (`Enclosed room`); both have no Scene entities and no
lights.

The cinematic row is arithmetic from
[`cinematic-scale-computational-strategy.md` §1](../../../broad-research/cinematic-scale-computational-strategy.md#1-work-backward-from-the-experience):
≈3,000 placements × 2 meshes + ≈600 Layout meshes ≈ 6,600 draws per pass, ≈9 M triangles, 40 PBR
materials with 120 2K maps (2,560 MiB RGBA8), 12 authored lights, and one shadow-casting
directional light that re-renders its casters every frame. The caster count and shadow-map size are
not stated in the source; the row assumes all meshes cast and does not invent a map size. The scene
was not built.

## Notes on the readings

- The saved World's Stage read `programs: 7`; an earlier read of the same view returned 6.
  `renderer.info.programs` grows as the session compiles material variants, so 6–7 is the honest
  range. The visit view read 5.
- `renderer.info.memory.textures` was 3 in the saved-World read while the scene walk found 2
  material textures (512 KiB). The third is renderer-owned (render target or internal), so both
  numbers are kept: 3 GPU textures resident, 2 referenced by the rendered materials.
- Stage draws 6 more than the visit view and 19,734 more triangles. Those are editor-only helpers
  (grid, marks, gizmos) that the visitor view does not present. Materials, lights, shadow casters
  and textures are unchanged.
- The saved World has 32 shadow **casters** but zero shadow-casting **lights**, so no shadow map is
  rendered. Caster count alone is not shadow cost.
- The saved World's 64 draws are about 1 % of the cinematic reference's 6,600, and its 3 lights are
  a quarter of the 12. Today's local World is far below the regime where P2 finds WebGPU's light
  advantage; the reference row is the scale check, not the World.

## Limits

- One current-format saved World was available. Two older Worlds were refused by the product, so
  the sample is one content World plus one blank baseline, not the two or three content Worlds the
  probe ideally wants.
- The visit reading comes from a draft Experience with no Stops in the same World. Preview still
  presents the World; it is a real visitor renderer surface, but it is not a curated 30-stop route.
- Counts are one frame, not an average. They are deterministic for a fixed view, but a different
  camera, culling result or LOD would change them.
- Texture bytes are an estimate from format, dimensions and mipmaps, not a GPU memory query.
- The cinematic row is arithmetic. It has no measured draw count, no measured triangles after
  culling and no measured texture residency.
