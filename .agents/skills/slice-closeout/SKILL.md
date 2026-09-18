---
name: slice-closeout
description: Close a shipped roadmap slice deterministically. Use when a slice implementation is complete, after tests pass, or when the user says close out the slice, ship the slice, or archive the slice.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → archive.

## Procedure

1. Verify implementation/acceptance: run the slice acceptance rows live plus
   `npm test`, `npm run check`, `npm run build` as the plan requires. Record gate numbers.
2. Update affected durable reference contracts (`docs/reference/...`). Roadmap
   proposals must never silently become reference truth; only landed behavior moves.
3. Write/update slice closeout evidence (acceptance record, rulings, residuals).
4. Mark slice shipped in its phase README (`docs/roadmap/<phase>/README.md`).
5. Update `docs/roadmap/README.md` only if P-level execution/planning/order changed.
6. Update `docs/operations/current.md` to the next work item (baton, not history).
7. Archive the whole completed slice bundle under `docs/archive/roadmap/...`
   and leave a one-line stub in the phase README. Archive is opt-in evidence only.
8. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
9. Repair links: search the repo for every moved path; fix Markdown, HTML/image,
   and prototype relative paths; verify case-sensitive paths.
10. Verify no live router treats archived material as authority
    (`docs/README.md`, `docs/roadmap/README.md`, phase/slice READMEs,
    `docs/operations/current.md`). Run any existing docs/link checks.
11. Checkpoint cleanup: no active checkpoint may remain for that slice.
    Promote durable findings first (deferred bug → `operations/tech-debt/`;
    completed research → owning artifact; landed behavior → `reference/*`;
    verification/rulings → closeout/archive; status → phase/slice README),
    then delete the checkpoint and remove any `current.md` RESUME pointer.
    Do not archive raw checkpoints.

Rules: follow `docs/README.md` routing; read minimum necessary context; do not
rewrite product scope, architecture, roadmap order, design decisions, or history
during closeout beyond what the slice shipped. Do not commit unless asked.
