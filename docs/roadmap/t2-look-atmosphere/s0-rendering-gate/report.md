# T2 S0 — Gate A report

**Status:** Gate A (E1–E3) complete, 2026-11-11. Gate B and Gate C are **not authorised** and have
not started. No PR merge authorisation.

This report is the Gate A slice of the §8 S0 report. It is deliberately narrower than the final S0
report; the remaining S0 items stay open.

## Verdicts

| S0 item | Gate A result | Verdict |
| --- | --- | --- |
| 1. Pipeline audit | Output sRGB, working `srgb-linear`, `NoToneMapping`, exposure 1.0, physical light units; readback calibration exact. See [pipeline](./pipeline.md). | **Go**, with the pipeline recorded |
| 7. Artwork colour fidelity | Lambert + `NoToneMapping` reproduces all 18 reference patches exactly (ΔE00 0); standard PBR lifts near-black; ACES/AgX/Neutral fail the mid-tone target. See [artwork fidelity](./artwork-fidelity.md). | **Go with the material constraint** |
| 2. PBR chart / indoor policy | Not started | Gate B |
| 3. Live Sky | Not started | Gate B |
| 4. Performance / D9 | Not started | Gate C |
| 5. Paper / Living | Not started | Gate B |
| 6. Parity | Not started; the snapshot target's linear colour space is a recorded defect risk | Gate B |

## Blocking findings

1. **There was no tone mapping to audit.** Production runs `NoToneMapping` at exposure 1. The gate
   decided not to add one, because every candidate fails artwork fidelity.
2. **The snapshot target is not colour-safe.** It is an `UnsignedByteType` target with no sRGB
   texture colour space; r187 renders it in the linear working space, and the PNG writer treats the
   bytes as sRGB. Do not use snapshots as parity or fidelity evidence until E6 fixes this.
3. **Artwork cannot use the standard PBR material without a visible dark-end lift.** A diffuse-only
   lit material is exact under the neutral reference and still satisfies D16.
4. **The plan's Neutral recommendation is rejected.** This is not a product-promise change; it is the
   measurement doing its job. If Gate B needs a mapper for the Sky, that is an owner D16 decision.

## What is now unblocked

- **S3 Lights** may rely on the light-unit and Brightness-stop record in
  [pipeline.md](./pipeline.md). Shadow defaults remain blocked on Gate C.
- **A1 Artwork** may rely on the colour-fidelity record in
  [artwork-fidelity.md](./artwork-fidelity.md). Placement, formatting, transparency and release
  pinning remain A1's own checks.

## Evidence

- [Contact sheet](./evidence/2026-11-11/gate-a-contact-sheet.png)
- [Machine-readable result](./evidence/2026-11-11/gate-a-result.json)
- Bench: `/dev/render-audit`, source `apps/editor/src/routes/dev/render-audit/`.
- Focused colour-math test: `apps/editor/tests/lib/render/gate-a-audit.test.ts`.
