/**
 * The one Circle commit: the same captured centre/rim plan the preview showed,
 * accepted as one closed-Wall intent and followed by its selection.
 *
 * The input exposes the session's live capture, in-flight flag, plan builder and
 * notice sink; this module owns no state.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { ChainDraftPoint, ChainPlanPreview } from './chain';
import { circleRoomCreateIntent } from './drawing-planners';
import { LAYOUT_INK_ENTRY } from './ink';

export type InkCircleCommitInput = {
	readonly services: StageAdapterServices;
	readonly memory: { readonly thickness: number | null; readonly height: number | null };
	readonly levelId: string;
	readonly inFlight: () => boolean;
	readonly setInFlight: (value: boolean) => void;
	readonly capture: () => ReturnType<typeof mintLayoutIdCapture> | null;
	readonly planCircleDraft: (center: ChainDraftPoint, rim: ChainDraftPoint) => ChainPlanPreview;
	readonly setNotice: (message: string) => void;
	readonly publish: () => void;
	readonly clearChain: () => void;
};



/**
 * Accept one Circle as one captured closed-Wall intent. The preview and
 * the commit use the same capture and the same centre/rim points, so the
 * seam is exactly the authored rim and a replay reproduces both ids.
 */
export async function commitCircle(
	input: InkCircleCommitInput,
	center: ChainDraftPoint,
	rim: ChainDraftPoint
): Promise<void> {
	if (input.inFlight()) return;
	const capture = input.capture() ?? mintLayoutIdCapture();
	const planned = input.planCircleDraft(center, rim);
	if (planned.kind === 'refused') {
		input.setNotice(planned.message);
		input.publish();
		return;
	}
	input.setInFlight(true);
	try {
		const snapshot = input.services.stage.snapshot();
		const outcome = await input.services.authoring.accept(
			circleRoomCreateIntent({
				payload: {
					center: [center.point[0], center.point[1]],
					rim: [rim.point[0], rim.point[1]],
					thickness: input.memory.thickness,
					height: input.memory.height
				},
				capture,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: input.services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: input.levelId
			})
		);
		if (outcome.kind === 'refused') {
			input.setNotice(outcome.message);
			input.publish();
			return;
		}
		const wallId = planned.authoredWallIds[0] ?? null;
		input.clearChain();
		const fresh = input.services.stage.snapshot();
		if (wallId !== null) {
			input.services.stage.select({
				sourceId: wallId,
				sourceKind: 'wall',
				generationId: fresh.compileGeneration,
				ref: {
					sourceId: wallId,
					sourceKind: 'wall',
					generationId: fresh.compileGeneration,
					stream: 'projected',
					subRef: null
				}
			});
		}
		input.services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
		input.services.stage.notifySurfaceChange();
	} finally {
		input.setInFlight(false);
	}
}
