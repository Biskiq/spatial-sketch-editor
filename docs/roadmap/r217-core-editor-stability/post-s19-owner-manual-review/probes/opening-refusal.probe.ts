/** PR #247 probe: what does the Opening drag path put on the Stage when its planner refuses? */
import { it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, mintLayoutIdCapture, planCreateWallFirstOpening, planUpdateWallFirstOpening, planWallChain } from '@portfolio/layout-core';

it('prints the planner message the adapter shows raw', () => {
	const base = createEmptyWallFirstLayoutDocument();
	const chain = planWallChain({ baseline: base, points: [[0, 0], [5, 0]], close: false, height: 3, capture: mintLayoutIdCapture(), levelId: base.floor.id });
	if (chain.kind !== 'success') throw new Error('chain');
	const door = planCreateWallFirstOpening(chain.document, { wallId: chain.document.walls[0]!.id, kind: 'door', offset: 1, width: 0.9, height: 2.1, sillHeight: 0 }, mintLayoutIdCapture(), chain.document.floor.id);
	if (door.kind !== 'success') throw new Error('door');
	const id = door.document.openings[0]!.id;
	for (const update of [{ offset: 4.8 }, { width: 8 }, { offset: -1 }]) {
		const planned = planUpdateWallFirstOpening(door.document, id, update);
		console.log(JSON.stringify({ update, kind: planned.kind, code: planned.kind === 'rejected' ? planned.rejection.code : null, message: planned.kind === 'rejected' ? planned.rejection.message : null }));
	}
});
