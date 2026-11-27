import { wallCenterlineSegment } from '../wall/centerline';
import type {
	CanonicalDeltaBuilders,
	CompiledObjectsUnit,
	EvaluatedRoomUnit,
	EvaluatedWallBaseUnit,
	ExpandedWallUnit,
	FloorAndAabbsUnit,
	ResolvedJunctionUnit,
} from './delta';
import { layoutItem } from '../kernel/source-collections';
import type { Vec3 } from '../kernel/types';
import type { LayoutVec2 } from './coordinates';
import type {
	CompiledJunction,
	CompiledPhysicalWall,
	CompilerOpening,
	LayoutBounds2,
	LayoutBounds3,
	LayoutGeometryIssue,
} from './types';
import { geometryId } from './types';
import { junctionSeamFailureOf } from '../wall/junction-clearance';
import { compiledJunctionId, resolveJunctionGeometry } from '../wall/junction-resolution';
import { countWork, p2311Measure } from '../kernel/work-observer';
import { cacheKeyDependency, cacheKeyOf } from './keys';
import { noQueryRecords, sameAuthored } from './reuse';
import type { SampledSegment } from './curve';
import { sampleSegment } from './curve';
import {
	WALL_OFFSET_FOLD_CODE,
	WALL_OFFSET_FOLD_MESSAGE,
	WALL_OFFSET_OVERLAP_CODE,
	WALL_OFFSET_OVERLAP_MESSAGE,
	wallOffsetClearanceFailure,
} from '../wall/offset-clearance';
import { wallPolylinesAroundOpenings } from './openings';
import { compilePhysicalWallTop } from './physical-wall-top';
import { compiledWallTopPeak } from '../wall/wall-top';
import {
	hasBlockingLayoutIssues,
	prepareLayoutRoomSegments,
	validatePreparedLayoutRoomGeometry,
} from './validation';
import { createQueryGeometryBuilder } from './queries';
import { junctionInputs, junctionLeg } from './junctions';
import { floorElevationOf, wallEndExpansion } from './physical-walls';
import {
	aabbRecord,
	buildWallFirstFloorAndAggregateAabbs,
	emitPhysicalWallQueryRecords,
	expandBounds2,
	expandBounds3,
	finiteBounds3,
	includeBounds3,
	wallBounds2,
	wallBounds3,
} from './query-records';
import { buildSolidSpans, buildWallFirstRoomSource, compileOpening, compileRoom } from './rooms';
import { compileObjects } from './room-objects';

export const DELTA_BUILDERS: CanonicalDeltaBuilders = {
	junctionInputs,
	evaluateRoom(
		document,
		roomIndex,
		pointById,
		junctionById,
		wallById,
		openingsByHostWallId,
		openingOrderById,
		defaultWallThickness,
	): EvaluatedRoomUnit {
		const room = layoutItem(document, 'rooms', roomIndex)!;
		const floor = document.floor;
		const wallThicknessBySegmentId: Record<string, number> = {};
		const openingHeightLimitBySegmentId: Record<string, number> = {};
		for (const ref of room.boundary) {
			const wall = wallById.get(ref.wallId);
			if (!wall) continue;
			wallThicknessBySegmentId[wall.id] = wall.thickness;
			openingHeightLimitBySegmentId[wall.id] = wall.height;
		}
		const built = buildWallFirstRoomSource(document, room, {
			junctionById,
			pointById,
			wallById,
			openingsByHostWallId,
			openingOrderById,
			wallThicknessBySegmentId,
			openingHeightLimitBySegmentId,
			defaultWallThickness,
		});
		const path = `floors[0].rooms[${roomIndex}]`;
		if ('issue' in built) {
			return {
				hasValidCeiling: false,
				source: null,
				compiled: null,
				stripped: null,
				polygons: [],
				aabbs: [],
				issues: [built.issue],
				bounds3: null,
			};
		}
		const source = built.source;
		if (source.ceilingElevation === undefined) {
			return {
				hasValidCeiling: false,
				source,
				compiled: null,
				stripped: null,
				polygons: [],
				aabbs: [],
				issues: [
					{
						path: `${path}.boundary`,
						code: 'room_ceiling_undefined',
						message: `Room '${room.id}' has no resolvable boundary Wall to derive a ceiling from`,
						targetId: room.id,
					},
				],
				bounds3: null,
			};
		}

		const prepared = prepareLayoutRoomSegments({ id: room.id, boundary: source.boundary }, path);
		const roomIssues = [
			...prepared.issues,
			...validatePreparedLayoutRoomGeometry(
				{ id: room.id, boundary: source.boundary, openings: source.openings },
				floor,
				prepared.segments,
				path,
				source.openingHeightLimitBySegmentId,
			),
		];
		if (hasBlockingLayoutIssues(roomIssues)) {
			return {
				hasValidCeiling: true,
				source,
				compiled: null,
				stripped: null,
				polygons: [],
				aabbs: [],
				issues: roomIssues,
				bounds3: null,
			};
		}

		const roomQueryBuilder = createQueryGeometryBuilder();
		const compiledRoom = compileRoom(
			source,
			floor,
			prepared.segments as SampledSegment[],
			roomQueryBuilder,
			'physical-wall',
		);
		const stripped =
			compiledRoom.walls.length === 0 && compiledRoom.openings.length === 0
				? compiledRoom
				: { ...compiledRoom, walls: [], openings: [] };
		return {
			hasValidCeiling: true,
			source,
			compiled: compiledRoom,
			stripped,
			polygons: roomQueryBuilder.polygons,
			aabbs: roomQueryBuilder.aabbs,
			issues: roomIssues,
			bounds3: compiledRoom.bounds3,
		};
	},

	evaluateWallBase(
		document,
		wall,
		pointById,
		hostedOpenings,
		derivedRole,
	): EvaluatedWallBaseUnit | null {
		const start = pointById.get(wall.startJunctionId);
		const end = pointById.get(wall.endJunctionId);
		if (!start || !end) return null;
		const floor = document.floor;
		const floorElevation = floor.elevation;
		const segment = wallCenterlineSegment(wall, start, end, 'forward');
		let sampled: SampledSegment;
		try {
			sampled = sampleSegment(segment);
		} catch {
			return null;
		}
		countWork('pairs:wall-opening', hostedOpenings.length);
		const wallOpenings: CompilerOpening[] = hostedOpenings.map((opening) => ({
			...opening,
			segmentId: opening.wallId,
		}));
		// Format 11 — the same derivation the cold path uses, so a retained Wall's
		// profile, sections, bounds, key parts and top issues are identical.
		const top = compilePhysicalWallTop(wall, sampled, segment, wallOpenings, floorElevation);
		const wallGeometryDependency = cacheKeyDependency(
			cacheKeyOf([
				'physical-wall-geometry',
				floor.id,
				wall.id,
				segment,
				wall.thickness,
				wall.height,
				floor.elevation,
				...top.keyPart,
			]),
		);
		const { sections, wallTop } = top;
		const compiledOpenings = wallOpenings.map((opening) =>
			compileOpening(opening, sampled, floor.id, wall.id, wallGeometryDependency),
		);
		const solidSpans = buildSolidSpans(sampled.samples, sections);
		const solidCenterlinePolylines = wallPolylinesAroundOpenings(sampled.samples, wallOpenings);
		const wallBounds2Value = wallBounds2(sampled.samples, wall.thickness);
		const wallBounds3Value = wallBounds3(sampled.samples, wall.thickness, floorElevation, wallTop);
		const baseCompiled: CompiledPhysicalWall = {
			id: geometryId(['physical-wall', floor.id, wall.id]),
			cacheKey: cacheKeyOf([
				'physical-wall',
				floor.id,
				wall.id,
				segment,
				wallOpenings,
				wall.thickness,
				floor.elevation,
				wall.height,
				...top.keyPart,
			]),
			wallId: wall.id,
			role: derivedRole,
			floorId: floor.id,
			thickness: wall.thickness,
			height: wall.height,
			...(top.profile ? { topProfile: top.profile } : {}),
			length: sampled.length,
			samples: sampled.samples,
			sections,
			solidSpans,
			openings: compiledOpenings,
			solidCenterlinePolylines,
			bounds2: wallBounds2Value,
			bounds3: wallBounds3Value,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
		};
		const wallClearanceIssues: LayoutGeometryIssue[] = [...top.issues];
		if (wall.centerline.kind !== 'line') {
			const clearance = p2311Measure('finite-thickness', () =>
				wallOffsetClearanceFailure(baseCompiled.samples, wall.thickness),
			);
			if (clearance) {
				wallClearanceIssues.push({
					path: `walls.${wall.id}`,
					code: clearance === 'fold' ? WALL_OFFSET_FOLD_CODE : WALL_OFFSET_OVERLAP_CODE,
					message: clearance === 'fold' ? WALL_OFFSET_FOLD_MESSAGE : WALL_OFFSET_OVERLAP_MESSAGE,
					targetId: wall.id,
				});
			}
		}
		const wallQueryBuilder = createQueryGeometryBuilder();
		const baseRecords =
			emitPhysicalWallQueryRecords(
				wallQueryBuilder,
				floor,
				wall,
				sampled,
				compiledOpenings,
				solidSpans,
				true,
			) ?? noQueryRecords();
		const baseBounds2: LayoutBounds2 = {
			min: [...wallBounds2Value.min] as LayoutVec2,
			max: [...wallBounds2Value.max] as LayoutVec2,
		};
		const baseBounds3: LayoutBounds3 = {
			min: [...wallBounds3Value.min] as Vec3,
			max: [...wallBounds3Value.max] as Vec3,
		};
		const baseWallAabb = aabbRecord(
			'wall',
			wall.id,
			['wall', floor.id, wall.id],
			baseBounds3.min,
			baseBounds3.max,
		);
		const legs =
			baseCompiled.samples.length < 2
				? {}
				: {
						...(wall.startJunctionId && pointById.has(wall.startJunctionId)
							? { start: junctionLeg(baseCompiled, 'start') }
							: {}),
						...(wall.endJunctionId && pointById.has(wall.endJunctionId)
							? { end: junctionLeg(baseCompiled, 'end') }
							: {}),
					};
		return {
			baseCompiled,
			baseBounds2,
			baseBounds3,
			baseRecords,
			baseWallAabb,
			issues: wallClearanceIssues,
			legs,
			openingsCount: hostedOpenings.length,
		};
	},

	resolveJunction(
		document,
		junctionId,
		point,
		sortedLegs,
		reuse,
		wallById,
		pointById,
	): ResolvedJunctionUnit {
		const floorElevation = floorElevationOf(document);
		const { authored: junctionAuthored, roundedContinuation } = junctionInputs(
			document,
			point,
			sortedLegs,
			wallById,
			pointById,
		);
		reuse.counters.signatureVisits += 1;
		const retainedJunction = reuse.junctions.get(junctionId);
		if (retainedJunction && sameAuthored(retainedJunction.authored, junctionAuthored)) {
			reuse.counters.junctionsReused += 1;
			return {
				compiled: retainedJunction.compiled,
				issues: retainedJunction.issues,
				evaluated: false,
			};
		}
		reuse.counters.junctionsEvaluated += 1;
		const junctionIssues: LayoutGeometryIssue[] = [];
		const resolved = resolveJunctionGeometry(junctionId, point, sortedLegs, {
			roundedContinuation,
		});
		junctionIssues.push(...resolved.issues);
		const seam = junctionSeamFailureOf({
			junctionId,
			point,
			legs: sortedLegs,
			resolution: resolved.resolution,
		});
		if (seam && !resolved.issues.some((issue) => issue.code === seam.code)) {
			junctionIssues.push({
				path: `junctions.${junctionId}`,
				code: seam.code,
				message: seam.message,
				targetId: junctionId,
			});
		}
		const minBand = Math.min(...sortedLegs.map((leg) => leg.bottomY));
		const maxBand = Math.max(...sortedLegs.map((leg) => leg.topY));
		const resolvedJunction: CompiledJunction = {
			id: compiledJunctionId(document.floor.id, junctionId),
			cacheKey: cacheKeyOf([
				'compiled-junction',
				document.floor.id,
				junctionId,
				point,
				sortedLegs.map((leg) => ({
					wallId: leg.wallId,
					end: leg.end,
					tangentOut: leg.tangentOut,
					normalOut: leg.normalOut,
					thickness: leg.thickness,
					bottomY: leg.bottomY,
					topY: leg.topY,
					role: leg.role,
					endpointOpen: leg.endpointOpen,
					endpointSolidBands: leg.endpointSolidBands.map((band) => [
						band.bottomY,
						band.topY,
						band.solid,
						band.openingId ?? null,
					]),
				})),
				...(roundedContinuation ? ['rounded-continuation'] : []),
			]),
			junctionId,
			point,
			legs: sortedLegs,
			resolution: resolved.resolution,
			bounds3: {
				min: [
					resolved.resolution.bounds2.min[0],
					floorElevation + minBand,
					resolved.resolution.bounds2.min[1],
				],
				max: [
					resolved.resolution.bounds2.max[0],
					floorElevation + maxBand,
					resolved.resolution.bounds2.max[1],
				],
			},
		};
		reuse.junctions.set(junctionId, {
			authored: junctionAuthored,
			compiled: resolvedJunction,
			issues: junctionIssues,
		});
		return { compiled: resolvedJunction, issues: junctionIssues, evaluated: true };
	},

	expandWall(
		floorId,
		floorElevation,
		wallHeight,
		wallId,
		baseCompiled,
		baseBounds2,
		baseBounds3,
		currentCompiled,
		currentWallAabb,
		joins,
	): ExpandedWallUnit {
		const expansion = wallEndExpansion(joins);
		const bounds2Val = expansion ? expandBounds2(baseBounds2, expansion) : baseBounds2;
		const bounds3Val = expansion
			? expandBounds3(baseBounds3, expansion, floorElevation, wallHeight)
			: baseBounds3;
		if (
			!sameAuthored(currentCompiled.bounds2, bounds2Val) ||
			!sameAuthored(currentCompiled.bounds3, bounds3Val)
		) {
			countWork('pairs:wall-aabb', 1);
			const compiled: CompiledPhysicalWall = {
				...baseCompiled,
				bounds2: bounds2Val,
				bounds3: bounds3Val,
			};
			const wallAabb = aabbRecord(
				'wall',
				wallId,
				['wall', floorId, wallId],
				bounds3Val.min,
				bounds3Val.max,
			);
			return { compiled, wallAabb };
		}
		return { compiled: currentCompiled, wallAabb: currentWallAabb };
	},

	compileObjects(objects, documentRoomIds, reuse): CompiledObjectsUnit {
		const issues: LayoutGeometryIssue[] = [];
		const queryBuilder = createQueryGeometryBuilder();
		const compiledObjects = compileObjects(objects, issues, queryBuilder, reuse);
		let docMin: Vec3 = [Infinity, Infinity, Infinity];
		let docMax: Vec3 = [-Infinity, -Infinity, -Infinity];
		let floorMin: Vec3 = [Infinity, Infinity, Infinity];
		let floorMax: Vec3 = [-Infinity, -Infinity, -Infinity];
		for (const object of compiledObjects) {
			includeBounds3(docMin, docMax, object.worldAabb.min, object.worldAabb.max);
			if (!object.roomId) continue;
			countWork('pairs:object-room', 1);
			if (documentRoomIds.has(object.roomId)) {
				includeBounds3(floorMin, floorMax, object.worldAabb.min, object.worldAabb.max);
			}
		}
		return {
			compiledObjects,
			polygons: queryBuilder.polygons,
			aabbs: queryBuilder.aabbs,
			issues,
			bounds3: finiteBounds3(docMin, docMax),
			floorRoomBounds3: finiteBounds3(floorMin, floorMax),
		};
	},

	buildFloorAndAabbs(floor, floorRoomIds, floorBounds, documentBounds, reuse): FloorAndAabbsUnit {
		return buildWallFirstFloorAndAggregateAabbs(
			floor,
			floorRoomIds,
			floorBounds,
			documentBounds,
			reuse,
		);
	},

	computeWallBaseBounds(wall, floorElevation) {
		return {
			bounds2: wallBounds2(wall.samples, wall.thickness),
			bounds3: wallBounds3(
				wall.samples,
				wall.thickness,
				floorElevation,
				floorElevation +
					(wall.topProfile ? compiledWallTopPeak(wall.topProfile, wall.height) : wall.height),
			),
		};
	},
};
