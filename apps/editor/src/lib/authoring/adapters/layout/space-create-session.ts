import {
	createSpaceCreationOutlineQuery,
	findSpaceCreationReturn,
	planCreateOpenSpace,
	spaceCreationAnchorKey,
	spaceCreationAnchorPoint,
	spaceCreationWallChoices,
	spaceOutlineSignedArea,
	type PlannedSpaceCreation,
	type SpaceCreationAnchor,
	type SpaceCreationCycle,
	type SpaceCreationEvidence,
	type SpaceCreationSpan,
} from '@portfolio/layout-core/room';
import { mintLayoutIdCapture, type LayoutIdCapture } from '@portfolio/layout-core/plan';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	isStageDrag,
	sameSubject,
	stageUnitRevision,
	type GestureLease,
	type ProposalLease,
	type StageAdapterContext,
	type StageCandidatePreview,
	type StageKeyboardIntent,
	type StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';

import { candidatePreviewOf } from './candidate-preview';
import { layoutSubjectReference } from './drawing-planners';
import {
	closestOnPolyline,
	INK_JUNCTION_HIT_CSS_PX,
	INK_WALL_HIT_CSS_PX,
	LAYOUT_INK_TASK,
	projectedWallPathCss,
	type RoomInkSnapshot,
} from './ink';
import { openWallFrame, wallStationAtPoint } from './precision-frames';
import type { LayoutSessionPorts } from './session-ports';
import { resolveJunctionPointSnap } from './snap';
import { spaceCreateIntent } from './space-create-planners';
import { pointerDatumPoint, projectedScene } from './stage-pointer';

type WallSpan = Extract<SpaceCreationSpan, { kind: 'wall' }>;
type Target = { anchor: SpaceCreationAnchor; point: LayoutVec2; span?: WallSpan };
type Candidate = {
	intent: AuthoringIntent;
	roomId: string;
	evidence: SpaceCreationEvidence;
	label: string;
};
type Press = {
	lease: GestureLease;
	origin: readonly [number, number];
	evaluationId: string;
	candidate: Candidate | null;
	target: Target | null;
};

function nearest<T>(options: { value: T; distance: number }[], radius: number): T | 'tied' | null {
	const [first, second] = options
		.filter(({ distance }) => distance <= radius)
		.sort((a, b) => a.distance - b.distance);
	if (!first) return null;
	return second && second.distance - first.distance <= 0.5 ? 'tied' : first.value;
}

export function createSpaceCreateSession(
	ports: Pick<LayoutSessionPorts, 'document' | 'levelId' | 'services' | 'inkTaskOpen'> & {
		publish: () => void;
		planCandidate<T>(body: () => T): T;
	},
) {
	const { document, levelId, services } = ports;
	const autoOutlineAt = createSpaceCreationOutlineQuery(document, levelId);
	let mode: RoomInkSnapshot['mode'] = 'hover';
	let start: SpaceCreationAnchor | null = null;
	let draft: SpaceCreationSpan[] = [];
	let lease: ProposalLease | null = null;
	let capture: LayoutIdCapture | null = null;
	let press: Press | null = null;
	let displayed: Candidate | null = null;
	let prepared: {
		key: string;
		candidate: Candidate | null;
		refusal?: string;
		evidence?: SpaceCreationEvidence;
	} | null = null;
	let hoverPoint: LayoutVec2 | null = null;
	let hoverTarget: Target | null = null;
	let failure: SpaceCreationEvidence | null = null;
	let refusal: string | null = null;
	let splitHint: string | null = null;
	let busy = false;
	let disposed = false;
	let cornerSequence = 0;
	let projectionId: string | null = null;
	let choices: readonly WallSpan[] = [];
	let projected: { evaluationId: string; scene: ReturnType<typeof projectedScene> } | null = null;
	const frameByWall = new Map<string, ReturnType<typeof openWallFrame>>();
	const physicalJunctions = new Set(
		document.walls.flatMap(({ startJunctionId, endJunctionId }) => [
			startJunctionId,
			endJunctionId,
		]),
	);

	const cursor = () => draft.at(-1)?.to ?? start;
	const sameAnchor = (a: SpaceCreationAnchor, b: SpaceCreationAnchor) =>
		spaceCreationAnchorKey(a) === spaceCreationAnchorKey(b);
	const pointOf = (anchor: SpaceCreationAnchor) => spaceCreationAnchorPoint(document, anchor);

	function publish() {
		if (disposed) return;
		services.stage.notifySurfaceChange();
		ports.publish();
	}

	function endPress() {
		const old = press;
		press = null;
		old?.lease.release();
		return old;
	}

	function clear() {
		endPress();
		lease?.release();
		lease = null;
		mode = 'hover';
		start = null;
		draft = [];
		capture = null;
		displayed = null;
		prepared = null;
		hoverPoint = null;
		hoverTarget = null;
		failure = null;
		refusal = null;
		splitHint = null;
		choices = [];
		projectionId = null;
		projected = null;
	}

	function reconcileLease() {
		if (lease && !lease.active) clear();
	}

	function currentSource() {
		return ports.inkTaskOpen() && services.stage.snapshot().domain.layoutLevelId === levelId;
	}

	function sceneFor(context: StageAdapterContext) {
		if (projected?.evaluationId !== context.evaluationId) {
			projected = { evaluationId: context.evaluationId, scene: projectedScene(document, context) };
		}
		return projected.scene;
	}

	function selectCandidate(
		key: string,
		cycle: SpaceCreationCycle,
		evidence: SpaceCreationEvidence,
		manual?: PlannedSpaceCreation,
	): void {
		if (prepared?.key !== key) {
			const snapshot = services.stage.snapshot();
			const nonce = manual ? capture! : mintLayoutIdCapture();
			const intent = spaceCreateIntent({
				cycle,
				capture: nonce,
				operationId: globalThis.crypto.randomUUID(),
				...snapshot.acceptedRevision,
				levelId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
			});
			const plan =
				manual ??
				ports.planCandidate(() =>
					planCreateOpenSpace({ baseline: document, levelId, capture: nonce, cycle }),
				);
			if (plan.kind === 'refused') {
				prepared = {
					key,
					candidate: null,
					refusal: plan.message,
					evidence: plan.evidence ?? evidence,
				};
			} else {
				const floor = plan.compiled.geometry.rooms.find(
					({ roomId }) => roomId === plan.roomId,
				)!.floorPolygon;
				const area = Math.abs(spaceOutlineSignedArea(floor)).toFixed(1);
				const label = `Open space · ${area} m² · ${manual ? 'Create Space' : 'Click to name'}`;
				prepared = {
					key,
					candidate: { intent, roomId: plan.roomId, evidence: plan.evidence, label },
				};
			}
		}
		displayed = prepared.candidate;
		refusal = prepared.refusal ?? null;
		failure = prepared.evidence ?? null;
	}

	function readAuto(context: StageAdapterContext, css: StagePointerIntent['css'], coarse: boolean) {
		const raw = pointerDatumPoint(context, css);
		if (!raw) return { point: null, outline: null };
		const scene = sceneFor(context);
		const point: LayoutVec2 = [raw[0], raw[1]];
		if (connectionAt(scene, css, coarse) !== null) return { point, outline: null };
		return { point, outline: autoOutlineAt(point) };
	}

	function updateAuto(context: StageAdapterContext, intent: StagePointerIntent) {
		const { point, outline } = readAuto(context, intent.css, intent.coarse ?? false);
		hoverPoint = point;
		if (projectionId !== context.evaluationId) prepared = null;
		projectionId = context.evaluationId;
		displayed = null;
		failure = null;
		refusal = point ? null : 'The working floor can’t be projected';
		if (outline?.kind === 'outline')
			selectCandidate(outline.cycleKey, outline.cycle, outline.evidence);
		else if (outline && outline.kind !== 'none') {
			refusal = outline.message;
			failure = outline.kind === 'refused' ? (outline.evidence ?? null) : null;
		}
	}

	function connectionAt(
		scene: ReturnType<typeof projectedScene>,
		css: StagePointerIntent['css'],
		coarse: boolean,
	) {
		const nodes = scene.junctions.filter(({ id }) => physicalJunctions.has(id));
		const hit = nearest(
			nodes.map((node) => ({
				value: node,
				distance: Math.hypot(node.css[0] - css[0], node.css[1] - css[1]),
			})),
			coarse ? 22 : INK_JUNCTION_HIT_CSS_PX,
		);
		if (hit === 'tied') return 'tied' as const;
		if (hit) return { kind: 'junction' as const, junction: hit };
		const wall = nearest(
			scene.walls.map((wall) => ({
				value: wall,
				distance:
					closestOnPolyline({ point: css, path: projectedWallPathCss(wall) })?.distance ?? Infinity,
			})),
			coarse ? 16 : INK_WALL_HIT_CSS_PX,
		);
		return wall === 'tied' ? wall : wall ? { kind: 'wall' as const, wall } : null;
	}

	function stationOn(
		anchor: SpaceCreationAnchor,
		frame: NonNullable<ReturnType<typeof openWallFrame>>,
	) {
		return anchor.kind === 'wall-station'
			? anchor.station
			: anchor.kind === 'junction' && anchor.id === frame.startJunctionId
				? 0
				: frame.length;
	}

	function spanPath(span: WallSpan): readonly LayoutVec2[] {
		if (!frameByWall.has(span.wallId))
			frameByWall.set(span.wallId, openWallFrame(document, span.wallId));
		const frame = frameByWall.get(span.wallId);
		const from = pointOf(span.from);
		const to = pointOf(span.to);
		if (!from || !to) return [];
		if (!frame) return [from, to];
		const a = stationOn(span.from, frame);
		const b = stationOn(span.to, frame);
		const points = frame.samples
			.filter(({ distance }) => distance > Math.min(a, b) && distance < Math.max(a, b))
			.map(({ point }) => point);
		return [from, ...(a > b ? points.reverse() : points), to];
	}

	function targetAt(
		context: StageAdapterContext,
		intent: StagePointerIntent,
	): Target | 'tied' | null {
		const raw = pointerDatumPoint(context, intent.css);
		if (!raw || mode === 'choose') return null;
		const point: LayoutVec2 = [raw[0], raw[1]];
		const css = intent.css;
		const radius = intent.coarse ? 22 : INK_JUNCTION_HIT_CSS_PX;
		const { left, top } = context.evaluation.rect;
		const project = ([x, z]: LayoutVec2) => {
			const p = context.project([x, context.snapshot.domain.datumMeters, z]);
			return p && ([p[0] - left, p[1] - top] as const);
		};
		if (mode === 'follow') {
			const hit = nearest(
				choices.map((span) => {
					const path = spanPath(span).map(project);
					const distance = path.every((p) => p !== null)
						? closestOnPolyline({ point: css, path })?.distance
						: null;
					return { value: span, distance: distance ?? Infinity };
				}),
				radius,
			);
			if (hit === 'tied') return hit;
			const endpoint = hit && pointOf(hit.to);
			return hit && endpoint ? { anchor: hit.to, point: endpoint, span: hit } : null;
		}
		const priorStations = new Map<string, SpaceCreationAnchor>();
		for (const anchor of [start, ...draft.map(({ to }) => to)]) {
			if (anchor?.kind === 'wall-station')
				priorStations.set(spaceCreationAnchorKey(anchor), anchor);
		}
		const prior = nearest(
			[...priorStations.values()].flatMap((anchor) => {
				const endpoint = pointOf(anchor);
				const projected = endpoint && project(endpoint);
				return endpoint && projected
					? [
							{
								value: { anchor, point: endpoint },
								distance: Math.hypot(css[0] - projected[0], css[1] - projected[1]),
							},
						]
					: [];
			}),
			radius,
		);
		if (prior) return prior;
		const hit = connectionAt(sceneFor(context), css, intent.coarse ?? false);
		if (hit === 'tied') return hit;
		if (hit?.kind === 'junction')
			return { anchor: { kind: 'junction', id: hit.junction.id }, point: hit.junction.point };
		if (hit?.kind === 'wall') {
			const station = wallStationAtPoint(document, hit.wall.id, point);
			if (station === null) return null;
			const anchor = { kind: 'wall-station' as const, wallId: hit.wall.id, station };
			const endpoint = pointOf(anchor);
			return endpoint ? { anchor, point: endpoint } : null;
		}
		const previous = cursor();
		const anchor = previous && pointOf(previous);
		const snap =
			anchor &&
			resolveJunctionPointSnap({
				geometry: context.snapshot.domain.geometry,
				point,
				anchor,
				pixelsPerMeter: 1 / context.evaluation.targetPlaneMetersPerCssPixel,
				drafting: context.drafting(),
			});
		const free = snap?.point ?? point;
		return {
			anchor: { kind: 'corner', key: `corner-${cornerSequence}`, point: free },
			point: free,
		};
	}

	function changeMode(next: 'draw' | 'follow') {
		reconcileLease();
		endPress();
		const from = cursor();
		if (next === 'follow' && (!from || from.kind === 'corner')) return;
		if (next === 'draw' && !paletteView().canDraw) return;
		mode = next;
		prepared = null;
		displayed = null;
		failure = null;
		refusal = null;
		splitHint = null;
		hoverTarget = null;
		choices =
			next === 'follow' && from && start
				? spaceCreationWallChoices(document, from, draft, start)
				: [];
		publish();
	}

	function proposeReturn(closeOnly = false) {
		prepared = null;
		displayed = null;
		failure = null;
		refusal = null;
		const from = cursor();
		if (!start || !from || (closeOnly && !sameAnchor(start, from))) return;
		const outline = ports.planCandidate(() => findSpaceCreationReturn(document, capture!, draft));
		if (outline.kind === 'outline')
			selectCandidate(outline.cycleKey, outline.cycle, outline.evidence, outline.plan);
		else if (outline.kind !== 'none') {
			refusal = outline.message;
			failure = outline.kind === 'refused' ? (outline.evidence ?? null) : null;
		}
		if (!refusal && !displayed) refusal = 'Follow Wall to continue the outline';
	}

	function append(target: Target) {
		refusal = null;
		splitHint = null;
		const from = cursor();
		if (!from) {
			if (target.anchor.kind === 'corner') {
				refusal = 'Start on a Wall';
				return;
			}
			start = target.anchor;
			capture = mintLayoutIdCapture();
			lease = services.stage.session.registerProposal({
				owner: LAYOUT_INK_TASK,
				reason: 'An open outline is live. Finish or cancel it to use Undo.',
			});
			describeSplits();
			return;
		}
		if (sameAnchor(from, target.anchor)) return;
		if (target.span) {
			draft.push(target.span);
			const closed = sameAnchor(start!, target.anchor);
			mode = closed ? 'choose' : 'follow';
			choices = closed ? [] : spaceCreationWallChoices(document, target.anchor, draft, start!);
			proposeReturn(true);
		} else {
			draft.push({ kind: 'virtual', from, to: target.anchor });
			if (target.anchor.kind === 'corner') cornerSequence += 1;
			else {
				mode = 'choose';
				proposeReturn();
			}
		}
		hoverTarget = null;
		describeSplits();
	}

	function describeSplits() {
		const anchors = [start, ...draft.map(({ to }) => to)];
		const hostIds = new Set(
			anchors.flatMap((anchor) => (anchor?.kind === 'wall-station' ? [anchor.wallId] : [])),
		);
		const names = document.walls
			.filter(({ id }) => hostIds.has(id))
			.map(({ name }) => name || 'Wall');
		splitHint = names.length ? `Splits ${names.join(', ')}` : null;
	}

	function backtrack(): boolean {
		reconcileLease();
		endPress();
		if (!start) return false;
		const last = draft.pop();
		if (!last) {
			clear();
			mode = 'draw';
		} else {
			mode = last.kind === 'virtual' ? 'draw' : 'follow';
			const from = cursor()!;
			choices = mode === 'follow' ? spaceCreationWallChoices(document, from, draft, start) : [];
			prepared = null;
			displayed = null;
			failure = null;
			refusal = null;
			hoverTarget = null;
			describeSplits();
		}
		publish();
		return true;
	}

	async function commit(candidate: Candidate) {
		reconcileLease();
		if (
			busy ||
			displayed !== candidate ||
			!currentSource() ||
			projectionId !== services.stage.evaluationId()
		)
			return;
		const before = services.stage.selectionState().primary;
		busy = true;
		publish();
		try {
			const result = await services.authoring.accept(candidate.intent);
			if (result.kind !== 'installed') {
				if (result.kind === 'refused' && !disposed) {
					refusal = result.message;
					failure = candidate.evidence;
					displayed = null;
				}
				return;
			}
			const fresh = services.stage.snapshot();
			if (fresh.sourceContentId !== result.install.sourceContentId) return;
			const current = services.stage.selectionState().primary;
			if (current && (!before || !sameSubject(before, current))) return;
			if (before && !current && !result.install.clearedSelection) return;
			const reference = layoutSubjectReference({
				kind: 'room',
				id: candidate.roomId,
				contentRevision: stageUnitRevision(fresh, 'layout'),
				levelId,
			});
			services.stage.closeTask();
			if (
				services.stage.setSelection({ ordered: [{ reference }], primary: reference }).kind ===
				'selected'
			) {
				services.openSpaceCreated?.(reference);
			}
		} finally {
			busy = false;
			publish();
		}
	}

	function updateManual(context: StageAdapterContext, intent: StagePointerIntent) {
		if (mode === 'choose' && projectionId !== context.evaluationId) proposeReturn();
		const raw = pointerDatumPoint(context, intent.css);
		hoverPoint = raw && [raw[0], raw[1]];
		projectionId = context.evaluationId;
		const target = targetAt(context, intent);
		hoverTarget = target === 'tied' ? null : target;
		if (mode !== 'choose') {
			refusal = !raw
				? 'The working floor can’t be projected'
				: target === 'tied'
					? 'Aim more clearly at one Wall or Junction'
					: null;
		}
	}

	function hover(intent: StagePointerIntent, context: StageAdapterContext): boolean {
		reconcileLease();
		if (!currentSource()) return false;
		if (intent.phase === 'cancel') {
			hoverPoint = null;
			hoverTarget = null;
			if (mode === 'hover') {
				displayed = null;
				failure = null;
				refusal = null;
			}
			return true;
		}
		if (intent.phase !== 'move') return false;
		if (mode === 'hover') updateAuto(context, intent);
		else updateManual(context, intent);
		return true;
	}

	function pointer(intent: StagePointerIntent, context: StageAdapterContext): boolean {
		reconcileLease();
		if (intent.phase === 'down') {
			if (!currentSource() || busy || intent.shift) return false;
			const shown = projectionId === context.evaluationId ? displayed : null;
			if (mode === 'hover') updateAuto(context, intent);
			else updateManual(context, intent);
			if (!hoverPoint) return false;
			const acquired = services.stage.acquireGesture({
				owner: LAYOUT_INK_TASK,
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change',
			});
			if (acquired.kind !== 'granted') return false;
			press = {
				lease: acquired.lease,
				origin: intent.css,
				evaluationId: intent.evaluationId,
				candidate: mode === 'hover' && shown === displayed ? shown : null,
				target: hoverTarget,
			};
			return true;
		}
		if (!press) return false;
		const old = press;
		const dragged = isStageDrag(
			{ x: old.origin[0], y: old.origin[1] },
			{ x: intent.css[0], y: intent.css[1] },
		);
		const sameProjection =
			old.evaluationId === intent.evaluationId && old.evaluationId === context.evaluationId;
		if (intent.phase === 'move' && old.lease.active && !dragged && sameProjection) return true;
		const eligible =
			old.lease.active && intent.phase === 'up' && currentSource() && sameProjection && !dragged;
		endPress();
		if (!eligible) {
			hoverTarget = null;
			if (mode === 'hover') displayed = null;
			return true;
		}
		if (mode === 'hover') {
			updateAuto(context, intent);
			if (old.candidate && displayed === old.candidate) void commit(old.candidate);
		} else if (old.target) {
			const released = targetAt(context, intent);
			const held = old.target;
			if (
				released &&
				released !== 'tied' &&
				((sameAnchor(held.anchor, released.anchor) &&
					held.span?.wallId === released.span?.wallId) ||
					(!held.span &&
						held.anchor.kind === 'wall-station' &&
						released.anchor.kind === 'wall-station' &&
						held.anchor.wallId === released.anchor.wallId))
			)
				append(held);
		}
		return true;
	}

	function key(intent: StageKeyboardIntent): boolean {
		reconcileLease();
		if (intent.kind === 'cancel') {
			if (press) {
				endPress();
				publish();
				return true;
			}
			if (mode === 'hover') return false;
			clear();
			publish();
			return true;
		}
		if (intent.kind === 'backtrack') return backtrack();
		if (intent.kind === 'finish' && paletteView().canCreate && displayed) {
			void commit(displayed);
			return true;
		}
		return false;
	}

	function paletteView(): RoomInkSnapshot {
		reconcileLease();
		const from = cursor();
		const closed = start !== null && draft.length > 0 && from !== null && sameAnchor(start, from);
		const anchored = from !== null && from.kind !== 'corner';
		return {
			mode,
			hint:
				splitHint ??
				(mode === 'hover'
					? 'Hover inside Walls'
					: !from
						? 'Start on a Wall'
						: displayed
							? displayed.label
							: mode === 'draw'
								? 'Pick a corner or end on a Wall'
								: 'Pick a highlighted Wall'),
			canFollow: mode !== 'hover' && anchored && draft.length > 0 && !closed,
			canDraw: mode === 'hover' || (anchored && !closed),
			canCreate:
				mode !== 'hover' &&
				displayed !== null &&
				!busy &&
				projectionId === services.stage.evaluationId(),
			confirmationId: mode !== 'hover' ? (displayed?.intent.operationId ?? null) : null,
			canBacktrack: start !== null && !busy,
			refusal,
		};
	}

	function previews(context: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		reconcileLease();
		const world = ([x, z]: LayoutVec2): [number, number, number] => [x, y, z];
		const physical = (paths: readonly (readonly LayoutVec2[])[]) =>
			paths.flatMap((path) => path.slice(1).map((p, i) => [world(path[i]!), world(p)] as const));
		const live = mode !== 'hover' || projectionId === context.evaluationId;
		if (!live) return [];
		const evidence = displayed?.evidence ?? failure;
		const walls =
			evidence?.walls ?? draft.flatMap((span) => (span.kind === 'wall' ? [spanPath(span)] : []));
		const virtual = [
			...(evidence?.virtual ??
				draft.flatMap((span) => {
					const a = pointOf(span.from);
					const b = pointOf(span.to);
					return span.kind === 'virtual' && a && b ? [[a, b] as const] : [];
				})),
		];
		const from = cursor();
		const active = from && pointOf(from);
		const first = start && draft.length > 0 ? pointOf(start) : null;
		if (mode === 'draw' && active && hoverTarget) virtual.push([active, hoverTarget.point]);
		const anchor = mode === 'hover' ? hoverPoint : active;
		const labels =
			anchor && (refusal || displayed)
				? [{ world: world(anchor), text: refusal ?? displayed!.label }]
				: [];
		const mark =
			hoverTarget && mode === 'draw'
				? hoverTarget
				: active && from
					? { point: active, anchor: from }
					: null;
		const snap = mark
			? {
					world: world(mark.point),
					name:
						mark.anchor.kind === 'corner'
							? 'Corner'
							: mark.anchor.kind === 'wall-station'
								? 'Wall'
								: 'Junction',
				}
			: undefined;
		return [
			...(first && start && from && !sameAnchor(start, from)
				? [
						candidatePreviewOf({
							id: 'layout-room-start',
							role: 'subject',
							geometry: { polygons: [], segments: [] },
							snap: {
								world: world(first),
								name: start.kind === 'wall-station' ? 'Wall' : 'Junction',
							},
						}),
					]
				: []),
			...(walls.length
				? [
						candidatePreviewOf({
							id: 'layout-room-physical',
							role: 'subject',
							drawing: true,
							geometry: { polygons: [], segments: physical(walls) },
						}),
					]
				: []),
			...(choices.length
				? [
						candidatePreviewOf({
							id: 'layout-room-wall-choices',
							role: 'affected',
							geometry: { polygons: [], segments: physical(choices.map(spanPath)) },
						}),
					]
				: []),
			...(hoverTarget?.span
				? [
						candidatePreviewOf({
							id: 'layout-room-follow-hover',
							role: 'subject',
							drawing: true,
							geometry: { polygons: [], segments: physical([spanPath(hoverTarget.span)]) },
						}),
					]
				: []),
			...(virtual.length || snap || labels.length
				? [
						candidatePreviewOf({
							id: 'layout-room-virtual',
							role: refusal ? 'refused' : 'subject',
							geometry: { polygons: [], segments: virtual.map(([a, b]) => [world(a), world(b)]) },
							labels,
							snap,
						}),
					]
				: []),
		];
	}

	return {
		pointer,
		hover,
		key,
		previews,
		paletteView,
		changeMode,
		backtrack,
		finish: () => {
			if (paletteView().canCreate && displayed) void commit(displayed);
		},
		clear,
		dispose() {
			clear();
			disposed = true;
		},
	};
}
