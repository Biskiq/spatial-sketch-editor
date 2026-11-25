/**
 * The Ink drawing preview vocabulary: target classification helpers, line
 * anchors, arc rise and the Circle/Box drafts.
 *
 * These are pure readings of one press, draft and hover. The session owns the
 * mutable state; these functions never mutate it.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { ChainDraft, ChainDraftPoint, ChainPlanPreview } from './chain';
import { appendChainPoint, boxChainDraft, isDraftStart, planChainDraft } from './chain';
import { measureWallArc, type WallChainArc } from '@portfolio/layout-core/wall';
import { pointOnWallCenterline, type InkPointerTarget } from './ink';
import type { projectedScene } from './stage-pointer';

export type InkPreviewPress = {
	readonly pressTarget: InkPointerTarget;
	readonly dragging: boolean;
} | null;

/**
 * Whether rounding a free point would land it on an existing Junction or
 * Wall centerline.
 *
 * A free target that silently becomes a contact is an undeclared
 * connection: the chain policy refuses `unconnected_interior_contact` (or a
 * crossing) even though the creator aimed at open floor. The deliberate
 * target must stay the creator's aim, so such a point keeps its raw
 * coordinate rather than inventing a connection the drawing did not name.
 */
export function freePointWouldCreateContact(
	point: readonly [number, number],
	projected: ReturnType<typeof projectedScene>
): boolean {
	const tolerance = 1e-6;
	if (
		projected.junctions.some(
			(junction) =>
				Math.hypot(junction.point[0] - point[0], junction.point[1] - point[1]) <=
				tolerance
		)
	) {
		return true;
	}
	return projected.walls.some((wall) => {
		const onCenterline = pointOnWallCenterline(wall, [point[0], point[1]]);
		return (
			Math.hypot(onCenterline[0] - point[0], onCenterline[1] - point[1]) <=
			tolerance
		);
	});
}

/** The transient press anchor follows the same start rule as dragInkWall.
 * It never appends to the deliberate click chain before release. */
export function linePreviewBase(draft: ChainDraft, press: InkPreviewPress): ChainDraft {
	if (!press?.dragging) return draft;
	const pressed = press.pressTarget;
	const start: ChainDraftPoint = { point: pressed.point, target: pressed.target };
	const tip = draft.points.at(-1);
	if (tip?.point[0] === start.point[0] && tip?.point[1] === start.point[1]) return draft;
	if (draft.points.length === 0) return { points: [start], closed: false };
	if (isDraftStart(draft, start.point, 1e-9) && draft.points.length >= 2) return { points: draft.points, closed: true };
	const begun = appendChainPoint(draft, start);
	return 'points' in begun ? begun : draft;
}

export function linePreviewDraft(draft: ChainDraft, press: InkPreviewPress, hover: InkPointerTarget | null): ChainDraft {
	const base = linePreviewBase(draft, press);
	if (base.closed || hover === null) return base;
	if (base.points.length >= 2 && isDraftStart(base, hover.point, 1e-9)) return { ...base, closed: true };
	const extended = appendChainPoint(base, { point: hover.point, target: hover.target });
	return 'points' in extended ? extended : base;
}

/** One planner pass over a draft at the remembered thickness and height. */
export function planInkDraft(document: LayoutDocumentWallFirst, target: ChainDraft, capture: ReturnType<typeof mintLayoutIdCapture> | null, levelId: string, memory: { readonly thickness: number | null; readonly height: number | null }, arc?: WallChainArc): ChainPlanPreview {
	return planChainDraft({
		document,
		draft: target,
		capture: capture ?? mintLayoutIdCapture(),
		levelId,
		...(memory.thickness === null ? {} : { thickness: memory.thickness }),
		...(memory.height === null ? {} : { height: memory.height }),
		...(arc === undefined ? {} : { arc })
	});
}

/**
 * The bulge apex under a raw working-plane point. Only the perpendicular
 * rise is kept; a bulge past the semicircle is passed through as drawn so
 * the canonical planner can refuse it, never silently clamped.
 */
export function arcApexAt(point: LayoutVec2, draft: ChainDraft): LayoutVec2 | null {
	const start = draft.points[0];
	const end = draft.points[1];
	if (start === undefined || end === undefined) return null;
	const measured = measureWallArc(start.point, end.point, point);
	if (measured === null) return null;
	const magnitude = Math.abs(measured.rise);
	if (!(magnitude > 0)) return null;
	const sign = measured.rise < 0 ? -1 : 1;
	const dx = end.point[0] - start.point[0];
	const dz = end.point[1] - start.point[1];
	const mx = (start.point[0] + end.point[0]) / 2;
	const mz = (start.point[1] + end.point[1]) / 2;
	return [mx - (dz / measured.chord) * magnitude * sign, mz + (dx / measured.chord) * magnitude * sign];
}

/**
 * Circle's two authored points: a centre tap (or the live press) and the
 * rim under the pointer. The rim is the canonical seam; no separate circle geometry is inferred later.
 */
export function circlePreviewPoints(draft: ChainDraft, press: InkPreviewPress, hover: InkPointerTarget | null): { center: ChainDraftPoint; rim: ChainDraftPoint } | null {
	const placed = draft.points[0];
	const pressed = press?.pressTarget;
	const center = placed ?? (pressed === undefined ? null : { point: pressed.point, target: pressed.target });
	if (center === null || hover === null) return null;
	if (Math.hypot(hover.point[0] - center.point[0], hover.point[1] - center.point[1]) < 1e-9) return null;
	return { center, rim: { point: hover.point, target: hover.target } };
}

/**
 * Box's first corner: the one a tap already placed, or the corner the live
 * press landed on (press-drag-release names both corners in one gesture).
 */
export function boxAnchor(draft: ChainDraft, press: InkPreviewPress): ChainDraftPoint | null {
	const placed = draft.points[0];
	if (placed !== undefined) return placed;
	const pressed = press?.pressTarget;
	return pressed === undefined ? null : { point: pressed.point, target: pressed.target };
}

/** The closed four-Wall ring the anchor and the pointer name, or `null`. */
export function boxPreviewDraft(document: LayoutDocumentWallFirst, draft: ChainDraft, press: InkPreviewPress, hover: InkPointerTarget | null): ChainDraft | null {
	const anchor = boxAnchor(draft, press);
	if (anchor === null || hover === null) return null;
	const box = boxChainDraft(document, anchor, { point: hover.point, target: hover.target });
	return 'points' in box ? box : null;
}
