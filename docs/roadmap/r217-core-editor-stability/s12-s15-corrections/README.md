# S12–S15 merged-batch corrections — 2026-10-31

**Evidence, not a new slice or a phase acceptance.** Owner-requested repair batch based on
`main` `3b3b28a888f9e382c10618b5db117b1f194df9c0` (PR #234), on
`codex/r217-s12-s15-corrections` in the original worktree. The owner accepted S12 Camera,
S13 drafting, open-chain Finish/Enter, cancellation on tool switch and the 3D datum-footprint
preview. The [phase register](../README.md#slice-register) and S11 final gate are unchanged.
The architecture-cycle exposure window remains closed; this repair is not an exposure slice.
Luna 6 high-effort agents handled bounded inventory, configuration/UI plumbing and verification;
the integrator diagnosed the browser failures and owns the combined changes.

## Causes and corrections

| Report | Cause | Correction / regression evidence |
| --- | --- | --- |
| Fresh Line press-drag has no live preview | Its press anchor entered the deliberate chain only at release; preview planned just the moving point | A transient draft applies the same start rule as release, without writing the click chain. Live length/snap, off-plane withdrawal, cancel and crossing recovery are exercised through the real adapter/F4 host in `layout-candidate-preview.test.ts` |
| Invalid crossing disappears | Refusal withdrew the Wall band and left words alone | Retain one dashed cursor reach and the planner's refusal; no candidate Wall/Opening polygon and no partial acceptance. Right-edge labels stay inside the Stage and clear of the Height Sheet; two mounted label cases cover this |
| Gold stripes and pale affected Walls | SVG stroked each 0.25 m sampled band separately and filled affected polygons | Fill subject bands, stroke their existing union boundary, and publish affected outlines without fill. Candidate/release geometry and four-edge outlines remain tested |
| Empty-start Wall vanishes; hover reveals it | Camera retained the empty source's 1 m radius after source edits: Plan near/far 99/101 clipped the 1.2 m Paper cut while datum hover remained visible | Rebase source bounds and calibrate the declared scene radius about the current target before the one Camera evaluation. Pose/reading/scale are preserved; the empty→first-Wall regression projects datum, cut and top, including after a target change |
| Typed 1,000 m freezes | 4,000 cut bands caused an all-polygons outline scan, then thousands of Paper and selection fill meshes/materials. An outline-only fix still stalled the browser | Existing Plan-box index conservatively narrows the same union predicates. Existing triangulations are batched by ink/order/elevation in renderer buffers. Tests assert exact/rotated four-edge output, bounded indexed work and one fill mesh with every triangle/elevation retained |
| API-off blocks new editing | Minted create intent performed a cloud GET before admitting local work | Create skips cloud reads and admits empty through the existing source path, guarded by session epoch. Explicit opens retain missing/forbidden/network errors. Starter remains a guarded Find replacement; pending-save resume is preserved |
| External identity dependency | Google OIDC was the only login issuer | Local username/password registration/login and authenticated credential enrollment, PostgreSQL credentials, salted async scrypt, secure sessions, origin protection, persistent attempt limits and bounded hashing work. Provider code, dependency, routes and config are removed |

The outline and fill changes consume the existing compiler/Plan drawing; they introduce no
architectural reconstruction, navigation graph, pose interpolation or authored/session fields.
The [architecture](../../../reference/architecture.md) and
[persistence contract](../../../reference/components/persistence.md) describe the cutover.

## Verification

Final commands passed:

- `npm test`: **254 files / 3,247 tests**, zero skips.
- `npm run test:arch`: **23 files / 194 tests**, zero skips; renderer importer list explicitly
  includes the buffer-batching helper. Documentation references also pass after adding this record.
- `npm run test:heavy`: **11 files / 138 tests**, zero skips.
- `npm run check`: **0 errors / 0 warnings**; all four shared-package checks pass
  (`check:camera-core`, `check:layout-core`, `check:geometry-core`, `check:project-model`).
- `npm run check:api`, `npm run build:api`, `npm run build`: pass.
- `DATABASE_URL=postgresql://biskiq:biskiq@localhost:5433/biskiq npm run test:api`:
  **119 tests across 15 files**, zero skips. Auth integration uses a random isolated schema;
  no shared database reset. Registration/login/logout, salts, uniqueness, invalid input,
  generic failures, origin refusal, rate/concurrency limits, removed redirect routes and legacy
  enrollment/ownership are covered.
- Post-guard mounted boot, source replacement and resume-save suites: **32/32**.
- `git diff --check`: clean.

Chromium journeys used a task-owned agent-browser session and a production preview, not a test
facade. API-off points to an unserved port; API-on uses an isolated API listener, the local
Compose PostgreSQL database and real credentialed HTTP. JSON Save/Load was exercised; real R2
asset upload was not part of these journeys.

1. API off: `/editor` mounts empty without authentication, Plan and 3D remain usable, first drag
   previews before release, deselection leaves black Paper ink, typed oblique length 1,000 m
   completes, and one Undo restores the prior 6.33142238071932 m. Save reports cloud failure
   without replacing the draft.
2. API on: new guest workspace → draw Wall → Save → local registration → explicit Resume pending
   Save → Saved. Sign out → username/password login → My Projects → Open restores the same Wall
   id and Junction coordinates. Saved source identity before and after reopen:
   `sha256-af9ea0b73155527f4a842fa93ddf51f64841983a0bd24be47ec17fb055207a99`.
3. Selected Wall body drag in Plan and 3D publishes a four-edge datum preview and commits once;
   one Undo restores Saved. Reading changes keep the selection/source and orientation. Guarded
   starter replacement, click anchor/hover, refused crossing, recovery to a valid leg and Esc
   cancellation were exercised without an extra Wall or history entry.
4. Live preview/refusal legibility was inspected at **1440×900, 1280×800, 1180×820 and 820×1180**.
   Screenshots below show the actual current palette; they make no S23 redesign claim.

## Password minimum follow-up

The owner's follow-up lowered the minimum to **8 characters**, retaining the 128-character
maximum. The API credential parser, login/register/enrollment form, HTML constraints and help
text agree. The DB-backed register, enrollment and login journey runs with an exactly
8-character password and rejects 7 characters; mounted form tests cover the same boundary.
Existing hashes, sessions and ownership need no migration.

## Visual scope and remaining decisions

- **S18** changes selection tint/edge calibration. Selected-mesh tint/edge styling stays for that
  slice; candidate seams and affected fills were separate defects and are corrected here.
- **S19** owns the 3D grid cutoff/clipping; unchanged.
- **S23** owns the Ink palette/container and constrained shell overhaul; unchanged, including the
  existing large palette and shell calibration. No palette redesign is smuggled into this repair.
- Existing `users.id` and every ownership FK remain byte-for-byte unchanged. A still-valid legacy
  session may enroll local credentials against its original id. **Owner decision recorded in this
  chat:** preserve ownership and leave signed-out legacy recovery as an explicit follow-up. There
  is no email/username-based claim, reassignment, data deletion or external identity fallback.
- Native touch/coarse hardware, Safari and the complete cross-domain S11 journeys remain S11's;
  this batch does not accept that final gate or close the phase.

## Captures

Captures are from this repair worktree before commit. The long-Wall capture includes buffer
batching; the later label-placement change affects only text placement. The four width captures
and 3D body preview include the final label behavior. No screenshot proves animation continuity
or the numerical/ownership assertions above; tests and the HTTP journey own those claims.

- [Live Line drag, 1440](./evidence/live-line-1440.png)
- [Oblique 1,000 m edit, 1440](./evidence/1000m-oblique-1440.png)
- [3D body-drag footprint, 1440](./evidence/body-preview-3d-1440.png)
- [Local registration and resumed Save, 1440](./evidence/local-auth-saved-1440.png)
- [Refused crossing with retained reach, 1440](./evidence/refusal-1440.png)
- [Live preview, 1280](./evidence/preview-1280.png)
- [Live preview, 1180](./evidence/preview-1180.png)
- [Live preview, 820 portrait](./evidence/preview-820.png)

## PR #236 local follow-up

The resumed PR keeps the measured 1,000 m envelope and the existing local-auth ownership model.
Exact 1,000 m edits pass; edits just over the boundary refuse without changing source/history.
Canonical reads and Stage admission refuse imported over-limit Wall spans, Wall heights and
Opening measures before geometry compilation. Local database tests retain the stable legacy
`google:<id>` owner and access to its existing project after credential enrollment/login.

Authentication verification covers the 15-minute source and source-plus-username budgets, expired
window reset, concurrent failures and mixed login/registration at the final source slot across two
API app instances. Forwarded addresses are ignored by default and used only when the simulated
local proxy peer matches configured `TRUST_PROXY` addresses. The independent review's P2 findings
were fixed: mixed auth actions now share a source lock, the Wall-height contract matches the shared
limit, and imported Wall height/Opening measure refusals have admission coverage. The follow-up
review reported no remaining P0–P2 findings.

Local verification for the resumed PR:

- `npm test`: **255 files / 3,260 tests**, all passed.
- `npm run test:arch`: **23 files / 194 tests**, all passed.
- `npm run test:heavy`: **11 files / 138 tests**, all passed.
- `DATABASE_URL=postgresql://biskiq:biskiq@localhost:5433/biskiq npm run test:api`:
  **128 tests across 15 files**, all passed against local PostgreSQL.
- Editor, API and all four shared-package checks passed; editor and API builds passed.
- `git diff --check` passed. The force-updated PR branch contains no `.cloud-attachments` paths.

No live service or provider integration was checked. The Render-specific proxy Blueprint entry was
removed from this PR; proxy trust remains an optional generic API setting for local simulation.
