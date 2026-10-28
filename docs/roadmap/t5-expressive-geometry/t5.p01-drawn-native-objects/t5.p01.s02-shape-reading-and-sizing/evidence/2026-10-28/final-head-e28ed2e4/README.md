# T5.P01.S02 final-head validation evidence

Captured from `/tmp/t5-p01-s02-validation.Cnv145` on 2026-10-28. This is raw validation evidence for reviewed product head `e28ed2e4f65c382af863fd9ac32b586db7f910ec`; it does not record owner acceptance or replace S03's exhaustive final gate.

The browser run identifies the same full revision in its JSON. It contains the final Plan Height repair scenario. Validation results recorded by the coordinator: full `npm test`, 229 files / 2,907 tests passed; unconditional arch, 23 files / 188 tests passed; root check, 0 errors and 0 warnings; root build passed; Layout, project-model and Camera checks passed; API check/build passed; DB-backed API, 6 passed / 0 skipped; Chromium, 3 specs passed with 21 passed scenario rows and one intentional Preview-availability not-run.

`browser/` contains the browser JSON, machine facts, run metadata and screenshots. `logs/` contains the raw command logs. `browser/artifacts/.last-run.json` is retained as emitted. The screenshot that covers the final Plan Height fix is `browser/t5-s02-07b-plan-height-size.png`.

The original S02 UX record at `../../../../acceptance.md` describes the earlier `86595afe` run. This evidence supersedes its validation numbers where affected; it does not silently rewrite or invalidate the separately retained historical browser run. No performance benchmark was run or authorized; suspended performance rows remain unmeasured and are not acceptance passes.

File SHA-256 values are recorded in `SHA256SUMS` for the copied source artifacts (excluding this README and the manifest itself).
