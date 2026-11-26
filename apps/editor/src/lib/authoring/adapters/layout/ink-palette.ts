/**
 * The Ink palette's readings: its built-in and contributed chapters and the
 * live snapshot the palette renders.
 *
 * The state object exposes the session's live values through getters; the
 * snapshot is a synchronous reading and never outlives the call.
 */
import { MIN_WALL_ARC_RISE, measureWallArc } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { StageInkReadingRecord } from '$lib/authoring/stage/stage-adapter-host';
import { pendingLegFacts, type ChainDraft, type ChainDraftPoint, type ChainPlanPreview } from './chain';
import type { InkPaletteReading, InkPaletteSnapshot, InkPointerTarget, InkWallMode } from './ink';
import type { OpeningPlacementSession } from './opening-placement-session';
import type { createRegionInkSession } from './region-ink-session';
import type { createSpaceCreateSession } from './space-create-session';

export type InkPaletteState = {
	readonly memory: {
		readonly reading: string;
		readonly wallMode: InkWallMode;
		readonly thickness: number | null;
		readonly height: number | null;
	};
	readonly draft: ChainDraft;
	readonly inkHover: () => InkPointerTarget | null;
	readonly inkArcApex: () => LayoutVec2 | null;
	readonly inkPreview: () => ChainPlanPreview | null;
	readonly inkNotice: () => string | null;
	readonly linePreviewBase: () => ChainDraft;
	readonly linePreviewDraft: () => ChainDraft;
	readonly boxPreviewDraft: () => ChainDraft | null;
	readonly boxAnchor: () => ChainDraftPoint | null;
	readonly region: ReturnType<typeof createRegionInkSession>;
	readonly opening: OpeningPlacementSession;
	readonly room: ReturnType<typeof createSpaceCreateSession>;
	readonly contributedReadings: () => readonly StageInkReadingRecord[];
};



/** Layout's built-in readings, then every contributed reading in host order. */
export function paletteReadings(contributed: readonly StageInkReadingRecord[]): readonly InkPaletteReading[] {
	return [
		{ id: 'wall', label: 'Wall', summary: 'Straight Wall chain.' },
		{
			id: 'opening',
			label: 'Opening',
			summary: 'A straight door or window on one Wall face.'
		},
		{ id: 'room', label: 'Room', summary: 'Create an Open Space from partial Walls.' },
		{ id: 'terrace', label: 'Terrace', summary: 'A raised floor region, drawn as a Box or a Line.' },
		{ id: 'roof', label: 'Roof › Flat', summary: 'Flat Roof › Flat overhead region, drawn as a Box or a Line.' },
		...contributed.map((reading) => ({
			id: reading.id,
			label: reading.label,
			summary: reading.summary
		}))
	];
}



export function snapshotForPalette(state: InkPaletteState): InkPaletteSnapshot {
	const { memory, draft, region, opening, room } = state;
	const inkHover = state.inkHover();
	const inkArcApex = state.inkArcApex();
	const inkPreview = state.inkPreview();
	const inkNotice = state.inkNotice();
	const linePreviewDraft = state.linePreviewDraft;
	const linePreviewBase = state.linePreviewBase;
	const boxPreviewDraft = state.boxPreviewDraft;
	const boxAnchor = state.boxAnchor;
	if (memory.reading === 'terrace' || memory.reading === 'roof') {
		const view = region.snapshot();
		return {
			reading: memory.reading,
			wallMode: memory.wallMode,
			arc: null,
			box: null,
			readings: paletteReadings(state.contributedReadings()),
			opening: null,
			region: {
				role: view.role,
				mode: view.mode,
				points: view.points,
				elevation: view.elevation,
				thickness: view.thickness,
				hint: view.hint,
				refusal: view.refusal
			},
			points: view.points,
			closed: false,
			canFinish: view.mode === 'line' && view.points.length >= 3,
			canClose: false,
			canBacktrack: view.points.length > 0,
			consequence: null,
			pending: null,
			refusal: view.refusal
		};
	}
	const boxMode = memory.reading === 'wall' && memory.wallMode === 'box';
	const circleMode = memory.reading === 'wall' && memory.wallMode === 'circle';
	const arcMode = memory.reading === 'wall' && memory.wallMode === 'arc';
	const withHover = circleMode || arcMode ? draft : linePreviewDraft();
	const effective = boxMode ? (boxPreviewDraft() ?? draft)
		: 'points' in withHover ? withHover : draft;
	const pending =
		inkHover === null || boxMode || circleMode || arcMode
			? null
			: pendingLegFacts(linePreviewBase(), inkHover.point);
	const anchor = boxMode ? boxAnchor() : null;
	const box =
		anchor === null || inkHover === null
			? null
			: {
					width: Math.abs(inkHover.point[0] - anchor.point[0]),
					depth: Math.abs(inkHover.point[1] - anchor.point[1])
				};
	const arc =
		arcMode && draft.points.length >= 2 && inkArcApex !== null
			? (() => {
					const measured = measureWallArc(draft.points[0]!.point, draft.points[1]!.point, inkArcApex!);
					return measured === null
						? null
						: {
								chord: measured.chord,
								rise: measured.rise,
								radius: measured.radius,
								belowMinimum: Math.abs(measured.rise) < MIN_WALL_ARC_RISE
							};
				})()
			: null;
	return {
		options: { thickness: memory.thickness, height: memory.height },
		reading: memory.reading,
		wallMode: memory.wallMode,
		arc,
		box,
		readings: paletteReadings(state.contributedReadings()),
		opening: memory.reading === 'opening' ? opening.paletteView() : null,
		...(memory.reading === 'room' ? { room: room.paletteView() } : {}),
		points: effective.points.map((entry) => [entry.point[0], entry.point[1]] as LayoutVec2),
		closed: effective.closed,
		canFinish: !boxMode && !circleMode && !arcMode && draft.points.length >= 2,
		canClose: !boxMode && !circleMode && !arcMode && draft.points.length >= 3 && !draft.closed,
		canBacktrack: draft.points.length > 0,
		consequence:
			inkPreview !== null &&
			inkPreview.kind === 'planned' &&
			(circleMode || arcMode || effective.points.length >= 2)
				? inkPreview.consequence.summary
				: null,
		pending,
		refusal: inkNotice
	};
}
