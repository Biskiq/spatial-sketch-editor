/**
 * The Ink live preview: arc chords, circle rings, line/Box chains and their
 * affected paper readings.
 *
 * The state object exposes the session's live values through getters and binds
 * its existing draft builders; this module never owns or copies reactive state.
 */
import { MIN_WALL_ARC_RISE, measureWallArc } from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type {
	StageAdapterContext,
	StageCandidatePreview,
} from '$lib/authoring/stage/stage-adapter-host';
import { candidatePreviewOf, type CandidatePaperGeometry } from './candidate-preview';
import {
	pendingLegFacts,
	type ChainDraft,
	type ChainDraftPoint,
	type ChainPlanPreview,
} from './chain';
import type { InkPointerTarget } from './ink';
import { openWallFrame } from './precision-frames';
import type { LayoutSessionPorts } from './session-ports';
import type { LayoutSnapWinner } from './snap';
import type { OpeningPlacementSession } from './opening-placement-session';
import type { createRegionInkSession } from './region-ink-session';
import type { createSpaceCreateSession } from './space-create-session';

const EMPTY_CANDIDATE_GEOMETRY: CandidatePaperGeometry = { polygons: [], segments: [] };

export type InkPreviewState = {
	readonly memory: {
		readonly reading: string;
		readonly wallMode: string;
		readonly thickness: number | null;
		readonly height: number | null;
	};
	readonly draft: () => ChainDraft;
	readonly inkHover: () => InkPointerTarget | null;
	readonly inkSnapWinner: () => LayoutSnapWinner | null;
	readonly inkArcApex: () => LayoutVec2 | null;
	readonly inkPreview: () => ChainPlanPreview | null;
	readonly linePreviewBase: () => ChainDraft;
	readonly linePreviewDraft: () => ChainDraft;
	readonly boxPreviewDraft: () => ChainDraft | null;
	readonly boxAnchor: () => ChainDraftPoint | null;
	readonly circlePreviewPoints: () => { center: ChainDraftPoint; rim: ChainDraftPoint } | null;
	readonly circleDraftPreview: (circle: {
		center: ChainDraftPoint;
		rim: ChainDraftPoint;
	}) => ChainPlanPreview;
	readonly room: ReturnType<typeof createSpaceCreateSession>;
	readonly region: ReturnType<typeof createRegionInkSession>;
	readonly opening: OpeningPlacementSession;
	readonly ports: Pick<LayoutSessionPorts, 'candidatePaper'>;
};

/**
 * The Wall reading's live candidate: the ring, Arc, Circle or cursor the creator
 * is aiming, from the planner's own candidate document through the existing
 * compile + Paper path. A refusal contributes only its words. Nothing is persisted.
 */
type ArcPreviewInput = {
	readonly world: (
		point: readonly [number, number],
		elevation?: number,
	) => [number, number, number];
	readonly snapOf: (
		winner: LayoutSnapWinner | null,
	) => { world: [number, number, number]; name: string } | undefined;
	readonly draft: ChainDraft;
	readonly inkHover: InkPointerTarget | null;
	readonly inkSnapWinner: LayoutSnapWinner | null;
	readonly inkArcApex: LayoutVec2 | null;
	readonly inkPreview: ChainPlanPreview | null;
	readonly ports: Pick<LayoutSessionPorts, 'candidatePaper'>;
	readonly y: number;
};

function arcPreviews(input: ArcPreviewInput): readonly StageCandidatePreview[] {
	const { world, snapOf, draft, inkHover, inkSnapWinner, inkArcApex, inkPreview, ports, y } = input;

	const start = draft.points[0];
	const end = draft.points[1];
	if (start === undefined) {
		return [];
	}
	if (end === undefined) {
		if (inkHover === null) return [];
		const length = Math.hypot(
			inkHover.point[0] - start.point[0],
			inkHover.point[1] - start.point[1],
		);
		return [
			candidatePreviewOf({
				id: 'layout-candidate-arc-cursor',
				role: 'subject',
				drawing: true,
				geometry: { polygons: [], segments: [[world(start.point), world(inkHover.point)]] },
				labels: [{ world: world(inkHover.point), text: `${length.toFixed(2)} m` }],
				snap: snapOf(inkSnapWinner),
			}),
		];
	}
	const chord = Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]);
	const midpoint: [number, number] = [
		(start.point[0] + end.point[0]) / 2,
		(start.point[1] + end.point[1]) / 2,
	];
	if (inkArcApex === null) {
		return [
			candidatePreviewOf({
				id: 'layout-candidate-arc',
				role: 'subject',
				drawing: true,
				geometry: { polygons: [], segments: [[world(start.point), world(end.point)]] },
				labels: [{ world: world(midpoint), text: `${chord.toFixed(2)} m · pull the bulge` }],
			}),
		];
	}
	const measured = measureWallArc(start.point, end.point, inkArcApex);
	const fallback = measured !== null && Math.abs(measured.rise) < MIN_WALL_ARC_RISE;
	const facts =
		measured === null
			? null
			: fallback
				? `Line · rise under ${MIN_WALL_ARC_RISE.toFixed(2)} m`
				: `Rise ${Math.abs(measured.rise).toFixed(2)} m · R ${Number.isFinite(measured.radius) ? measured.radius.toFixed(2) : '∞'} m`;
	if (inkPreview?.kind === 'planned') {
		const wallId = inkPreview.authoredWallIds[0];
		const frame = wallId === undefined ? null : openWallFrame(inkPreview.document, wallId);
		const segments =
			frame === null
				? ([[world(start.point), world(end.point)]] as const)
				: frame.samples
						.slice(1)
						.map(
							(sample, index) => [world(frame.samples[index]!.point), world(sample.point)] as const,
						);
		const closesRoom = inkPreview.createdRoomIds.length > 0;
		const built = closesRoom
			? ports.candidatePaper(inkPreview.document, y, new Set(inkPreview.createdRoomIds), new Set())
			: null;
		const labels: { world: [number, number, number]; text: string }[] = [];
		if (facts !== null) labels.push({ world: world(inkArcApex), text: facts });
		if (closesRoom) {
			labels.push({
				world: world(start.point),
				text:
					inkPreview.createdRoomIds.length === 1
						? 'Creates 1 Room'
						: `Creates ${inkPreview.createdRoomIds.length} Rooms`,
			});
		}
		return [
			candidatePreviewOf({
				id: 'layout-candidate-arc',
				role: 'subject',
				drawing: true,
				geometry: { polygons: built?.paper.subject.polygons ?? [], segments },
				labels,
			}),
		];
	}
	if (inkPreview?.kind === 'refused') {
		return [
			candidatePreviewOf({
				id: 'layout-candidate-arc-refused',
				role: 'refused',
				geometry: { polygons: [], segments: [[world(start.point), world(end.point)]] },
				labels: [{ world: world(inkArcApex), text: inkPreview.message }],
			}),
		];
	}
	return [];
}

export function previews(
	state: InkPreviewState,
	adapterContext: StageAdapterContext,
	y: number,
): readonly StageCandidatePreview[] {
	const { memory, room, region, opening, ports } = state;
	const draft = state.draft();
	const inkHover = state.inkHover();
	const inkSnapWinner = state.inkSnapWinner();
	const inkArcApex = state.inkArcApex();
	const inkPreview = state.inkPreview();
	const linePreviewBase = state.linePreviewBase;
	const linePreviewDraft = state.linePreviewDraft;
	const boxPreviewDraft = state.boxPreviewDraft;
	const boxAnchor = state.boxAnchor;
	const circlePreviewPoints = state.circlePreviewPoints;
	const circleDraftPreview = state.circleDraftPreview;
	const world = (point: readonly [number, number], elevation = y): [number, number, number] => [
		point[0],
		elevation,
		point[1],
	];
	const snapOf = (winner: LayoutSnapWinner | null) =>
		winner === null ? undefined : { world: world(winner.point), name: winner.name };
	if (memory.reading === 'room') return room.previews(adapterContext, y);
	if (memory.reading === 'terrace' || memory.reading === 'roof')
		return region.previews(adapterContext, y);
	if (memory.reading === 'opening') return opening.previews(adapterContext, y);
	if (memory.reading === 'wall' && memory.wallMode === 'arc') {
		return arcPreviews({
			world,
			snapOf,
			draft,
			inkHover,
			inkSnapWinner,
			inkArcApex,
			inkPreview,
			ports,
			y,
		});
	}

	// Circle is one authored closed-Wall intent, so its live preview is the
	// authored ring itself. The radius leg stays a measurement label; it is
	// never the primary shape the creator sees while aiming.
	if (memory.reading === 'wall' && memory.wallMode === 'circle') {
		const circle = circlePreviewPoints();
		if (circle === null) return [];
		const radius = Math.hypot(
			circle.rim.point[0] - circle.center.point[0],
			circle.rim.point[1] - circle.center.point[1],
		);
		if (!(radius > 0)) return [];
		const planned = circleDraftPreview(circle);
		const segments: [[number, number, number], [number, number, number]][] = [];
		const steps = 64;
		for (let index = 0; index < steps; index += 1) {
			const from = (index / steps) * Math.PI * 2;
			const to = ((index + 1) / steps) * Math.PI * 2;
			segments.push([
				[
					circle.center.point[0] + Math.cos(from) * radius,
					y,
					circle.center.point[1] + Math.sin(from) * radius,
				],
				[
					circle.center.point[0] + Math.cos(to) * radius,
					y,
					circle.center.point[1] + Math.sin(to) * radius,
				],
			]);
		}
		const facts = `r ${radius.toFixed(2)} m · ⌀ ${(radius * 2).toFixed(2)} m`;
		return [
			candidatePreviewOf({
				id: 'layout-candidate-circle',
				role: planned.kind === 'refused' ? 'refused' : 'subject',
				geometry: { polygons: [], segments },
				labels: [
					{
						world: world(circle.center.point),
						text: planned.kind === 'refused' ? `${facts} — ${planned.message}` : facts,
					},
				],
				snap: snapOf(inkSnapWinner),
			}),
		];
	}

	// Wall chain / Box, including the cursor point before a plan exists.
	const boxMode = memory.wallMode === 'box';
	const live = boxMode ? (boxPreviewDraft() ?? draft) : linePreviewDraft();
	const points = 'points' in live ? live.points : draft.points;
	if (inkPreview?.kind === 'planned') {
		const closesRoom = !boxMode && live.closed && inkPreview.createdRoomIds.length > 0;
		const subjectIds = new Set([
			...(closesRoom ? inkPreview.createdRoomIds : []),
			...inkPreview.absorbedRoomIds,
		]);
		const affectedIds = new Set(inkPreview.splitWallIds);
		const built =
			subjectIds.size > 0 || affectedIds.size > 0
				? ports.candidatePaper(inkPreview.document, y, subjectIds, affectedIds)
				: null;
		const geometry = {
			polygons: built?.paper.subject.polygons ?? [],
			segments: [
				...points
					.slice(1)
					.map((point, i) => [world(points[i]!.point), world(point.point)] as const),
				...(live.closed && points.length > 2
					? [[world(points.at(-1)!.point), world(points[0]!.point)] as const]
					: []),
			],
		};
		const labels: { world: [number, number, number]; text: string }[] = [];
		if (closesRoom) {
			const count = inkPreview.createdRoomIds.length;
			labels.push({
				world: world(points[0]!.point),
				text: count === 1 ? 'Creates 1 Room' : `Creates ${count} Rooms`,
			});
		} else if (inkHover !== null && !boxMode) {
			const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
			if (pending !== null)
				labels.push({ world: world(inkHover.point), text: `${pending.length.toFixed(2)} m` });
		}
		if (boxMode && inkHover !== null) {
			const anchor = boxAnchor();
			if (anchor !== null) {
				labels.push({
					world: world(inkHover.point),
					text: `${Math.abs(inkHover.point[0] - anchor.point[0]).toFixed(2)} × ${Math.abs(inkHover.point[1] - anchor.point[1]).toFixed(2)} m`,
				});
			}
		}
		return [
			candidatePreviewOf({
				id: 'layout-candidate-chain',
				role: 'subject',
				drawing: true,
				geometry,
				labels,
				snap: closesRoom
					? { world: world(points[0]!.point), name: 'Close Room' }
					: snapOf(inkSnapWinner),
			}),
			...(built === null ||
			(built.paper.affected.polygons.length === 0 && built.paper.affected.segments.length === 0)
				? []
				: [
						candidatePreviewOf({
							id: 'layout-candidate-chain-affected',
							role: 'affected',
							geometry: built.paper.affected,
						}),
					]),
		];
	}
	if (inkPreview?.kind === 'refused' && points.length >= 2) {
		// The placed legs stay drawn: only the live leg is refused (review
		// pass 2 §3). They are the same ink line the creator already drew.
		const placed = live.closed ? points : points.slice(0, -1);
		const from = live.closed ? points.at(-1)! : points.at(-2)!;
		const to = live.closed ? points[0]! : points.at(-1)!;
		return [
			...(placed.length < 2
				? []
				: [
						candidatePreviewOf({
							id: 'layout-candidate-chain',
							role: 'subject',
							drawing: true,
							geometry: {
								polygons: [],
								segments: placed
									.slice(1)
									.map((point, i) => [world(placed[i]!.point), world(point.point)] as const),
							},
						}),
					]),
			candidatePreviewOf({
				id: 'layout-candidate-chain-refused',
				role: 'refused',
				// A dashed cursor reach names the refused input, never a Wall band.
				geometry: { polygons: [], segments: [[world(from.point), world(to.point)]] },
				labels: [{ world: world(to.point), text: inkPreview.message }],
			}),
		];
	}
	if (inkHover !== null && linePreviewBase().points.length > 0) {
		const last = linePreviewBase().points.at(-1)!.point;
		const pending = pendingLegFacts(linePreviewBase(), inkHover.point);
		return [
			candidatePreviewOf({
				id: 'layout-candidate-cursor',
				role: 'subject',
				drawing: true,
				geometry: { polygons: [], segments: [[world(last), world(inkHover.point)]] },
				labels:
					pending === null
						? []
						: [{ world: world(inkHover.point), text: `${pending.length.toFixed(2)} m` }],
				snap: snapOf(inkSnapWinner),
			}),
		];
	}
	if (inkHover !== null && inkSnapWinner !== null) {
		return [
			candidatePreviewOf({
				id: 'layout-candidate-cursor',
				role: 'subject',
				drawing: true,
				geometry: EMPTY_CANDIDATE_GEOMETRY,
				snap: snapOf(inkSnapWinner),
			}),
		];
	}
	return [];
}
