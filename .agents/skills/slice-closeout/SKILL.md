---
name: slice-closeout
description: Close a shipped roadmap slice deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → archive.

## Procedure

1. Verify implementation/acceptance: run the slice acceptance rows live plus
   `npm test`, `npm run check`, `npm run build` as the plan requires. Record gate numbers.
   Do not rerun already-valid expensive gates when unchanged evidence is
   trustworthy; rerun only when changes invalidate evidence, acceptance
   requires it, or uncertainty exists.
2. Inspect any active checkpoint for that slice: promote durable findings first
   (deferred bug → `operations/tech-debt/`; completed research → owning
   artifact; landed behavior → `reference/*`; verification/rulings →
   closeout/archive; status → phase README), then delete the checkpoint
   and remove any `current.md` RESUME pointer. Do not archive raw checkpoints.
3. Update affected durable reference contracts (`docs/reference/...`) only if the
   slice established or changed durable knowledge future work would otherwise
   rediscover; reconcile/supersede stale claims it invalidates.
   Roadmap proposals must never silently become reference truth; only landed behavior moves.
4. Write/update slice closeout evidence (acceptance record, rulings, residuals).
5. Mark the slice shipped in its phase README (`docs/roadmap/<phase>/README.md`) —
   the phase README owns child status/order and routes each child's exact plan/QA
   artifact directly. Do not create or maintain a slice README/index for status;
   the exact plan stays its own artifact.
6. Update `docs/roadmap/README.md` only if P-level execution/planning/order changed.
7. Update `docs/operations/current.md` to the next work item (baton, not history).
8. Archive the whole completed slice bundle under `docs/archive/roadmap/...`
   and leave a one-line stub in the phase README. Archive is opt-in evidence only.
9. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links: search the repo for every moved path; fix Markdown, HTML/image,
    and prototype relative paths; verify case-sensitive paths.
11. Verify no live router treats archived material as authority
    (`docs/README.md`, `docs/roadmap/README.md`, phase READMEs,
    `docs/operations/current.md`). Run any existing docs/link checks.

Rules: follow `docs/README.md` routing; read minimum necessary context; do not
rewrite product scope, architecture, roadmap order, design decisions, or history
during closeout beyond what the slice shipped. Do not commit unless asked.
