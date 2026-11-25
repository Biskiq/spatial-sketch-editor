/**
 * The Ink pointer target: junction/host precedence, then the one Layout snap
 * resolver, with contact-free fallback.
 *
 * The state object reads the session's live mode, draft and anchor, and routes
 * the named snap winner back to the session; it owns no state itself.
 */
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import type { ChainDraft } from './chain';
import { INK_JUNCTION_HIT_CSS_PX, classifyInkPointerTarget, pointOnWallCenterline, type InkPointerTarget } from './ink';
import { freePointWouldCreateContact } from './ink-preview';
import { resolveInkPointSnap, type LayoutSnapWinner } from './snap';
import { pointerDatumPoint, projectedScene } from './stage-pointer';

export type InkTargetState = {
	readonly memory: { readonly wallMode: string };
	readonly draft: () => ChainDraft;
	readonly document: LayoutDocumentWallFirst;
	readonly linePreviewBase: () => ChainDraft;
	readonly setSnap: (winner: LayoutSnapWinner | null) => void;
};



/**
 * The deliberate target one Stage-local pointer position names, in world
 * coordinates. `null` when the working plane cannot be resolved there.
 */
export function inkTargetAt(
	state: InkTargetState,
	adapterContext: StageAdapterContext,
	css: readonly [number, number]
): InkPointerTarget | null {
	const memory = state.memory;
	const draft = state.draft();
	const document = state.document;
	const linePreviewBase = state.linePreviewBase;
	const start = memory.wallMode === 'line' && draft.points.length >= 3 ? draft.points[0] : undefined;
	if (start !== undefined) {
		const { left, top } = adapterContext.evaluation.rect;
		const projected = adapterContext.project([start.point[0], adapterContext.snapshot.domain.datumMeters, start.point[1]]);
		if (projected !== null && Math.hypot(css[0] + left - projected[0], css[1] + top - projected[1]) <= INK_JUNCTION_HIT_CSS_PX) {
			state.setSnap({ point: start.point, kind: 'junction', name: 'Junction' });
			return { ...start, css };
		}
	}
	const projected = projectedScene(document, adapterContext);
	const hit = classifyInkPointerTarget({ css, junctions: projected.junctions, walls: projected.walls });
	if (hit?.kind === 'junction') {
		const junction = projected.junctions.find((candidate) => candidate.id === hit.junctionId);
		if (junction === undefined) return null;
		state.setSnap({ point: junction.point, kind: 'junction', name: 'Junction' });
		return { target: hit, point: junction.point, css };
	}
	const point = pointerDatumPoint(adapterContext, css);
	if (point === null) return null;
	if (hit?.kind === 'host') {
		const wall = projected.walls.find((candidate) => candidate.id === hit.wallId);
		if (wall === undefined) return null;
		// The split lands where the creator aimed: the pointer projected onto
		// that Wall's centerline, never the cursor's raw plane point.
		const split = pointOnWallCenterline(wall, [point[0], point[1]]);
		state.setSnap({ point: split, kind: 'wall-span', name: 'Wall', wallId: wall.id });
		return { target: hit, point: split, css };
	}
	// Free placement asks the one Layout snap resolver. Junction and host
	// targets above keep precedence, so snap can never move a connection off
	// the subject the creator deliberately aimed at. The inverse is guarded
	// too: a grid point that would land on an existing Junction or Wall keeps
	// the creator's raw aim instead of authoring an undeclared contact.
	const drafting = adapterContext.drafting();
	const winner = resolveInkPointSnap({
		geometry: adapterContext.snapshot.domain.geometry,
		point: [point[0], point[1]],
		pixelsPerMeter: 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel,
		anchor: linePreviewBase().points.at(-1)?.point ?? null,
		drafting
	});
	if (winner !== null) {
		if (winner.kind === 'junction') {
			const junction = projected.junctions.find(
				(candidate) =>
					Math.hypot(candidate.point[0] - winner.point[0], candidate.point[1] - winner.point[1]) <= 1e-9
			);
			if (junction !== undefined) {
				state.setSnap(winner);
				return { target: { kind: 'junction', junctionId: junction.id }, point: junction.point, css };
			}
		}
		if (winner.kind === 'wall-span' && winner.wallId !== undefined) {
			const wall = projected.walls.find((candidate) => candidate.id === winner.wallId);
			if (wall !== undefined) {
				state.setSnap(winner);
				return { target: { kind: 'host', wallId: wall.id }, point: winner.point, css };
			}
		}
		if (freePointWouldCreateContact(winner.point, projected)) {
			state.setSnap(null);
			return { target: { kind: 'free' }, point: [point[0], point[1]], css };
		}
		state.setSnap(winner);
		return { target: { kind: 'free' }, point: winner.point, css };
	}
	state.setSnap(null);
	return { target: { kind: 'free' }, point: [point[0], point[1]], css };
}
