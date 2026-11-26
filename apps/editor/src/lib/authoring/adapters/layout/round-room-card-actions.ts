/**
 * C4 — the Round Room's Card actions.
 *
 * Release round is the Room's explicit way out of the circle: a connected ring
 * only clears the Room's stated fact, while an isolated circle is split into two
 * ordinary open arcs of the same locus in the same operation. The Wall's
 * `Go to <Room>` links are the way back from one arc to the whole; they only
 * change the selection.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import { isClosedWall, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type {
	StageAdapterServices,
	StageCardAction,
} from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';

import { wallBoundingRoundRooms } from './precision-facts';
import { roundRoomReleaseIntent } from './round-room-planners';

type RoomFact = {
	readonly id: string;
	readonly name: string;
	readonly round?: unknown;
	readonly boundary: readonly { readonly wallId: string }[];
};

function roomReleaseRoundAction(
	services: StageAdapterServices,
	roomId: string,
	roomName: string,
	isolatedCircle: boolean,
): StageCardAction {
	return {
		id: 'layout-room-release-round',
		label: 'Release round',
		group: 'secondary',
		detail: isolatedCircle
			? `Splits the circle into two ordinary curved Walls. ${roomName} stops being round. One undo step.`
			: `Clears the Round fact; the arc Walls stay ordinary curved Walls. ${roomName} stops being round. One undo step.`,
		run: async () => {
			const capture = mintLayoutIdCapture();
			const snapshot = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				roundRoomReleaseIntent({
					roomId,
					capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId,
				}),
			);
			services.stage.notifySurfaceChange();
			if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message };
			return outcome.kind === 'no-op'
				? { kind: 'no-op', message: `${roomName} was already not round.` }
				: { kind: 'accepted' };
		},
	};
}

/** Release round, only while the Room still states the Round fact. */
export function roundRoomActions(
	services: StageAdapterServices,
	document: LayoutDocumentWallFirst,
	room: RoomFact,
): StageCardAction[] {
	if (room.round === undefined) return [];
	const onlyWall =
		room.boundary.length === 1
			? document.walls.find((wall) => wall.id === room.boundary[0]!.wallId)
			: undefined;
	return [
		roomReleaseRoundAction(
			services,
			room.id,
			room.name,
			onlyWall !== undefined && isClosedWall(onlyWall),
		),
	];
}

/** One selection step from a Wall to each Room it bounds. */
export function wallBoundingRoomActions(
	services: StageAdapterServices,
	document: LayoutDocumentWallFirst,
	wallId: string,
): StageCardAction[] {
	return wallBoundingRoundRooms(document, wallId).map((room) => ({
		id: `layout-wall-bounds:${room.roomId}`,
		label: `Go to ${room.name}`,
		group: 'secondary',
		detail: `Selects ${room.name}, the Room this Wall bounds.`,
		run: async () => {
			const fresh = services.stage.snapshot();
			services.stage.select({
				sourceId: room.roomId,
				sourceKind: 'room-floor',
				generationId: fresh.compileGeneration,
				ref: {
					sourceId: room.roomId,
					sourceKind: 'room-floor',
					generationId: fresh.compileGeneration,
					stream: 'projected',
					subRef: null,
				},
			});
			return { kind: 'accepted' };
		},
	}));
}
