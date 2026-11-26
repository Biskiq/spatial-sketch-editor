import type {
	LayoutDocumentWallFirst,
	LayoutWall,
	LayoutWallOpening,
	OrientedWallRef,
} from './types';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { LayoutSurfaceLineage } from '../plan/surface-reference';
import {
	normalizeLayoutSurfaceLineage,
	roomSurfaceLineage,
	splitWallSurfaceLineage,
} from '../plan/surface-reference';
import { p2311Measure } from '../kernel/work-observer';
import { validateWallFirstLayoutDocument } from './codec';
import { compileWallFirstLayoutGeometry } from '../geometry/compiler';
import { hasBlockingLayoutIssues } from '../geometry/validation';
import { CURVE_ARC_LENGTH_TOLERANCE } from '../geometry/curve';
import { extractBoundaryCandidateFaces } from '../geometry/face-extraction';
import { buildCorrespondenceComponents } from '../room/reconciliation-correspondence';
import {
	createRoomBoundaryLookup,
	interiorWitness,
	roomBoundaryPolygon,
} from '../room/reconciliation-boundary';
import { reconcileRooms } from '../room/reconciliation';
import { createAuthoringRoomAllocator } from './topology-ops';
import { allocateCapturedId } from '../plan/id-capture';
import { validateClosedWallContacts } from '../topology/wall-first';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
} from '../room/topology-components';
import { planWallCrossing, planWallSplitAtPoint } from './noding';
import { wallCubicChain } from './centerline';
import type { ResolvedWallSplitResult } from './curve-algebra';
import type {
	RoundOperationCorrespondence,
	RoundOperationJunctionCorrespondence,
	RoundOperationOpeningCorrespondence,
} from '../room/round-room';
import { partitionClosedWallChainAtStations } from '../room/round-room';
import { carryRegionWallIntents } from '../room/region-validation';
import { coincidesAsJunction } from './junction-identity';
import { nextNodingFix, validateChainTopology } from './chain-repair';
import { nodingAllocatorAdapter } from './chain-noding';
import type { WallChainPlan, WallChainPlanOptions, WallChainRejection } from './chain-types';
import { cloneWallFirstDocument } from './chain-plan';
import { createCapturedWallChainAllocator } from './chain-types';
import { absorbPartialVirtualEdgeWalls } from './chain-virtual-edges';

export type ClosedToRingSpec = {
	readonly closedWall: LayoutWall;
	readonly roundRoomId: string;
	readonly seamPoint: LayoutVec2;
	readonly closedLength: number;
	readonly stations: readonly ResolvedWallSplitResult[];
	readonly snappedPoints: ReadonlyArray<
		| { readonly pointIndex: number; readonly kind: 'seam' }
		| {
				readonly pointIndex: number;
				readonly kind: 'interior';
				readonly split: ResolvedWallSplitResult;
		  }
	>;
};

export function executeWallChainCandidate(
	options: WallChainPlanOptions,
	thickness: number,
	height: number,
	resolvedInput: ReadonlyArray<{ junctionId: string | null; point: LayoutVec2 }>,
	legEndpoints: ReadonlyArray<{
		start: { junctionId: string | null; point: LayoutVec2 };
		end: { junctionId: string | null; point: LayoutVec2 };
	}>,
	close: boolean,
	arcLeg: { readonly pointIndex: number; readonly centerline: LayoutWall['centerline'] } | null,
	declaredHostByPointIndexInput: ReadonlyMap<number, string>,
	closedSpecs: readonly ClosedToRingSpec[],
): WallChainPlan {
	const allocator = createCapturedWallChainAllocator(options.capture);
	const reject = (rejection: WallChainRejection): WallChainPlan => ({
		kind: 'rejected',
		rejection,
	});
	const resolved = resolvedInput.map((entry) => ({
		junctionId: entry.junctionId,
		point: [entry.point[0], entry.point[1]] as LayoutVec2,
	}));
	const declaredHostByPointIndex = new Map(declaredHostByPointIndexInput);

	// --- candidate construction ---------------------------------------------
	const candidate: LayoutDocumentWallFirst = cloneWallFirstDocument(options.baseline);
	const createdJunctionIds: string[] = [];
	const createdWallIds: string[] = [];
	const splitWallIds = new Set<string>();
	const closedPartitionSurfaceLineage: LayoutSurfaceLineage[number][] = [];
	const closedPartitionJunctionCorr: RoundOperationJunctionCorrespondence[] = [];
	const closedPartitionOpeningCorr: RoundOperationOpeningCorrespondence[] = [];
	const closedPartitionWallCorrs: RoundOperationCorrespondence['walls'][number][] = [];
	const regionWallSplits = new Map<string, readonly string[]>();
	const closedHostFragmentIds: string[] = [];

	for (const closedSpec of closedSpecs) {
		const { closedWall, roundRoomId, seamPoint, closedLength, stations, snappedPoints } =
			closedSpec;
		const seamJunctionId = closedWall.startJunctionId;
		const segments = partitionClosedWallChainAtStations({
			closedWall,
			seamPoint,
			totalLength: closedLength,
			stations,
		});
		const rimJunctionIds: string[] = [];
		for (let i = 0; i < stations.length; i += 1) {
			const takenJ = new Set(candidate.junctions.map((j) => j.id));
			const jId = allocateCapturedId(takenJ, `${closedWall.id}:rim:${i + 1}`, options.capture);
			candidate.junctions.push({ id: jId, point: [stations[i]!.point[0], stations[i]!.point[1]] });
			createdJunctionIds.push(jId);
			rimJunctionIds.push(jId);
			closedPartitionJunctionCorr.push({
				kind: 'born',
				junctionId: jId,
				sourceWallId: closedWall.id,
				station: stations[i]!.distance,
			});
		}

		const fragmentWalls: LayoutWall[] = [];
		const createdArcIds: string[] = [];
		for (let i = 0; i < segments.length; i += 1) {
			const seg = segments[i]!;
			const startJ = i === 0 ? seamJunctionId : rimJunctionIds[i - 1]!;
			const endJ = i === segments.length - 1 ? seamJunctionId : rimJunctionIds[i]!;
			const takenW = new Set([...candidate.walls.map((w) => w.id), ...createdArcIds]);
			const fragId =
				i === 0
					? closedWall.id
					: allocateCapturedId(takenW, `${closedWall.id}:arc:${i}`, options.capture);
			if (i > 0) {
				createdArcIds.push(fragId);
				createdWallIds.push(fragId);
				closedPartitionSurfaceLineage.push(...splitWallSurfaceLineage(closedWall.id, fragId));
			}
			fragmentWalls.push({
				id: fragId,
				startJunctionId: startJ,
				endJunctionId: endJ,
				thickness: closedWall.thickness,
				height: closedWall.height,
				centerline: wallCubicChain(seg.knots, seg.spans),
				...(closedWall.name !== undefined ? { name: closedWall.name } : {}),
			});
		}

		// Rebase hosted Openings across the k+1 fragments.
		const rebasedOpenings: LayoutWallOpening[] = [];
		for (const opening of candidate.openings) {
			if (opening.wallId !== closedWall.id) {
				rebasedOpenings.push(opening);
				continue;
			}
			const rawStart = ((opening.offset % closedLength) + closedLength) % closedLength;
			const oStart = closedLength - rawStart <= CURVE_ARC_LENGTH_TOLERANCE ? 0 : rawStart;
			const oEnd = oStart + opening.width;
			for (const station of stations) {
				if (
					station.distance > oStart + CURVE_ARC_LENGTH_TOLERANCE &&
					station.distance < oEnd - CURVE_ARC_LENGTH_TOLERANCE
				) {
					return reject({
						code: 'noding_rejected',
						message: `Attachment cut on closed Wall '${closedWall.id}' passes through Opening '${opening.id}' interior`,
						wallIds: [closedWall.id],
					});
				}
			}
			let targetIndex = 0;
			for (let i = 0; i < segments.length; i += 1) {
				const seg = segments[i]!;
				if (
					oStart >= seg.startDistance - CURVE_ARC_LENGTH_TOLERANCE &&
					oEnd <= seg.endDistance + CURVE_ARC_LENGTH_TOLERANCE
				) {
					targetIndex = i;
					break;
				}
			}
			const targetSeg = segments[targetIndex]!;
			const targetWall = fragmentWalls[targetIndex]!;
			const offset = Math.max(0, oStart - targetSeg.startDistance);
			rebasedOpenings.push({ ...opening, wallId: targetWall.id, offset });
			closedPartitionOpeningCorr.push({
				openingId: opening.id,
				beforeWallId: closedWall.id,
				afterWallId: targetWall.id,
			});
		}

		candidate.walls = candidate.walls.flatMap((w) =>
			w.id === closedWall.id ? fragmentWalls : [w],
		);
		candidate.openings = rebasedOpenings;
		candidate.rooms = candidate.rooms.map((r) =>
			r.id === roundRoomId
				? {
						...r,
						boundary: fragmentWalls.map(
							(w): OrientedWallRef => ({ wallId: w.id, direction: 'forward' }),
						),
					}
				: r,
		);
		const allFragIds = fragmentWalls.map((w) => w.id);
		regionWallSplits.set(closedWall.id, allFragIds);
		splitWallIds.add(closedWall.id);
		closedHostFragmentIds.push(...allFragIds);
		closedPartitionWallCorrs.push({
			kind: 'subdivision',
			sourceWallId: closedWall.id,
			fragmentWallIds: allFragIds,
		});

		// Bind snapped draft points to the resolved rim Junctions and remove closed-Wall host declarations.
		for (const snapped of snappedPoints) {
			if (snapped.kind === 'seam') {
				resolved[snapped.pointIndex] = {
					junctionId: seamJunctionId,
					point: [seamPoint[0], seamPoint[1]],
				};
			} else {
				const cutIdx = stations.findIndex((s) => coincidesAsJunction(s.point, snapped.split.point));
				const jId = rimJunctionIds[cutIdx]!;
				const jPt = stations[cutIdx]!.point;
				resolved[snapped.pointIndex] = { junctionId: jId, point: [jPt[0], jPt[1]] };
			}
			declaredHostByPointIndex.delete(snapped.pointIndex);
		}
	}
	if (regionWallSplits.size > 0) {
		candidate.regions = carryRegionWallIntents(candidate.regions, regionWallSplits);
	}

	// Allocate one junction per distinct unresolved chain point (resolved
	// entries carry the IDs forward; legs read them directly).
	for (const entry of resolved) {
		if (entry.junctionId) continue;
		const taken = new Set(candidate.junctions.map((junction) => junction.id));
		const id = allocator.nextJunctionId(taken, `junction-chain-${createdJunctionIds.length + 1}`);
		candidate.junctions.push({ id, point: entry.point });
		createdJunctionIds.push(id);
		entry.junctionId = id;
	}

	for (const [index] of legEndpoints.entries()) {
		const startId = resolved[close ? index % resolved.length : index]!.junctionId!;
		const endId = resolved[close ? (index + 1) % resolved.length : index + 1]!.junctionId!;
		const taken = new Set(candidate.walls.map((wall) => wall.id));
		const id = allocator.nextWallId(taken, `wall-chain-${index + 1}`);
		const wall: LayoutWall = {
			id,
			startJunctionId: startId,
			endJunctionId: endId,
			thickness,
			height,
			// Authored chain legs are straight; A3 is the one bounded
			// exception: the drawn Arc's leg carries the canonical cubic-chain the
			// curve planners already read, and every other leg stays `line`.
			centerline:
				arcLeg !== null && index === arcLeg.pointIndex ? arcLeg.centerline : { kind: 'line' },
		};
		candidate.walls.push(wall);
		createdWallIds.push(id);
	}

	// --- noding against the full candidate graph -----------------------------
	// The chain may T into or cross pre-existing walls (and vice versa). Every
	// un-noded relationship is resolved through the noding plans until
	// the graph is clean; distances are always recomputed against the current
	// candidate so a wall already fragmented by an earlier fix stays correct.
	//
	// Provenance: `authoredWallIds` tracks the candidate segment lineage
	// (initial legs plus fragments of authored walls). Host fragments split
	// off pre-existing walls stay host-derived and never enter this set —
	// they are still reported via `createdWallIds`/`splitWallIds` but they
	// must not participate as authored walls in later noding passes.
	const nodedJunctionIds = new Set<string>();
	const authoredWallIds = new Set<string>(
		createdWallIds.filter((id) => !closedHostFragmentIds.includes(id)),
	);
	const operationOwnedJunctionIds = new Set<string>(createdJunctionIds);
	// The validated declarations, re-keyed onto the Junction each declared point
	// actually resolved to (a declared identity, or the chain's own minted node).
	// Stored as a Set per Junction so a multi-snap stroke splitting one host arc
	// propagates authorization to the newly split fragment as well.
	const endpointHostWallIds = new Map<string, Set<string>>();
	for (const [pointIndex, wallId] of declaredHostByPointIndex) {
		const junctionId = resolved[pointIndex]?.junctionId;
		if (junctionId) {
			const set = endpointHostWallIds.get(junctionId) ?? new Set<string>();
			set.add(wallId);
			endpointHostWallIds.set(junctionId, set);
		}
	}
	const baselineJunctionIds = new Set(options.baseline.junctions.map((junction) => junction.id));
	const junctionIdRedirects = new Map<string, string>();
	const resolveJunctionId = (junctionId: string): string => {
		let resolvedId = junctionId;
		const visited = new Set<string>();
		while (!visited.has(resolvedId)) {
			visited.add(resolvedId);
			const redirect = junctionIdRedirects.get(resolvedId);
			if (!redirect) break;
			resolvedId = redirect;
		}
		return resolvedId;
	};
	const MAX_NODING_PASSES = 64;
	const nodingSurfaceLineage: LayoutSurfaceLineage[number][] = [];
	let passes = 0;
	for (;;) {
		passes += 1;
		if (passes > MAX_NODING_PASSES) {
			return reject({ code: 'noding_rejected', message: 'Chain noding did not converge' });
		}
		const fix = nextNodingFix(
			candidate,
			[...authoredWallIds],
			operationOwnedJunctionIds,
			endpointHostWallIds,
		);
		if (!fix) break;
		if (fix.kind === 'reject') return reject(fix.rejection);
		if (fix.kind === 'adopt') {
			// Two Junction records described one physical node (a chain point and
			// a crossing-derived point a hair apart). Adopt one identity instead
			// of splitting: geometry is untouched, only the duplicate record is
			// retired and every wall reference is remapped.
			const duplicates = new Set(fix.duplicateJunctionIds);
			for (const duplicateId of duplicates) {
				junctionIdRedirects.set(duplicateId, fix.keepJunctionId);
				operationOwnedJunctionIds.delete(duplicateId);
			}
			candidate.junctions = candidate.junctions.filter((junction) => !duplicates.has(junction.id));
			candidate.walls = candidate.walls.map((wall) => {
				const start = duplicates.has(wall.startJunctionId);
				const end = duplicates.has(wall.endJunctionId);
				if (!start && !end) return wall;
				return {
					...wall,
					startJunctionId: start ? fix.keepJunctionId : wall.startJunctionId,
					endJunctionId: end ? fix.keepJunctionId : wall.endJunctionId,
				};
			});
			continue;
		}
		if (fix.kind === 'tee' && fix.projectOwnedEndpoint) {
			candidate.junctions = candidate.junctions.map((junction) =>
				junction.id === fix.endpointJunctionId
					? { ...junction, point: [fix.point[0], fix.point[1]] }
					: junction,
			);
		}
		const plan =
			fix.kind === 'crossing'
				? planWallCrossing(
						candidate,
						fix.wallIds,
						fix.point,
						nodingAllocatorAdapter(allocator, candidate),
					)
				: planWallSplitAtPoint(
						candidate,
						fix.interiorWallId,
						fix.splitDistance,
						fix.point,
						nodingAllocatorAdapter(allocator, candidate),
						{
							existingJunctionId: fix.endpointJunctionId,
						},
					);
		if (plan.kind === 'rejected') {
			return reject({
				code: 'noding_rejected',
				message: plan.rejection.message,
				wallIds: plan.rejection.wallId ? [plan.rejection.wallId] : undefined,
			});
		}
		nodingSurfaceLineage.push(...plan.surfaceLineage);
		const document = plan.document as LayoutDocumentWallFirst;
		const before = new Set(candidate.walls.map((wall) => wall.id));
		// Attribute new fragments by parent provenance: an authored parent's
		// child inherits authored lineage; a host parent's child stays host.
		if (fix.kind === 'crossing') {
			const ordered = [...fix.wallIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
			plan.createdWallIds.forEach((created, createdIndex) => {
				if (before.has(created)) return;
				createdWallIds.push(created);
				const parentId = ordered[createdIndex];
				if (parentId !== undefined && authoredWallIds.has(parentId)) {
					authoredWallIds.add(created);
				}
			});
		} else {
			for (const created of plan.createdWallIds) {
				if (before.has(created)) continue;
				createdWallIds.push(created);
				if (authoredWallIds.has(fix.interiorWallId)) {
					authoredWallIds.add(created);
				}
			}
		}
		for (const split of plan.splitWallIds) splitWallIds.add(split);
		if (fix.kind === 'tee') {
			for (const hostSet of endpointHostWallIds.values()) {
				if (hostSet.has(fix.interiorWallId)) {
					for (const created of plan.createdWallIds) hostSet.add(created);
				}
			}
		}
		if (!baselineJunctionIds.has(plan.junctionId)) {
			nodedJunctionIds.add(plan.junctionId);
			operationOwnedJunctionIds.add(plan.junctionId);
		}
		// planWallCrossing/planWallSplit return full documents; adopt them.
		candidate.junctions = document.junctions;
		candidate.walls = document.walls;
		candidate.rooms = document.rooms;
		candidate.regions = document.regions;
		candidate.openings = document.openings;
	}

	// SP1d partial-Wall absorption: a newly drawn Wall that starts at one
	// virtual-edge Junction and ends on a proper subsegment of that edge replaces
	// the covered part of the open side and joins the Space boundary. This runs
	// before reconciliation so the carry rule sees the authored boundary; the
	// full-edge case stays the existing face/closure path.
	const absorbedRoomIds = absorbPartialVirtualEdgeWalls(candidate, authoredWallIds);

	// --- topology gate: no un-noded crossing may survive ---------------------
	const closedContact = validateClosedWallContacts(
		candidate,
		new Set([...createdWallIds, ...splitWallIds]),
	);
	if (closedContact)
		return reject({ code: 'closed_wall_isolated', message: closedContact.message });
	const topologyIssue = p2311Measure('chain-topology-gate', () => validateChainTopology(candidate));
	if (topologyIssue) return reject(topologyIssue);

	// --- room reconciliation (every chain) ----------------------------------
	// Format 6: a closed ring encloses and a Wall between two points of one Room's
	// boundary divides it. There is no authored role to gate on, so every chain
	// runs the same correspondence reconciliation.
	let lineage: Array<{ faceKey: string; roomId: string; kind: 'created' }> = [];
	let surfaceLineage: LayoutSurfaceLineage = [];
	let retiredRoomIds: string[] = [];
	{
		const extraction = p2311Measure('face-extraction', () =>
			extractBoundaryCandidateFaces(candidate),
		);
		if (extraction.faces.length > 0 || options.baseline.rooms.length > 0) {
			const predecessorPolygons = new Map<string, readonly LayoutVec2[]>();
			const predecessorWitnesses = new Map<string, LayoutVec2>();
			const boundaryLookup = createRoomBoundaryLookup(options.baseline);
			for (const room of options.baseline.rooms) {
				const polygon = roomBoundaryPolygon(options.baseline, room.id, boundaryLookup);
				if (!polygon) {
					return reject({
						code: 'room_reconciliation_rejected',
						message: `Predecessor room '${room.id}' has an unresolvable boundary`,
					});
				}
				predecessorPolygons.set(room.id, polygon);
				predecessorWitnesses.set(room.id, interiorWitness(polygon));
			}
			// True correspondence components: connected components of
			// the bipartite predecessor-Room ↕ candidate-face graph. An edge
			// exists when the predecessor witness lies strictly inside the
			// face or the predecessor polygon overlaps the face with
			// positive area — AND (P23B.3a D-12) authored identity puts both
			// sides in the same connected component, so an authored Wall
			// landing over an INDEPENDENT group can never claim its Rooms.
			// Faces with no predecessor form independent 0→1 birth
			// components. Never one-component-per-face.
			const components = p2311Measure('correspondence', () =>
				buildCorrespondenceComponents({
					faces: extraction.faces,
					predecessorRoomIds: options.baseline.rooms.map((room) => room.id),
					predecessorWitnesses,
					predecessorPolygons,
					candidateDocument: candidate,
					baselineRooms: options.baseline.rooms,
				}),
			);
			const result = p2311Measure('room-reconciliation', () =>
				reconcileRooms({
					baseline: options.baseline,
					candidateDocument: candidate,
					extraction,
					components,
					predecessorWitnesses,
					predecessorPolygons,
					// The chain is non-removal: an already-open Space is preserved,
					// never retired by an unrelated stroke.
					candidateRooms: candidate.rooms,
					allocator: createAuthoringRoomAllocator(options.capture, options.roomNamePrefix),
				}),
			);
			if ('rejection' in result) {
				return reject({
					code: 'room_reconciliation_rejected',
					message: result.rejection.message,
					...(result.rejection.roomIds ? { wallIds: result.rejection.roomIds } : {}),
					...(result.rejection.faceKey ? { topology: extraction.diagnostics } : {}),
				});
			}
			candidate.rooms = result.document.rooms;
			candidate.objects = result.document.objects;
			candidate.openings = result.document.openings;
			lineage = result.lineage
				.filter((record) => record.kind === 'created')
				.map((record) => ({
					faceKey: record.faceKey,
					roomId: record.roomId,
					kind: 'created' as const,
				}));
			retiredRoomIds = [...result.retiredRoomIds];
			surfaceLineage = roomSurfaceLineage(result.lineage);
		}
	}

	// --- final canonical gates ----------------------------------------------
	const canonical = p2311Measure('chain-canonical-gates', () => {
		const validated = validateWallFirstLayoutDocument(candidate);
		return {
			validated,
			compiled: validated.success ? compileWallFirstLayoutGeometry(validated.document) : null,
		};
	});
	const validated = canonical.validated;
	if (!validated.success) {
		return reject({
			code: 'invalid_candidate_document',
			message: `Candidate failed wall-first validation: ${validated.issues[0]?.message ?? 'unknown issue'}`,
			issues: validated.issues,
		});
	}
	const compiled = canonical.compiled!;
	if (hasBlockingLayoutIssues(compiled.issues)) {
		return reject({
			code: 'candidate_does_not_compile',
			message: `Candidate document does not compile: ${compiled.issues[0]?.message ?? 'unknown geometry issue'}`,
			issues: compiled.issues,
		});
	}

	const finalJunctionIds = new Set(validated.document.junctions.map((junction) => junction.id));
	// The last-resort coordinate recovery may only reach identities in
	// the component this operation authored. Coincident records in unrelated
	// components are legal now, so an unrestricted lookup could hand a chain an
	// unrelated group's Junction as its own start/end — the implicit join this step
	// removes, leaking back out through the return value.
	const finalComponentKeyByWallId = topologyComponentKeyByWallId(validated.document);
	const finalJunctionComponentKeyById = topologyComponentKeyByJunctionId(
		validated.document,
		finalComponentKeyByWallId,
	);
	const authoredComponentKeys = new Set<string | symbol>(
		[...authoredWallIds]
			.map((wallId) => finalComponentKeyByWallId.get(wallId))
			.filter((key): key is string => key !== undefined),
	);
	const resolveFinalJunctionId = (entry: {
		junctionId: string | null;
		point: LayoutVec2;
	}): string | null => {
		if (!entry.junctionId) return null;
		const redirectedId = resolveJunctionId(entry.junctionId);
		if (finalJunctionIds.has(redirectedId)) return redirectedId;
		return (
			validated.document.junctions.find((junction) => {
				if (!coincidesAsJunction(junction.point, entry.point)) return false;
				const key = finalJunctionComponentKeyById.get(junction.id);
				return key !== undefined && authoredComponentKeys.has(key);
			})?.id ?? null
		);
	};
	const startJunctionId = resolveFinalJunctionId(resolved[0]!);
	const endJunctionId = resolveFinalJunctionId(
		close ? resolved[0]! : resolved[resolved.length - 1]!,
	);
	if (!startJunctionId || !endJunctionId) {
		return reject({
			code: 'invalid_candidate_document',
			message: 'Committed candidate lost a resolved Junction identity',
		});
	}

	const normalizedSurfaceLineage = normalizeLayoutSurfaceLineage({
		beforeLayout: options.baseline,
		afterLayout: validated.document,
		lineage: [...closedPartitionSurfaceLineage, ...nodingSurfaceLineage, ...surfaceLineage],
	});
	if (normalizedSurfaceLineage.kind === 'rejected') {
		return reject({
			code: 'invalid_candidate_document',
			message: normalizedSurfaceLineage.message,
		});
	}

	const clearedRoundRoomIds: string[] = [];
	const roundRoomCorr: RoundOperationCorrespondence['rooms'][number][] = [];
	for (const baseRoom of options.baseline.rooms) {
		if (baseRoom.round === undefined) continue;
		const afterRoom = validated.document.rooms.find((r) => r.id === baseRoom.id);
		if (!afterRoom) {
			roundRoomCorr.push({ roomId: baseRoom.id, status: 'retired' });
		} else if (afterRoom.round === undefined) {
			clearedRoundRoomIds.push(baseRoom.id);
			roundRoomCorr.push({ roomId: baseRoom.id, status: 'cleared-round' });
		} else {
			roundRoomCorr.push({ roomId: baseRoom.id, status: 'preserved' });
		}
	}
	const roundCorrespondence: RoundOperationCorrespondence | undefined =
		closedPartitionWallCorrs.length > 0 || clearedRoundRoomIds.length > 0
			? {
					rooms: roundRoomCorr,
					walls: closedPartitionWallCorrs,
					junctions: closedPartitionJunctionCorr,
					openings: closedPartitionOpeningCorr,
				}
			: undefined;

	return {
		kind: 'success',
		document: validated.document,
		createdWallIds: [...new Set(createdWallIds)],
		authoredWallIds: [...authoredWallIds],
		createdJunctionIds: [...new Set([...createdJunctionIds, ...nodedJunctionIds])].filter(
			(junctionId) => finalJunctionIds.has(junctionId),
		),
		splitWallIds: [...splitWallIds],
		startJunctionId,
		endJunctionId,
		lineage,
		surfaceLineage: normalizedSurfaceLineage.lineage,
		retiredRoomIds,
		absorbedRoomIds,
		...(clearedRoundRoomIds.length > 0 ? { clearedRoundRoomIds } : {}),
		...(roundCorrespondence ? { roundCorrespondence } : {}),
		// P23B.11 M-4 — the final canonical gate above is the ONLY compile
		// authority; this carries its result so an installing caller does not pay
		// for a second compile of the same accepted document.
		acceptance: {
			documentJson: validated.canonicalJson,
			geometry: compiled.geometry,
			issues: compiled.issues,
		},
	};
}
