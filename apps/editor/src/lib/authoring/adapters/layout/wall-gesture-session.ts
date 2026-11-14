import { sizeDeltaLabel } from '$lib/authoring/stage/stage-adapter-host';
import { axisTravelFromRay } from '$lib/authoring/stage/stage-adapter-host';
import {
	proposeWallFirstArchitectureGeometry,
	type WallFirstArchitectureProposalWall,
	planExactWallHeight,
	planExactWallThickness,
	planUpdateWallFirstOpening,
	type FixedWallEndpoint,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	type StageAdapterContext,
	type StageKeyboardIntent,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import { perfInstall, perfMark } from '$lib/platform/perf-marks';

import { wallRefusalWords } from './refusals';
import { openingRefusalWords } from './opening-planners';
import { pointerDatumPoint } from './stage-pointer';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import {
	planNumericEntryField,
	planNumericEntryInput,
	planNumericEntryOpen,
	planNumericEntrySubmit,
	planNumericFields,
	type PlanNumericEntryState,
	type PlanNumericField,
	type PlanNumericHost
} from '$lib/authoring/layout/plan-numeric-entry';
import {
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_WALL_HEIGHT_KIND,
	LAYOUT_WALL_THICKNESS_KIND,
	buildLayoutIntent,
	wallManipulationIntent,
	curvedWallPointAt,
	type WallFrame,
	type WallManipulationRequest,
	type WallNeighbourPreview
} from './precision';
import {
	pointerWallRequest,
	wallRequestExactLabel,
	wallRequestLabel,
	type WallHandle,
	type WallPointerMode
} from './wall-gesture';
import { resolveJunctionPointSnap, snapWallDrag, type LayoutSnapWinner } from './snap';
import {
	DRAFTING_SNAP_METERS,
	draftingSnapIncrementMeters
} from '$lib/authoring/stage/stage-adapter-host';
import {
	type CandidatePaperGeometry,
	wallHeightGhostPaper,
	candidatePreviewOf,
	openingIdsOnWalls
} from './candidate-preview';
import {
	clearPausedProposal,
	clearPausedProposalsForSource,
	pausedWallProposal,
	publishPausedProposal,
	type PausedWallProposal
} from './paused-proposal';
import {
	selectedWall,
	selectedClosedWall,
	selectedCurvedWall,
	projectWallHandles,
	wallLength,
	wallDirection
} from './layout-subjects';
import {
	attemptedConflictPoint,
	createWallDragReader,
	datumSnapDistance,
	isPointerDrag,
	numericWords,
	previewCoordinates,
	wallProposalPaper,
	type LayoutManipulationPorts,
	type NumericGestureTarget
} from './manipulation-support';
import { type LayoutSessionPorts } from './session-ports';

function wallAxisSnapDistance(
	ctx: StageAdapterContext,
	origin: Readonly<LayoutVec2>,
	axis: Readonly<LayoutVec2>
): (from: number, to: number) => number {
	const at = (distance: number): LayoutVec2 => [
		origin[0] + axis[0] * distance,
		origin[1] + axis[1] * distance
	];
	return (from, to) => datumSnapDistance(ctx, at(from), at(to));
}
/**
 * The shape the hand is asking for, before validation. It is display evidence
 * only: it is never submitted, compiled, admitted to history or serialized.
 */
/**
 * The complete network a rigid Wall or Junction move asks for, before validation.
 * Junction moves reshape every incident Wall; a rigid move translates the whole
 * chain and lets connected neighbours follow. If the pure proposal cannot
 * describe the intent, the selected Wall's endpoint attempt is the narrow fallback.
 */
function attemptedWallNetwork(
	document: LayoutDocumentWallFirst,
	frame: WallFrame,
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): WallFirstArchitectureProposalWall[] {
	const network =
		request.kind === 'move'
			? proposeWallFirstArchitectureGeometry(document, {
					kind: 'wall-move',
					wallId: frame.wallId,
					delta: request.delta
				})
			: request.kind === 'junction'
				? proposeWallFirstArchitectureGeometry(document, {
						kind: 'junction-move',
						junctionId: request.junctionId,
						point: request.point
					})
				: undefined;
	return network !== undefined && network.length > 0
		? network
		: attemptedWallGesture(frame, request, fixed);
}

function attemptedWallGesture(
	frame: WallFrame,
	request: WallManipulationRequest,
	fixed: FixedWallEndpoint
): WallFirstArchitectureProposalWall[] {
	const start: LayoutVec2 = [frame.start[0], frame.start[1]];
	const end: LayoutVec2 = [frame.end[0], frame.end[1]];
	if (request.kind === 'junction') {
		if (request.junctionId === frame.startJunctionId)
			((start[0] = request.point[0]), (start[1] = request.point[1]));
		else ((end[0] = request.point[0]), (end[1] = request.point[1]));
	} else if (request.kind === 'move') {
		start[0] += request.delta[0];
		start[1] += request.delta[1];
		end[0] += request.delta[0];
		end[1] += request.delta[1];
	} else if (request.kind === 'length') {
		const fixedPoint = fixed === 'start' ? frame.start : frame.end;
		const sign = fixed === 'start' ? 1 : -1;
		const moving: LayoutVec2 = [
			fixedPoint[0] + frame.direction[0] * request.length * sign,
			fixedPoint[1] + frame.direction[1] * request.length * sign
		];
		if (fixed === 'start') end.splice(0, 2, moving[0], moving[1]);
		else start.splice(0, 2, moving[0], moving[1]);
	}
	return [{ wallId: frame.wallId, points: [start, end] }];
}

/** One claimed Wall gesture, from its immutable baseline to its one commit. */
type WallGesture = {
	/** The evaluation the press was measured in; a change pauses the writer. */
	readonly evaluationId: string;
	/** Stage-local CSS origin shared with the host's click tolerance. */
	readonly pressCss: readonly [number, number];
	readonly markId: string;
	readonly handle: WallHandle;
	readonly fixed: FixedWallEndpoint;
	/** What the mark means: length, angle, rigid move or a free Junction move. */
	readonly mode: WallPointerMode;
	/** The Junction a point gesture moves, or `null` for a body/length gesture. */
	readonly junctionId: string | null;
	/** The Wall's other end: the orthogonal guide for a point gesture. */
	readonly otherPoint: readonly [number, number] | null;
	/** The Wall's current normal, in world X/Z. */
	readonly normal: readonly [number, number];
	/** Which way the current drag moves along that normal. */
	normalSign: 1 | -1;
	readonly numericHost: PlanNumericHost;
	readonly numericField: PlanNumericField;
	/** Numeric entry opened by typing at the gesture; `null` while pointer-driven. */
	numeric: PlanNumericEntryState | null;
	readonly frame: WallFrame;
	readonly startPoint: readonly [number, number];
	/** The exact lease this gesture was granted, never whichever lease is live. */
	readonly lease: GestureAcquisition | null;
	/** The last valid explicit parameter, or `null` after a refused move. */
	request: WallManipulationRequest | null;
	/** The uncommitted centerlines from Layout's direct-edit proposal. */
	proposal: WallFirstArchitectureProposalWall[] | null;
	/** The attempted centerlines, retained even while validation refuses them. */
	attempt: WallFirstArchitectureProposalWall[] | null;
	/** The real conflict the refusal names, when the attempt has one. */
	refusalPoint: LayoutVec2 | null;
	readonly readPreview: ReturnType<typeof createWallDragReader>;
	/** Neighbours the candidate reshaped at the edited junction. */
	neighbours: readonly WallNeighbourPreview[];
	/** The winning snap, or `null` when nothing won. */
	snap: LayoutSnapWinner | null;
	/** The pointer's last datum point, for a refused candidate's dash. */
	pointerPoint: LayoutVec2 | null;
	/** The signed body distance the pointer currently names. */
	distance: number;
	/** The moving endpoint's current point (the Junction or free end). */
	movingPoint: readonly [number, number];
};
export function createWallGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
	candidatePaper,
	junctionActive
}: LayoutManipulationPorts &
	Pick<LayoutSessionPorts, 'candidatePaper'> & { readonly junctionActive: () => boolean }) {
	let gesture: WallGesture | null = null;
	type ScalarGesture = {
		spec: {
			id: string;
			subject: 'wall' | 'opening';
			subjectId: string;
			field: 'height' | 'thickness';
			value: number;
			anchor: [number, number, number];
			axis: [number, number, number];
			/** A top knob's stem foot (review pass 2 §6); absent for plain rays. */
			stem?: [number, number, number];
		};
		evaluationId: string;
		revision: string;
		pressCss: readonly [number, number];
		startTravel: number;
		metersPerCssPixel: number;
		lease: Extract<GestureAcquisition, { kind: 'granted' }>;
		value: number | null;
		candidate: LayoutDocumentWallFirst | null;
		numeric: PlanNumericEntryState | null;
		refusal: string | null;
	};
	let scalarGesture: ScalarGesture | null = null;
	function endScalar(): void {
		const current = scalarGesture;
		scalarGesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}
	const WALL_TOP_KNOB_REACH_METERS = 0.45;
	/** The selected Wall's cap and local tangent, for straight, curved or closed. */
	function selectedScalarTarget(adapterContext: StageAdapterContext): {
		readonly wallId: string;
		readonly cap: LayoutVec2;
		readonly tangent: LayoutVec2;
	} | null {
		const wall = selectedWall(adapterContext);
		if (wall !== null) {
			const tangent = wallDirection(wall.frame);
			return tangent === null
				? null
				: { wallId: wall.wallId, cap: wall.frame.end, tangent: [tangent[0], tangent[1]] };
		}
		const curved = selectedCurvedWall(document, adapterContext);
		if (curved !== null) {
			const end = curvedWallPointAt(curved.frame, curved.frame.length);
			return end === null ? null : { wallId: curved.wallId, cap: end.point, tangent: end.tangent };
		}
		const closed = selectedClosedWall(adapterContext);
		if (closed === null) return null;
		const radius = Math.hypot(closed.seam[0] - closed.center[0], closed.seam[1] - closed.center[1]);
		if (!(radius > 0)) return null;
		return {
			wallId: closed.wallId,
			cap: closed.seam,
			tangent: [
				-(closed.seam[1] - closed.center[1]) / radius,
				(closed.seam[0] - closed.center[0]) / radius
			]
		};
	}
	function scalarSpecs(ctx: StageAdapterContext): ScalarGesture['spec'][] {
		const target = selectedScalarTarget(ctx);
		if (target === null) return [];
		const source = document.walls.find((wall) => wall.id === target.wallId);
		if (source === undefined) return [];
		const y = ctx.snapshot.domain.datumMeters;
		const planReading = ctx.evaluation.settledReading === 'plan';
		const normal: LayoutVec2 = [-target.tangent[1], target.tangent[0]];
		const knob: LayoutVec2 = [
			target.cap[0] + target.tangent[0] * WALL_TOP_KNOB_REACH_METERS,
			target.cap[1] + target.tangent[1] * WALL_TOP_KNOB_REACH_METERS
		];
		return [
			{
				id: 'layout-wall-height',
				subject: 'wall',
				subjectId: source.id,
				field: 'height',
				value: source.height,
				// The top knob stands just past the Wall's cap on a stem from its
				// base, clear of the body and the thickness grip. Travel is vertical,
				// so the drawn offset never changes the planned height.
				anchor: [knob[0], y + source.height, knob[1]],
				stem: [knob[0], y, knob[1]],
				axis: [0, 1, 0]
			},
			{
				id: 'layout-wall-thickness',
				subject: 'wall',
				subjectId: source.id,
				field: 'thickness',
				value: source.thickness,
				anchor: [target.cap[0], planReading ? y : y + source.height, target.cap[1]],
				axis: [normal[0], 0, normal[1]]
			}
		];
	}
	function scalarTravel(
		ctx: StageAdapterContext,
		spec: ScalarGesture['spec'],
		css: readonly [number, number]
	): number | null {
		if (spec.field === 'height' && ctx.evaluation.settledReading === 'plan')
			return -css[1] * ctx.evaluation.targetPlaneMetersPerCssPixel;
		const ray = ctx.ray([css[0] + ctx.evaluation.rect.left, css[1] + ctx.evaluation.rect.top]);
		return ray === null
			? null
			: axisTravelFromRay({
					origin: spec.anchor,
					direction: spec.axis,
					rayOrigin: ray.origin,
					rayDirection: ray.direction
				});
	}
	function previewScalar(value: number): boolean {
		const current = scalarGesture;
		if (!current) return false;
		if (current.spec.subject === 'opening') {
			const opening = document.openings.find((o) => o.id === current.spec.subjectId);
			const plan = planUpdateWallFirstOpening(document, current.spec.subjectId, { height: value });
			if (plan.kind === 'rejected') {
				current.value = null;
				current.candidate = null;
				current.refusal = openingRefusalWords(document, plan.rejection, {
					openingId: current.spec.subjectId,
					...(opening
						? {
								wallId: opening.wallId,
								kind: opening.kind,
								offset: opening.offset,
								width: opening.width
							}
						: {}),
					height: value
				});
				return false;
			}
			current.value = value;
			current.candidate = plan.document;
			current.refusal = null;
			return true;
		}
		const plan =
			current.spec.field === 'height'
				? planExactWallHeight(document, current.spec.subjectId, value)
				: planExactWallThickness(document, current.spec.subjectId, value);
		if (plan.kind === 'rejected') {
			current.value = null;
			current.candidate = null;
			current.refusal = wallRefusalWords(plan.rejection.code, plan.rejection.message);
			return false;
		}
		current.value = value;
		current.candidate = plan.document;
		current.refusal = null;
		return true;
	}
	async function commitScalar(current: ScalarGesture, value: number): Promise<void> {
		const snapshot = services.stage.snapshot();
		// Capture the baseline revision: a stale press can never be rebased into a different edit.
		if (stageUnitRevision(snapshot, 'layout') !== contentRevision) return;
		const subject = current.spec.subject;
		const id = current.spec.subjectId;
		const field = current.spec.field;
		const outcome = await services.authoring.accept(
			buildLayoutIntent({
				kind:
					subject === 'opening'
						? LAYOUT_OPENING_MEASURE_KIND
						: field === 'height'
							? LAYOUT_WALL_HEIGHT_KIND
							: LAYOUT_WALL_THICKNESS_KIND,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: current.revision,
				contentRevision,
				levelId,
				targets: [
					{
						version: 1,
						domain: 'layout',
						subject: { kind: subject, id },
						revision: { kind: 'exact', contentRevision },
						instancePath: [],
						location: {
							kind: 'layout-location',
							levelId,
							structureInstancePath: []
						},
						componentId: null,
						capabilityId: null
					}
				],
				payload:
					subject === 'opening'
						? { openingId: id, field: 'height', value }
						: { wallId: id, [field]: value }
			})
		);
		publishRefusal(outcome.kind === 'refused' ? outcome.message : null);
		services.stage.notifySurfaceChange();
	}
	function scalarPointer(intent: StagePointerIntent, ctx: StageAdapterContext): boolean {
		if (intent.phase === 'down') {
			const spec = scalarSpecs(ctx).find((s) => s.id === intent.handleId);
			if (!spec) return false;
			const travel = scalarTravel(ctx, spec, intent.css);
			if (travel === null) return false;
			const lease = services.stage.acquireGesture({
				owner: 'layout-scalar',
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (lease.kind !== 'granted') return false;
			scalarGesture = {
				spec,
				evaluationId: intent.evaluationId,
				revision: services.authoring.acceptedRevision().revisionId,
				pressCss: intent.css,
				startTravel: travel,
				metersPerCssPixel: ctx.evaluation.targetPlaneMetersPerCssPixel,
				lease,
				value: null,
				candidate: null,
				numeric: null,
				refusal: null
			};
			services.stage.notifySurfaceChange();
			return true;
		}
		const current = scalarGesture;
		if (!current) return false;
		if (
			intent.phase === 'cancel' ||
			intent.evaluationId !== current.evaluationId ||
			!current.lease.lease.active
		) {
			endScalar();
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'move' && current.numeric === null) {
			if (!isPointerDrag(current.pressCss, intent.css)) return true;
			const travel = scalarTravel(ctx, current.spec, intent.css);
			if (travel === null) return true;
			let value =
				current.spec.value +
				(travel - current.startTravel) * (current.spec.field === 'thickness' ? 2 : 1);
			const step = draftingSnapIncrementMeters(ctx.drafting());
			if (step !== null) {
				const raw = value;
				value = Math.round(value / step) * step;
				if (current.spec.field === 'height') {
					const sill =
						current.spec.subject === 'opening'
							? (document.openings.find((o) => o.id === current.spec.subjectId)?.sillHeight ?? 0)
							: 0;
					const candidates = [
						services.stage.heightSheet().height(),
						...services.stage.heightSheet().pins(),
						...services.stage.heightTicks().map((tick) => tick.heightMeters)
					]
						.map((h) => h - sill)
						.filter((h) => h > 0);
					const nearest = candidates.toSorted((a, b) => Math.abs(a - raw) - Math.abs(b - raw))[0];
					if (
						nearest !== undefined &&
						Math.abs(nearest - raw) < (intent.coarse ? 12 : 6) * current.metersPerCssPixel
					)
						value = nearest;
				}
			}
			previewScalar(value);
			services.stage.notifySurfaceChange();
			return true;
		}
		if (intent.phase === 'up' && current.numeric === null) {
			const value = isPointerDrag(current.pressCss, intent.css) ? current.value : null;
			if (current.refusal !== null)
				settleRefusal({
					subject:
						current.spec.subject === 'wall'
							? { kind: 'wall', wallId: current.spec.subjectId }
							: { kind: 'opening', openingId: current.spec.subjectId },
					contentRevision,
					point: [current.spec.anchor[0], current.spec.anchor[2]],
					text: current.refusal
				});
			endScalar();
			if (value !== null) void commitScalar(current, value);
			services.stage.notifySurfaceChange();
		}
		return true;
	}
	function scalarKey(intent: StageKeyboardIntent): boolean {
		const current = scalarGesture;
		if (!current) return false;
		if (intent.kind === 'type') {
			const key = intent.key;
			if (key === '\t') return true;
			if (current.numeric === null) {
				const field = current.spec.field;
				const opened = planNumericEntryOpen(
					{ host: field, fieldId: field, ownerId: current.spec.subjectId },
					{ [field]: current.value ?? current.spec.value }
				);
				current.numeric = planNumericEntryInput(opened, key);
			} else current.numeric = planNumericEntryInput(current.numeric, current.numeric.text + key);
		} else if (intent.kind === 'backtrack' && current.numeric !== null)
			current.numeric = planNumericEntryInput(current.numeric, current.numeric.text.slice(0, -1));
		else if (intent.kind === 'finish' && current.numeric !== null) {
			const result = planNumericEntrySubmit(current.numeric);
			if (result.kind === 'refuse') {
				current.numeric = result.state;
				current.refusal = 'Enter a positive measure.';
			} else if (result.kind !== 'ignored') {
				const value = result.values[current.spec.field];
				if (value !== undefined && previewScalar(value)) {
					endScalar();
					void commitScalar(current, value);
				}
			}
		} else if (intent.kind === 'cancel') {
			if (current.numeric !== null) current.numeric = null;
			else endScalar();
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	/*
	 * Review pass 3 — Room move. A selected Room publishes one move cross under
	 * its label. The connected group is resolved once, then its baseline
	 * centerlines follow the pointer. Release submits one Layout intent. Scene
	 * objects stay where they are: they are world-placed, owned by no Room.
	 */
	function endGesture(): void {
		endScalar();
		const current = gesture;
		gesture = null;
		// Release **this gesture's own** grant. Reading the session's live lease
		// would release another owner's after a reading change already spent ours.
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
	}
	/**
	 * A reading flip ends the writer but not the work: the last explicit
	 * parameter is kept as a paused proposal for the Card to name. It is never
	 * committed by the pointer-up that follows, which is what "no silent commit"
	 * means mechanically.
	 */
	function preservePausedProposal(sourceContentId: string): void {
		const current = gesture;
		if (current === null || current.request === null) {
			pausedProposal = null;
			return;
		}
		const proposal = {
			sourceContentId,
			wallId: current.frame.wallId,
			request: current.request,
			fixed: current.fixed,
			label: wallRequestExactLabel(current.request, current.fixed)
		};
		pausedProposal = proposal;
		// The Card's field writer offers an explicit Resume from this store; it is
		// not a document and the retained planner revalidates the request on apply.
		publishPausedProposal(proposal);
	}
	/** The Wall operation a mark id names, or `null` for a non-Wall mark. */
	function wallMarkSpec(markId: string): {
		readonly handle: WallHandle;
		readonly fixed: FixedWallEndpoint;
		readonly mode: WallPointerMode;
		readonly host: PlanNumericHost;
		readonly numericField: 'length' | 'angle' | 'distance' | 'x';
	} | null {
		switch (markId) {
			case 'layout-wall-start-mark':
				return { handle: 'start', fixed: 'end', mode: 'junction', host: 'junction', numericField: 'x' };
			case 'layout-wall-end-mark':
				return { handle: 'end', fixed: 'start', mode: 'junction', host: 'junction', numericField: 'x' };
			case 'layout-wall-length':
				return {
					handle: 'end',
					fixed: 'start',
					mode: 'length',
					host: 'wall-edit',
					numericField: 'length'
				};
			case 'layout-wall-move-mark':
				return {
					handle: 'body',
					fixed: 'start',
					mode: 'move',
					host: 'wall-normal',
					numericField: 'distance'
				};
			default:
				return null;
		}
	}

	let pausedProposal: PausedWallProposal | null = null;
	function clearPaused() {
		if (pausedProposal !== null) {
			clearPausedProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
		}
		pausedProposal = null;
	}

	function replacePaused(sourceContentId: string) {
		pausedProposal = null;
		clearPausedProposalsForSource(sourceContentId);
	}

	function begin(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		selected: { wallId: string; frame: WallFrame },
		markId: string,
		bodyPress: boolean
	) {
		const point = pointerDatumPoint(adapterContext, intent.css);
		if (point === null) return false;
		const acquisition = services.stage.acquireGesture({
			owner: 'layout-precision',
			evaluationId: intent.evaluationId,
			policy: 'cancel-on-reading-change'
		});
		if (acquisition.kind !== 'granted') {
			publishRefusal(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
			return false;
		}
		const wallSpec = bodyPress
			? {
					handle: 'body' as const,
					fixed: 'start' as const,
					mode: 'move' as const,
					host: 'wall-normal' as const,
					numericField: 'distance' as const
				}
			: wallMarkSpec(markId);
		if (wallSpec !== null) {
			const numericFields = planNumericFields(wallSpec.host);
			const numericField =
				numericFields.find((field) => field.id === wallSpec.numericField) ?? numericFields[0]!;
			const normal: readonly [number, number] = [
				-selected.frame.direction[1],
				selected.frame.direction[0]
			];
			const junctionId =
				wallSpec.mode !== 'junction'
					? null
					: wallSpec.handle === 'start'
						? selected.frame.startJunctionId
						: selected.frame.endJunctionId;
			const otherPoint =
				wallSpec.mode !== 'junction'
					? null
					: wallSpec.handle === 'start'
						? selected.frame.end
						: selected.frame.start;
			const movingPoint =
				wallSpec.mode === 'junction'
					? wallSpec.handle === 'start'
						? selected.frame.start
						: selected.frame.end
					: point;
			const nextGesture: WallGesture = {
				evaluationId: intent.evaluationId,
				pressCss: intent.css,
				markId,
				handle: wallSpec.handle,
				fixed: wallSpec.fixed,
				mode: wallSpec.mode,
				junctionId,
				otherPoint,
				normal,
				normalSign: 1,
				numericHost: wallSpec.host,
				numericField,
				numeric: null,
				frame: selected.frame,
				startPoint: point,
				lease: acquisition,
				request: null,
				proposal: null,
				attempt: null,
				refusalPoint: null,
				readPreview: createWallDragReader(stageLayout(adapterContext.snapshot)),
				neighbours: [],
				snap: null,
				pointerPoint: [point[0], point[1]],
				distance: 0,
				movingPoint
			};
			gesture = nextGesture;
			services.stage.notifySurfaceChange();
			return true;
		}
		acquisition.lease.release();
		return false;
	}

	function move(intent: StagePointerIntent, adapterContext: StageAdapterContext) {
		if (gesture === null) return false;
		if (!isPointerDrag(gesture.pressCss, intent.css)) {
			gesture.request = null;
			gesture.proposal = null;
			gesture.neighbours = [];
			gesture.snap = null;
			gesture.pointerPoint = null;
			publishRefusal(null);
			services.stage.notifySurfaceChange();
			return true;
		}
		const point = pointerDatumPoint(adapterContext, intent.css);
		if (point === null) {
			services.stage.notifySurfaceChange();
			return true;
		}
		const wallGesture = gesture!;
		const drafting = adapterContext.drafting();
		const grabbedEnd = wallGesture.handle === 'start' ? wallGesture.frame.start : wallGesture.frame.end;
		const aimed: LayoutVec2 = [
			grabbedEnd[0] + (point[0] - wallGesture.startPoint[0]),
			grabbedEnd[1] + (point[1] - wallGesture.startPoint[1])
		];
		let moveSnapped = false;
		wallGesture.pointerPoint = [point[0], point[1]];
		let request: WallManipulationRequest;
		let winner: LayoutSnapWinner | null = null;
		let snappedPoint: readonly [number, number] = point;
		if (wallGesture.mode === 'junction') {
			const anchor = wallGesture.otherPoint;
			if (anchor === null) return true;
			const snapped = resolveJunctionPointSnap({
				geometry: adapterContext.snapshot.domain.geometry,
				point: aimed,
				anchor: [anchor[0], anchor[1]],
				pixelsPerMeter: 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel,
				distanceCss: (from, to) => datumSnapDistance(adapterContext, from, to),
				drafting
			});
			snappedPoint = snapped?.point ?? aimed;
			winner = snapped;
			request = pointerWallRequest({
				handle: wallGesture.handle,
				mode: 'junction',
				frame: wallGesture.frame,
				fixed: wallGesture.fixed,
				startPoint: wallGesture.startPoint,
				point: snappedPoint
			});
			wallGesture.movingPoint = snappedPoint;
			// A press that has not left the endpoint's own cell names no move. It is
			// neither a refusal nor a proposal, so release commits nothing.
			const origin = wallGesture.handle === 'start' ? wallGesture.frame.start : wallGesture.frame.end;
			if (Math.hypot(snappedPoint[0] - origin[0], snappedPoint[1] - origin[1]) < 1e-9) {
				wallGesture.request = null;
				wallGesture.proposal = null;
				wallGesture.neighbours = [];
				wallGesture.snap = null;
				publishRefusal(null);
				services.stage.notifySurfaceChange();
				return true;
			}
		} else if (wallGesture.handle === 'body' || wallGesture.mode === 'move') {
			const rawDistance =
				(point[0] - wallGesture.startPoint[0]) * wallGesture.normal[0] +
				(point[1] - wallGesture.startPoint[1]) * wallGesture.normal[1];
			wallGesture.normalSign = rawDistance < 0 ? -1 : 1;
			const { value: distance, snapped } = snapWallDrag(
				rawDistance,
				drafting,
				wallAxisSnapDistance(adapterContext, wallGesture.startPoint, wallGesture.normal)
			);
			moveSnapped = snapped;
			wallGesture.distance = distance;
			if (distance === 0) {
				// A zero delta is not a refusal and not a proposal: the Wall has not
				// left its line, so release commits nothing.
				wallGesture.request = null;
				wallGesture.proposal = null;
				wallGesture.neighbours = [];
				wallGesture.snap = null;
				publishRefusal(null);
				services.stage.notifySurfaceChange();
				return true;
			}
			snappedPoint = [
				wallGesture.startPoint[0] + wallGesture.normal[0] * distance,
				wallGesture.startPoint[1] + wallGesture.normal[1] * distance
			];
			wallGesture.movingPoint = snappedPoint;
			request = pointerWallRequest({
				handle: 'body',
				mode: 'move',
				frame: wallGesture.frame,
				fixed: wallGesture.fixed,
				startPoint: wallGesture.startPoint,
				point: snappedPoint
			});
		} else {
			request = pointerWallRequest({
				handle: wallGesture.handle,
				mode: 'length',
				frame: wallGesture.frame,
				fixed: wallGesture.fixed,
				startPoint: wallGesture.startPoint,
				point
			});
		}
		// A pointer dragged across the fixed endpoint names no length on this
		// Wall: the planner would place the moved endpoint on the existing side,
		// mirroring the preview away from the hand. Withdraw the candidate and
		// name the refusal instead of committing a mirrored Wall.
		const attempted =
			request.kind === 'angle'
				? null
				: attemptedWallNetwork(document, wallGesture.frame, request, wallGesture.fixed);
		if (attempted !== null) wallGesture.attempt = attempted;
		if (request.kind === 'length' && request.length <= 0) {
			wallGesture.request = null;
			wallGesture.proposal = null;
			wallGesture.neighbours = [];
			wallGesture.snap = null;
			publishRefusal('Drag the endpoint back across the fixed endpoint to name a length.');
			// T3.P03.S02: a refused sample installs no preview, so the harness must
			// see it as refused rather than as an input that never arrived.
			perfMark('wall-preview:refused', { wallId: wallGesture.frame.wallId });
			services.stage.notifySurfaceChange();
			return true;
		}
		if (request.kind === 'length') {
			const fixedPoint = wallGesture.fixed === 'start' ? wallGesture.frame.start : wallGesture.frame.end;
			const sign = wallGesture.fixed === 'start' ? 1 : -1;
			const direction: LayoutVec2 = [
				wallGesture.frame.direction[0] * sign,
				wallGesture.frame.direction[1] * sign
			];
			const { value: snappedLength, snapped } = snapWallDrag(
				request.length,
				drafting,
				wallAxisSnapDistance(adapterContext, fixedPoint, direction),
				DRAFTING_SNAP_METERS
			);
			if (snappedLength !== request.length) {
				request = { kind: 'length', length: snappedLength };
			}
			// The ray's own accepted length is not a proposal: a click-like sample
			// leaves the Wall and the Card untouched.
			if (Math.abs(request.length - wallGesture.frame.length) < 1e-9) {
				wallGesture.request = null;
				wallGesture.proposal = null;
				wallGesture.neighbours = [];
				wallGesture.snap = null;
				publishRefusal(null);
				services.stage.notifySurfaceChange();
				return true;
			}
			if (snapped) {
				winner = {
					point: [
						fixedPoint[0] + wallGesture.frame.direction[0] * snappedLength * sign,
						fixedPoint[1] + wallGesture.frame.direction[1] * snappedLength * sign
					],
					kind: 'grid',
					name: 'Grid'
				};
			}
			wallGesture.movingPoint = winner?.point ?? point;
		}
		const frame = wallGesture.frame;
		if (request.kind === 'angle') return true; // The Stage publishes no turn grip.
		const fixedStart = wallGesture.fixed === 'start';
		const fixedPoint = fixedStart ? frame.start : frame.end;
		const sign = fixedStart ? 1 : -1;
		const planned = wallGesture.readPreview(
			request.kind === 'move'
				? { kind: 'wall-move', wallId: frame.wallId, delta: request.delta }
				: request.kind === 'junction'
					? { ...request, kind: 'junction-move' }
					: {
							kind: 'junction-move',
							junctionId: fixedStart ? frame.endJunctionId : frame.startJunctionId,
							point: [
								fixedPoint[0] + frame.direction[0] * request.length * sign,
								fixedPoint[1] + frame.direction[1] * request.length * sign
							]
						}
		);
		if (planned.kind === 'refused') {
			// A refused candidate is not a proposal: drop the preview so a
			// later release cannot install the last valid pose on its behalf.
			wallGesture.request = null;
			wallGesture.proposal = null;
			wallGesture.neighbours = [];
			wallGesture.snap = null;
			wallGesture.refusalPoint =
				attempted === null
					? wallGesture.pointerPoint
					: (attemptedConflictPoint(attempted, document) ?? wallGesture.pointerPoint);
			publishRefusal(wallRefusalWords(planned.code));
			perfMark('wall-preview:refused', { wallId: wallGesture.frame.wallId });
		} else {
			wallGesture.request = request;
			wallGesture.proposal = planned.walls;
			const subject = planned.walls.find((wall) => wall.wallId === frame.wallId);
			const moved =
				request.kind === 'move'
					? [subject?.points[0], subject?.points.at(-1)]
					: [subject?.points.at(fixedStart ? -1 : 0)];
			wallGesture.neighbours = planned.walls.flatMap(({ wallId, points }) => {
				if (wallId === frame.wallId) return [];
				const endpoint = [points[0], points.at(-1)].find(
					(point) =>
						point !== undefined && moved.some((at) => at?.[0] === point[0] && at?.[1] === point[1])
				);
				return endpoint === undefined ? [] : [{ wallId, point: endpoint }];
			});
			wallGesture.snap =
				request.kind === 'move' && moveSnapped
					? {
							point: [
								(frame.start[0] + frame.end[0]) / 2 + request.delta[0],
								(frame.start[1] + frame.end[1]) / 2 + request.delta[1]
							],
							kind: 'grid',
							name: 'Grid'
						}
					: winner;
			publishRefusal(null);
			// The candidate is installed into the overlay here; presentation is
			// the next frame, which the harness pairs by sequence.
			perfInstall('wall-preview', { wallId: wallGesture.frame.wallId });
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	function release(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		refusal: string | null
	) {
		const current = gesture;
		if (current === null) return false;
		const dragged = isPointerDrag(current.pressCss, intent.css);
		const pending = current.numeric === null && dragged ? current.request : null;
		const fixed = current.fixed;
		const wallId = current.frame.wallId;
		const refusedPoint = dragged ? current.pointerPoint : null;
		const refusedText = dragged ? refusal : null;
		const attemptGeometry =
			current.attempt === null
				? null
				: wallProposalPaper(current.attempt, adapterContext.snapshot.domain.datumMeters);
		if (pending === null && refusedText !== null && refusedPoint !== null) {
			settleRefusal({
				subject: { kind: 'wall', wallId },
				contentRevision: adapterContext.snapshot.domain.unitRevisions.layout,
				point: current.refusalPoint ?? refusedPoint,
				text: refusedText,
				...(attemptGeometry === null ? {} : { geometry: attemptGeometry })
			});
		}
		endGesture();
		if (pending !== null) void commit(pending, fixed, wallId, refusedPoint, attemptGeometry);
		services.stage.notifySurfaceChange();
		return true;
	}

	function numericTarget(): NumericGestureTarget | null {
		const wall = gesture;
		if (wall !== null) {
			const length = wallLength(wall.frame);
			const angle =
				((Math.atan2(wall.frame.end[1] - wall.frame.start[1], wall.frame.end[0] - wall.frame.start[0]) *
					180) /
					Math.PI +
					360) %
				360;
			return {
				host: wall.numericHost,
				field: wall.numericField,
				ownerId: wall.frame.wallId,
				candidates:
					wall.numericHost === 'wall-normal'
						? { distance: Math.abs(wall.distance) }
						: wall.numericHost === 'junction'
							? { x: wall.movingPoint[0], z: wall.movingPoint[1] }
							: wall.numericField.id === 'angle'
								? { angle }
								: { length }
			};
		}
		return null;
	}

	function submitNumeric() {
		const wall = gesture;
		if (wall !== null) {
			if (wall.numeric === null) return false;
			const outcome = planNumericEntrySubmit(wall.numeric);
			if (outcome.kind === 'refuse') {
				wall.numeric = outcome.state;
				publishRefusal(numericWords(outcome.reason));
				services.stage.notifySurfaceChange();
				return true;
			}
			if (outcome.kind === 'ignored') return true;
			wall.numeric = null;
			const values = outcome.values;
			let request: WallManipulationRequest | null = null;
			if (wall.numericHost === 'wall-normal') {
				const distance = (values.distance ?? 0) * wall.normalSign;
				request = { kind: 'move', delta: [wall.normal[0] * distance, wall.normal[1] * distance] };
			} else if (wall.numericHost === 'junction' && wall.junctionId !== null) {
				request = {
					kind: 'junction',
					junctionId: wall.junctionId,
					point: [values.x ?? wall.movingPoint[0], values.z ?? wall.movingPoint[1]]
				};
			} else if (wall.numericField.id === 'length' && values.length !== undefined) {
				request = { kind: 'length', length: values.length };
			} else if (wall.numericField.id === 'angle' && values.angle !== undefined) {
				request = { kind: 'angle', angleRadians: (values.angle * Math.PI) / 180 };
			}
			const fixed = wall.fixed;
			const wallId = wall.frame.wallId;
			endGesture();
			if (request !== null) void commit(request, fixed, wallId);
			services.stage.notifySurfaceChange();
			return true;
		}
		return false;
	}

	function setNumeric(next: PlanNumericEntryState | null) {
		if (gesture !== null) gesture.numeric = next;
	}
	function scalarDescriptors(adapterContext: StageAdapterContext) {
		return scalarSpecs(adapterContext)
			.filter((spec) => spec.field !== 'height' || adapterContext.evaluation.settledReading !== 'plan')
			.map(
				(spec): StageHandleDescriptor => ({
					id: spec.id,
					kind: 'ray',
					role: 'edit',
					disclosedBy: 'layout-wall-size-chip',
					anchor: spec.anchor,
					axis: spec.axis,
					extent: spec.value,
					draw:
						spec.stem !== undefined
							? { ray: 8, glyph: 'top-knob' }
							: {
									ray: spec.field === 'height' ? 22 : 9,
									twoWayHalf: 9
								},
					...(spec.stem === undefined ? {} : { stem: spec.stem }),
					bothWays: spec.field === 'thickness',
					screen:
						spec.field === 'height'
							? {
									axis: [0, -1],
									...(adapterContext.evaluation.settledReading === 'plan'
										? { offset: [0, -24] as const }
										: {})
								}
							: undefined,
					label: spec.field === 'height' ? 'Height' : 'Thickness',
					fact: spec.field,
					verb: spec.field,
					planner:
						spec.subject === 'opening'
							? LAYOUT_OPENING_MEASURE_KIND
							: spec.field === 'height'
								? LAYOUT_WALL_HEIGHT_KIND
								: LAYOUT_WALL_THICKNESS_KIND,
					value:
						scalarGesture?.spec.id === spec.id && scalarGesture.numeric
							? `${spec.field} ${scalarGesture.numeric.text}`
							: sizeDeltaLabel(
									scalarGesture?.spec.id === spec.id ? (scalarGesture.value ?? spec.value) : spec.value,
									spec.value
								),
					refusal: scalarGesture?.spec.id === spec.id ? scalarGesture.refusal : null
				})
			);
	}

	function scalarPreviews(y: number) {
		if (scalarGesture !== null) {
			const current = scalarGesture;
			if (
				current.candidate !== null &&
				current.value !== null &&
				current.spec.subject === 'wall' &&
				current.spec.field === 'height'
			)
				return [
					candidatePreviewOf({
						id: 'layout-scalar-candidate',
						role: 'subject',
						geometry: wallHeightGhostPaper(current.candidate, current.spec.subjectId, y, current.value)
					})
				];
			if (current.candidate !== null) {
				const ids = new Set([
					current.spec.subjectId,
					...(current.spec.subject === 'wall'
						? openingIdsOnWalls(current.candidate, new Set([current.spec.subjectId]))
						: [])
				]);
				const built = candidatePaper(current.candidate, y, ids, new Set());
				if (built)
					return [
						candidatePreviewOf({
							id: 'layout-scalar-candidate',
							role: 'subject',
							geometry: built.paper.subject
						})
					];
			}
			return [];
		}
		return null;
	}

	function refusedPreviews(y: number, refusal: string | null) {
		const { world } = previewCoordinates(y);
		const activeWall = gesture;
		// A refused sample still shows the full shape the hand asked for. It is
		// display-only evidence, separate from the validated candidate: release
		// remains unable to install it, and no history entry exists.
		if (
			activeWall !== null &&
			activeWall.request === null &&
			refusal !== null &&
			activeWall.pointerPoint !== null
		) {
			return [
				candidatePreviewOf({
					id: 'layout-candidate-wall-refused',
					role: 'refused',
					geometry:
						activeWall.attempt === null
							? { polygons: [], segments: [] }
							: wallProposalPaper(activeWall.attempt, y),
					labels: [{ world: world(activeWall.refusalPoint ?? activeWall.pointerPoint), text: refusal }]
				})
			];
		}
		return null;
	}

	function previews(y: number) {
		const { world, snapOf } = previewCoordinates(y);
		const activeWall = gesture;
		if (activeWall !== null && activeWall.proposal === null && activeWall.numeric !== null) {
			return [
				candidatePreviewOf({
					id: 'layout-candidate-wall-numeric',
					role: 'subject',
					geometry: { polygons: [], segments: [] },
					labels: [
						{
							world: world(activeWall.movingPoint),
							text: `${planNumericEntryField(activeWall.numeric).label} ${activeWall.numeric.text}`
						}
					]
				})
			];
		}
		if (activeWall?.proposal != null && activeWall.request !== null) {
			const wallId = activeWall.frame.wallId;
			const subject = wallProposalPaper(
				activeWall.proposal.filter((wall) => wall.wallId === wallId),
				y
			);
			const affected = wallProposalPaper(
				activeWall.proposal.filter((wall) => wall.wallId !== wallId),
				y
			);
			const text =
				activeWall.numeric !== null
					? `${planNumericEntryField(activeWall.numeric).label} ${activeWall.numeric.text}`
					: wallRequestLabel(activeWall.request, activeWall.fixed, { baseline: activeWall.frame });
			return [
				candidatePreviewOf({
					id: 'layout-candidate-wall',
					role: 'subject',
					geometry: subject,
					labels: [{ world: world(activeWall.movingPoint), text }],
					snap: snapOf(activeWall.snap)
				}),
				...(affected.segments.length === 0
					? []
					: [
							candidatePreviewOf({
								id: 'layout-candidate-neighbours',
								role: 'affected',
								geometry: affected
							})
						])
			];
		}
		if (activeWall !== null) return [];
		return null;
	}

	function overlay(adapterContext: StageAdapterContext, refusal: string | null) {
		const selected = selectedWall(adapterContext);
		// Marks are the shared manipulation language and are drawn by the Stage
		// overlay from `handles`; these contributions are only the gesture's own
		// preview/refusal/paused evidence.
		// An Opening's marks carry its live candidate and refusal themselves.
		if (selected === null) return [];
		const points = projectWallHandles(adapterContext, selected.frame);
		if (points === null) return [];
		const activeGesture = gesture;
		const previewEnd = activeGesture?.proposal
			?.find((wall) => wall.wallId === activeGesture.frame.wallId)
			?.points.at(-1);
		if (activeGesture !== null && previewEnd !== undefined && activeGesture.request !== null) {
			const css = adapterContext.project([
				previewEnd[0],
				adapterContext.snapshot.domain.datumMeters,
				previewEnd[1]
			]);
			return [
				...(css === null
					? []
					: [
							{
								id: 'layout-wall-preview',
								css,
								label: wallRequestLabel(activeGesture.request, activeGesture.fixed, {
									baseline: activeGesture.frame
								})
							}
						]),
				// Neighbours the canonical candidate reshaped: the junction this edit
				// moved is shown at each affected Wall's candidate endpoint.
				...activeGesture.neighbours.flatMap((neighbour) => {
					const marker = adapterContext.project([
						neighbour.point[0],
						adapterContext.snapshot.domain.datumMeters,
						neighbour.point[1]
					]);
					return marker === null
						? []
						: [
								{
									id: `layout-wall-neighbour-${neighbour.wallId}`,
									css: marker,
									label: `Neighbour ${neighbour.wallId} reshaped by this edit`
								}
							];
				})
			];
		}
		// The adapter-owned store is the one source: Discard (or any other
		// clear) removes the overlay marker too, rather than leaving a paused
		// value the panel no longer offers to apply.
		const paused =
			pausedProposal === null
				? null
				: pausedWallProposal(pausedProposal.sourceContentId, pausedProposal.wallId);
		return [
			...(paused === null
				? []
				: [
						{
							id: 'layout-wall-paused',
							css: points.middle,
							label: `Paused after a reading change — ${paused.label}. Resume or Discard in the selection Card, or Escape to cancel.`
						}
					]),
			...(refusal === null ? [] : [{ id: 'layout-wall-refusal', css: points.middle, label: refusal }])
		];
	}

	/**
	 * Commit one explicit manipulation parameter through the **same** captured
	 * intent the typed field builds. The operation id and revision are minted
	 * here, at release, so a proposal cannot install against the revision it
	 * started on if an acceptance landed in between.
	 */
	async function commit(
		request: WallManipulationRequest,
		fixed: FixedWallEndpoint,
		wallId: string,
		point: LayoutVec2 | null = null,
		attemptGeometry: CandidatePaperGeometry | null = null
	): Promise<void> {
		// T3.P03.S02: release commits exactly once; that commit is the command
		// whose completion the performance flow measures.
		perfMark('command:commit', { wallId });
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			wallManipulationIntent({
				request,
				wallId,
				fixed,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId
			})
		);
		const refusal = outcome.kind === 'refused' ? wallRefusalWords(outcome.code, outcome.message) : null;
		publishRefusal(refusal);
		if (
			point !== null &&
			refusal !== null &&
			gesture === null &&
			!junctionActive() &&
			stageUnitRevision(services.stage.snapshot(), 'layout') === stageUnitRevision(snapshot, 'layout')
		) {
			settleRefusal({
				subject: request.kind === 'junction' ? { kind: 'junction' } : { kind: 'wall', wallId },
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				point,
				text: refusal,
				...(attemptGeometry === null ? {} : { geometry: attemptGeometry })
			});
		}
		services.stage.notifySurfaceChange();
	}

	return {
		commit,
		get active() {
			return gesture !== null;
		},
		get evaluationId() {
			return gesture?.evaluationId;
		},
		get numeric() {
			return gesture?.numeric ?? null;
		},
		numericTarget,
		submitNumeric,
		setNumeric,
		begin,
		move,
		release,
		endGesture,
		scalarPointer,
		scalarKey,
		scalarDescriptors,
		scalarPreviews,
		preservePausedProposal,
		clearPaused,
		replacePaused,
		refusedPreviews,
		previews,
		overlay,
		get hasScalar() {
			return scalarGesture !== null;
		},
		markState: () =>
			gesture === null
				? null
				: {
						markId: gesture.markId,
						numeric: gesture.numeric,
						request: gesture.request,
						fixed: gesture.fixed,
						frame: gesture.frame,
						incidentWalls: gesture.neighbours.length + 1
					}
	};
}
