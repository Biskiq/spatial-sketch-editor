# World Authoring Prototype

**Current executable World reference**, adopted in place from the P26 Spatial Authoring Prototype
under #112 (2026-10-02). It preserves journeys A–F and their spatial laws while using the accepted
World shell: local Index, dominant Stage, selected identity Card, invoked Look/Details,
Instrument and Precision. [PLATE §0.8](../../docs/reference/design-system/editor-shell-and-visual-system.md#08-accepted-destination-shell--unified-world--experience-direction-2026-10-01-pr-111)
owns destination shell design; this static prototype establishes no production interface or cutover.

```sh
cd prototypes/spatial-authoring
python3 -m http.server 8826
# http://localhost:8826/                 explore; J opens the A–F presenter
# http://localhost:8826/rationale.html   current rationale and specimens
# ?journey=A&step=0&motion=instant       reproducible presenter entry
bash qa/run-all.sh                     # both acceptance axes; private server/browser per axis
bash scripts/shoot.sh                  # regenerate specimens into qa/out/specimens
```

No build step. Three.js is vendored; Google Fonts have system fallbacks. The presenter and
`window.__me` are prototype facilities outside the product interaction model.

- [rationale.html](./rationale.html) — current shell, inherited A–F, intermediate readings and return.
- [IMPLEMENTER-REFERENCE.md](./IMPLEMENTER-REFERENCE.md) — formulas, validators, cancellation,
  navigation/task seams and the limits of these mechanisms.
- [qa/ACCEPTANCE.md](./qa/ACCEPTANCE.md) — acceptance, coverage/harvest and preservation evidence.
- [qa/README.md](./qa/README.md) — current executable checks and their actual proof limits.

Try the Garden window's Look → Unroll, or pull the Rotunda dog-ear and stop anywhere. O unrolls,
S squares up, K defines a Section (arrows slide/turn, −/= depth, Tab side, Enter opens).
Lift a ceiling, preview its gap correction, then U looks up. Measure reaches numbers in place;
P opens Precision. / searches; row verbs distinguish selection from navigation/recovery.
Esc leaves the foremost writer/Precision/task, Back returns one reading, Shift-Esc puts the chain
back. View navigation stays separate from source Undo.

Lens crossing cancels proposals and parks inactive World work. Returning is ordinary. Explicit
Resume validates current identity/targets and invokes from the current standpoint. The Experience
lens is visibly a **read-only continuity fixture**, containing one Presentation referring to the
window: no authoring, Guide/Stop/Deck, Camera capture or visitor Preview. **#113** owns the real V2
Experience executable and both directions of continuity. F and production T1 remain gated.

The predecessor shell, reconciliation and comparisons are preserved in Git; their interaction
rules are harvested into the current reference/tests. The stable phase-local path is a
[forward pointer](../../docs/roadmap/p26-spatial-depth/Final-Design-Prototype/README.md), with no second executable.
