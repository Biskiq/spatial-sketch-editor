# World interaction sheet assets

> **Covers:** the accepted World visual/interaction sheet, its offline Opening specimen and the G1 Groups specimen.
> **Authority:** visual and interaction evidence only; production code/tests own behavior.

The [World interaction sheet](../world-interaction-sheet.html) is the accepted visual reference for
World drawing, Opening, transforms, Paper/Room labels and Card disclosure. The SVG, local state and
clocks in the sheet are demonstration mechanisms, not Camera/runtime or persisted-format authorities.

`opening.js` imports the real Layout planners, production Plan symbols and refusal wording, then
packages them into `opening.bundle.js` so the sheet opens directly from disk. Keep the source and
bundle together.

`groups.js` draws the *Groups* section (G1): group selection and drill, hover and Erase marks, rigid
group transforms with the support refusal, sets with fine and coarse pointers, the group, member and
set Cards, Index membership, *Group with …* and Showcase. It is a plain script with no build step. It
reuses the sheet's inline drawing helpers, so it loads after them. The
[G1 plan](../../plans/t2-look-atmosphere/g1-groups/implementation-plan.md) §2 owns the rules it
illustrates.

## Rebuild the Opening specimen

From the repository root:

```sh
node -e "require('esbuild').buildSync({entryPoints:['docs/design-system/world-interaction-sheet/opening.js'],bundle:true,minify:true,format:'iife',define:{'import.meta.env.DEV':'false'},outfile:'docs/design-system/world-interaction-sheet/opening.bundle.js'})"
```

Verify the bundle builds, then exercise initialization, Door/Window creation, overlap/bounds refusals,
cancellation, view switching and reset. Browser smoke should cover Plan/3D cutouts, transparent hit
areas, production Door/Window symbols, placement, keyboard sliding and a 390 px layout without
overflow or browser errors. The historical review remains at
`git show 2ca766335:docs/archive/roadmap/r217-core-editor-stability/world-shell-recovery/opening-design-review.md`;
this file owns the live rebuild recipe.
