/**
 * P23B pre-P23B.8 follow-up — the whole-Room drag's live-preview **parity gate**.
 *
 * The gesture change this guards: a Room-unit drag stops re-deriving and
 * installing the whole document on every pointermove, and instead draws a
 * transient attempt derived from the frozen baseline, compiling once at release.
 * That is only admissible if the drawn attempt is the geometry the release
 * planner would produce — the "preview parity" question — so this file is the
 * differential the change is gated on:
 *
 * ```text
 * LEVEL 1  compile equivalence (the concept's own premise)
 *          compile(translated document)  ≡  translate(compile(baseline))
 *          for every moved Wall's samples, its length, and every moved Room's
 *          floor polygon.
 *
 * LEVEL 2  proposal fidelity (this implementation's correctness)
 *          proposeWallFirstRoomUnitGeometry(...) ≡ compile(translated).samples
 *          i.e. the drawn attempt is the planner's own geometry, not a second
 *          description of it.
 * ```
 *
 * P0.3 answers the same question for a rigid ROTATION and returns a NEGATIVE
 * result that is recorded rather than hidden: a rotated isolated group compiles
 * to the rigid image of its baseline Rooms (vertex-exact) and preserves every
 * Wall's length, but its **Wall sampling density is not rotation-invariant** —
 * `samples(rotated)` and `rotate(samples)` do not even agree on their sample
 * count. So a rotation preview cannot be drawn by moving the baseline's canonical
 * points the way a translation is. Rotation was subsequently WIRED anyway (the
 * owner reversed P23.14 Decision 7 on 2026-09-28), because the negative result
 * rules out only that one drawing rule: `proposeWallFirstRoomUnitRotation`
 * RESAMPLES the rotated centerline through the sampler the release itself uses,
 * so the drawn attempt IS the release planner's candidate (release-equivalent by
 * construction, asserted below) and differs from the baseline's own ink by sample
 * density alone.
 *
 * Points are compared to 9 decimal places: the transform is exact arithmetic, so
 * drift means a resampled or re-derived curve, not rounding. Fixtures are the
 * committed ones, so the claim is made on the same documents the performance
 * evidence uses.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planWallFirstRoomMove,
	planWallFirstRoomRotation,
	proposeWallFirstRoomUnitGeometry,
	proposeWallFirstRoomUnitRotation,
	resolveIsolatedRoomGroupSubgraph,
	rotateRoomUnitMoveCandidate,
	validateWallFirstLayoutDocument,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type RoomUnitMoveProposalWall,
	type RoomUnitMoveSubgraph
} from '@portfolio/layout-core';

import { P23B_MATRIX_SPECS, P23B_OWNER_LAYOUT, buildP23BMatrixFixture } from '$lib/bench/p23b-fixtures';

/** Every differential here compiles 40-Wall documents; the default budget is far too small. */
const DIFFERENTIAL_TIMEOUT_MS = 300_000;

/** Rigid translations small enough to stay clear of the next Room in each fixture. */
const TRANSLATION_DELTAS: readonly LayoutVec2[] = [
	[1.5, 2.25],
	[-2.5, -1.75],
	[0.75, -3.25]
];

/** Rotation magnitudes a Plan rotate gesture actually produces. */
const ROTATION_YAWS: readonly number[] = [Math.PI / 18, -Math.PI / 12];

/** Rooms exercised per fixture; the matrix cells carry ten, the owner payload fewer. */
const ROOMS_PER_ARM = 4;

type Arm = {
	label: string;
	document: LayoutDocumentWallFirst;
	baseline: CompiledLayoutGeometry;
};

/** The committed 40-wall matrix cells plus the committed owner payload. */
function fixtureArms(): Arm[] {
	const arms: Arm[] = [];
	const documents: LayoutDocumentWallFirst[] = [];
	for (const spec of P23B_MATRIX_SPECS) {
		if (spec.size !== '40-wall') continue;
		documents.push(buildP23BMatrixFixture(spec));
	}
	documents.push(P23B_OWNER_LAYOUT);
	for (let index = 0; index < documents.length; index += 1) {
		const document = documents[index]!;
		const label =
			index < documents.length - 1 ? P23B_MATRIX_SPECS.filter((spec) => spec.size === '40-wall')[index]!.id : 'owner-40-curved-v1';
		arms.push({
			label,
			document,
			baseline: compileWallFirstLayoutGeometry(document).geometry
		});
	}
	return arms;
}

type TranslationCase = {
	context: string;
	fixture: string;
	subgraph: RoomUnitMoveSubgraph;
	delta: LayoutVec2;
	/** The release planner's own moved IDs for this delta. */
	changedWallIds: readonly string[];
	movedRoomIds: readonly string[];
	candidate: CompiledLayoutGeometry;
	proposal: readonly RoomUnitMoveProposalWall[];
};

let translationCasesCache: TranslationCase[] | null = null;

/** Built once and shared by both P0.2 describes — each case costs several compiles. */
function translationCases(): TranslationCase[] {
	if (translationCasesCache) return translationCasesCache;
	const cases: TranslationCase[] = [];
	for (const arm of fixtureArms()) {
		const rooms = arm.document.rooms.slice(0, ROOMS_PER_ARM);
		for (const room of rooms) {
			const isolation = resolveIsolatedRoomGroupSubgraph(arm.document, room.id);
			if (isolation.kind !== 'success') continue;
			const { subgraph } = isolation;
			for (const delta of TRANSLATION_DELTAS) {
				const plan = planWallFirstRoomMove(arm.document, room.id, delta);
				if (plan.kind !== 'success') continue;
				cases.push({
					context: `${arm.label} ${room.id} Δ${delta[0]},${delta[1]}`,
					fixture: arm.label,
					subgraph,
					delta,
					changedWallIds: plan.changedWallIds,
					movedRoomIds: plan.movedRoomIds,
					candidate: compileWallFirstLayoutGeometry(plan.document).geometry,
					proposal: proposeWallFirstRoomUnitGeometry(arm.document, subgraph, delta)
				});
			}
		}
	}
	translationCasesCache = cases;
	return cases;
}

function wallOf(geometry: CompiledLayoutGeometry, wallId: string) {
	return geometry.walls.find((wall) => wall.wallId === wallId);
}

function wallPoints(wall: { samples: readonly { point: readonly [number, number] }[] }): LayoutVec2[] {
	return wall.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2);
}

function shifted(point: readonly [number, number], delta: LayoutVec2): LayoutVec2 {
	return [point[0] + delta[0], point[1] + delta[1]];
}

function rotated(point: readonly [number, number], pivot: LayoutVec2, yaw: number): LayoutVec2 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	const x = point[0] - pivot[0];
	const z = point[1] - pivot[1];
	// The candidate's own handedness (see core's `rotatePointAbout`): the shipped
	// legacy Room transform's convention, so one gesture turns a Room one way.
	return [pivot[0] + x * cos + z * sin, pivot[1] - x * sin + z * cos];
}

function polygonPivot(points: readonly LayoutVec2[]): LayoutVec2 {
	const sum = points.reduce<[number, number]>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
	return [sum[0] / points.length, sum[1] / points.length];
}

function expectPointsEqual(
	actual: readonly LayoutVec2[],
	expected: readonly LayoutVec2[],
	context: string
): void {
	expect(actual.length, `${context}: sample count`).toBe(expected.length);
	for (let index = 0; index < actual.length; index += 1) {
		expect(actual[index]![0], `${context}: sample ${index} x`).toBeCloseTo(expected[index]![0], 9);
		expect(actual[index]![1], `${context}: sample ${index} z`).toBeCloseTo(expected[index]![1], 9);
	}
}

function proposalPoints(proposal: readonly RoomUnitMoveProposalWall[], wallId: string): LayoutVec2[] {
	return proposal.find((entry) => entry.wallId === wallId)?.points ?? [];
}

describe('P0.2 — compile equivalence under a rigid Room-unit translation', () => {
	it(
		'every moved Wall and Room in every committed fixture lands where the compile says',
		() => {
			const arms = fixtureArms();
			const baselineByLabel = new Map(arms.map((arm) => [arm.label, arm.baseline]));
			const cases = translationCases();
			for (const entry of cases) {
				const baseline = baselineByLabel.get(entry.fixture)!;
				expect(entry.changedWallIds.length, `${entry.context}: moved Walls`).toBeGreaterThan(0);
				for (const wallId of entry.changedWallIds) {
					const before = wallOf(baseline, wallId);
					const after = wallOf(entry.candidate, wallId);
					expect(before, `${entry.context}: baseline Wall ${wallId}`).toBeDefined();
					expect(after, `${entry.context}: candidate Wall ${wallId}`).toBeDefined();
					// Level 1a — the samples are the rigid image of the baseline's.
					expectPointsEqual(
						wallPoints(after!),
						wallPoints(before!).map((point) => shifted(point, entry.delta)),
						`${entry.context} wall ${wallId}`
					);
					// Level 1b — a rigid motion preserves the Wall's own invariants.
					expect(after!.length, `${entry.context} wall ${wallId} length`).toBeCloseTo(before!.length, 9);
					expect(after!.thickness, `${entry.context} wall ${wallId} thickness`).toBe(before!.thickness);
					expect(after!.height, `${entry.context} wall ${wallId} height`).toBe(before!.height);
					expect(after!.startJunctionId, `${entry.context} wall ${wallId} start junction`).toBe(
						before!.startJunctionId
					);
					expect(after!.endJunctionId, `${entry.context} wall ${wallId} end junction`).toBe(
						before!.endJunctionId
					);
				}
				for (const movedRoomId of entry.movedRoomIds) {
					const before = baseline.rooms.find((room) => room.roomId === movedRoomId);
					const after = entry.candidate.rooms.find((room) => room.roomId === movedRoomId);
					expect(before, `${entry.context}: baseline Room ${movedRoomId}`).toBeDefined();
					expect(after, `${entry.context}: candidate Room ${movedRoomId}`).toBeDefined();
					expectPointsEqual(
						after!.floorPolygon,
						before!.floorPolygon.map((point) => shifted(point, entry.delta)),
						`${entry.context} room ${movedRoomId} floor`
					);
				}
			}
			// The gate must not pass vacuously: every committed arm has to contribute.
			expect(cases.length, 'translated cases exercised').toBeGreaterThanOrEqual(24);
			expect(new Set(cases.map((entry) => entry.fixture)).size, 'distinct fixtures').toBe(4);
		},
		DIFFERENTIAL_TIMEOUT_MS
	);
});

describe('P0.2 — proposal fidelity against the compile', () => {
	it(
		'the drawn attempt is the planner’s own geometry, point for point',
		() => {
			const arms = fixtureArms();
			const baselineByLabel = new Map(arms.map((arm) => [arm.label, arm.baseline]));
			let comparisons = 0;
			for (const entry of translationCases()) {
				const baseline = baselineByLabel.get(entry.fixture)!;
				// Every moved Wall is proposed; nothing else is.
				expect(
					entry.proposal.map((wall) => wall.wallId).sort(),
					`${entry.context}: proposed Walls`
				).toEqual([...entry.changedWallIds].sort());
				for (const wallId of entry.changedWallIds) {
					// Level 2 — the drawn attempt IS the planner's compiled geometry.
					expectPointsEqual(
						proposalPoints(entry.proposal, wallId),
						wallPoints(wallOf(entry.candidate, wallId)!),
						`${entry.context} proposal ${wallId}`
					);
					// …and the "move the canonical points, never resample" rule: it is
					// also exactly the baseline shifted.
					expectPointsEqual(
						proposalPoints(entry.proposal, wallId),
						wallPoints(wallOf(baseline, wallId)!).map((point) => shifted(point, entry.delta)),
						`${entry.context} proposal ${wallId} vs baseline`
					);
					comparisons += 1;
				}
			}
			expect(comparisons, 'proposal/compile comparisons').toBeGreaterThanOrEqual(24);
		},
		DIFFERENTIAL_TIMEOUT_MS
	);
});

describe('P0.3 — rigid rotation: what IS and is NOT preview-equivariant', () => {
	it(
		'Rooms and Wall lengths are the rigid image; Wall sampling density is not rotation-invariant',
		() => {
			let cases = 0;
			let validationRefusals = 0;
			let sampleCountAgreements = 0;
			let sampleCountDivergences = 0;
			for (const arm of fixtureArms()) {
				for (const room of arm.document.rooms.slice(0, ROOMS_PER_ARM)) {
					const isolation = resolveIsolatedRoomGroupSubgraph(arm.document, room.id);
					if (isolation.kind !== 'success') continue;
					const { subgraph } = isolation;
					const baselineRoom = arm.baseline.rooms.find((entry) => entry.roomId === room.id);
					if (!baselineRoom || baselineRoom.floorPolygon.length === 0) continue;
					const pivot = polygonPivot(baselineRoom.floorPolygon);
					for (const yaw of ROTATION_YAWS) {
						const rotatedDocument = rotateRoomUnitMoveCandidate(arm.document, subgraph, pivot, yaw);
						// Rotation must pass the same canonical validation a commit would:
						// a rotation the gates refuse has no committable result, so there is
						// nothing for a preview to be faithful to.
						const structural = validateWallFirstLayoutDocument(rotatedDocument);
						if (!structural.success) {
							validationRefusals += 1;
							continue;
						}
						const candidate = compileWallFirstLayoutGeometry(structural.document).geometry;
						const context = `${arm.label} ${room.id} yaw ${yaw.toFixed(4)}`;
						for (const wallId of subgraph.wallIds) {
							const before = wallOf(arm.baseline, wallId);
							const after = wallOf(candidate, wallId);
							if (!before || !after) continue;
							const expectedImage = wallPoints(before).map((point) => rotated(point, pivot, yaw));
							// Rigid invariants hold exactly.
							expect(after.length, `${context} wall ${wallId} length`).toBeCloseTo(before.length, 9);
							expect(after.thickness, `${context} wall ${wallId} thickness`).toBe(before.thickness);
							expect(after.height, `${context} wall ${wallId} height`).toBe(before.height);
							const actual = wallPoints(after);
							if (actual.length !== expectedImage.length) {
								// The recorded negative result: the compiler's sampling density
								// depends on the curve's orientation, so a rotated Wall is NOT
								// the baseline's samples rotated.
								sampleCountDivergences += 1;
								continue;
							}
							expectPointsEqual(actual, expectedImage, `${context} wall ${wallId}`);
							sampleCountAgreements += 1;
						}
						// Rooms are vertex-based, so their parity is exact either way.
						const afterRoom = candidate.rooms.find((entry) => entry.roomId === room.id)!;
						expectPointsEqual(
							afterRoom.floorPolygon,
							baselineRoom.floorPolygon.map((point) => rotated(point, pivot, yaw)),
							`${context} floor`
						);
						// The drawn attempt for the same rotation: the release planner's own
						// candidate sampled through the one canonical sampler, so it is not a
						// rigid transform of the baseline's points — it is a resample of the
						// SAME rotated geometry the release would commit.
						for (const wallId of subgraph.wallIds) {
							const before = wallOf(arm.baseline, wallId);
							if (!before) continue;
							expect(
								proposalPoints(
									proposeWallFirstRoomUnitRotation(arm.document, subgraph, pivot, yaw),
									wallId
								).length,
								`${context} proposal ${wallId} sample count`
							).toBeGreaterThan(1);
						}
						cases += 1;
					}
				}
			}
			expect(cases, 'rotation cases exercised').toBeGreaterThanOrEqual(12);
			expect(sampleCountAgreements + sampleCountDivergences, 'walls compared').toBeGreaterThan(0);
			// THE NEGATIVE RESULT, asserted rather than assumed: at least one Wall's
			// sampling density changes under a rigid rotation.
			expect(
				sampleCountDivergences,
				'Walls whose sample count changed under rotation'
			).toBeGreaterThan(0);
			// Recorded, not hidden: how many rotations the canonical gates refuse.
			expect(validationRefusals).toBeGreaterThanOrEqual(0);
		},
		DIFFERENTIAL_TIMEOUT_MS
	);

	/**
	 * THE ROTATION PREVIEW'S OWN PARITY GATE — the property the WIRED gesture needs.
	 *
	 * The drawn attempt is not required to be the baseline's ink rotated (the test
	 * above shows it cannot be). What it must be is the geometry the RELEASE would
	 * commit: removing the per-move planner call is admissible only if what the
	 * pointer draws is what the release writes. The release re-derives through
	 * `planWallFirstRoomRotation` against the frozen baseline, so this compares two
	 * INDEPENDENT calls — the attempt the viewport draws and the plan the release
	 * runs — both of which resample the same rotated centerlines. Equality here is
	 * stronger than the translation path's equivalent, which needs the added
	 * "never resampled" assertion above.
	 */
	it(
		'the drawn rotation attempt IS the release planner’s candidate, point for point',
		() => {
			let comparisons = 0;
			let accepted = 0;
			let refused = 0;
			for (const arm of fixtureArms()) {
				for (const room of arm.document.rooms.slice(0, ROOMS_PER_ARM)) {
					const isolation = resolveIsolatedRoomGroupSubgraph(arm.document, room.id);
					if (isolation.kind !== 'success') continue;
					const { subgraph } = isolation;
					const baselineRoom = arm.baseline.rooms.find((entry) => entry.roomId === room.id);
					if (!baselineRoom || baselineRoom.floorPolygon.length === 0) continue;
					const pivot = polygonPivot(baselineRoom.floorPolygon);
					for (const yaw of ROTATION_YAWS) {
						const plan = planWallFirstRoomRotation(arm.document, room.id, pivot, yaw);
						if (plan.kind !== 'success') {
							refused += 1;
							continue;
						}
						accepted += 1;
						const context = `${arm.label} ${room.id} yaw ${yaw.toFixed(4)}`;
						const candidate = compileWallFirstLayoutGeometry(plan.document).geometry;
						const proposal = proposeWallFirstRoomUnitRotation(arm.document, subgraph, pivot, yaw);
						// The moving set is the planner's own: the attempt proposes exactly
						// the Walls the release reports it changed, and nothing else.
						expect(
							proposal.map((entry) => entry.wallId).sort(),
							`${context}: proposed Walls`
						).toEqual([...plan.changedWallIds].sort());
						for (const wallId of plan.changedWallIds) {
							expectPointsEqual(
								proposalPoints(proposal, wallId),
								wallPoints(wallOf(candidate, wallId)!),
								`${context} proposal ${wallId}`
							);
							comparisons += 1;
						}
					}
				}
			}
			// Not vacuous, and a real comparison: the committed fixtures are expected
			// to accept some rotations, and a refused one has nothing to be faithful to.
			expect(accepted, 'rotations the canonical gates accept').toBeGreaterThan(0);
			expect(comparisons, 'proposal/release Wall comparisons').toBeGreaterThanOrEqual(accepted);
			expect(accepted + refused, 'rotation cases attempted').toBeGreaterThanOrEqual(12);
		},
		DIFFERENTIAL_TIMEOUT_MS
	);
});
