import { previewOpeningRepeat } from './opening-repeat';
import { openingRepeatProposal } from './opening-repeat-proposal';
import type { LayoutCandidatePresenter } from './candidate-presenter';
import {
	mintLayoutIdCapture,
	planUpdateWallFirstOpening,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	type StageAdapterContext,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { stageLayout, stageUnitRevision } from '$lib/authoring/stage/stage-adapter-host';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import { perfMark } from '$lib/platform/perf-marks';

import {
	openingResizeIntent,
	openingResizePatch,
	openingRefusalWords,
	type OpeningResizeCorner,
	type OpeningResizeEdge,
	type OpeningResizePayload
} from './opening-planners';
import { pointerDatumPoint } from './stage-pointer';
import type { SemanticReference } from '@portfolio/project-model';
import {
	planNumericEntrySubmit,
	planNumericFields,
	type PlanNumericEntryState,
	type PlanNumericField,
	type PlanNumericHost
} from '$lib/authoring/layout/plan-numeric-entry';
import {
	LAYOUT_OPENING_MEASURE_KIND,
	buildLayoutIntent,
	wallStationAtPoint,
	wallStationNearPoint,
	type WallFrame,
	type WallStationFrame
} from './precision';
import { resolveOpeningSlideSnap, resolveOpeningWidthSnap, type LayoutSnapWinner } from './snap';
import { candidatePreviewOf } from './candidate-preview';
import { selectedOpening, wallDirection, type OpeningMarkSubject } from './layout-subjects';
import {
	isPointerDrag,
	numericWords,
	previewCoordinates,
	type LayoutManipulationPorts,
	type NumericGestureTarget
} from './manipulation-support';
import { type LayoutSessionPorts } from './session-ports';

/** One claimed Opening mark: slide position or width, through the Opening planner. */
type OpeningMarkGesture = {
	pointerPoint: LayoutVec2 | null;
	pointerWorld: readonly [number, number, number] | null;
	readonly evaluationId: string;
	/** Stage-local CSS origin shared with the host's click tolerance. */
	readonly pressCss: readonly [number, number];
	readonly markId: string;
	readonly openingId: string;
	readonly wallId: string;
	readonly frame: WallFrame;
	readonly station: WallStationFrame;
	readonly length: number;
	readonly offsetAtStart: number;
	readonly widthAtStart: number;
	readonly heightAtStart: number;
	readonly sillAtStart: number;
	readonly action:
		| { readonly kind: 'slide' }
		| { readonly kind: 'edge'; readonly edge: OpeningResizeEdge }
		| { readonly kind: 'corner'; readonly corner: OpeningResizeCorner };
	/** Preserve the pointer's grab offset from the specific moving edge/corner. */
	readonly grabOffsetAlong: number;
	readonly grabOffsetY: number;
	readonly startPoint: readonly [number, number];
	readonly lease: GestureAcquisition | null;
	readonly numericHost: PlanNumericHost;
	readonly numericField: PlanNumericField;
	readonly baseline: LayoutDocumentWallFirst;
	/** The last candidate this gesture owns, or `null` after a refusal. */
	request:
		| { readonly kind: 'slide'; readonly value: number }
		| { readonly kind: 'resize'; readonly payload: OpeningResizePayload }
		| null;
	/** The snap the pointer named, when one won. */
	snap: LayoutSnapWinner | null;
	/** The canonical candidate document the preview compiles. */
	previewDocument: LayoutDocumentWallFirst | null;
	numeric: PlanNumericEntryState | null;
};

type OpeningGesturePorts = LayoutManipulationPorts &
	Pick<LayoutSessionPorts, 'candidatePaper' | 'openingFace'> & {
		readonly presenter: LayoutCandidatePresenter;
		readonly planCandidate: <T>(plan: () => T) => T;
	};

export function createOpeningGestureSession({
	services,
	document,
	levelId,
	contentRevision,
	publishRefusal,
	settleRefusal,
	candidatePaper,
	openingFace,
	presenter,
	planCandidate
}: OpeningGesturePorts) {
	let openingGesture: OpeningMarkGesture | null = null;
	/** The bounded Opening operation a cursor mark names, or `null`. */
	function openingMarkAction(markId: string): OpeningMarkGesture['action'] | null {
		if (markId === 'layout-opening-position') return { kind: 'slide' };
		if (markId === 'layout-opening-width-start') return { kind: 'edge', edge: 'left' };
		if (markId === 'layout-opening-width-end') return { kind: 'edge', edge: 'right' };
		if (markId === 'layout-opening-height-top') return { kind: 'edge', edge: 'top' };
		if (markId === 'layout-opening-sill-bottom') return { kind: 'edge', edge: 'bottom' };
		const corner = markId.startsWith('layout-opening-corner-')
			? markId.slice('layout-opening-corner-'.length)
			: '';
		return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(corner)
			? { kind: 'corner', corner: corner as OpeningResizeCorner }
			: null;
	}
	/** The canonical reference an Opening mark's intent addresses. */
	function openingReference(openingId: string): SemanticReference {
		const snapshot = services.stage.snapshot();
		return {
			version: 1,
			domain: 'layout',
			subject: { kind: 'opening', id: openingId },
			revision: { kind: 'exact', contentRevision: stageUnitRevision(snapshot, 'layout') },
			instancePath: [],
			location: {
				kind: 'layout-location',
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: []
			},
			componentId: null,
			capabilityId: null
		};
	}

	/**
	 * Commit one Opening measure through the same `layout-opening-measure`
	 * planner the Card field uses. One field per intent, no combined patch, and
	 * the planner owns every fit/overlap refusal.
	 */
	async function commitMarkOpening(request: {
		readonly openingId: string;
		readonly field: 'offset' | 'width';
		readonly value: number;
	}): Promise<void> {
		perfMark('command:commit', { openingId: request.openingId });
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			buildLayoutIntent({
				kind: LAYOUT_OPENING_MEASURE_KIND,
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId,
				targets: [openingReference(request.openingId)],
				payload: {
					openingId: request.openingId,
					field: request.field,
					value: request.value
				}
			})
		);
		publishRefusal(outcome.kind === 'refused' ? outcome.message : null);
		services.stage.notifySurfaceChange();
	}

	/** Commit one coupled edge/corner candidate as one F.4 history operation. */
	async function commitOpeningResize(payload: OpeningResizePayload): Promise<void> {
		perfMark('command:commit', { openingId: payload.openingId });
		const snapshot = services.stage.snapshot();
		const outcome = await services.authoring.accept(
			openingResizeIntent({
				payload,
				capture: mintLayoutIdCapture(),
				operationId: globalThis.crypto.randomUUID(),
				projectId: snapshot.acceptedRevision.projectId,
				revisionId: services.authoring.acceptedRevision().revisionId,
				contentRevision: stageUnitRevision(snapshot, 'layout'),
				levelId: snapshot.domain.layoutLevelId
			})
		);
		publishRefusal(outcome.kind === 'refused' ? outcome.message : null);
		services.stage.notifySurfaceChange();
	}

	/** Release the Opening gesture's own lease and drop its candidate. */
	function endOpeningGesture(): void {
		const current = openingGesture;
		openingGesture = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
	}
	/** The pointer's point on the same Wall face as the selected Opening marks. */
	function openingPointerWorldAt(
		adapterContext: StageAdapterContext,
		css: readonly [number, number],
		frame: WallFrame,
		station: WallStationFrame
	): readonly [number, number, number] | null {
		const datum = adapterContext.snapshot.domain.datumMeters;
		if (adapterContext.evaluation.settledReading === 'plan') {
			const point = pointerDatumPoint(adapterContext, css);
			return point === null ? null : [point[0], datum, point[1]];
		}
		const ray = adapterContext.ray([
			css[0] + adapterContext.evaluation.rect.left,
			css[1] + adapterContext.evaluation.rect.top
		]);
		if (ray === null) return null;
		if (station.curved) {
			// A curved host has no single face plane. Read the station nearest
			// the pointer, then intersect the tangent plane at that station so
			// a slide follows the curve rather than the chord.
			const datumPoint = pointerDatumPoint(adapterContext, css);
			const distance =
				datumPoint === null ? null : wallStationNearPoint(document, frame.wallId, datumPoint, 2);
			const local = distance === null ? null : station.pointAt(distance);
			if (local !== null) {
				const tangent = local.tangent;
				const tangentNormal: readonly [number, number] = [-tangent[1], tangent[0]];
				const wall = document.walls.find((candidate) => candidate.id === frame.wallId);
				const side =
					Math.sign(
						(adapterContext.evaluation.eye[0] - local.point[0]) * tangentNormal[0] +
							(adapterContext.evaluation.eye[2] - local.point[1]) * tangentNormal[1]
					) || 1;
				const faceOffset = (side * (wall?.thickness ?? 0)) / 2;
				const hit = adapterContext.intersect(ray, {
					originMeters: [
						local.point[0] + tangentNormal[0] * faceOffset,
						datum,
						local.point[1] + tangentNormal[1] * faceOffset
					],
					normal: [tangentNormal[0], 0, tangentNormal[1]],
					yawRadians: Math.atan2(tangent[0], tangent[1]),
					datumMeters: datum,
					supportedLocalExtent: null
				});
				return hit.kind === 'intersected' ? hit.worldPoint : null;
			}
		}
		const direction = wallDirection(frame);
		if (direction === null) return null;
		const normal: readonly [number, number] = [-direction[1], direction[0]];
		const wall = document.walls.find((candidate) => candidate.id === frame.wallId);
		const side =
			Math.sign(
				(adapterContext.evaluation.eye[0] - (frame.start[0] + frame.end[0]) / 2) * normal[0] +
					(adapterContext.evaluation.eye[2] - (frame.start[1] + frame.end[1]) / 2) * normal[1]
			) || 1;
		const faceOffset = (side * (wall?.thickness ?? 0)) / 2;
		const hit = adapterContext.intersect(ray, {
			originMeters: [
				frame.start[0] + normal[0] * faceOffset,
				datum,
				frame.start[1] + normal[1] * faceOffset
			],
			normal: [normal[0], 0, normal[1]],
			yawRadians: Math.atan2(direction[0], direction[1]),
			datumMeters: datum,
			supportedLocalExtent: null
		});
		return hit.kind === 'intersected' ? hit.worldPoint : null;
	}
	function begin(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		selectedOpeningSubject: OpeningMarkSubject,
		markId: string
	) {
		const openingWorldAtPress = openingPointerWorldAt(
			adapterContext,
			intent.css,
			selectedOpeningSubject.frame,
			selectedOpeningSubject.station
		);
		if (openingWorldAtPress === null) return false;
		const point: LayoutVec2 = [openingWorldAtPress[0], openingWorldAtPress[2]];
		const acquisition = services.stage.acquireGesture({
			owner: 'layout-precision',
			evaluationId: intent.evaluationId,
			policy: 'cancel-on-reading-change'
		});
		if (acquisition.kind !== 'granted') {
			publishRefusal(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
			return false;
		}
		const action = openingMarkAction(markId);
		if (action === null) {
			acquisition.kind === 'granted' && acquisition.lease.release();
			return false;
		}
		const source = document.openings.find(
			(candidate) => candidate.id === selectedOpeningSubject.openingId
		);
		if (source === undefined) {
			acquisition.lease.release();
			return false;
		}
		const numericHost: PlanNumericHost = action.kind === 'slide' ? 'opening-slide' : 'opening-resize';
		const direction = wallDirection(selectedOpeningSubject.frame);
		if (direction === null) {
			acquisition.lease.release();
			return false;
		}
		const alongAtPress = selectedOpeningSubject.station.curved
			? (wallStationAtPoint(document, selectedOpeningSubject.wallId, point) ?? 0)
			: (point[0] - selectedOpeningSubject.frame.start[0]) * direction[0] +
				(point[1] - selectedOpeningSubject.frame.start[1]) * direction[1];
		const targetAlong =
			action.kind === 'slide'
				? source.offset + source.width / 2
				: action.kind === 'edge'
					? action.edge === 'left'
						? source.offset
						: action.edge === 'right'
							? source.offset + source.width
							: source.offset + source.width / 2
					: action.corner.endsWith('left')
						? source.offset
						: source.offset + source.width;
		const targetY =
			action.kind === 'slide'
				? source.sillHeight + source.height / 2
				: action.kind === 'edge'
					? action.edge === 'top'
						? source.sillHeight + source.height
						: action.edge === 'bottom'
							? source.sillHeight
							: source.sillHeight + source.height / 2
					: action.corner.startsWith('bottom')
						? source.sillHeight
						: source.sillHeight + source.height;
		const pointerY = openingWorldAtPress[1] - adapterContext.snapshot.domain.datumMeters;
		openingGesture = {
			evaluationId: intent.evaluationId,
			pressCss: intent.css,
			markId,
			openingId: selectedOpeningSubject.openingId,
			wallId: selectedOpeningSubject.wallId,
			frame: selectedOpeningSubject.frame,
			station: selectedOpeningSubject.station,
			length: selectedOpeningSubject.length,
			offsetAtStart: selectedOpeningSubject.offset,
			widthAtStart: selectedOpeningSubject.width,
			heightAtStart: source.height,
			sillAtStart: source.sillHeight,
			action,
			grabOffsetAlong: alongAtPress - targetAlong,
			grabOffsetY: pointerY - targetY,
			startPoint: point,
			pointerPoint: [point[0], point[1]],
			pointerWorld: openingWorldAtPress,
			lease: acquisition,
			numericHost,
			numericField: planNumericFields(numericHost)[0]!,
			baseline: stageLayout(adapterContext.snapshot),
			request: null,
			snap: null,
			previewDocument: null,
			numeric: null
		};
		services.stage.notifySurfaceChange();
		return true;
	}

	function move(intent: StagePointerIntent, adapterContext: StageAdapterContext) {
		if (openingGesture === null) return false;
		if (!isPointerDrag(openingGesture.pressCss, intent.css)) {
			openingGesture.request = null;
			openingGesture.previewDocument = null;
			openingGesture.snap = null;
			publishRefusal(null);
			services.stage.notifySurfaceChange();
			return true;
		}
		const openingWorldPoint = openingPointerWorldAt(
			adapterContext,
			intent.css,
			openingGesture.frame,
			openingGesture.station
		);
		if (openingWorldPoint === null) {
			openingGesture.request = null;
			openingGesture.previewDocument = null;
			openingGesture.snap = null;
			services.stage.notifySurfaceChange();
			return true;
		}
		const point: LayoutVec2 = [openingWorldPoint[0], openingWorldPoint[2]];
		const direction = wallDirection(openingGesture.frame);
		const source = openingGesture.baseline.openings.find(
			(entry) => entry.id === openingGesture!.openingId
		);
		if (direction === null || source === undefined) return true;
		const along = openingGesture.station.curved
			? (wallStationAtPoint(document, openingGesture.wallId, point) ?? 0)
			: (point[0] - openingGesture.frame.start[0]) * direction[0] +
				(point[1] - openingGesture.frame.start[1]) * direction[1];
		const yMeters = openingWorldPoint[1] - adapterContext.snapshot.domain.datumMeters;
		const hostSpan = {
			segmentId: openingGesture.wallId,
			start: openingGesture.frame.start,
			end: openingGesture.frame.end
		};
		const pixelsPerMeter = 1 / adapterContext.evaluation.targetPlaneMetersPerCssPixel;
		const drafting = adapterContext.drafting();
		let request: OpeningMarkGesture['request'];
		let patch: Parameters<typeof planUpdateWallFirstOpening>[2];
		let winner: LayoutSnapWinner | null = null;
		if (openingGesture.action.kind === 'slide') {
			const snapped = resolveOpeningSlideSnap({
				geometry: adapterContext.snapshot.domain.geometry,
				hostSpan,
				openingId: openingGesture.openingId,
				pointerCenterOffset: along - openingGesture.grabOffsetAlong,
				width: openingGesture.widthAtStart,
				pixelsPerMeter,
				drafting
			});
			request = { kind: 'slide', value: snapped.offset };
			patch = { offset: snapped.offset };
			winner = snapped.winner;
		} else if (openingGesture.action.kind === 'edge') {
			let value: number;
			if (openingGesture.action.edge === 'left' || openingGesture.action.edge === 'right') {
				const rawEdge = along - openingGesture.grabOffsetAlong;
				const snapped = resolveOpeningWidthSnap({
					geometry: adapterContext.snapshot.domain.geometry,
					hostSpan,
					openingId: openingGesture.openingId,
					pointerEdgeOffset: rawEdge,
					pixelsPerMeter,
					drafting
				});
				value = snapped.edgeOffset;
				winner = snapped.winner;
			} else {
				value = yMeters - openingGesture.grabOffsetY;
			}
			const payload: OpeningResizePayload = {
				openingId: openingGesture.openingId,
				kind: 'edge',
				edge: openingGesture.action.edge,
				value
			};
			request = { kind: 'resize', payload };
			patch = openingResizePatch(source, payload);
		} else {
			const corner = openingGesture.action.corner;
			const left = corner.endsWith('left');
			const bottom = corner.startsWith('bottom');
			const fixedAlong = left
				? openingGesture.offsetAtStart + openingGesture.widthAtStart
				: openingGesture.offsetAtStart;
			const fixedY = bottom
				? openingGesture.sillAtStart + openingGesture.heightAtStart
				: openingGesture.sillAtStart;
			const desiredAlong = along - openingGesture.grabOffsetAlong;
			const desiredY = yMeters - openingGesture.grabOffsetY;
			const baseX = (left ? -1 : 1) * openingGesture.widthAtStart;
			const baseY = (bottom ? -1 : 1) * openingGesture.heightAtStart;
			const factor =
				((desiredAlong - fixedAlong) * baseX + (desiredY - fixedY) * baseY) /
				(openingGesture.widthAtStart ** 2 + openingGesture.heightAtStart ** 2);
			const payload: OpeningResizePayload = {
				openingId: openingGesture.openingId,
				kind: 'corner',
				corner,
				factor
			};
			request = { kind: 'resize', payload };
			patch = openingResizePatch(source, payload);
		}
		openingGesture.snap = winner;
		openingGesture.pointerPoint = [point[0], point[1]];
		openingGesture.pointerWorld = openingWorldPoint;
		const planned = planUpdateWallFirstOpening(openingGesture.baseline, openingGesture.openingId, patch);
		if (planned.kind === 'rejected') {
			openingGesture.request = null;
			openingGesture.previewDocument = null;
			publishRefusal(
				openingRefusalWords(openingGesture.baseline, planned.rejection, {
					openingId: source.id,
					wallId: source.wallId,
					kind: source.kind,
					offset: source.offset,
					width: source.width,
					height: source.height,
					sillHeight: source.sillHeight,
					...patch
				})
			);
		} else {
			openingGesture.request = request;
			openingGesture.previewDocument = planned.document;
			publishRefusal(null);
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	function release(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		refusal: string | null
	) {
		if (openingGesture === null) return false;
		const draggedOpening =
			openingGesture.numeric === null && isPointerDrag(openingGesture.pressCss, intent.css);
		const pendingOpening = draggedOpening ? openingGesture.request : null;
		const openingId = openingGesture.openingId;
		if (
			draggedOpening &&
			pendingOpening === null &&
			refusal !== null &&
			openingGesture.pointerPoint !== null
		) {
			settleRefusal({
				subject: { kind: 'opening', openingId },
				contentRevision: adapterContext.snapshot.domain.unitRevisions.layout,
				point: openingGesture.pointerPoint,
				text: refusal
			});
		}
		endOpeningGesture();
		if (pendingOpening?.kind === 'slide') {
			void commitMarkOpening({ openingId, field: 'offset', value: pendingOpening.value });
		} else if (pendingOpening?.kind === 'resize') {
			void commitOpeningResize(pendingOpening.payload);
		}
		services.stage.notifySurfaceChange();
		return true;
	}

	function numericTarget(): NumericGestureTarget | null {
		const opening = openingGesture;
		if (opening === null || opening.action.kind !== 'slide') return null;
		return {
			host: opening.numericHost,
			field: opening.numericField,
			ownerId: opening.openingId,
			candidates: { offset: opening.offsetAtStart, width: opening.widthAtStart }
		};
	}

	function submitNumeric() {
		const opening = openingGesture;
		if (opening === null || opening.numeric === null) return false;
		const outcome = planNumericEntrySubmit(opening.numeric);
		if (outcome.kind === 'refuse') {
			opening.numeric = outcome.state;
			publishRefusal(numericWords(outcome.reason));
			services.stage.notifySurfaceChange();
			return true;
		}
		if (outcome.kind === 'ignored') return true;
		opening.numeric = null;
		const field = opening.numericField.id === 'width' ? 'width' : 'offset';
		const value = field === 'width' ? outcome.values.width : outcome.values.offset;
		const openingId = opening.openingId;
		endOpeningGesture();
		if (value !== undefined) void commitMarkOpening({ openingId, field, value });
		services.stage.notifySurfaceChange();
		return true;
	}

	function setNumeric(next: PlanNumericEntryState | null) {
		if (openingGesture !== null) openingGesture.numeric = next;
	}
	function previews(adapterContext: StageAdapterContext, y: number, refusal: string | null) {
		const { world, snapOf } = previewCoordinates(y);
		const activeOpeningMark = openingGesture;
		if (activeOpeningMark !== null && activeOpeningMark.previewDocument !== null) {
			const subjectIds = new Set([activeOpeningMark.openingId, activeOpeningMark.wallId]);
			const geometry =
				adapterContext.evaluation.settledReading === 'plan'
					? (candidatePaper(activeOpeningMark.previewDocument, y, subjectIds, new Set())?.paper
							.subject ?? null)
					: openingFace(activeOpeningMark.previewDocument, new Set([activeOpeningMark.openingId]), y);
			if (geometry !== null) {
				return [
					candidatePreviewOf({
						id: 'layout-candidate-opening-mark',
						role: 'subject',
						geometry,
						snap: snapOf(activeOpeningMark.snap)
					})
				];
			}
			return [];
		}
		if (activeOpeningMark !== null) {
			if (refusal === null || activeOpeningMark.pointerPoint === null) return [];
			return [
				candidatePreviewOf({
					id: 'layout-candidate-opening-mark-refused',
					role: 'refused',
					geometry: {
						polygons: [],
						segments: [[world(activeOpeningMark.startPoint), world(activeOpeningMark.pointerPoint)]]
					},
					labels: [{ world: world(activeOpeningMark.pointerPoint), text: refusal }]
				})
			];
		}
		return null;
	}

	function repeatPreviews(
		adapterContext: StageAdapterContext,
		y: number
	): readonly StageCandidatePreview[] | null {
		// T1 A8 — the Card's live Repeat proposal. Every copy comes from the
		// planner's own candidate document, filtered to the Openings it created,
		// so the Stage can never show a copy acceptance would refuse. The Card
		// owns the typed count/spacing; this is a read of the same proposal.
		const activeRepeat = openingRepeatProposal(
			adapterContext.snapshot.sourceContentId,
			selectedOpening(document, adapterContext)?.openingId ?? ''
		);
		if (activeRepeat !== null) {
			// One proposal per distinct (accepted, Opening, count, spacing); its
			// minted preview ids stay pinned while the memo holds it.
			const preview = presenter.proposal(
				['opening-repeat', document, activeRepeat.openingId, activeRepeat.count, activeRepeat.spacing],
				// The proposal's own validation compile runs through this project's
				// session, as the Repeat planner's commit does.
				() =>
					planCandidate(() =>
						previewOpeningRepeat({
							document,
							openingId: activeRepeat.openingId,
							count: activeRepeat.count,
							spacing: activeRepeat.spacing
						})
					)
			);
			if (preview.kind === 'planned') {
				const createdIds = new Set(preview.createdOpeningIds);
				const geometry =
					adapterContext.evaluation.settledReading === 'plan'
						? (candidatePaper(preview.document, y, createdIds, new Set())?.paper.subject ?? null)
						: openingFace(preview.document, createdIds, y);
				if (geometry !== null) {
					return [
						candidatePreviewOf({
							id: 'layout-candidate-opening-repeat',
							role: 'subject',
							geometry
						})
					];
				}
			}
		}

		return null;
	}

	return {
		repeatPreviews,
		get active() {
			return openingGesture !== null;
		},
		get evaluationId() {
			return openingGesture?.evaluationId;
		},
		get numeric() {
			return openingGesture?.numeric ?? null;
		},
		numericTarget,
		submitNumeric,
		setNumeric,
		begin,
		move,
		release,
		endOpeningGesture,
		previews,
		markState: () =>
			openingGesture === null
				? null
				: {
						openingId: openingGesture.openingId,
						markId: openingGesture.markId,
						numeric: openingGesture.numeric,
						numericField: openingGesture.numericField,
						previewDocument: openingGesture.previewDocument
					}
	};
}
