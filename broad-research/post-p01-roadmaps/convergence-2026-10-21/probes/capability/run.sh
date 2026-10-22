#!/bin/sh
# RR-3/5/6 capability probes — full reproduction. Run from the repository root.
# Uses only installed tools (@gltf-transform/cli 4.4.1, three 0.186.1, vitest 3.2.7); no downloads.
set -eu
P=broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/capability
C=node_modules/.bin/gltf-transform

# Probe 1 — repository asset audit (all tracked GLB/glTF).
python3 -I "$P/glb_audit.py" $(git ls-files '*.glb' '*.gltf')

# Probe 2 — synthesize the positive part/capability fixture and validate it.
node "$P/make_fixture.mjs"
"$C" validate "$P/fixtures/part-specimen.glb" | grep -E 'errors|warnings' || true

# Source -> derivative loss: the repository's own P24A recipe, its single steps, the default
# optimizer (the catalogue checklist's merge/meshopt route), and a part-preserving variant.
rm -rf "$P/out" && mkdir -p "$P/out"
sh apps/editor/assets-source/pipeline/normalize-asset.sh "$P/fixtures/part-specimen.glb" furniture-floor 1 "$P/out/normalize"
"$C" prune   "$P/fixtures/part-specimen.glb" "$P/out/prune.glb"   > /dev/null 2>&1
"$C" flatten "$P/fixtures/part-specimen.glb" "$P/out/flatten.glb" > /dev/null 2>&1
"$C" join    "$P/fixtures/part-specimen.glb" "$P/out/join.glb"    > /dev/null 2>&1
"$C" optimize "$P/fixtures/part-specimen.glb" "$P/out/optimize-default.glb" > /dev/null 2>&1
"$C" prune "$P/fixtures/part-specimen.glb" "$P/out/pp1.glb" --keep-leaves true > /dev/null 2>&1
"$C" dedup "$P/out/pp1.glb" "$P/out/pp2.glb" --meshes false > /dev/null 2>&1
"$C" center "$P/out/pp2.glb" "$P/out/part-preserving.glb" --pivot below > /dev/null 2>&1
rm -f "$P/out/pp1.glb" "$P/out/pp2.glb"
python3 -I "$P/glb_audit.py" "$P/fixtures/part-specimen.glb" "$P/out/normalize/model.glb" "$P/out/prune.glb" \
  "$P/out/flatten.glb" "$P/out/join.glb" "$P/out/optimize-default.glb" "$P/out/part-preserving.glb"

# Probes 2 (loader), 3 (bounded addressing), 4/5 (lifecycle) — deterministic Node traces.
(cd apps/editor && npx vitest run --config "../../$P/vitest.config.ts")
