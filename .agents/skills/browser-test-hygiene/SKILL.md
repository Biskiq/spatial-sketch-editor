---
name: browser-test-hygiene
description: Rules for any agent that writes or runs an agent-browser / Chromium QA script (prototypes/spatial-authoring/qa is the canonical case): one browser session at a time, closed as soon as its work is done, and the batching that keeps a pass short. The agent runs the axes; handing the command over is not a substitute.
---

# Browser Test Hygiene

Applies to: any script that drives `agent-browser`, and to any plan step that runs browser tests. The
prototype harness (`prototypes/spatial-authoring/qa/lib.sh` and the `*-check.sh` axes) follows these
rules; new scripts must too.

## The one rule: close the session when its work is done

```text
one session at a time
  launch once per script, reuse it for every command in that script
  close it as soon as the script's work is done, on EVERY exit path — pass, failure, interrupt
  (trap ... EXIT) — and always before launching the next session
  NEVER `agent-browser close --all` — other threads and agents share this machine
  a driver (qa/run-all.sh) closes each axis's session before starting the next
```

That is the whole of the hygiene: a fresh browser per run is fine, a browser left alive after its run
is not. Each leftover Chrome helper holds memory and CPU, and everything gets slower until a
two-minute axis takes an hour. A script that can exit without closing its own session is a bug in the
script — copy `qa/lib.sh`'s trap rather than inventing teardown again.

## One pass, never a fan-out

Running the same script once per screen "so it can be re-run a piece at a time" pays browser and
server startup for every copy and leaves one more helper behind: a 7-section runner turns a
two-minute axis into twenty minutes. A staged axis is **one pass** that establishes and verifies its
own preconditions. If a section runner exists, delete it rather than adapt it.

## Why a pass is slow, and how to keep it short

- Each harness command spawns a CLI process and talks to a live browser. A pass costs roughly
  (evals + pointer ops + key presses) × that per-call latency — far slower than an in-process unit
  test, by construction. Shorten a pass by making **fewer calls**, not by waiting less.
- **Keys are the sharp edge, measured on 2026-10-01.** `agent-browser press <printable key>` leaves the
  key held: the page receives thousands of keydowns a second forever, so the key's command re-runs at
  every later state change — a reading that keeps re-opening after every close is the symptom, and it
  also burns CPU for the whole run. Dispatch the keydown for printable keys (`qa_press` does), and know
  that with a live knife aim `press` hangs ~30 s and drops the key (`qa_key_dispatch` for that case).
- A command that hangs or is dropped comes back as **empty**, not wrong. Empty is a harness symptom:
  re-run the axis; never "fix" the app because of it. It is not a count — 220 plain evals in one
  session returned clean in 6 seconds, so an eval budget is the wrong thing to tune.
- Batch reads: one eval per block that returns a JSON blob; assert on the blob in bash. An assertion
  should cost no browser round trip.
- Keys can be delivered **after** the next eval. Key-driven checks wait for the state the key causes
  (poll the blob), and never re-press a toggle "to make sure" — a double press is worse than a wait.
- Preconditions (ordinary state, selection) are established **and verified**, with a retry, so a late
  key from the previous block cannot cascade into the next block's failures.
- Each script serves its own checkout on a private ephemeral port (`http.server 0`). Never reuse
  `8826`: another worktree owns it.

## Minimum testing

```text
assert only what the change can break — its stage's acceptance row, not the whole product
one pass, one browser, seconds to a couple of minutes per axis
run the axis the change touches while building; the full set only at a stage checkpoint
QA_SHOT=0 unless the stage needs evidence; screenshots are evidence, never assertions
if a run is dragging, cut checks — never let a suite run for tens of minutes
```

## Run the axes yourself

The agent runs the axes; handing the command to the owner is not a substitute for a run, and a slow
suite is fixed by making it smaller and self-closing, not by passing it on.
