---
name: browser-test-hygiene
description: Rules for any agent that writes or runs an agent-browser / Chromium QA script (prototypes/spatial-authoring/qa is the canonical case): one browser session per script, torn down on every exit path, and the minimum-testing doctrine. In this repo the owner runs the browser acceptance axes — hand over the exact command instead of launching one.
---

# Browser Test Hygiene

Applies to: any script that drives `agent-browser`, and to any plan step that says "run the browser
tests". The prototype harness (`prototypes/spatial-authoring/qa/lib.sh` and the `*-check.sh` axes)
follows these rules; new scripts must too.

## One browser per script, torn down on every exit path

```text
ONE browser session per script
  reuse the session inside the script — startup is paid once per run, not once per assertion
  close it on EVERY exit path: pass, failure, interrupt (trap ... EXIT in the script)
  NEVER `agent-browser close --all` — other threads and agents share this machine
  a driver closes each axis's session before starting the next (qa/run-all.sh does)
```

A browser left running is not harmless. Each leftover Chrome helper holds memory and CPU, and every
later run gets slower until the machine crawls. A script that can exit without its teardown running is
a bug in the script, not a tolerable leak. Before adding a new script, copy `qa/lib.sh`'s trap rather
than inventing teardown again.

## Never fan a suite into sections

A section runner that runs the same script once per screen pays browser startup and server startup for
every copy and leaves one more helper behind — a 7-section runner turns a two-minute axis into twenty
minutes and slows the next run too. A staged axis is **one pass** that establishes and verifies its own
preconditions. If a section runner exists, delete it rather than adapt it.

## Why a pass is slow, and how to keep it short

- Each harness command spawns a CLI process and talks to a live browser. A pass costs roughly
  (evals + pointer ops + key presses) × that per-call latency. Shorten a pass by making **fewer
  calls**, not by waiting less.
- `agent-browser` starts dropping results after roughly **100 evals in one session**, and the drop
  looks like an **empty** result, not a wrong one. Empty is a harness symptom: re-run the axis; never
  "fix" the app because of it.
- Batch reads: one eval per block that returns a JSON blob; assert on the blob in bash. An assertion
  should cost no browser round trip.
- Keys can be delivered **after** the next eval. Key-driven checks wait for the state the key causes
  (poll the blob), and never re-press a toggle "to make sure" — a double press is worse than a wait.
- Preconditions (ordinary state, selection) are established **and verified**, with a retry, so a late
  key from the previous block cannot cascade into the next block's failures.
- Each script serves its own checkout on a private ephemeral port (`http.server 0`). Never reuse
  `8826`: another worktree owns it.

## Minimum testing (owner rule for this repo)

```text
assert only what the change can break — its stage's acceptance row, not the whole product
one pass, one browser, seconds to a couple of minutes per axis
run the axis the change touches while building; the full set only at a stage checkpoint
QA_SHOT=0 unless the stage needs evidence; screenshots are evidence, never assertions
if a run is dragging, cut checks — never let a suite run for tens of minutes
```

## The owner runs the axes

In this repo the owner runs the browser acceptance axes. When a run is needed, stop and hand over the
exact command (`cd prototypes/spatial-authoring && QA_SHOT=0 bash qa/<axis>-check.sh`), say what it
proves, and wait. Do not launch it yourself, and do not leave a browser open for the owner to find.
