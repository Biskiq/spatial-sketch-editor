import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	planWallRoleChange,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { hostWallAtSpan } from '../../helpers/angled-plan-fixtures';

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];
const RECT = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)] as const;

function commitChain(
	baseline: LayoutDocumentWallFirst,
	points: readonly (readonly [number, number])[],
	role: 'boundary' | 'partition',
	close = false,
	/** P23B.3a S6 — the DECLARED connection (array index = draft point index). */
	connection?: { hosts?: readonly string[] }
): LayoutDocumentWallFirst {
	const hostSnaps = (connection?.hosts ?? []).map((wallId, index) => ({ pointIndex: index, wallId }));
	const plan = planWallChain({
		baseline,
		points: [...points] as [number, number][],
		role,
		close,
		...(hostSnaps.length > 0 ? { endpointHostSnaps: hostSnaps } : {})
	});
	if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
	return plan.document;
}

function expectRejected(plan: ReturnType<typeof planWallRoleChange>, code: string) {
	if (plan.kind !== 'rejected') throw new Error(`expected rejection ${code}, got success`);
	expect(plan.rejection.code).toBe(code);
	return plan;
}

describe('P23.6 wall role change — rejections', () => {
	it('rejects unknown walls, invalid roles, and no-ops without touching the document', () => {
		const document = commitChain(baseDocument(), RECT, 'boundary', true);
		const input = JSON.stringify(document);
		expectRejected(planWallRoleChange(document, 'wall:missing', 'partition'), 'unknown_wall');
		expectRejected(
			planWallRoleChange(document, document.walls[0]!.id, 'ceiling' as never),
			'invalid_role'
		);
		expectRejected(planWallRoleChange(document, document.walls[0]!.id, 'boundary'), 'no_op');
		expect(JSON.stringify(document)).toBe(input);
	});
});

describe('P23.6 wall role change — boundary to partition', () => {
	it('keeps the physical Wall while retiring the unclosable Room', () => {
		const document = commitChain(baseDocument(), RECT, 'boundary', true);
		const roomId = document.rooms[0]!.id;
		const wallId = document.walls[0]!.id;
		const plan = planWallRoleChange(document, wallId, 'partition');
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.walls.find((wall) => wall.id === wallId)?.role).toBe('partition');
		expect(plan.document.walls).toHaveLength(4);
		expect(plan.document.junctions).toHaveLength(4);
		expect(plan.document.rooms).toHaveLength(0);
		expect(plan.retiredRoomIds).toEqual([roomId]);
		expect(plan.lineage).toEqual([]);
		// Input purity: the baseline still carries the Room.
		expect(document.rooms).toHaveLength(1);
	});
});

describe('P23.6 wall role change — partition to boundary', () => {
	it('flips a freestanding Wall with no supported topology and births no Room', () => {
		const document = commitChain(baseDocument(), [p(0, 0), p(4, 0)], 'partition');
		const wallId = document.walls[0]!.id;
		const plan = planWallRoleChange(document, wallId, 'boundary');
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.walls.find((wall) => wall.id === wallId)?.role).toBe('boundary');
		expect(plan.document.rooms).toHaveLength(0);
		expect(plan.lineage).toEqual([]);
	});

	it('births a Room when the flip closes a partition ring', () => {
		let document = commitChain(baseDocument(), RECT, 'partition', true);
		expect(document.rooms).toHaveLength(0);
		const wallIds = document.walls.map((wall) => wall.id);
		for (const [index, wallId] of wallIds.entries()) {
			const plan = planWallRoleChange(document, wallId!, 'boundary');
			if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
			document = plan.document;
			expect(document.rooms).toHaveLength(index === wallIds.length - 1 ? 1 : 0);
		}
		expect(document.walls.every((wall) => wall.role === 'boundary')).toBe(true);
	});

	it('splits a Room when a partition divider flips to boundary', () => {
		const roomed = commitChain(baseDocument(), RECT, 'boundary', true);
		const roomId = roomed.rooms[0]!.id;
		// P23B.3a S6 — the divider's ends land on the Room's own bottom and top Walls,
		// and the operation DECLARES those hosts (the wall-span snap an author's click
		// expresses). Extending the enclosure's group is what makes the later flip a
		// genuine 1→2 instead of flipping a freestanding Wall beside the Room.
		const divided = commitChain(roomed, [p(2, 0), p(2, 3)], 'partition', false, {
			hosts: [hostWallAtSpan(roomed, p(2, 0))!, hostWallAtSpan(roomed, p(2, 3))!]
		});
		expect(divided.rooms).toHaveLength(1);
		const dividerId = divided.walls.find((wall) => wall.role === 'partition')!.id;
		const plan = planWallRoleChange(divided, dividerId, 'boundary');
		if (plan.kind !== 'success') throw new Error(`expected success: ${JSON.stringify(plan)}`);
		expect(plan.document.rooms).toHaveLength(2);
		// P23.8 split correspondence: the predecessor survives on one face and
		// the other face is born — retirement stays empty.
		expect(plan.document.rooms.map((room) => room.id)).toContain(roomId);
		expect(plan.retiredRoomIds).toEqual([]);
		expect(plan.lineage).toHaveLength(1);
		// The divider survives under its own ID and every boundary now participates.
		expect(plan.document.walls.find((wall) => wall.id === dividerId)?.role).toBe('boundary');
	});
});

