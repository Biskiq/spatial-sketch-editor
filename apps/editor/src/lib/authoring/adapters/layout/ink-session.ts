/**
 * Ink drawing: the Wall reading's one-operation controller.
 *
 * It owns the Line, Box, Arc and Circle state machines: the live chain draft,
 * the one identity capture shared by preview and acceptance, the in-flight
 * guard, the press lease, the planner preview, the palette controller and the
 * keyboard commands (finish, backtrack, cancel). It plans through the existing
 * drawing planners (`drawing-planners`, `chain`) and accepts through the one
 * coordinator port; it writes no source of its own and owns no geometry
 * algorithm. The Opening reading is its sibling controller
 * (`opening-placement-session`), driven through the same palette.
 *
 * Two lifetimes, kept apart:
 *
 * - **Adapter-lifetime defaults** — thickness, height, reading and wall mode —
 *   live in the shared `InkMemory`, so an accepted write's rebind does not
 *   forget them.
 * - **Captured gesture state** — the draft, its capture, the hover and snap, the
 *   preview, the notice, the press lease and the proposal lease — is created
 *   here per binding. `clear()` and `release()` end it exactly once: a live
 *   chain's proposal lease is released on finish, cancel, backtrack-to-empty,
 *   task close, replacement and disposal, so Undo is never stranded behind it.
 *
 * A refused acceptance leaves the chain editable with its capture kept for the
 * retry; a settled chain never donates its capture to the next one.
 */
import { type WallChainArc } from '@portfolio/layout-core/wall';
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';

import {
	stageUnitRevision,
	type GestureAcquisition,
	type ProposalLease,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCandidatePreview,
	type StageInkReadingRecord,
	type StageInkReadingSession,
	type StageKeyboardIntent,
	type StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';

import { type CandidatePaperGeometry } from './candidate-preview';
import {
	EMPTY_CHAIN_DRAFT,
	appendChainPoint,
	backtrackChainPoint,
	boxChainDraft,
	chainPlanRequest,
	classifyTypedChainPoint,
	closeChainDraft,
	isDraftStart,
	planChainDraft,
	type ChainDraft,
	type ChainDraftPoint,
	type ChainPlanPreview,
} from './chain';
import { wallChainCommitIntent } from './drawing-planners';
import {
	LAYOUT_INK_ENTRY,
	LAYOUT_INK_TASK,
	publishInkSurface,
	type InkController,
	type InkPointerTarget,
	type InkWallMode,
} from './ink';
import type { OpeningPlacementSession } from './opening-placement-session';
import { parsePlacementXZ } from './precision';
import type { LayoutSessionPorts } from './session-ports';
import type { createSpaceCreateSession } from './space-create-session';
import { type LayoutSnapWinner } from './snap';
import { pointerDatumPoint } from './stage-pointer';
import { createRegionInkSession } from './region-ink-session';
import { createContributedInkReader } from './ink-contributed';
import { previews as previewsOf } from './ink-previews';
import {
	paletteReadings as paletteReadingsOf,
	snapshotForPalette as snapshotForPaletteOf,
} from './ink-palette';
import {
	circleDraftPreview as circleDraftPreviewOf,
	planCircleDraft as planCircleDraftOf,
} from './ink-circle';
import { inkTargetAt as inkTargetAtOf } from './ink-targeting';
import { commitCircle as commitCircleOf } from './ink-circle-commit';
import {
	arcApexAt as arcApexAtOf,
	boxAnchor as boxAnchorOf,
	boxPreviewDraft as boxPreviewDraftOf,
	circlePreviewPoints as circlePreviewPointsOf,
	linePreviewBase as linePreviewBaseOf,
	linePreviewDraft as linePreviewDraftOf,
	planInkDraft as planInkDraftOf,
} from './ink-preview';

const _EMPTY_CANDIDATE_GEOMETRY: CandidatePaperGeometry = { polygons: [], segments: [] };

/** The Ink task as the binding drives it, across every reading it carries. */
export type InkSession = {
	/** The Ink pointer contract: contributed reading, Opening reading or Wall reading. */
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** A hover updates the live candidate; it never claims the move. */
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/**
	 * The command keys drawing owns while Ink is armed: `finish` and `backtrack` are
	 * the same two commands the palette runs, and `cancel` ends the chain before the
	 * host's unwind disarms the tool. A key the live chain has nothing to say about
	 * is refused, not swallowed.
	 */
	key(intent: StageKeyboardIntent, adapterContext: StageAdapterContext): boolean;
	/** The planner's live candidate for the current reading, in world coordinates. */
	previews(
		adapterContext: StageAdapterContext,
		datumMeters: number,
	): readonly StageCandidatePreview[];
	overlay(
		adapterContext: StageAdapterContext,
	): ReturnType<NonNullable<StageAdapterBinding['overlay']>>;
	/** A contributed reading's proposed body, drawn by the one Canvas. */
	ghosts(
		adapterContext: StageAdapterContext,
	): ReturnType<NonNullable<StageAdapterBinding['ghosts']>>;
	/** The contributed reading currently selected, or `null` for a built-in. */
	contributedReading(): StageInkReadingRecord | null;
	/** Open the contributed reading's session against this binding when it is selected. */
	ensureContributedSession(): StageInkReadingSession | null;
	/** Publish the palette's chapter: this binding's own live state. */
	publish(): void;
	/**
	 * End every transient with no commit and no document write: the press lease,
	 * the live chain and its proposal, the Opening candidate, the contributed
	 * session and the palette surface. Task close and disposal both end here.
	 */
	release(): void;
};

export function createInkSession(
	ports: Omit<LayoutSessionPorts, 'publish'> & {
		readonly opening: OpeningPlacementSession;
		readonly room: ReturnType<typeof createSpaceCreateSession>;
	},
): InkSession {
	const { services, document, levelId, presenter, memory, opening, room } = ports;
	const contributed = createContributedInkReader({ services, readingId: () => memory.reading });
	const contributedReading = contributed.reading;
	const endContributedSession = contributed.end;
	const ensureContributedSession = contributed.ensure;
	/** V1c — the one Pen's Terrace and Flat Roof drawing, over Box/Line. */
	const region = createRegionInkSession({
		services,
		document,
		levelId,
		inkTaskOpen: ports.inkTaskOpen,
		role: () => (memory.reading === 'roof' ? 'overhead' : 'floor'),
		mode: () => memory.regionMode,
		publish: () => publish(),
		select: ports.select,
	});
	/** The live chain draft, its hover target and its planner preview. */
	let draft: ChainDraft = EMPTY_CHAIN_DRAFT;
	/** A3 — the decided bulge apex and the raw plane point currently shaping it. */
	let inkArcApex: LayoutVec2 | null = null;
	let inkArcHover: LayoutVec2 | null = null;
	/** One operation, one capture: the same identity previews and commits. */
	let chainCapture: ReturnType<typeof mintLayoutIdCapture> | null = null;
	let inkHover: InkPointerTarget | null = null;
	/** The snap the current Ink hover named; never persisted. */
	let inkSnapWinner: LayoutSnapWinner | null = null;
	let inkNotice: string | null = null;
	let inkPreview: ChainPlanPreview | null = null;
	/** The live chain's lease: Undo names finish-or-cancel until it settles. */
	let inkProposal: ProposalLease | null = null;
	/**
	 * Set while one acceptance is in flight. The palette's Finish button and the
	 * `Enter` command can both fire for one gesture (a focused button activates on
	 * the same keydown the host maps), and two accepts for one chain would be two
	 * authored operations that were meant to be one.
	 */
	let chainCommitInFlight = false;
	let inkPress: {
		/** Where the press landed, in Stage-local CSS: the drag's own first point. */
		readonly origin: readonly [number, number];
		readonly evaluationId: string;
		readonly lease: GestureAcquisition | null;
		/**
		 * The deliberate target the **press** named. A drag authors its Wall from
		 * here, so a later move must never overwrite it — otherwise the Wall would
		 * start wherever the hand happened to hover last.
		 */
		readonly pressTarget: InkPointerTarget;
		/** The latest deliberate target under the pointer; the release falls back to it. */
		hover: InkPointerTarget;
		dragging: boolean;
	} | null = null;
	const linePreviewBase = (): ChainDraft => linePreviewBaseOf(draft, inkPress);
	const linePreviewDraft = (): ChainDraft => linePreviewDraftOf(draft, inkPress, inkHover);
	const planInkDraft = (target: ChainDraft, arc?: WallChainArc): ChainPlanPreview =>
		planInkDraftOf(document, target, chainCapture, levelId, memory, arc);
	const arcApexAt = (point: LayoutVec2): LayoutVec2 | null => arcApexAtOf(point, draft);
	const circlePreviewPoints = () => circlePreviewPointsOf(draft, inkPress, inkHover);
	const boxAnchor = () => boxAnchorOf(draft, inkPress);
	const boxPreviewDraft = () => boxPreviewDraftOf(document, draft, inkPress, inkHover);

	const circlePlanInput = {
		document: () => document,
		capture: () => chainCapture,
		memory,
		presenter,
		levelId,
	};
	const circleDraftPreview = (circle: { center: ChainDraftPoint; rim: ChainDraftPoint }) =>
		circleDraftPreviewOf(circlePlanInput, circle);
	const planCircleDraft = (
		center: ChainDraftPoint,
		rim: ChainDraftPoint,
		planCircle?: Parameters<typeof planCircleDraftOf>[3],
	) => planCircleDraftOf(circlePlanInput, center, rim, planCircle);
	const previewState = {
		memory,
		draft: () => draft,
		inkHover: () => inkHover,
		inkSnapWinner: () => inkSnapWinner,
		inkArcApex: () => inkArcApex,
		inkPreview: () => inkPreview,
		linePreviewBase,
		linePreviewDraft,
		boxPreviewDraft,
		boxAnchor,
		circlePreviewPoints,
		circleDraftPreview,
		room,
		region,
		opening,
		ports,
	};
	const previews = (adapterContext: StageAdapterContext, y: number) =>
		previewsOf(previewState, adapterContext, y);

	const paletteState = {
		get memory() {
			return memory;
		},
		get draft() {
			return draft;
		},
		inkHover: () => inkHover,
		inkArcApex: () => inkArcApex,
		inkPreview: () => inkPreview,
		inkNotice: () => inkNotice,
		linePreviewBase,
		linePreviewDraft,
		boxPreviewDraft,
		boxAnchor,
		region,
		opening,
		room,
		contributedReadings: () => services.stage.inkReadings(),
	};
	const paletteReadings = () => paletteReadingsOf(services.stage.inkReadings());
	const snapshotForPalette = () => snapshotForPaletteOf(paletteState);

	const targetState = {
		memory,
		draft: () => draft,
		document,
		linePreviewBase,
		setSnap: (winner: LayoutSnapWinner | null) => {
			inkSnapWinner = winner;
		},
	};
	const inkTargetAt = (adapterContext: StageAdapterContext, css: readonly [number, number]) =>
		inkTargetAtOf(targetState, adapterContext, css);

	const circleCommitInput = {
		services,
		memory,
		levelId,
		inFlight: () => chainCommitInFlight,
		setInFlight: (value: boolean) => {
			chainCommitInFlight = value;
		},
		capture: () => chainCapture,
		planCircleDraft,
		setNotice: (message: string) => {
			inkNotice = message;
		},
		publish,
		clearChain,
	};
	const commitCircle = (center: ChainDraftPoint, rim: ChainDraftPoint) =>
		commitCircleOf(circleCommitInput, center, rim);

	/** Re-plan the draft (with the hover point, when there is one). */
	function refreshInkPreview(): void {
		if (inkHover === null) inkSnapWinner = null;
		// A contributed reading owns its own preview; this binding's Wall chain
		// planner must never speak for it.
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			inkPreview = null;
			inkNotice = null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'circle') {
			// The Circle proposal shares the release Wall builder and keeps
			// reconciliation and source admission at release.
			const circle = circlePreviewPoints();
			inkPreview = circle === null ? null : circleDraftPreview(circle);
			if (inkPreview !== null)
				inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			// A3 — the preview is the exact cubic the third activation commits. The
			// planner owns the range refusal, so the Stage shows the drawn bulge and
			// repeats its words rather than clamping the bulge to a semicircle.
			if (draft.points.length < 2) {
				inkPreview = null;
				inkNotice = null;
				return;
			}
			if (inkArcHover !== null) {
				// A pointer on the chord names no bulge: clearing here prevents a
				// stale curve from outliving the bulge the creator moved away from.
				inkArcApex = arcApexAt(inkArcHover);
			}
			if (inkArcApex === null) {
				// Keep the release's words ("pull the bulge…") readable: a chord
				// with no rise is not a plan, but the refusal is still the answer.
				inkPreview = null;
				return;
			}
			inkPreview = planInkDraft(draft, { pointIndex: 0, apex: inkArcApex });
			inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'box') {
			// Box previews the very ring its release commits. With no second corner
			// yet there is nothing to plan, and a refusal set by the last release
			// stays readable until the pointer names a new box.
			const box = boxPreviewDraft();
			inkPreview = box === null ? null : planInkDraft(box);
			if (inkPreview !== null)
				inkNotice = inkPreview.kind === 'refused' ? inkPreview.message : null;
			return;
		}
		const points = linePreviewDraft();
		inkPreview = planInkDraft(points);
		// A refusal is only words for the palette: the live chain is untouched.
		inkNotice =
			inkPreview.kind === 'refused' && points.points.length >= 2 ? inkPreview.message : null;
	}

	/**
	 * Commit one Box through the same Wall-chain acceptance four Lines use. A
	 * degenerate box refuses in words and writes nothing; a tapped first corner
	 * stays so the creator can name another opposite corner.
	 */
	function commitBox(first: ChainDraftPoint, opposite: ChainDraftPoint): void {
		const box = boxChainDraft(document, first, opposite);
		if (!('points' in box)) {
			inkNotice = box.message;
			return;
		}
		void commitChain(box);
	}

	/** Begin the live chain: one capture and one proposal lease per operation. */
	function beginChain(point: ChainDraftPoint): void {
		draft = { points: [point], closed: false };
		inkArcApex = null;
		inkArcHover = null;
		chainCapture = mintLayoutIdCapture();
		inkProposal?.release();
		inkProposal = services.stage.session.registerProposal({
			owner: LAYOUT_INK_TASK,
			reason: 'A Wall chain is live; finish it or cancel it — Undo is available once it settles.',
		});
		inkNotice = null;
		refreshInkPreview();
		publish();
	}

	/** Drop the live chain's last point, keeping the operation alive while any remain. */
	function backtrackChain(): void {
		draft = backtrackChainPoint(draft);
		if (draft.points.length < 2) {
			inkArcApex = null;
			inkArcHover = null;
		}
		if (draft.points.length === 0) {
			inkProposal?.release();
			inkProposal = null;
			chainCapture = null;
		}
		inkNotice = null;
		refreshInkPreview();
		publish();
	}

	/** Drop the live chain and its proposal, exactly once. */
	function clearChain(): void {
		draft = EMPTY_CHAIN_DRAFT;
		inkArcApex = null;
		inkArcHover = null;
		chainCapture = null;
		inkHover = null;
		inkSnapWinner = null;
		inkPreview = null;
		inkNotice = null;
		inkProposal?.release();
		inkProposal = null;
		publish();
	}

	/** The chapter the palette reads: the live binding's own state. */
	function publish(): void {
		if (!ports.inkTaskOpen()) {
			publishInkSurface(null);
			return;
		}
		const controller: InkController = {
			setReading: (next) => {
				if (next === memory.reading) return;
				if (!paletteReadings().some((reading) => reading.id === next)) {
					inkNotice = 'That reading is not available in this project.';
					publish();
					return;
				}
				if (draft.points.length > 0) {
					inkNotice = 'Finish or cancel the Wall chain before switching readings.';
					publish();
					return;
				}
				if (region.snapshot().points.length > 0) {
					inkNotice = 'Finish or cancel the region before switching readings.';
					publish();
					return;
				}
				// A contributed reading owns live input too; a switch must not
				// silently throw away a half-drawn outline or a chosen depth.
				if (contributed.current()?.hasWork?.() === true) {
					inkNotice = 'Finish or cancel the live reading before switching readings.';
					publish();
					return;
				}
				// A contributed reading's session lives only while it is selected.
				endContributedSession();
				room.clear();
				region.clear();
				if (next === 'opening') opening.captureHost();
				memory.reading = next;
				inkNotice = null;
				// The palette remounts from the last valid options on the next Opening
				// reading, so its fields and the adapter agree again.
				if (next === 'opening') memory.openingOptionsValid = true;
				opening.clear();
				inkHover = null;
				if (next === 'wall') refreshInkPreview();
				else if (next !== 'opening') ensureContributedSession();
				services.stage.notifySurfaceChange();
				publish();
			},
			drawOpenSide: () => {
				if (memory.reading === 'room') room.changeMode('draw');
			},
			followWall: () => {
				if (memory.reading === 'room') room.changeMode('follow');
			},
			setWallMode: (mode: InkWallMode) => {
				if (mode === memory.wallMode) return;
				if (draft.points.length > 0 || inkPress !== null) {
					inkNotice =
						'Finish or cancel the Wall chain before switching between Line, Arc, Box and Circle.';
					publish();
					return;
				}
				memory.wallMode = mode;
				inkNotice = null;
				inkArcApex = null;
				inkArcHover = null;
				inkHover = null;
				refreshInkPreview();
				services.stage.notifySurfaceChange();
				publish();
			},
			setRegionMode: (mode) => {
				if (memory.reading !== 'terrace' && memory.reading !== 'roof') return;
				if (mode === memory.regionMode) return;
				if (region.snapshot().points.length > 0) {
					inkNotice = 'Finish or cancel the region before switching between Box and Line.';
					publish();
					return;
				}
				memory.regionMode = mode;
				inkNotice = null;
				services.stage.notifySurfaceChange();
				publish();
			},
			setOpeningOptions: (options) => opening.setOptions(options),
			placeOpening: (offsetText) => opening.placeAtOffset(offsetText),
			finish: () => {
				if (memory.reading === 'room') {
					room.finish();
					return;
				}
				if (memory.reading === 'terrace' || memory.reading === 'roof') {
					region.finish();
					return;
				}
				if (memory.reading === 'wall' && memory.wallMode === 'arc') {
					if (draft.points.length < 2 || inkArcApex === null) {
						inkNotice = 'An Arc needs a start, an end and a bulge.';
						publish();
						return;
					}
					void commitChain(draft, { pointIndex: 0, apex: inkArcApex });
					return;
				}
				void commitChain();
			},
			close: () => {
				if (memory.reading === 'wall' && memory.wallMode === 'arc') {
					inkNotice = 'An Arc is one open Wall; a ring is closed with Line.';
					publish();
					return;
				}
				const closed = closeChainDraft(draft);
				if ('points' in closed) void commitChain(closed);
				else {
					inkNotice = closed.message;
					publish();
				}
			},
			backtrack: () => {
				if (memory.reading === 'room') room.backtrack();
				else if (memory.reading === 'terrace' || memory.reading === 'roof')
					region.key({ kind: 'backtrack' });
				else backtrackChain();
			},
			cancel: () => {
				if (memory.reading === 'room') room.key({ kind: 'cancel' });
				else if (memory.reading === 'terrace' || memory.reading === 'roof') region.clear();
				else clearChain();
			},
			typePoint: (xText: string, zText: string) => {
				const parsed = parsePlacementXZ(xText, zText);
				if (!parsed.ok) {
					inkNotice = parsed.reason;
					publish();
					return;
				}
				if (memory.reading === 'wall' && memory.wallMode === 'arc' && draft.points.length >= 2) {
					inkNotice =
						'An Arc takes its bulge from the Stage: move the pointer and click to finish.';
					publish();
					return;
				}
				const next = classifyTypedChainPoint(document, parsed.point);
				appendInkPoint(next);
			},
			setOptions: (options) => {
				memory.thickness = options.thickness;
				memory.height = options.height;
				refreshInkPreview();
				publish();
			},
		};
		publishInkSurface({ snapshot: snapshotForPalette, controller });
	}

	/** Append one deliberate point, closing the ring when it returns to the start. */
	function appendInkPoint(next: ChainDraftPoint): void {
		if (draft.points.length === 0) {
			beginChain(next);
			return;
		}
		if (isDraftStart(draft, next.point, 1e-9) && draft.points.length >= 2) {
			void commitChain({ points: draft.points, closed: true });
			return;
		}
		const appended = appendChainPoint(draft, next);
		if (!('points' in appended)) {
			inkNotice = appended.message;
			publish();
			return;
		}
		draft = appended;
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			inkArcApex = null;
			inkArcHover = null;
		}
		inkNotice = null;
		inkHover = null;
		refreshInkPreview();
		publish();
	}

	/**
	 * A drag names one Wall: the point the press landed on **and** the point it was
	 * released on, accepted in one step.
	 *
	 * Recording only the release left a fresh chain a single point long, which the
	 * planner correctly refuses as an insufficient chain — so the primary gesture
	 * could not draw a Wall at all. The **press's own** target is the one kept: a
	 * move may have hovered elsewhere since, and a drag that starts on a Junction
	 * or on a Wall's interior declares that connection exactly as a tap does.
	 */
	function dragInkWall(press: InkPointerTarget, release: InkPointerTarget): void {
		const start: ChainDraftPoint = { point: press.point, target: press.target };
		const tip = draft.points[draft.points.length - 1];
		const continuesFromTip =
			tip !== undefined && tip.point[0] === start.point[0] && tip.point[1] === start.point[1];
		if (!continuesFromTip) {
			if (draft.points.length === 0) {
				// The chain's first point: one capture and one live proposal, exactly as
				// the first tap of a chain begins it.
				beginChain(start);
			} else if (isDraftStart(draft, start.point, 1e-9) && draft.points.length >= 2) {
				// The press landed on the chain's own first vertex: that is the enclosure
				// gesture, and the release is its finish.
				void commitChain({ points: draft.points, closed: true });
				return;
			} else {
				const begun = appendChainPoint(draft, start);
				if (!('points' in begun)) {
					inkNotice = begun.message;
					return;
				}
				draft = begun;
			}
		}
		if (draft.points.length >= 2 && isDraftStart(draft, release.point, 1e-9)) {
			void commitChain({ ...draft, closed: true });
			return;
		}
		const appended = appendChainPoint(draft, { point: release.point, target: release.target });
		if (!('points' in appended)) {
			inkNotice = appended.message;
			return;
		}
		draft = appended;
		void commitChain(appended);
	}

	/**
	 * Accept the whole chain once.
	 *
	 * Preview and acceptance run the **same** captured input: the draft's own
	 * points and declarations with one identity capture, so what the creator
	 * saw is what the planner commits. A refusal leaves the live chain editable
	 * and writes no partial source.
	 */
	async function commitChain(override?: ChainDraft, arc?: WallChainArc): Promise<void> {
		// One chain, one acceptance. A second activation of the same command (a
		// focused Finish button activated by the very keydown the host maps) is the
		// same creator intent, not a second operation.
		if (chainCommitInFlight) return;
		const target = override ?? draft;
		if (target.points.length < 2) {
			inkNotice = 'A chain needs at least two points.';
			publish();
			return;
		}
		chainCommitInFlight = true;
		try {
			await commitChainOnce(target, arc);
		} finally {
			chainCommitInFlight = false;
		}
	}

	/** The one acceptance pass; `commitChain` owns the in-flight guard. */
	async function commitChainOnce(target: ChainDraft, arc?: WallChainArc): Promise<void> {
		const capture = chainCapture ?? mintLayoutIdCapture();
		const request = chainPlanRequest(target);
		const payload = {
			points: request.points,
			close: request.close,
			junctionSnaps: request.endpointJunctionSnaps,
			hostSnaps: request.endpointHostSnaps,
			thickness: memory.thickness,
			height: memory.height,
			...(arc === undefined ? {} : { arc }),
		};
		const planned = planChainDraft({
			document,
			draft: target,
			capture,
			levelId,
			...(memory.thickness === null ? {} : { thickness: memory.thickness }),
			...(memory.height === null ? {} : { height: memory.height }),
			...(arc === undefined ? {} : { arc }),
		});
		if (planned.kind === 'refused') {
			// Refused in words, with a repair: the chain stays exactly as it was and
			// no source is written.
			inkNotice = planned.message;
			publish();
			return;
		}
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			wallChainCommitIntent({
				payload,
				capture,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId,
			}),
		);
		if (outcome.kind === 'refused') {
			inkNotice = outcome.message;
			publish();
			return;
		}
		const lastWallId =
			planned.authoredWallIds[planned.authoredWallIds.length - 1] ??
			planned.createdWallIds[planned.createdWallIds.length - 1] ??
			null;
		clearChain();
		// Accept the whole chain once and select the last created Wall; Ink stays
		// armed. A content install closes the active task, so the tool is re-armed
		// against the **new** source — its ids and generation are read after the
		// install, never from the binding the commit started in.
		const fresh = services.stage.snapshot();
		if (lastWallId !== null) {
			services.stage.select({
				sourceId: lastWallId,
				sourceKind: 'wall',
				generationId: fresh.compileGeneration,
				ref: {
					sourceId: lastWallId,
					sourceKind: 'wall',
					generationId: fresh.compileGeneration,
					stream: 'projected',
					subRef: null,
				},
			});
		}
		services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
		services.stage.notifySurfaceChange();
	}

	function endInkPress(): void {
		const current = inkPress;
		inkPress = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active)
			current.lease.lease.release();
	}

	/** The Ink half of the pointer contract. */
	function inkPointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
		if (intent.phase === 'down') {
			const target = inkTargetAt(adapterContext, intent.css);
			if (target === null) {
				inkNotice = 'That press does not land on the working plane.';
				publish();
				return false;
			}
			const acquisition = services.stage.acquireGesture({
				owner: LAYOUT_INK_TASK,
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change',
			});
			if (acquisition.kind !== 'granted') {
				inkNotice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
				publish();
				return false;
			}
			inkPress = {
				origin: intent.css,
				evaluationId: intent.evaluationId,
				lease: acquisition,
				pressTarget: target,
				hover: target,
				dragging: false,
			};
			inkHover = target;
			const pressedArcHover = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = pressedArcHover === null ? null : [pressedArcHover[0], pressedArcHover[1]];
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		const current = inkPress;
		if (current === null) return false;
		if (intent.phase === 'cancel') {
			endInkPress();
			inkHover = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		if (intent.evaluationId !== current.evaluationId) {
			// Reading flip: the press was measured in a projection that no longer
			// describes what is drawn. End the press and keep the live chain.
			endInkPress();
			inkHover = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		if (intent.phase === 'move') {
			current.dragging =
				Math.hypot(intent.css[0] - current.origin[0], intent.css[1] - current.origin[1]) > 4;
			const target = inkTargetAt(adapterContext, intent.css);
			if (target !== null) {
				current.hover = target;
				inkHover = target;
			} else {
				inkHover = null;
			}
			const movedArcHover = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = movedArcHover === null ? null : [movedArcHover[0], movedArcHover[1]];
			if (memory.reading === 'wall' && memory.wallMode === 'arc') inkNotice = null;
			refreshInkPreview();
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		// Release: a tap names one point; a drag names a Wall — the point the press
		// landed on and the point it was released on — and finishes it.
		const release = inkTargetAt(adapterContext, intent.css) ?? current.hover;
		const travel = Math.hypot(intent.css[0] - current.origin[0], intent.css[1] - current.origin[1]);
		const pressTarget = current.pressTarget;
		endInkPress();
		inkHover = null;
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			// A3 — start, end, bulge. A drag from the first point names both
			// endpoints in one gesture; the third activation sets the bulge.
			const apexPoint = pointerDatumPoint(adapterContext, intent.css);
			const rawRelease: LayoutVec2 =
				apexPoint === null ? [release.point[0], release.point[1]] : [apexPoint[0], apexPoint[1]];
			if (draft.points.length === 0) {
				beginChain({ point: pressTarget.point, target: pressTarget.target });
				if (travel > 4) {
					const appended = appendChainPoint(draft, {
						point: release.point,
						target: release.target,
					});
					if ('points' in appended) {
						draft = appended;
						inkArcApex = null;
					}
				}
			} else if (draft.points.length === 1) {
				const appended = appendChainPoint(draft, { point: release.point, target: release.target });
				if ('points' in appended) {
					draft = appended;
					inkArcApex = null;
				} else {
					inkNotice = appended.message;
				}
			} else {
				const bulge = arcApexAt(rawRelease);
				if (bulge !== null) {
					inkArcApex = bulge;
					inkArcHover = rawRelease;
					// The commit's own refusal words must survive: re-planning here
					// could clear a policy refusal the preview never ran.
					void commitChain(draft, { pointIndex: 0, apex: bulge });
					publish();
					return true;
				}
				inkNotice = 'Pull the bulge away from the chord to set the Arc.';
			}
			refreshInkPreview();
			publish();
			return true;
		}
		if (memory.reading === 'wall' && memory.wallMode === 'box') {
			// Box: a drag names both corners; a tap names the first corner, and the
			// next tap the opposite one.
			const releasePoint: ChainDraftPoint = { point: release.point, target: release.target };
			if (travel > 4)
				commitBox(
					draft.points[0] ?? { point: pressTarget.point, target: pressTarget.target },
					releasePoint,
				);
			else if (draft.points.length === 0) beginChain(releasePoint);
			else commitBox(draft.points[0]!, releasePoint);
		} else if (memory.reading === 'wall' && memory.wallMode === 'circle') {
			// Circle: a drag names centre → rim in one gesture; a tap names the
			// centre, and the next tap names the rim. The rim is released exactly
			// where the creator finished, so it is the canonical seam.
			const releasePoint: ChainDraftPoint = { point: release.point, target: release.target };
			if (travel > 4) {
				void commitCircle(
					draft.points[0] ?? { point: pressTarget.point, target: pressTarget.target },
					releasePoint,
				);
			} else if (draft.points.length === 0) beginChain(releasePoint);
			else void commitCircle(draft.points[0]!, releasePoint);
		} else if (travel <= 4) appendInkPoint({ point: release.point, target: release.target });
		else dragInkWall(pressTarget, release);
		refreshInkPreview();
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/** The Ink hover: a contributed reading's, the Opening's, or the live chain's. */
	function hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading === 'terrace' || memory.reading === 'roof')
			return region.hover(intent, adapterContext);
		if (memory.reading === 'room') {
			const claimed = room.hover(intent, adapterContext);
			if (claimed) {
				services.stage.notifySurfaceChange();
				publish();
			}
			return claimed;
		}
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) return false;
			const claimed = session.hover?.(intent, adapterContext) ?? false;
			if (claimed) publish();
			return claimed;
		}
		if (memory.reading === 'opening') return opening.hover(intent, adapterContext);
		// A Wall-reading hover updates the live chain. It never claims a move:
		// the host's navigation gesture and the next press stay the host's.
		if (intent.phase !== 'move') return false;
		if (memory.reading === 'wall' && memory.wallMode === 'arc') {
			const hoveredArc = pointerDatumPoint(adapterContext, intent.css);
			inkArcHover = hoveredArc === null ? null : [hoveredArc[0], hoveredArc[1]];
			inkNotice = null;
		}
		inkHover = inkTargetAt(adapterContext, intent.css);
		refreshInkPreview();
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/** The pointer contract across readings: contributed, Opening, then Wall. */
	function pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading === 'terrace' || memory.reading === 'roof')
			return region.pointer(intent, adapterContext);
		if (memory.reading === 'room') {
			const claimed = room.pointer(intent, adapterContext);
			if (claimed) {
				services.stage.notifySurfaceChange();
				publish();
			}
			return claimed;
		}
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) {
				inkNotice = 'That reading is not available in this project.';
				publish();
				return false;
			}
			const claimed = session.pointer(intent, adapterContext);
			publish();
			return claimed;
		}
		if (memory.reading === 'opening') return opening.pointer(intent, adapterContext);
		return inkPointer(intent, adapterContext);
	}

	function key(intent: StageKeyboardIntent, adapterContext: StageAdapterContext): boolean {
		if (memory.reading === 'terrace' || memory.reading === 'roof') return region.key(intent);
		if (memory.reading === 'room') {
			return room.key(intent);
		}
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			const session = ensureContributedSession();
			if (session === null) return false;
			const claimed = session.key?.(intent, adapterContext) ?? false;
			publish();
			return claimed;
		}
		switch (intent.kind) {
			case 'finish':
				if (draft.points.length < 2) return false;
				void commitChain();
				return true;
			case 'backtrack':
				if (draft.points.length === 0) return false;
				backtrackChain();
				return true;
			case 'cancel':
				if (draft.points.length === 0) return false;
				clearChain();
				return true;
			default:
				return false;
		}
	}

	function overlay(
		adapterContext: StageAdapterContext,
	): ReturnType<NonNullable<StageAdapterBinding['overlay']>> {
		if (memory.reading === 'room') {
			return [];
		}
		if (memory.reading !== 'wall' && memory.reading !== 'opening') {
			return contributed.current()?.overlay?.(adapterContext) ?? [];
		}
		if (memory.reading === 'opening') return opening.overlay(adapterContext);
		// The Wall reading's marks are the Stage's own candidate geometry, never a
		// second overlay drawing.
		return [];
	}

	function ghosts(
		adapterContext: StageAdapterContext,
	): ReturnType<NonNullable<StageAdapterBinding['ghosts']>> {
		if (
			memory.reading === 'wall' ||
			memory.reading === 'opening' ||
			memory.reading === 'room' ||
			memory.reading === 'terrace' ||
			memory.reading === 'roof'
		)
			return [];
		return contributed.current()?.ghosts?.(adapterContext) ?? [];
	}

	return {
		pointer,
		hover,
		key,
		previews,
		overlay,
		ghosts,
		contributedReading,
		ensureContributedSession,
		publish,
		release() {
			endInkPress();
			clearChain();
			opening.clear();
			room.clear();
			region.clear();
			endContributedSession();
			publishInkSurface(null);
		},
	};
}
