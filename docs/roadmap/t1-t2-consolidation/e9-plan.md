# E9 Artwork and remaining world materials

Implements E9 of the [execution schedule](./execution-schedule.md) (R5 artwork and the rest of R2c in
[slices](./slices.md); keys from [renderer-refactor](./renderer-refactor.md) §2.3–2.5). E7 and E8 are
merged. Delete this plan before final merge.

## Shape

- **Description.** `describeSceneRender` also emits one frozen artwork item per Artwork: image
  identity, resolved frame layout numbers, colours and placement. No Three, no store.
- **Geometry.** The geometry store gains three keyed specs: `artwork-frame:` (outer size, face,
  depth), `artwork-mat:` (outer and inner size) and `artwork-backing:` (size). The image surface uses
  the existing `unit:plane`. A artworks of s distinct framed sizes hold 1 + 3·s buffers.
- **Materials.** The material store gains `lambert`, `depth` and `distance` descriptor kinds, and
  `basic` gains `vertexColors`/`depthWrite`. Artwork surfaces key their map by the loaded texture's
  identity, so equal images share one material and a replaced source can never reuse a stale one.
- **Handler.** `scene-artwork-representation.ts` realizes artwork items as retained groups under the
  Scene representation root. Placement edits move the group; body edits rebuild leases; a source
  edit releases the image lease and redraws on arrival, as the component did. Artwork stays out of
  the pick registry, as today. The Stage placement ghost is the same handler with a ghost flag.
- **Retired.** `EntityArtwork.svelte`. Environment ground, the paper ground and `GroundPlinth`
  acquire from the store through one small attach component.

## Alpha exception

Moving `alphaTest` onto the surface would discard alpha < 0.5 texels in the colour pass, which the
blended surface draws today, so the colour image is not identical. The custom depth/distance
materials stay. They are built by the store now. The portability allowlist entry moves to the
handler with the same two tokens.

## Verification

Count tests on identical fixtures (sizes × profiles, transparent, ghost), lease and arrival tests
(stale replacement, disposal, scope change), material property parity against the removed
component's values, and updated architecture guards. Then the fast and arch lanes, `check`, `build`
and focused Stage/Preview QA if the browser allows it.

## Rollback

Revert the artwork handler and resources together. The environment/plinth acquisition and store
kinds can stay.
