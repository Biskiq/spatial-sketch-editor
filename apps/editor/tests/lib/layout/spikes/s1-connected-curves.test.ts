import { describe, expect, it } from 'vitest';
import {
	CLOSED_WALL_CIRCLE_ACCURACY,
	cubicBezierArcLength,
	cubicBezierPoint,
	isClosedWall,
	orientedWallChainKnotsAndSpans,
	parseWallFirstLayoutDocumentJson,
	planCreateWallFirstOpening,
	planDeleteWall,
	planDuplicateIsolatedRoom,
	planMoveWallFirstOpening,
	planResizeClosedWallRadius,
	planWallChain,
	planWallFirstRoomMove,
	planWallSplit,
	readClosedWallCircle,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	wallCubicChain,
	wallFirstWallLength,
	type CubicBezierShape,
	type LayoutVec2
} from '@portfolio/layout-core';
import { AuthoringHistory, type HistoryState } from '$lib/authoring/f4/history';
import {
	accepted, attach, attachmentDistances, boundary, capture, circle, clearRound, cubics, gate,
	nodingIds, point, radialScale, reconcileFixture, repackCircle, resize, resolveInside, splitAt,
	stageFirstSplit, stripAnnex, wall, type InsideRef, type State
} from './s1-connected-curves';

function connected() {
	const seed = circle();
	const first = attach(seed.state, seed.wallId, 0);
	const second = attach(first.state, first.nextWallId, 1);
	return { ...seed, first, second };
}

function closePoint(actual: LayoutVec2, expected: LayoutVec2) {
	expect(Math.hypot(actual[0] - expected[0], actual[1] - expected[1])).toBeLessThan(1e-11);
}

function expectTransformedCubics(
	before: CubicBezierShape[],
	after: CubicBezierShape[],
	transform: (point: LayoutVec2) => LayoutVec2
) {
	expect(after).toHaveLength(before.length);
	for (const [index, span] of before.entries()) {
		for (const key of ['start', 'handleOut', 'handleIn', 'end'] as const) {
			closePoint(after[index]![key], transform(span[key]));
		}
	}
}

// Production Layout bytes plus a test-only snapshot envelope for the future fact.
function encode(state: State): string {
	return JSON.stringify({
		layout: serializeWallFirstLayoutDocument(state.layout), roundByRoom: state.roundByRoom
	});
}

function decode(json: string): State {
	const { layout, roundByRoom } = JSON.parse(json) as { layout: string; roundByRoom: State['roundByRoom'] };
	const parsed = parseWallFirstLayoutDocumentJson(layout);
	if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
	return { layout: parsed.document, roundByRoom };
}

function historyEntry(state: State, operationId: string): HistoryState<State> {
	const canonicalJson = encode(state);
	return { source: decode(canonicalJson), canonicalJson, operationId,
		sourceContentId: canonicalJson, blockingIssues: [], correspondence: [] };
}

function record(history: AuthoringHistory<State>, after: State, operation: string) {
	const before = history.current.canonicalJson;
	const depth = history.depth;
	const entry = historyEntry(after, operation);
	expect(entry.canonicalJson).not.toBe(before);
	history.push(entry);
	expect(history.depth).toBe(depth + 1);
	expect(encode(history.undo()!.source)).toBe(before);
	expect(encode(history.redo()!.source)).toBe(entry.canonicalJson);
}

function expectCarrier(state: State, roomId: string, name: string, radius: number, center: LayoutVec2) {
	expect(state.layout.rooms.find((room) => room.id === roomId)?.name).toBe(name);
	expect(state.roundByRoom[roomId]).toEqual({ radius, center });
}

describe('T1 S1 connected curves evidence', () => {
	it('1 — splits the persisted cubic locus exactly and meets the circle budget at 1, 2 and 4 attachments', () => {
		const seed = circle();
		let { state, wallId: hostId } = seed;
		const authored = state.roundByRoom[seed.roomId]!;
		const limits = CLOSED_WALL_CIRCLE_ACCURACY;
		for (const [index, distance] of attachmentDistances.entries()) {
			const before = cubics(state.layout, hostId);
			const { spanIndex, t, promotedKnotId } = splitAt(state.layout, hostId, distance);
			expect(promotedKnotId).toBeUndefined(); // Test true interior cubic cuts.
			const next = attach(state, hostId, index);
			const { layout } = next.state;
			const left = cubics(layout, hostId);
			const right = cubics(layout, next.nextWallId);
			expect(left.slice(0, -1)).toEqual(before.slice(0, spanIndex));
			expect(right.slice(1)).toEqual(before.slice(spanIndex + 1));
			for (let sample = 0; sample <= 64; sample++) {
				const u = sample / 64;
				closePoint(cubicBezierPoint(left.at(-1)!, u), cubicBezierPoint(before[spanIndex]!, u * t));
				closePoint(cubicBezierPoint(right[0]!, u), cubicBezierPoint(before[spanIndex]!, t + u * (1 - t)));
			}
			const refs = boundary(layout, seed.roomId);
			expect(refs).toHaveLength(index + 2); // Retained seam plus one Junction per attachment.
			expect(layout.walls.filter((entry) => !refs.some((ref) => ref.wallId === entry.id)
				&& (entry.startJunctionId === next.junctionId || entry.endJunctionId === next.junctionId))).toHaveLength(1);
			const ring = refs.flatMap(({ wallId, direction }) => {
				expect(isClosedWall(wall(layout, wallId))).toBe(false);
				return cubics(layout, wallId, direction);
			});
			let radialError = 0;
			for (const span of ring) {
				for (let sample = 0; sample <= 256; sample++) {
					const [x, z] = cubicBezierPoint(span, sample / 256);
					radialError = Math.max(radialError, Math.abs(Math.hypot(x, z) - authored.radius));
				}
			}
			const length = ring.reduce((sum, span) => sum + cubicBezierArcLength(span), 0);
			const lengthError = Math.abs(length - 2 * Math.PI * authored.radius);
			expect(radialError).toBeLessThan(limits.maxRadialError);
			expect(lengthError).toBeLessThan(limits.maxLengthError);
			console.info(`S1 ${index + 1} attachments, ${refs.length} arcs: radial error ${radialError.toExponential(6)} m, length error ${lengthError.toExponential(6)} m`);
			state = next.state;
			hostId = next.nextWallId;
		}
	});

	it('2 — preserves the named Room through attach, Opening edits, resize, group move, copy and detach with Undo/Redo', () => {
		const { state, roomId, wallId, first, second } = connected();
		const originalRoom = state.layout.rooms[0]!;
		const name = originalRoom.name;
		const round = state.roundByRoom[roomId]!;
		const history = new AuthoringHistory(historyEntry(state, 'seed'));
		for (const [step, next] of [['attach-1', first.state], ['attach-2', second.state]] as const) {
			expectCarrier(next, roomId, name, round.radius, round.center);
			record(history, next, step);
		}
		expect(second.state.layout.rooms).toHaveLength(2);
		const annex = second.state.layout.rooms.find((room) => room.id !== roomId)!;
		const shared = boundary(second.state.layout, roomId).filter((ref) =>
			annex.boundary.some((other) => other.wallId === ref.wallId && other.direction !== ref.direction));
		expect(shared).toHaveLength(1);

		const base = second.state.layout;
		const placed = accepted(planCreateWallFirstOpening(base,
			{ wallId, kind: 'window', offset: 0.35, width: 0.25 }, capture('place'), base.floor.id)).document;
		const opening = placed.openings[0]!;
		const slid = accepted(planMoveWallFirstOpening(placed, opening.id, 0.62)).document;
		expect(slid.openings).toEqual([{ ...opening, offset: 0.62 }]);
		for (const [step, layout] of [['place', placed], ['slide', slid]] as const) {
			const next = { ...second.state, layout };
			expectCarrier(next, roomId, name, round.radius, round.center);
			record(history, next, step);
		}

		const newRadius = 6.125;
		const resized = accepted(resize({ ...second.state, layout: slid }, roomId, newRadius)).state;
		expectCarrier(resized, roomId, name, newRadius, round.center);
		record(history, resized, 'resize');

		const delta: LayoutVec2 = [3, -2];
		const move = accepted(planWallFirstRoomMove(resized.layout, roomId, delta));
		expect(move.movedRoomIds).toEqual([roomId, annex.id]);
		expect(move.document.openings).toEqual(resized.layout.openings);
		const translate = ([x, z]: LayoutVec2): LayoutVec2 => [x + delta[0], z + delta[1]];
		for (const ref of boundary(resized.layout, roomId)) {
			expectTransformedCubics(cubics(resized.layout, ref.wallId), cubics(move.document, ref.wallId), translate);
		}
		const moved = {
			layout: move.document,
			roundByRoom: { [roomId]: { center: translate(round.center), radius: newRadius } }
		};
		expectCarrier(moved, roomId, name, newRadius, delta);
		record(history, moved, 'move');

		// Staged boundary-only copy. Run the shipped isolated Duplicate planner
		// on the stripped fixture and graft only the newly allocated records.
		const isolated = stripAnnex(moved.layout, roomId);
		const copyDelta: LayoutVec2 = [22, 4];
		const copy = accepted(planDuplicateIsolatedRoom(isolated, { roomId, delta: copyDelta },
			capture('copy'), isolated.floor.id));
		const copyId = copy.createdRoomId!;
		const layout = accepted(gate({
			...moved.layout,
			rooms: [...moved.layout.rooms, copy.document.rooms.find((room) => room.id === copyId)!],
			junctions: [...moved.layout.junctions, ...copy.document.junctions.filter((j) => copy.createdJunctionIds.includes(j.id))],
			walls: [...moved.layout.walls, ...copy.document.walls.filter((w) => copy.createdWallIds.includes(w.id))],
			openings: [...moved.layout.openings, ...copy.document.openings.filter((o) => copy.createdOpeningIds.includes(o.id))]
		})).document;
		const duplicated = { layout, roundByRoom: { ...moved.roundByRoom, [copyId]: { center: [25, 2] as LayoutVec2, radius: newRadius } } };
		expect(copyId).not.toBe(roomId);
		expectCarrier(duplicated, roomId, name, newRadius, delta);
		expectCarrier(duplicated, copyId, `${name} copy`, newRadius, [25, 2]);
		expect(boundary(layout, copyId).map((ref) => ref.wallId)).toEqual(copy.createdWallIds);
		for (const [index, ref] of boundary(moved.layout, roomId).entries()) {
			expectTransformedCubics(cubics(moved.layout, ref.wallId), cubics(layout, copy.createdWallIds[index]!),
				([x, z]) => [x + copyDelta[0], z + copyDelta[1]]);
		}
		const copiedOpening = layout.openings.find((o) => copy.createdOpeningIds.includes(o.id))!;
		expect(copiedOpening).toMatchObject({ offset: moved.layout.openings[0]!.offset, width: opening.width });
		expect(copy.createdWallIds).toContain(copiedOpening.wallId);
		record(history, duplicated, 'duplicate');

		// Continue the source journey from before duplication. The repack fixture
		// deliberately has one Opening on the retained seam fragment.
		history.undo();
		const detached = { ...moved, layout: repackCircle(isolated, moved.roundByRoom[roomId]!, wallId) };
		expectCarrier(detached, roomId, name, newRadius, delta);
		expect(detached.layout.walls).toHaveLength(1);
		expect(isClosedWall(wall(detached.layout, wallId))).toBe(true);
		expect(detached.layout.openings).toEqual(moved.layout.openings);
		expect(history.current.canonicalJson).toBe(encode(moved));
		const detachHistory = new AuthoringHistory(history.current);
		record(detachHistory, detached, 'detach');
	});

	it('3 — restores the exact stated number and never infers Round from identical geometry', () => {
		const { second, roomId, wallId } = connected();
		const enteredRadius = 5.123456789012345;
		const state = accepted(resize(second.state, roomId, enteredRadius)).state;
		const restored = decode(encode(state));
		expect(restored.roundByRoom[roomId]!.radius).toBe(enteredRadius);
		expect(readClosedWallCircle(restored.layout, wallId)).toBeNull();
		const released = clearRound(restored, roomId);
		expect(serializeWallFirstLayoutDocument(released.layout)).toBe(serializeWallFirstLayoutDocument(restored.layout));
		expect(decode(encode(released)).roundByRoom[roomId]).toBeUndefined();
		const unsupportedEncoding = validateWallFirstLayoutDocument({
			...restored.layout,
			rooms: restored.layout.rooms.map((room) => room.id === roomId
				? { ...room, round: restored.roundByRoom[roomId] } : room)
		});
		expect(unsupportedEncoding).toMatchObject({ success: false, issues: [expect.objectContaining({
			path: expect.stringMatching(/\.round$/)
		})] });
	});

	it('4 — moves every rim Junction and keeps the Opening station, or refuses the whole edit on a neighbour issue', () => {
		const { second, roomId, wallId } = connected();
		const base = second.state.layout;
		const host = base.walls.find((entry) => entry.startJunctionId === nodingIds('1').nextJunctionId()
			&& entry.centerline.kind === 'line')!;
		const withArcOpening = accepted(planCreateWallFirstOpening(base,
			{ wallId, kind: 'window', offset: 0.6, width: 0.3 }, capture('arc-window'), base.floor.id)).document;
		const layout = accepted(planCreateWallFirstOpening(withArcOpening,
			{ wallId: host.id, kind: 'window', offset: 1.45, width: 0.8 }, capture('neighbour-window'), base.floor.id)).document;
		const baseline = { ...second.state, layout };
		const before = encode(baseline);
		const history = new AuthoringHistory(historyEntry(baseline, 'before-radius'));
		const rejected = resize(history.current.source, roomId, 6.125);
		if (rejected.kind === 'success') history.push(historyEntry(rejected.state, 'unexpected-resize'));
		expect(rejected).toEqual({ kind: 'rejected', rejection: expect.arrayContaining([expect.objectContaining({
			code: 'opening_exceeds_wall', wallId: host.id, message: expect.stringContaining(host.id)
		})]) });
		expect(encode(baseline)).toBe(before);
		expect(encode(history.current.source)).toBe(before);
		expect(history.current.canonicalJson).toBe(before);
		expect(history.depth).toBe(1);

		const next = accepted(resize(baseline, roomId, 4)).state;
		const ringIds = boundary(layout, roomId).map((ref) => ref.wallId);
		for (const id of ringIds) {
			expectTransformedCubics(cubics(layout, id), cubics(next.layout, id),
				(point) => radialScale(point, [0, 0], 0.8));
		}
		const rimIds = new Set(ringIds.flatMap((id) => [wall(layout, id).startJunctionId, wall(layout, id).endJunctionId]));
		expect(rimIds.size).toBe(3);
		for (const junction of layout.junctions) {
			const actual = point(next.layout, junction.id);
			if (rimIds.has(junction.id)) {
				closePoint(actual, radialScale(junction.point, [0, 0], 0.8));
				expect(actual).not.toEqual(junction.point);
			} else {
				expect(actual).toEqual(junction.point);
			}
		}
		expect(wall(next.layout, host.id)).toEqual(host);
		expect(wallFirstWallLength(next.layout, host.id)! - wallFirstWallLength(layout, host.id)!).toBeCloseTo(1, 6);
		expect(next.layout.rooms).toEqual(layout.rooms);
		const [oldArc, oldNeighbour] = layout.openings;
		const [newArc, newNeighbour] = next.layout.openings;
		expect(newArc).toEqual({ ...oldArc, offset: oldArc!.offset * 0.8 });
		expect(newNeighbour).toEqual(oldNeighbour);
		closePoint(splitAt(next.layout, wallId, newArc!.offset).point,
			radialScale(splitAt(layout, wallId, oldArc!.offset).point, [0, 0], 0.8));
		record(history, next, 'one-radius-edit');
	});

	it('5 — clears the fixture fact on divide, open and Release round, with Undo/Redo', () => {
		const { second, roomId, seamId, wallId } = connected();
		const state = second.state;
		const layout = state.layout;
		const rimId = second.junctionId;
		const divided = accepted(planWallChain({
			baseline: layout, points: [point(layout, seamId), point(layout, rimId)], close: false,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: seamId }, { pointIndex: 1, junctionId: rimId }],
			capture: capture('divide'), levelId: layout.floor.id
		})).document;
		expect(divided.rooms).toHaveLength(3);
		expect(divided.rooms.some((room) => room.id === roomId)).toBe(true);
		const opened = accepted(planDeleteWall(layout, wallId, capture('open'), layout.floor.id)).document;
		expect(opened.rooms.some((room) => room.id === roomId)).toBe(false);
		expect(opened.walls.some((entry) => entry.id === wallId)).toBe(false);
		for (const [step, changed] of [['divide', divided], ['open', opened], ['release', layout]] as const) {
			const next = clearRound({ ...state, layout: changed }, roomId);
			expect(next.roundByRoom).toEqual({});
			expect(next.layout).toBe(changed);
			expect(resolveInside(next, { roomId, role: 'inside' })).toEqual([]);
			record(new AuthoringHistory(historyEntry(state, 'round')), next, step);
		}
	});

	it('6 — one Room-side reference expands to all and only the current ring faces, including a reversed shared arc', () => {
		const seed = circle();
		const ref: InsideRef = { roomId: seed.roomId, role: 'inside' };
		let { state, wallId: hostId } = seed;
		expect(resolveInside(state, ref).map((face) => face.wallId)).toEqual([seed.wallId]);
		for (const index of attachmentDistances.keys()) {
			const next = attach(state, hostId, index);
			state = next.state;
			hostId = next.nextWallId;
			const faces = resolveInside(state, ref);
			expect(new Set(faces.map((face) => face.wallId))).toEqual(new Set([
				seed.wallId, ...Array.from({ length: index + 1 }, (_, i) => nodingIds(String(i + 1)).nextWallId())
			]));
			expect(faces).toHaveLength(index + 2);
		}
		const sharedId = nodingIds('1').nextWallId();
		const shared = wall(state.layout, sharedId);
		const reversed = orientedWallChainKnotsAndSpans(shared.centerline, 'reverse');
		const layout = {
			...state.layout,
			walls: state.layout.walls.map((entry) => entry.id === sharedId ? {
				...entry, startJunctionId: entry.endJunctionId, endJunctionId: entry.startJunctionId,
				centerline: wallCubicChain(reversed.knots, reversed.spans)
			} : entry),
			rooms: state.layout.rooms.map((room) => ({ ...room, boundary: room.boundary.map((entry) =>
				entry.wallId === sharedId ? { ...entry, direction: entry.direction === 'forward' ? 'reverse' as const : 'forward' as const } : entry
			) }))
		};
		const faces = resolveInside({ ...state, layout }, ref);
		expect(faces.find((face) => face.wallId === sharedId)).toMatchObject({ side: 'right', physical: { role: 'dividing' } });
		for (const face of faces) {
			const sample = face.physical.samples[Math.floor(face.physical.samples.length / 2)]!;
			const sign = face.side === 'left' ? 1 : -1;
			expect(-sign * (sample.point[0] * sample.normal[0] + sample.point[1] * sample.normal[1])).toBeGreaterThan(0);
		}
	});

	it('counterexamples — shipped isolation refusals and loss of correspondence when every Wall ID changes', () => {
		const { state, roomId, wallId, first, second } = connected();
		expect(planWallSplit(state.layout, wallId, attachmentDistances[0], nodingIds('1'))).toMatchObject({
			kind: 'rejected', rejection: { code: 'closed_wall_isolated' }
		});
		expect(planResizeClosedWallRadius({ document: second.state.layout, wallId, radius: 6 })).toMatchObject({
			kind: 'rejected', rejection: { code: 'not_closed_wall' }
		});
		expect(planWallFirstRoomMove(first.state.layout, roomId, [1, 0])).toMatchObject({
			kind: 'rejected', rejection: { code: 'room_not_isolated' }
		});
		const layout = second.state.layout;
		expect(planDuplicateIsolatedRoom(layout, { roomId, delta: [20, 0] }, capture('refused-copy'), layout.floor.id)).toMatchObject({
			kind: 'rejected', rejection: { code: 'room_not_isolated' }
		});
		const { candidate } = stageFirstSplit(state.layout, wallId, attachmentDistances[0]);
		const rekeyed = { ...candidate, walls: candidate.walls.map((entry) => ({ ...entry, id: `new-${entry.id}` })) };
		const reconciled = reconcileFixture(state.layout, rekeyed);
		expect(reconciled.retiredRoomIds).toEqual([roomId]);
		expect(reconciled.lineage.map((entry) => entry.kind)).toEqual(['created']);
		accepted(gate(reconciled.document));
	});
});
