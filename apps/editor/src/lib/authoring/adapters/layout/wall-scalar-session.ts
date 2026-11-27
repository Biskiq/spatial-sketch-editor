import {
	planExactWallHeight,
	planExactWallThickness,
	planSetWallTop,
	planUpdateWallFirstOpening,
	wallFirstWallLength,
	type LayoutDocumentWallFirst,
	type LayoutWallTop,
} from '@portfolio/layout-core/wall';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import {
	axisTravelFromRay,
	draftingSnapIncrementMeters,
	sizeDeltaLabel,
	stageUnitRevision,
	type GestureAcquisition,
	type StageAdapterContext,
	type StageHandleDescriptor,
	type StageKeyboardIntent,
	type StagePointerIntent,
} from '$lib/authoring/stage/stage-adapter-host';
import {
	planNumericEntryInput,
	planNumericEntryOpen,
	planNumericEntrySubmit,
	type PlanNumericEntryState,
} from '$lib/authoring/layout/plan-numeric-entry';
import { candidatePreviewOf, openingIdsOnWalls, wallHeightGhostPaper } from './candidate-preview';
import {
	selectedClosedWall,
	selectedCurvedWall,
	selectedWall,
	wallDirection,
} from './layout-subjects';
import { isPointerDrag, type LayoutManipulationPorts } from './manipulation-support';
import { openingRefusalWords } from './opening-planners';
import {
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_WALL_HEIGHT_KIND,
	LAYOUT_WALL_THICKNESS_KIND,
	LAYOUT_WALL_TOP_KIND,
	buildLayoutIntent,
} from './precision';
import { curvedWallPointAt } from './precision-frames';
import { wallEditRejectionWords } from './refusals';
import type { LayoutSessionPorts } from './session-ports';
import { wallTopForKnobDrag, type WallTopKnob } from './wall-top-edits';
import { wallHeightKnobSpot, wallTopBreakpointSpots } from './wall-top-frame';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';

/** One captured Wall measure edit, shared by the grip and its numeric entry. */
export function createWallScalarSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
	candidatePaper,
}: LayoutManipulationPorts & Pick<LayoutSessionPorts, 'candidatePaper'>) {
	type ScalarGesture = {
		spec: {
			id: string;
			subject: 'wall' | 'opening';
			subjectId: string;
			field: 'height' | 'thickness' | 'top';
			/** Which top breakpoint a `top` knob drags. */
			topKnob?: WallTopKnob;
			/** The Wall's span, captured with the spec for the top's normalization. */
			length: number;
			value: number;
			anchor: [number, number, number];
			axis: [number, number, number];
			/** A top knob's stem foot (review pass 2 §6); absent for plain rays. */
			stem?: [number, number, number];
			/** A legibility-only screen shift; the world anchor stays canonical. */
			screenOffset?: readonly [number, number];
		};
		evaluationId: string;
		revision: string;
		pressCss: readonly [number, number];
		startTravel: number;
		metersPerCssPixel: number;
		lease: Extract<GestureAcquisition, { kind: 'granted' }>;
		value: number | null;
		candidate: LayoutDocumentWallFirst | null;
		/** The exact eave + top a `top` knob drag previews and commits. */
		top: { readonly height: number; readonly top: LayoutWallTop } | null;
		numeric: PlanNumericEntryState | null;
		refusal: string | null;
	};
	let scalarGesture: ScalarGesture | null = null;
	function endScalar(): void {
		const current = scalarGesture;
		scalarGesture = null;
		if (current?.lease.lease.active) current.lease.lease.release();
	}
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
				(closed.seam[0] - closed.center[0]) / radius,
			],
		};
	}
	function scalarSpecs(ctx: StageAdapterContext): ScalarGesture['spec'][] {
		const target = selectedScalarTarget(ctx);
		if (target === null) return [];
		const source = document.walls.find((wall) => wall.id === target.wallId);
		if (source === undefined) return [];
		const compiled = ctx.snapshot.domain.geometry.walls.find((wall) => wall.wallId === source.id);
		if (compiled === undefined) return [];
		const length = wallFirstWallLength(document, source.id);
		if (length === undefined) return [];
		const y = ctx.snapshot.domain.datumMeters;
		const planReading = ctx.evaluation.settledReading === 'plan';
		const normal: LayoutVec2 = [-target.tangent[1], target.tangent[0]];
		const unfoldState = wallUnfold.isActive(source.id) ? wallUnfold.state : null;
		const frame = {
			wall: compiled,
			layout: document,
			datumMeters: y,
			eye: ctx.evaluation.eye,
			unfold:
				unfoldState === null
					? null
					: { state: unfoldState, sideAngle: wallUnfold.presentationAngle },
		};
		const specs: ScalarGesture['spec'][] = [];
		// Height (the eave) stays reachable in both readings; while unrolled it sits
		// on the sheet top edge instead of the hidden Wall face, so it needs no size
		// chip disclosure.
		const heightSpot = wallHeightKnobSpot({ ...frame, top: source.top, height: source.height });
		if (heightSpot !== null) {
			specs.push({
				id: 'layout-wall-height',
				subject: 'wall',
				subjectId: source.id,
				field: 'height',
				length,
				value: source.height,
				anchor: [heightSpot.anchor[0], heightSpot.anchor[1], heightSpot.anchor[2]],
				stem: [heightSpot.stem[0], heightSpot.stem[1], heightSpot.stem[2]],
				axis: [0, 1, 0],
			});
		}
		// The shape knobs: one at each end and (for a gable) one at the apex, on
		// the same development map the Wall and the sheet draw.
		for (const spot of wallTopBreakpointSpots({
			...frame,
			top: source.top,
			height: source.height,
		})) {
			specs.push({
				id: `layout-wall-top-${spot.knob}`,
				subject: 'wall',
				subjectId: source.id,
				field: 'top',
				topKnob: spot.knob as WallTopKnob,
				length,
				value: spot.topLocal,
				anchor: [spot.anchor[0], spot.anchor[1], spot.anchor[2]],
				stem: [spot.stem[0], spot.stem[1], spot.stem[2]],
				axis: [0, 1, 0],
			});
		}
		// A profiled Wall's eave is also its start or end breakpoint, so the Height
		// grip and that top knob would otherwise share one point and hide each
		// other. Shift only the Height glyph in screen space: its world station and
		// value stay canonical, and both grips keep their own hit target.
		const heightSpec = specs.find((spec) => spec.field === 'height');
		if (
			heightSpec !== undefined &&
			specs.some(
				(spec) =>
					spec.field === 'top' &&
					Math.hypot(
						spec.anchor[0] - heightSpec.anchor[0],
						spec.anchor[1] - heightSpec.anchor[1],
						spec.anchor[2] - heightSpec.anchor[2],
					) < 1e-6,
			)
		) {
			heightSpec.screenOffset = [-30, 0];
		}
		// Thickness has no sheet reading: a developed strip has one authored
		// thickness, so the grip would be an invisible control on the canonical body.
		if (unfoldState === null) {
			specs.push({
				id: 'layout-wall-thickness',
				subject: 'wall',
				subjectId: source.id,
				field: 'thickness',
				length,
				value: source.thickness,
				anchor: [target.cap[0], planReading ? y : y + source.height, target.cap[1]],
				axis: [normal[0], 0, normal[1]],
			});
		}
		return specs;
	}
	function scalarTravel(
		ctx: StageAdapterContext,
		spec: ScalarGesture['spec'],
		css: readonly [number, number],
	): number | null {
		if (
			(spec.field === 'height' || spec.field === 'top') &&
			ctx.evaluation.settledReading === 'plan'
		)
			return -css[1] * ctx.evaluation.targetPlaneMetersPerCssPixel;
		const ray = ctx.ray([css[0] + ctx.evaluation.rect.left, css[1] + ctx.evaluation.rect.top]);
		return ray === null
			? null
			: axisTravelFromRay({
					origin: spec.anchor,
					direction: spec.axis,
					rayOrigin: ray.origin,
					rayDirection: ray.direction,
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
								width: opening.width,
							}
						: {}),
					height: value,
				});
				return false;
			}
			current.value = value;
			current.candidate = plan.document;
			current.refusal = null;
			return true;
		}
		if (current.spec.field === 'top') {
			const wall = document.walls.find((candidate) => candidate.id === current.spec.subjectId);
			if (wall === undefined || current.spec.topKnob === undefined) return false;
			const dragged = wallTopForKnobDrag({
				current: wall.top,
				height: wall.height,
				knob: current.spec.topKnob,
				topLocal: value,
				length: current.spec.length,
			});
			const plan = planSetWallTop(document, current.spec.subjectId, dragged.top, dragged.height);
			if (plan.kind === 'rejected') {
				current.value = null;
				current.candidate = null;
				current.top = null;
				current.refusal = wallEditRejectionWords(document, plan.rejection);
				return false;
			}
			current.value = value;
			current.candidate = plan.document;
			current.top = dragged;
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
			current.refusal = wallEditRejectionWords(document, plan.rejection);
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
		if (field === 'top' && current.top === null) return;
		const outcome = await services.authoring.accept(
			buildLayoutIntent({
				kind:
					subject === 'opening'
						? LAYOUT_OPENING_MEASURE_KIND
						: field === 'height'
							? LAYOUT_WALL_HEIGHT_KIND
							: field === 'top'
								? LAYOUT_WALL_TOP_KIND
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
							structureInstancePath: [],
						},
						componentId: null,
						capabilityId: null,
					},
				],
				payload:
					subject === 'opening'
						? { openingId: id, field: 'height', value }
						: field === 'top'
							? { wallId: id, height: current.top!.height, top: current.top!.top }
							: { wallId: id, [field]: value },
			}),
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
				policy: 'cancel-on-reading-change',
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
				top: null,
				numeric: null,
				refusal: null,
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
				if (current.spec.field === 'height' || current.spec.field === 'top') {
					const sill =
						current.spec.subject === 'opening'
							? (document.openings.find((o) => o.id === current.spec.subjectId)?.sillHeight ?? 0)
							: 0;
					const candidates = [
						services.stage.heightSheet().height(),
						...services.stage.heightSheet().pins(),
						...services.stage.heightTicks().map((tick) => tick.heightMeters),
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
					text: current.refusal,
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
				const numericField = current.spec.field === 'top' ? 'height' : current.spec.field;
				const opened = planNumericEntryOpen(
					{ host: numericField, fieldId: numericField, ownerId: current.spec.subjectId },
					{ [numericField]: current.value ?? current.spec.value },
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
				const numericField = current.spec.field === 'top' ? 'height' : current.spec.field;
				const value = result.values[numericField];
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

	function scalarDescriptors(adapterContext: StageAdapterContext) {
		return scalarSpecs(adapterContext)
			.filter(
				(spec) =>
					adapterContext.evaluation.settledReading !== 'plan' ||
					(spec.field !== 'height' && spec.field !== 'top'),
			)
			.map((spec): StageHandleDescriptor => {
				const unfolded = wallUnfold.isActive(spec.subjectId);
				return {
					id: spec.id,
					kind: 'ray',
					role: 'edit',
					...(spec.field === 'top' || (spec.field === 'height' && unfolded)
						? {}
						: { disclosedBy: 'layout-wall-size-chip' }),
					anchor: spec.anchor,
					axis: spec.axis,
					extent: spec.value,
					draw:
						spec.stem !== undefined
							? { ray: 8, glyph: 'top-knob' }
							: {
									ray: spec.field === 'height' ? 22 : 9,
									twoWayHalf: 9,
								},
					...(spec.stem === undefined ? {} : { stem: spec.stem }),
					bothWays: spec.field === 'thickness',
					screen:
						spec.field === 'height' || spec.field === 'top'
							? {
									axis: [0, -1],
									...(adapterContext.evaluation.settledReading === 'plan' && spec.field === 'height'
										? { offset: [0, -24] as const }
										: spec.screenOffset !== undefined
											? { offset: spec.screenOffset }
											: {}),
								}
							: undefined,
					label:
						spec.field === 'height'
							? 'Height'
							: spec.field === 'top'
								? spec.topKnob === 'apex'
									? 'Apex top'
									: spec.topKnob === 'start'
										? 'Top at start'
										: 'Top at end'
								: 'Thickness',
					fact: spec.field,
					verb: spec.field === 'top' ? 'Top' : spec.field,
					planner:
						spec.subject === 'opening'
							? LAYOUT_OPENING_MEASURE_KIND
							: spec.field === 'height'
								? LAYOUT_WALL_HEIGHT_KIND
								: spec.field === 'top'
									? LAYOUT_WALL_TOP_KIND
									: LAYOUT_WALL_THICKNESS_KIND,
					value:
						scalarGesture?.spec.id === spec.id && scalarGesture.numeric
							? `${spec.field === 'top' ? 'Top' : spec.field} ${scalarGesture.numeric.text}`
							: sizeDeltaLabel(
									scalarGesture?.spec.id === spec.id
										? (scalarGesture.value ?? spec.value)
										: spec.value,
									spec.value,
								),
					refusal: scalarGesture?.spec.id === spec.id ? scalarGesture.refusal : null,
				};
			});
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
						geometry: wallHeightGhostPaper(
							current.candidate,
							current.spec.subjectId,
							y,
							current.value,
						),
					}),
				];
			if (current.candidate !== null) {
				const ids = new Set([
					current.spec.subjectId,
					...(current.spec.subject === 'wall'
						? openingIdsOnWalls(current.candidate, new Set([current.spec.subjectId]))
						: []),
				]);
				const built = candidatePaper(current.candidate, y, ids, new Set());
				if (built)
					return [
						candidatePreviewOf({
							id: 'layout-scalar-candidate',
							role: 'subject',
							geometry: built.paper.subject,
						}),
					];
			}
			return [];
		}
		return null;
	}

	return {
		end: endScalar,
		pointer: scalarPointer,
		key: scalarKey,
		descriptors: scalarDescriptors,
		previews: scalarPreviews,
		get active() {
			return scalarGesture !== null;
		},
	};
}
