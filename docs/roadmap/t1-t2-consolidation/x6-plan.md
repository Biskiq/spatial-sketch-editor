# X6 Layout manipulation and contributions

Implement section L of the decomposition and X6 of the approved execution schedule.
Baseline is X5's merged adapter (5,460 lines). Characterize the production binding
with the existing Layout adapter suites and extend their parity evidence where needed.

Move captured Wall, curve, Junction, existing Opening, and Room manipulation into
their named binding-scoped owners. Preserve adapter defaults, explicit dispatch
precedence, canonical planners and history, the compile context and candidate
memo. Move read-only contribution projection to its own module. Cross-owner
transitions use typed calls from composition. Keep the public binding unchanged.

Guard dependency direction with the existing import-closure infrastructure.
Verify production dispatch, cancellation and acceptance, E4/X5 retention, the
arch and fast lanes, type checking, build, and the required CI gates. Attempt
focused browser QA. Revert the implementation commit(s) as a unit to roll back.
