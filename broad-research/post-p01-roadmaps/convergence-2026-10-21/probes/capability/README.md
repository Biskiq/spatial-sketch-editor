# RR-3/5/6 capability probes — disposable harness

Research evidence for [capability-aware-interaction.md](../../capability-aware-interaction.md) §Step 2 results.
Not a product test, not a contract, not authority. Delete freely after reconciliation.

- **Source revision:** `ce9b7156` (docs-only over evidence baseline `78cafc3a`; no inspected source changed).
- **Environment:** macOS (Darwin 24.6.0), Node v26.7.0, Python 3.13.1, installed `three@0.186.1`,
  `@gltf-transform/{core,extensions,cli}@4.4.1`, Vitest 3.2.7. No downloads, no new dependencies, no browser.
- **Isolation:** `vitest.config.ts` roots at this directory and includes only `*.probe.ts`; product lanes include
  `apps/editor/tests/**/*.{test,spec}.{js,ts}` only. Vite cache goes to the OS temp dir.

## Reproduce (from the repository root)

```sh
sh broad-research/post-p01-roadmaps/convergence-2026-10-21/probes/capability/run.sh
```

| File | Purpose |
| --- | --- |
| `glb_audit.py` | Probe 1: stdlib GLB/glTF JSON-chunk audit (magic/version/chunk asserted; nodes, groups, empties, TRS/matrix, duplicate names, extras, extensions, clip channel targets, variants, skins, morphs) |
| `make_fixture.mjs` | Probe 2: writes `fixtures/part-specimen.glb` (7 nodes: group root, Body with variants + extras, LidHinge pivot → Lid, two `Foot` nodes sharing one mesh, empty `Anchor.Dial` with extras; clip `LidOpen`) |
| `run.sh` | Full reproduction, including the repo's own `normalize-asset.sh` P24A recipe and single gltf-transform steps into `out/` |
| `loader.probe.ts` | Probe 2 loader column: what three's GLTFLoader exposes and what a SkeletonUtils clone keeps |
| `addressing.probe.ts` | Probe 3 (bounded) + 4/5 channel half: F.1 component refusal; F.3 negotiation with a research-only `scene.part-emphasis@1` family |
| `lifecycle.probe.ts` | Probes 4/5 interpreter + Camera tickets: Guide-free Presentation, stale/cancel/reset/re-entry/rebase |

## Hashes (SHA-256)

| Artifact | Hash |
| --- | --- |
| `fixtures/part-specimen.glb` (2612 B; `gltf-transform validate`: 0 errors, 0 warnings; regenerates byte-identically) | `48a24ffc4a6d2798022e4ae9015da8eb0948460b53b8eba0dad6412c91998bee` |
| `out/normalize/model.glb` (repo P24A recipe) | `4b48926365cbf3202ce714f13dc4f8e5f4413e65ab3b569684c64926e23b24af` |
| `out/prune.glb` | `89e1dcd68fb94617ec3c0a9ca2b674b12a0742d5e029db6d52cc2b798fea4572` |
| `out/flatten.glb` | `5f64d289691cbc2a6827d051b91b1eccb34b981bc1ca517b9a5917dd6739b4e6` |
| `out/join.glb` | `d4618f7dab9419285d7aa53b310ade710d30b09bcce59f78963d3ad63b0c230a` |
| `out/optimize-default.glb` | `8015f38b9e1b6362318fb88a88c51693e4201910cc77eef4d8610164759222b6` |
| `out/part-preserving.glb` (prune `--keep-leaves true`, dedup `--meshes false`, center) | `a599c8b4a57156e677cd70ae3f629c269185e200e9e79edb7adde8770b35f5de` |

Results, traces and their interpretation live in the packet, not here. Last run: 3 files, 10 probes passed
(each assertion encodes the observed result, including observed gaps).
