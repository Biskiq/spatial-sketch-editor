/**
 * The pointer facts one group-copy placement reads.
 *
 * `point` is the Stage's own any-hit surface (or its datum point): the overhead
 * and wall origins keep that X/Z and height. `support` is Place's visible,
 * snapped support — already on the Stage grid and pinned to the witness the
 * planner will commit — so the support origin stands exactly where a single
 * Place would. Nothing here resolves a floor, a ceiling or a wall: it reads the
 * existing pointer-support helper and the Scene hit.
 */
import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import type { GroupCopyPointer } from './group-copy-contract';
import { pointerDatumPoint, pointerPlaceSupport } from './pointer-support';

export function groupCopyPointerAt(
	context: StageAdapterContext,
	css: readonly [number, number],
	snapStep: number | null,
): GroupCopyPointer | null {
	const ray = context.ray([
		css[0] + context.evaluation.rect.left,
		css[1] + context.evaluation.rect.top,
	]);
	if (ray === null) return null;
	const hit = context.pickScene(ray);
	const point = hit === null ? pointerDatumPoint(context, css) : hit.worldPoint;
	if (point === null || !point.every(Number.isFinite)) return null;
	return {
		point: [point[0], point[1], point[2]],
		wallNormal: hit?.wallNormal ?? null,
		support: pointerPlaceSupport(context, css, snapStep),
	};
}
