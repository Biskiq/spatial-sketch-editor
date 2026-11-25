import type { WallSamplingDerivation } from '../../wall/centerline';
import { isCanonicalWallSampling } from '../../wall/centerline';
import type { CompiledJunctionLeg, CompiledLayoutGeometryResult } from '../types';
import type { LayoutCompileReuse } from '../reuse';
import { sameAuthored } from '../reuse';
import type { LayoutDocumentWallFirst } from '../../wall/types';
import { hasAnySamplingTestObserver } from '../../world/lookups';
import { layoutItem, layoutLength } from '../../kernel/source-collections';
import { collectJoinsForWall, resolveCowDirtyIds } from './seed';
import { compileSnapshot } from './snapshots';
import type { CanonicalDeltaBuilders, EvaluatedWallBaseUnit, RetainedCompileWorld } from './units';
import { compileSourceViews } from './world';

/**
 * Attempt a persistent delta compile against `reuse.world`. Returns `null` when the
 * edit changes topology, global Floor datums, fallback thickness, or lacks
 * COW lineage, allowing the caller to fall back cleanly.
 */
export function tryCompileWallFirstLayoutGeometryDelta(
	document: LayoutDocumentWallFirst,
	sampling: WallSamplingDerivation | undefined,
	reuse: LayoutCompileReuse,
	builders: CanonicalDeltaBuilders
): CompiledLayoutGeometryResult | null {
	if (hasAnySamplingTestObserver() || !isCanonicalWallSampling(sampling)) return null;
	let world = reuse.world as RetainedCompileWorld | null;
	if (!world) return null;
	if (document.regions !== world.document.regions &&
		(document.regions.length !== 0 || world.document.regions.length !== 0)) return null;

	const defaultWallThickness = layoutItem(document, 'walls', 0)?.thickness ?? 0.1;
	if (
		!Object.is(document.floor.id, world.floorId) ||
		!Object.is(document.floor.elevation, world.floorElevation) ||
		!Object.is(defaultWallThickness, world.defaultWallThickness)
	) {
		return null;
	}

	if (
		layoutLength(document, 'walls') !== layoutLength(world.document, 'walls') ||
		layoutLength(document, 'junctions') !== layoutLength(world.document, 'junctions') ||
		layoutLength(document, 'rooms') !== layoutLength(world.document, 'rooms') ||
		layoutLength(document, 'openings') !== layoutLength(world.document, 'openings')
	) {
		return null;
	}

	const dirty = resolveCowDirtyIds(world.document, document);
	if (!dirty) return null;
	if (dirty.changedRoomIds.length > 0) {
		return null;
	}

	// Verify ID-at-index invariants for candidate junctions/walls/openings touched by `dirty`,
	// and filter out sibling candidates whose values are actually identical to `world`!
	const changedJunctionIds = new Set<string>();
	for (let i = 0; i < dirty.changedJunctionIds.length; i += 1) {
		const jId = dirty.changedJunctionIds[i]!;
		const docIdx = world.junctionDocIndexById.get(jId);
		if (docIdx === undefined) return null;
		const nextJ = layoutItem(document, 'junctions', docIdx);
		if (!nextJ || nextJ.id !== jId) return null;
		const prevPt = world.pointById.get(jId)!;
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevPt, nextJ.point)) {
			changedJunctionIds.add(jId);
		}
	}

	const authoredChangedWallIds = new Set<string>();
	for (let i = 0; i < dirty.changedWallIds.length; i += 1) {
		const wId = dirty.changedWallIds[i]!;
		const docIdx = world.wallDocIndexById.get(wId);
		if (docIdx === undefined) return null;
		const nextW = layoutItem(document, 'walls', docIdx);
		if (!nextW || nextW.id !== wId) return null;
		const prevW = world.wallById.get(wId)!;
		if (
			nextW.startJunctionId !== prevW.startJunctionId ||
			nextW.endJunctionId !== prevW.endJunctionId
		) {
			return null;
		}
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevW, nextW)) {
			authoredChangedWallIds.add(wId);
		}
	}

	const changedOpeningHostWallIds = new Set<string>();
	for (let i = 0; i < dirty.changedOpeningIds.length; i += 1) {
		const opId = dirty.changedOpeningIds[i]!;
		const opIdx = world.openingOrderById.get(opId);
		if (opIdx === undefined) return null;
		const nextOp = layoutItem(document, 'openings', opIdx);
		if (!nextOp || nextOp.id !== opId) return null;
		const prevOp = world.openingById.get(opId)!;
		if (nextOp.wallId !== prevOp.wallId) return null;
		reuse.counters.signatureVisits += 1;
		if (!sameAuthored(prevOp, nextOp)) {
			// The source views below read the *candidate* document, so the updated
			// Opening is picked up there; only its host Wall needs scheduling.
			changedOpeningHostWallIds.add(nextOp.wallId);
		}
	}

	// Pre-flight check: ensure no dirty wall changes nullability (sampling failure
	// vs success) or incident junction leg membership before mutating `world`!
	const dirtyWallIds = new Set<string>(authoredChangedWallIds);
	for (const wId of changedOpeningHostWallIds) dirtyWallIds.add(wId);
	for (const jId of changedJunctionIds) {
		const incident = world.wallIdsByJunctionId.get(jId);
		if (incident) {
			for (let i = 0; i < incident.length; i += 1) dirtyWallIds.add(incident[i]!);
		}
	}

	world = { ...world, ...compileSourceViews(document, world), junctionIssuesByOrder: world.junctionIssuesByOrder.fork() };
	reuse.world = world;
	// 1. Evaluate dirty Walls (base geometry + legs).
	const evaluatedWallBaseById = new Map<string, EvaluatedWallBaseUnit>();
	let validWallCount = 0;
	validWallCount = world.sortedWalls.length;

	for (const wId of dirtyWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots.get(docIdx)!;
		const wall = world.wallById.get(wId)!;
		const hosted = world.openingsByHostWallId.get(wId) ?? [];
		const role = world.derivedWallRoles.get(wId) ?? 'free-standing';
		const evaluated = builders.evaluateWallBase(document, wall, world.pointById, hosted, role);
		if ((evaluated === null) !== (prevSlot.compiled === null)) {
			// Nullability transition (broken curve / NaN): invalidate world and fall back!
			reuse.world = null;
			return null;
		}
		if (evaluated !== null) {
			if ((evaluated.baseCompiled.samples.length >= 2) !== ((prevSlot.compiled?.samples.length ?? 0) >= 2)) {
				reuse.world = null;
				return null;
			}
			evaluatedWallBaseById.set(wId, evaluated);
			reuse.counters.wallsEvaluated += 1;
			reuse.counters.openingsEvaluated += evaluated.openingsCount;
		}
	}
	reuse.counters.wallsReused += validWallCount - reuse.counters.wallsEvaluated;

	// 2. Evaluate dirty Rooms (rooms referencing any dirty Wall).
	const dirtyRoomIndexSet = new Set<number>();
	for (const wId of dirtyWallIds) {
		const roomIndices = world.roomIndicesByWallId.get(wId);
		if (roomIndices) {
			for (let i = 0; i < roomIndices.length; i += 1) dirtyRoomIndexSet.add(roomIndices[i]!);
		}
	}
	for (const jId of changedJunctionIds) {
		const roomIndices = world.roomIndicesByJunctionId.get(jId);
		if (roomIndices) {
			for (let i = 0; i < roomIndices.length; i += 1) dirtyRoomIndexSet.add(roomIndices[i]!);
		}
	}
	if (dirtyRoomIndexSet.size > 0) {
		const sortedDirtyRooms = [...dirtyRoomIndexSet].sort((a, b) => a - b);
		for (let i = 0; i < sortedDirtyRooms.length; i += 1) {
			const rIdx = sortedDirtyRooms[i]!;
			const prevSlot = world.roomSlots.get(rIdx)!;
			const unit = builders.evaluateRoom(
				document,
				rIdx,
				world.pointById,
				world.junctionById,
				world.wallById,
				world.openingsByHostWallId,
				world.openingOrderById,
				defaultWallThickness
			);
			if ((prevSlot.stripped === null) !== (unit.stripped === null)) { reuse.world = null; return null; }
			if (prevSlot.hasValidCeiling !== unit.hasValidCeiling) {
				if (unit.hasValidCeiling) world.validCeilingRoomCount += 1;
				else world.validCeilingRoomCount -= 1;
			}
			if (unit.hasValidCeiling) {
				reuse.counters.roomsEvaluated += 1;
			}
			if (unit.source) {
				const room = layoutItem(document, 'rooms', rIdx)!;
				const retentionKey = [
					room,
					unit.source.ceilingElevation ?? null,
					document.floor.elevation,
					document.floor.id,
					defaultWallThickness,
					false,
					...room.boundary.map((ref) => {
						const w = world.wallById.get(ref.wallId);
						return [
							ref,
							w ?? null,
							w ? world.pointById.get(w.startJunctionId) ?? null : null,
							w ? world.pointById.get(w.endJunctionId) ?? null : null,
							world.openingsByHostWallId.get(ref.wallId) ?? null
						];
					}),
					...room.virtualEdges.map((edge) => [
						edge,
						world.pointById.get(edge.startJunctionId) ?? null,
						world.pointById.get(edge.endJunctionId) ?? null
					])
				];
				reuse.roomSources.set(room.id, { authored: retentionKey, source: unit.source });
				reuse.roomCompiles.set(unit.source, {
					source: unit.source,
					compiled: unit.compiled,
					stripped: unit.stripped,
					records: {
						points: [],
						spans: [],
						polygons: unit.polygons,
						aabbs: unit.aabbs
					},
					issues: unit.issues
				});
			}
			world.roomSlots = world.roomSlots.set(rIdx, {
				roomId: layoutItem(document, 'rooms', rIdx)!.id,
				hasValidCeiling: unit.hasValidCeiling,
				stripped: unit.stripped,
				polygons: unit.polygons,
				aabbs: unit.aabbs,
				issues: unit.issues,
				bounds3: unit.bounds3
			});
		}
	}
	reuse.counters.roomsReused += world.validCeilingRoomCount - reuse.counters.roomsEvaluated;

	// 3. Evaluate Objects if any object changed or count changed.
	if (
		dirty.changedObjectIds.length > 0 ||
		layoutLength(document, 'objects') !== layoutLength(world.document, 'objects')
	) {
		world.objectUnit = builders.compileObjects(document.objects, world.documentRoomIds, reuse);
	} else {
		reuse.counters.objectsReused += layoutLength(document, 'objects');
	}

	// 4. Resolve affected Junctions (moved junctions + endpoints of dirty walls).
	const affectedJunctionIds = new Set<string>(changedJunctionIds);
	for (const wId of dirtyWallIds) {
		const w = world.wallById.get(wId)!;
		if (w.startJunctionId) affectedJunctionIds.add(w.startJunctionId);
		if (w.endJunctionId) affectedJunctionIds.add(w.endJunctionId);
	}
	let affectedValidJunctions = 0;
	for (const jId of affectedJunctionIds) {
		const jSortedIdx = world.junctionSortedIndexById.get(jId);
		if (jSortedIdx === undefined) continue;
		const point = world.pointById.get(jId);
		if (!point) continue;
		affectedValidJunctions += 1;
		const incidentWallIds = world.wallIdsByJunctionId.get(jId) ?? [];
		const legs: CompiledJunctionLeg[] = [];
		for (let i = 0; i < incidentWallIds.length; i += 1) {
			const incWallId = incidentWallIds[i]!;
			const incWall = world.wallById.get(incWallId)!;
			const evaluatedBase = evaluatedWallBaseById.get(incWallId);
			const legPair = evaluatedBase
				? evaluatedBase.legs
				: world.wallSlots.get(world.wallDocIndexById.get(incWallId)!)!.legs;
			if (incWall.startJunctionId === jId && legPair.start) legs.push(legPair.start);
			if (incWall.endJunctionId === jId && legPair.end) legs.push(legPair.end);
		}
		if (legs.length === 0) {
			reuse.world = null;
			return null;
		}
		legs.sort(
			(a, b) =>
				a.outwardAngle - b.outwardAngle ||
				(a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : 0) ||
				(a.end < b.end ? -1 : a.end > b.end ? 1 : 0)
		);
		const resolved = builders.resolveJunction(document, jId, point, legs, reuse, world.wallById, world.pointById);
		if (world.sortedJunctions.get(jSortedIdx) !== resolved.compiled) {
			world.sortedJunctions = world.sortedJunctions.set(jSortedIdx, resolved.compiled);
		}
		const issueOrder = world.junctionLegOrderById.get(jId);
		if (issueOrder === undefined) { reuse.world = null; return null; }
		if (resolved.issues.length > 0) {
			world.junctionIssuesByOrder.set(issueOrder, resolved.issues);
		} else {
			world.junctionIssuesByOrder.delete(issueOrder);
		}
	}
	// `resolveJunction` incremented `junctionsEvaluated` / `junctionsReused` for
	// `affectedValidJunctions`; add the untouched junctions to `junctionsReused`.
	reuse.counters.junctionsReused += world.sortedJunctions.length - affectedValidJunctions;

	// 5. Expand dirty Walls AND miter-neighbor Walls incident to `affectedJunctionIds`.
	const expansionWallIds = new Set<string>(dirtyWallIds);
	for (const jId of affectedJunctionIds) {
		const incident = world.wallIdsByJunctionId.get(jId);
		if (incident) {
			for (let i = 0; i < incident.length; i += 1) expansionWallIds.add(incident[i]!);
		}
	}
	for (const wId of expansionWallIds) {
		const docIdx = world.wallDocIndexById.get(wId)!;
		const prevSlot = world.wallSlots.get(docIdx)!;
		const wall = world.wallById.get(wId)!;
		const evaluatedBase = evaluatedWallBaseById.get(wId);
		const baseCompiled = evaluatedBase ? evaluatedBase.baseCompiled : prevSlot.baseCompiled;
		const baseBounds2 = evaluatedBase ? evaluatedBase.baseBounds2 : prevSlot.baseBounds2;
		const baseBounds3 = evaluatedBase ? evaluatedBase.baseBounds3 : prevSlot.baseBounds3;
		if (!baseCompiled || !baseBounds2 || !baseBounds3) continue;

		const currentCompiled = evaluatedBase ? evaluatedBase.baseCompiled : prevSlot.compiled!;
		const currentWallAabb = evaluatedBase ? evaluatedBase.baseWallAabb : prevSlot.wallAabb!;
		const joins = collectJoinsForWall(wId, wall.startJunctionId, wall.endJunctionId, world);
		const expanded = builders.expandWall(
			document.floor.id,
			document.floor.elevation,
			wall.height,
			wId,
			baseCompiled,
			baseBounds2,
			baseBounds3,
			currentCompiled,
			currentWallAabb,
			joins
		);

		const baseRecords = evaluatedBase ? evaluatedBase.baseRecords : prevSlot.baseRecords;
		const legs = evaluatedBase ? evaluatedBase.legs : prevSlot.legs;
		const issues = evaluatedBase ? evaluatedBase.issues : prevSlot.issues;

		if (
			evaluatedBase !== undefined ||
			expanded.compiled !== prevSlot.compiled ||
			expanded.wallAabb !== prevSlot.wallAabb
		) {
			world.wallSlots = world.wallSlots.set(docIdx, {
				wallId: wId,
				sortedIndex: prevSlot.sortedIndex,
				baseCompiled,
				compiled: expanded.compiled,
				baseBounds2,
				baseBounds3,
				legs,
				baseRecords,
				wallAabb: expanded.wallAabb,
				issues
			});
			world.sortedWalls = world.sortedWalls.set(prevSlot.sortedIndex, expanded.compiled);

			const startPt = world.pointById.get(wall.startJunctionId)!;
			const endPt = world.pointById.get(wall.endJunctionId)!;
			const hosted = world.openingsByHostWallId.get(wId) ?? [];
			const role = world.derivedWallRoles.get(wId) ?? 'free-standing';
			reuse.walls.set(wId, {
				authored: [
					wall,
					startPt,
					endPt,
					document.floor.id,
					document.floor.elevation,
					hosted,
					role,
					false
				],
				compiled: expanded.compiled,
				baseBounds2,
				baseBounds3,
				legs,
				records: { ...baseRecords, aabbs: [...baseRecords.aabbs, expanded.wallAabb] },
				issues
			});
		}
	}

	reuse.counters.regionsReused += world.regionUnit.regions.length;
	world.document = document;
	reuse.counters.entities =
		reuse.counters.wallsEvaluated +
		reuse.counters.roomsEvaluated +
		reuse.counters.junctionsEvaluated +
		reuse.counters.objectsEvaluated;

	// Snapshot roots are immutable. Legacy array properties materialize only when
	// actually consumed; bounds/counts come from cached tree summaries.
	return compileSnapshot(document, world, reuse, builders);
}
