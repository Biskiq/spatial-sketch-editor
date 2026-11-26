/**
 * The Layout Card's scoped actions.
 *
 * Duplicate, overhead, remove-space, Wall deletion/split, Opening deletion and
 * Region removal each disclose the canonical planner's consequence before the
 * click; every run is one ordinary F.4 acceptance and one history entry.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import {
	isClosedWall,
	planDeleteWallFirstOpening,
	type LayoutDocumentWallFirst,
} from '@portfolio/layout-core/wall';
import { resolveRoomCopyEnclosure } from '@portfolio/layout-core/room';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageCardAction,
	StageCardActionOutcome,
	StageCardSubject,
} from '$lib/authoring/stage/stage-adapter-host';
import { restingObjectsOnFloorRegion } from './region-resting';
import { wallFace } from '$lib/authoring/layout/wall-face-store';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { WALL_UNFOLD_SHAPE_REFUSAL } from '$lib/layout/wall-unfold';
import { wallFaceFrame, wallSheetFaceFrame } from '$lib/layout/wall-face';
import type { LayoutSessionPorts } from './session-ports';
import type { ActiveKnot } from './layout-marks';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import { interiorLift } from '$lib/authoring/layout/interior-lift-store.svelte';
import {
	droppedRoomRelationWords,
	roomDuplicateRefusalWords,
	wallSplitRefusalWords,
} from './refusals';
import { openingDeleteIntent, openingRefusalWords } from './opening-planners';
import {
	layoutSubjectReference,
	wallDeleteIntent,
	type WallDeletionPreview,
} from './drawing-planners';
import { wallSplitIntent } from './split-planners';
import {
	LAYOUT_REGION_FOOTPRINT_KIND,
	LAYOUT_REGION_REMOVE_KIND,
	regionEditIntent,
} from './region-planners';
import type { RegionEdgePick } from './session-ports';
import {
	LAYOUT_ROOM_OVERHEAD_KIND,
	LAYOUT_SPACE_REMOVE_KIND,
	buildLayoutIntent,
} from './precision';
import { wallStraightenIntent } from './precision-intents';
import { previewWallStraighten, wallStationFrame } from './precision-frames';

/**
 * X1 — Lift is a **reading, not an edit**.
 *
 * The action changes only the shell's temporary scope: no document value, no
 * history entry, no Camera intent. It is a Room action because a generated lid
 * has no subject of its own and is selected through its Room. Running it while
 * Lift is on with another scope narrows to this Space; while it is off, it
 * starts here. The label follows the live scope, so the same button offers the
 * way back.
 */
function roomLiftAction(
	services: StageAdapterServices,
	roomId: string,
	roomName: string,
): StageCardAction {
	const scope = interiorLift.reading?.scope ?? null;
	const liftedHere = scope?.kind === 'space' && scope.roomId === roomId;
	return {
		id: 'layout-room-lift',
		label: liftedHere ? 'Put back' : 'Lift',
		detail: liftedHere
			? `Puts ${roomName}'s overhead back. Nothing in the document changes.`
			: `Lifts ${roomName}'s overhead to read inside. Nothing in the document changes.`,
		run: async () => {
			if (liftedHere) interiorLift.putBack();
			else interiorLift.lift({ kind: 'space', roomId });
			services.stage.notifySurfaceChange();
			return { kind: 'accepted' };
		},
	};
}

function roomDuplicateCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function layoutCardActions(
	input: {
		readonly services: StageAdapterServices;
		readonly context: StageAdapterContext;
		readonly levelId: string;
		readonly selectLayoutSubject: LayoutSessionPorts['select'];
		readonly readActiveKnot: () => ActiveKnot | null;
		readonly document: LayoutDocumentWallFirst;
		readonly deletionPreview: (wallId: string) => WallDeletionPreview;
		readonly requestRoomDuplicate: (roomId: string) => StageCardActionOutcome;
		readonly removeSelectedKnot: (
			wallId: string,
		) => Promise<StageCardActionOutcome> | StageCardActionOutcome;
		readonly regionEdgePick: RegionEdgePick;
	},
	cardSubject: StageCardSubject,
): readonly StageCardAction[] {
	const {
		services,
		context,
		document,
		levelId,
		deletionPreview,
		requestRoomDuplicate,
		removeSelectedKnot,
		regionEdgePick,
		selectLayoutSubject,
		readActiveKnot,
	} = input;

	// A5 — Duplicate is the Room's one scoped action and it works for every
	// Room. The disclosure comes from the same copy-enclosure resolver the
	// acceptance re-proves: a shared boundary Wall copies privately, and
	// every Door relation that would leave the copy is named before the
	// click. Only a genuine refusal (an unknown Room, an unresolved
	// boundary or a read-only profile object) withholds the action.
	if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
		const roomId = cardSubject.sourceId;
		const room = document.rooms.find((entry) => entry.id === roomId);
		if (room === undefined) {
			return [
				{
					id: 'layout-room-duplicate',
					label: 'Duplicate',
					group: 'secondary',
					detail: 'That Room is gone. Select the Room again.',
					run: async () => ({
						kind: 'refused',
						message: 'That Room is gone. Select the Room again.',
					}),
				},
			];
		}
		const resolved = resolveRoomCopyEnclosure(document, roomId);
		let detail: string;
		if (resolved.kind === 'rejected') {
			detail = roomDuplicateRefusalWords(document, resolved.rejection);
		} else {
			const enclosure = resolved.enclosure;
			const objects = enclosure.associatedObjectIds.length;
			const dropped = droppedRoomRelationWords(document, roomId, enclosure.droppedRelations);
			detail = [
				`Copies ${room.name} as a free island with its ${roomDuplicateCount(enclosure.wallIds.length, 'Wall')}, ${roomDuplicateCount(enclosure.junctionIds.length, 'Junction')}, ${roomDuplicateCount(enclosure.openingIds.length, 'Opening')}${objects === 0 ? '' : ` and ${roomDuplicateCount(objects, 'object')}`}.`,
				...(dropped === null ? [] : [dropped]),
				'The copy starts clear of its source; move the pointer, then click to place it.',
			].join(' ');
		}
		const openSpace = room.virtualEdges.length > 0;
		const nextOverhead = room.overhead === 'open-to-sky' ? 'closed' : 'open-to-sky';
		return [
			roomLiftAction(services, roomId, room.name),
			{
				id: 'layout-room-duplicate',
				label: 'Duplicate',
				// Duplicate adds a copy and Undo removes it: it is scoped and
				// reversible, so it sits in the Card's More disclosure rather than
				// the destructive row.
				group: 'secondary',
				detail,
				run: async () => {
					if (resolved.kind === 'rejected') {
						return { kind: 'refused', message: detail };
					}
					return requestRoomDuplicate(roomId);
				},
			},
			{
				id: 'layout-room-overhead',
				label: nextOverhead === 'open-to-sky' ? 'Open to sky' : 'Close overhead',
				group: 'secondary',
				detail:
					nextOverhead === 'open-to-sky'
						? 'Removes the generated lid over this Space; its Walls, floor and area stay.'
						: 'Restores the generated lid over this Space; its Walls, floor and area stay.',
				run: async () => {
					const snapshot = services.stage.snapshot();
					const contentRevision = stageUnitRevision(snapshot, 'layout');
					const levelId = snapshot.domain.layoutLevelId;
					const outcome = await services.authoring.accept(
						buildLayoutIntent({
							kind: LAYOUT_ROOM_OVERHEAD_KIND,
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							contentRevision,
							levelId,
							targets: [
								layoutSubjectReference({ kind: 'room', id: roomId, contentRevision, levelId }),
							],
							payload: { roomId, overhead: nextOverhead },
						}),
					);
					if (outcome.kind === 'refused') {
						return { kind: 'refused', message: outcome.message };
					}
					services.stage.notifySurfaceChange();
					return outcome.kind === 'no-op'
						? { kind: 'no-op', message: 'The overhead already had that value.' }
						: { kind: 'accepted' };
				},
			},
			...(openSpace
				? [
						{
							id: 'layout-space-remove',
							label: 'Remove space',
							detail: `Removes ${room.name} and its open sides; its Walls stay. Objects keep their place and lose the association.`,
							destructive: true,
							run: async (): Promise<StageCardActionOutcome> => {
								const snapshot = services.stage.snapshot();
								const contentRevision = stageUnitRevision(snapshot, 'layout');
								const levelId = snapshot.domain.layoutLevelId;
								const outcome = await services.authoring.accept(
									buildLayoutIntent({
										kind: LAYOUT_SPACE_REMOVE_KIND,
										operationId: globalThis.crypto.randomUUID(),
										projectId: snapshot.acceptedRevision.projectId,
										revisionId: services.authoring.acceptedRevision().revisionId,
										contentRevision,
										levelId,
										targets: [
											layoutSubjectReference({
												kind: 'room',
												id: roomId,
												contentRevision,
												levelId,
											}),
										],
										payload: { roomId },
									}),
								);
								if (outcome.kind === 'refused') {
									return { kind: 'refused', message: outcome.message };
								}
								services.stage.notifySurfaceChange();
								return outcome.kind === 'no-op'
									? { kind: 'no-op', message: 'The Space was already gone.' }
									: { kind: 'accepted' };
							},
						},
					]
				: []),
		];
	}
	if (cardSubject.sourceKind === 'opening') {
		const opening = document.openings.find((entry) => entry.id === cardSubject.sourceId);
		if (opening === undefined) {
			return [
				{
					id: 'layout-opening-delete',
					label: 'Delete Opening',
					detail: 'That Opening is no longer in the project. Select its Wall and try again.',
					destructive: true,
					run: async () => ({
						kind: 'refused',
						message: 'That Opening is no longer in the project.',
					}),
				},
			];
		}
		const disclosure = planDeleteWallFirstOpening(document, opening.id);
		if (disclosure.kind === 'rejected') {
			return [
				{
					id: 'layout-opening-delete',
					label: 'Delete Opening',
					detail: openingRefusalWords(document, disclosure.rejection, {
						openingId: opening.id,
					}),
					destructive: true,
					run: async () => ({ kind: 'refused', message: 'The Opening could not be deleted.' }),
				},
			];
		}
		const hostWallId = opening.wallId;
		return [
			{
				id: 'layout-opening-delete',
				label: 'Delete Opening',
				detail: 'Removes this Opening from its Wall in one undo step.',
				destructive: true,
				run: async () => {
					const capture = mintLayoutIdCapture();
					const snapshot = services.stage.snapshot();
					const outcome = await services.authoring.accept(
						openingDeleteIntent({
							openingId: opening.id,
							capture,
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							contentRevision: stageUnitRevision(snapshot, 'layout'),
							levelId: snapshot.domain.layoutLevelId,
						}),
					);
					if (outcome.kind === 'refused') {
						services.stage.notifySurfaceChange();
						return { kind: 'refused', message: outcome.message };
					}
					selectLayoutSubject('wall', hostWallId);
					services.stage.notifySurfaceChange();
					return outcome.kind === 'no-op'
						? { kind: 'no-op', message: 'The Opening was already gone.' }
						: { kind: 'accepted' };
				},
			},
		];
	}
	if (cardSubject.sourceKind === 'region') {
		const region = document.regions.find((entry) => entry.id === cardSubject.sourceId);
		if (region === undefined) return [];
		const resting = restingObjectsOnFloorRegion(context.snapshot, region.id);
		const kind = region.role === 'overhead' ? 'Flat Roof' : 'Terrace';
		const edge = regionEdgePick.read();
		const picked = edge !== null && edge.regionId === region.id ? edge.index : null;
		const addCorner: StageCardAction | null =
			picked === null || picked < 0 || picked >= region.footprint.points.length
				? null
				: {
						id: 'layout-region-add-corner',
						label: 'Add corner here',
						detail: `Adds a corner at the midpoint of edge ${picked + 1}. The Region, its elevation and its thickness stay.`,
						run: async (): Promise<StageCardActionOutcome> => {
							const points = region.footprint.points.map(([x, z]): LayoutVec2 => [x, z]);
							if (points.length >= 1024) {
								return {
									kind: 'refused',
									message: 'A region footprint can store at most 1024 corners.',
								};
							}
							const start = points[picked]!;
							const end = points[(picked + 1) % points.length]!;
							points.splice(picked + 1, 0, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]);
							const snapshot = services.stage.snapshot();
							const outcome = await services.authoring.accept(
								regionEditIntent({
									kind: LAYOUT_REGION_FOOTPRINT_KIND,
									regionId: region.id,
									payload: { points },
									operationId: globalThis.crypto.randomUUID(),
									projectId: snapshot.acceptedRevision.projectId,
									revisionId: services.authoring.acceptedRevision().revisionId,
									contentRevision: stageUnitRevision(snapshot, 'layout'),
									levelId,
								}),
							);
							if (outcome.kind === 'refused') {
								return { kind: 'refused', message: outcome.message };
							}
							regionEdgePick.write(null);
							services.stage.notifySurfaceChange();
							return { kind: 'accepted' };
						},
					};
		return [
			...(addCorner === null ? [] : [addCorner]),
			{
				id: 'layout-region-delete',
				label: `Delete ${kind}`,
				destructive: true,
				detail: [
					region.role !== 'floor'
						? 'Removes this slab in one undo step; the Rooms and objects under it stay.'
						: resting === 1
							? '1 object rests on this platform and stays where it is when the platform is gone.'
							: `${resting} objects rest on this platform and stay where they are when the platform is gone.`,
					'Walls are unchanged.',
				].join(' '),
				run: async (): Promise<StageCardActionOutcome> => {
					const snapshot = services.stage.snapshot();
					const outcome = await services.authoring.accept(
						regionEditIntent({
							kind: LAYOUT_REGION_REMOVE_KIND,
							regionId: region.id,
							payload: { regionId: region.id },
							operationId: globalThis.crypto.randomUUID(),
							projectId: snapshot.acceptedRevision.projectId,
							revisionId: services.authoring.acceptedRevision().revisionId,
							contentRevision: stageUnitRevision(snapshot, 'layout'),
							levelId: snapshot.domain.layoutLevelId,
						}),
					);
					if (outcome.kind === 'refused') {
						return { kind: 'refused', message: outcome.message };
					}
					services.stage.notifySurfaceChange();
					return outcome.kind === 'no-op'
						? { kind: 'no-op', message: `The ${kind} was already gone.` }
						: { kind: 'accepted' };
				},
			},
		];
	}
	if (cardSubject.sourceKind !== 'wall') return [];
	const wallId = cardSubject.sourceId;
	// A6 — Face is one explicit Look action over the landed `face` intent.
	// Layout supplies the frame (bounds + look); the Camera derives the pose
	// and the route owns the clock, so nothing here writes a camera. Put back
	// restores the exact standpoint Face started from and is the action when
	// this Wall is the faced one.
	const facing = wallFace.isActive(wallId);
	const faceAction: StageCardAction = {
		id: 'layout-wall-face',
		label: facing ? 'Put back' : 'Face this wall',
		detail: facing
			? 'Returns the Camera to the view it had before Face.'
			: 'Squares the Camera to this Wall or its unrolled sheet. Put back returns to where you were looking.',
		run: async () => {
			if (wallFace.isActive(wallId)) {
				const outcome = wallFace.putBack(wallId);
				if (outcome.kind === 'refused') {
					return {
						kind: 'refused',
						message:
							outcome.reason === 'no-camera'
								? 'The Stage has no Camera to put back.'
								: 'The Camera could not return to where it was.',
					};
				}
				services.stage.notifySurfaceChange();
				return { kind: 'accepted' };
			}
			const wall = context.snapshot.domain.geometry.walls.find(
				(candidate) => candidate.wallId === wallId,
			);
			if (wall === undefined) {
				return { kind: 'refused', message: 'That Wall is no longer in the project.' };
			}
			const session = wallUnfold.state;
			const evaluation = services.stage.evaluation();
			if (evaluation === null) {
				return { kind: 'refused', message: 'The Stage is not ready to face a Wall.' };
			}
			const frame =
				session !== null && session.wallId === wallId
					? wallSheetFaceFrame({
							wall,
							state: session,
							sideAngle: wallUnfold.presentationAngle,
							floorY: context.snapshot.domain.datumMeters,
						})
					: wallFaceFrame(wall, {
							pose: evaluation.pose,
							reading: evaluation.settledReading,
						});
			if (frame === null) {
				return { kind: 'refused', message: 'That Wall has no face to square the view to.' };
			}
			const outcome = wallFace.face({ wallId, frame });
			if (outcome.kind === 'refused') {
				return {
					kind: 'refused',
					message:
						outcome.reason === 'no-camera'
							? 'The Stage has no Camera to face this Wall from.'
							: 'The Camera could not face this Wall.',
				};
			}
			services.stage.notifySurfaceChange();
			return { kind: 'accepted' };
		},
	};
	// One shared action channel for the active knot and the Wall's
	// shape. Each run previews the retained planner first and then accepts
	// one captured intent, so a refusal writes nothing and an acceptance is
	// one undo step. A straight Wall adds no action here.
	const wallSource = document.walls.find((candidate) => candidate.id === wallId);
	// One Split over the retained noder. The Card is the
	// midpoint path: a press elsewhere on the Wall never retargets it.
	// Pointer-specific placement belongs to the deferred Stage context
	// menu. Nothing here arms a tool or adds a mark.
	const splitLength = wallStationFrame(document, wallId)?.length;
	const splitAt = splitLength === undefined ? null : splitLength / 2;
	const splitOpening =
		splitAt === null
			? undefined
			: document.openings.find(
					(opening) =>
						opening.wallId === wallId &&
						splitAt > opening.offset &&
						splitAt < opening.offset + opening.width,
				);
	const splitRefusal =
		wallSource === undefined
			? 'That Wall is no longer in the project.'
			: isClosedWall(wallSource)
				? wallSplitRefusalWords('closed_wall_isolated')
				: splitAt === null
					? 'This Wall has no resolvable length.'
					: splitOpening !== undefined
						? wallSplitRefusalWords('split_through_opening_interior')
						: null;
	const splitAction: StageCardAction = {
		id: 'layout-wall-split',
		label: 'Split wall here',
		detail:
			splitRefusal ??
			`Adds a joint at ${splitAt!.toFixed(2)} m. The start-side Wall keeps this Wall's identity; Openings keep their places and the Room is unchanged.`,
		run: async () => {
			if (splitRefusal !== null || splitAt === null) {
				return { kind: 'refused', message: splitRefusal ?? 'The Wall cannot be split there.' };
			}
			const capture = mintLayoutIdCapture();
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				wallSplitIntent({
					wallId,
					distance: splitAt,
					capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId,
				}),
			);
			if (outcome.kind === 'refused') {
				services.stage.notifySurfaceChange();
				return { kind: 'refused', message: outcome.message };
			}
			// The start-side fragment keeps the Wall id; keep the creator on it so
			// the Card describes the Wall they just divided.
			selectLayoutSubject('wall', wallId);
			services.stage.notifySurfaceChange();
			return outcome.kind === 'no-op'
				? { kind: 'no-op', message: 'The Wall was already split there.' }
				: { kind: 'accepted' };
		},
	};
	const curveActions: StageCardAction[] = [];
	if (wallSource?.centerline.kind === 'cubic-chain') {
		const knots = wallSource.centerline.knots;
		const activeKnot = readActiveKnot();
		const activeIndex =
			activeKnot?.wallId === wallId
				? knots.findIndex((knot) => knot.id === activeKnot!.knotId)
				: -1;
		const runCurve = async (kind: 'delete' | 'straighten'): Promise<StageCardActionOutcome> => {
			// Centerline and knot shape edits are refused while unfolded,
			// explicitly and with the same words the Stage uses.
			if (wallUnfold.isActive(wallId)) {
				return { kind: 'refused', message: WALL_UNFOLD_SHAPE_REFUSAL };
			}
			// A Card record can outlive the session state it was rendered from. A
			// stale Remove must refuse, never fall through to the other shape action.
			if (kind === 'delete') return removeSelectedKnot(wallId);
			const preview = previewWallStraighten(document, wallId);
			if (preview.kind === 'refused') return { kind: 'refused', message: preview.message };
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				wallStraightenIntent({
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId,
					wallId,
				}),
			);
			if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
			services.stage.notifySurfaceChange();
			return { kind: 'accepted' };
		};
		if (activeIndex >= 0) {
			curveActions.push({
				id: 'layout-wall-knot-remove',
				label: 'Remove bend point',
				detail: `Removes bend point ${activeIndex + 1} of ${knots.length}; its two spans merge in one undo step.`,
				run: () => runCurve('delete'),
			});
		}
		curveActions.push({
			id: 'layout-wall-straighten',
			label: 'Straighten Wall',
			detail:
				'Returns this curved Wall to its straight chord in one undo step; hosted Openings keep their arc-length stations.',
			run: () => runCurve('straighten'),
		});
	}
	// Unfold entry lives only in the Card foot; the Stage pill
	// owns Put back and the face switch. Shape rings are contextual on
	// the selected Wall; there is no hidden Bend-armed mode.
	const preview = deletionPreview(wallId);
	if (preview.kind === 'refused') {
		return [
			faceAction,
			splitAction,
			...curveActions,
			{
				id: 'layout-wall-delete',
				label: 'Delete Wall',
				detail: preview.message,
				destructive: true,
				run: async () => ({ kind: 'refused', message: preview.message }),
			},
		];
	}
	return [
		faceAction,
		splitAction,
		...curveActions,
		{
			id: 'layout-wall-delete',
			label: 'Delete Wall',
			detail: preview.summary,
			destructive: true,
			run: async () => {
				const capture = mintLayoutIdCapture();
				const snapshot = services.stage.snapshot();
				const outcome = await services.authoring.accept(
					wallDeleteIntent({
						wallId,
						capture,
						operationId: globalThis.crypto.randomUUID(),
						projectId: snapshot.acceptedRevision.projectId,
						revisionId: services.authoring.acceptedRevision().revisionId,
						contentRevision: stageUnitRevision(snapshot, 'layout'),
						levelId: snapshot.domain.layoutLevelId,
					}),
				);
				services.stage.notifySurfaceChange();
				if (outcome.kind === 'refused') {
					return { kind: 'refused', message: outcome.message };
				}
				return outcome.kind === 'no-op'
					? { kind: 'no-op', message: 'The Wall was already gone.' }
					: { kind: 'accepted' };
			},
		},
	];
}
