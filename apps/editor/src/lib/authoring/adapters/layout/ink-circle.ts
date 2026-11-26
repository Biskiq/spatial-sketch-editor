/**
 * The Ink Circle proposal and commit plan over the live centre → rim pair.
 *
 * The input exposes the session's live document, capture and thickness/height;
 * the module owns no state and returns the same retained plan the release uses.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import { planCreateCircularRoom, proposeCreateCircularWall } from '@portfolio/layout-core/room';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { ChainDraftPoint, ChainPlanPreview } from './chain';
type InkCirclePresenter = {
	readonly proposal: (key: readonly unknown[], build: () => ChainPlanPreview) => ChainPlanPreview;
};

export type InkCirclePlanInput = {
	readonly document: () => LayoutDocumentWallFirst;
	readonly capture: () => ReturnType<typeof mintLayoutIdCapture> | null;
	readonly memory: { readonly thickness: number | null; readonly height: number | null };
	readonly presenter: InkCirclePresenter;
	readonly levelId: string;
};

/**
 * The live Circle proposal, once per distinct centre → rim, size and capture.
 */
export function circleDraftPreview(
	input: InkCirclePlanInput,
	circle: { center: ChainDraftPoint; rim: ChainDraftPoint },
): ChainPlanPreview {
	return input.presenter.proposal(
		[
			'circle',
			input.document(),
			input.capture(),
			input.memory.thickness,
			input.memory.height,
			circle.center.point[0],
			circle.center.point[1],
			circle.rim.point[0],
			circle.rim.point[1],
		],
		() => planCircleDraft(input, circle.center, circle.rim, proposeCreateCircularWall),
	);
}

/** One retained circular-Room plan over the live centre → rim pair. */
export function planCircleDraft(
	input: InkCirclePlanInput,
	center: ChainDraftPoint,
	rim: ChainDraftPoint,
	planCircle = planCreateCircularRoom,
): ChainPlanPreview {
	const plan = planCircle({
		baseline: input.document(),
		center: [center.point[0], center.point[1]],
		rim: [rim.point[0], rim.point[1]],
		capture: input.capture() ?? mintLayoutIdCapture(),
		levelId: input.levelId,
		roomNamePrefix: 'Room',
		...(input.memory.thickness === null ? {} : { thickness: input.memory.thickness }),
		...(input.memory.height === null ? {} : { height: input.memory.height }),
	});
	if (plan.kind === 'rejected') {
		return { kind: 'refused', code: plan.rejection.code, message: plan.rejection.message };
	}
	return {
		kind: 'planned',
		document: plan.document,
		authoredWallIds: [plan.wallId],
		createdWallIds: [plan.wallId],
		createdJunctionIds: [plan.junctionId],
		splitWallIds: [],
		createdRoomIds: [...plan.createdRoomIds],
		retiredRoomIds: [],
		absorbedRoomIds: [],
		consequence: { kind: 'encloses', summary: 'Creates one circular Room on finish.' },
	};
}
