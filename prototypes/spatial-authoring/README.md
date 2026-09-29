# Spatial Authoring Prototype

**Durable artifact.** The accepted spatial-authoring / P26 experience reference,
kept at `prototypes/spatial-authoring/`. It was moved here on 2026-09-29 from
`docs/roadmap/p26-spatial-depth/Final-Design-Prototype/`, where it was the P26
*Final Design Prototype*; the family boundary and authority semantics are in
[`../README.md`](../README.md). Its implementation shortcuts stay evidence of
interaction intent and **not** production contracts.

A working prototype of Museum Editor's P26 direction, synthesised from designers B and D: **one museum you move around, open, inspect and edit from whatever standpoint is most useful.**

```sh
cd prototypes/spatial-authoring          # this folder
python3 -m http.server 8826
# http://localhost:8826/                 prototype (press J for guided journeys)
# http://localhost:8826/rationale.html   design rationale
```

No build step. Three.js is vendored in `vendor/`; fonts load from Google Fonts with system fallbacks.

- **[rationale.html](./rationale.html)** — the unified model, complete journeys with intermediate frames, what came from B and D, what changed, departures from today's editor, open technical questions.
- **[REVIEW-RECONCILIATION.md](./REVIEW-RECONCILIATION.md)** — the response to the peer review: which arguments were accepted, rejected or reinterpreted, what the synthesis had lost against B and D, what changed, and what is still not demonstrated. Before/after evidence is in `review/` and `screens/`.
- **[IMPLEMENTER-REFERENCE.md](./IMPLEMENTER-REFERENCE.md)** — for the P26 implementation agent: rules, formulas, state machines and code locations for the hardest interactions (settle, unfold, section preview/part/depth/Reveal, handle drags and refusal, lift and look up, two histories, motion policy).
- `scripts/shoot.sh` — re-renders every screen in `screens/` from live prototype states (needs the server and [agent-browser](https://github.com/vercel-labs/agent-browser)).

Try: select the Garden window and pull the folded corner on the Rotunda's top — stop anywhere — then <kbd>S</kbd> to square up. Or <kbd>O</kbd> for the whole unroll in one move. In Plan, select the window and slide it along the curve. With nothing selected, <kbd>K</kbd> draws a line to open the museum along; slide it before opening. Select a ceiling and drag its tab up, <kbd>U</kbd> looks up. <kbd>/</kbd> finds anything and says why you can't see it. <kbd>Esc</kbd> steps back one level, <kbd>⇧Esc</kbd> puts everything back. <kbd>Shift</kbd> makes any move instant.
