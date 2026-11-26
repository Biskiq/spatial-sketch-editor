import type { StageInputArbiterInput } from './stage-input.svelte';
import { stageResizeCursorCss } from '../stage-glyphs';
import {
	layoutSelectionReference,
	primaryEntry,
	sameReference,
	type StageSelectionEntry,
} from '../semantic-selection';
import { planSourceKindOf } from './plan-source-kind';

export type StageHoverPorts = {
	readonly input: StageInputArbiterInput;
	readonly dragging: () => boolean;
	readonly hostDragging: () => boolean;
};

export function createStageHover(ports: StageHoverPorts) {
	const input = ports.input;
	let hoverSelection = $state<StageSelectionEntry | null>(null);
	let hoverMove = $state(false);
	let stageCursor = $state<string | null>(null);

	let hoverFrame: number | null = null;
	let hoverSample: { css: [number, number]; shift: boolean; coarse: boolean } | null = null;

	function clearHover(clearAdapterHover = true): void {
		if (clearAdapterHover && input.adapterTapOnly?.()) {
			const stage = input.facade();
			const evaluationId = stage?.evaluationId();
			if (evaluationId != null) stage?.hoverIntent({ phase: 'cancel', css: [0, 0], evaluationId });
		}
		if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
		hoverFrame = null;
		hoverSample = null;
		input.unfold.setPinHovered(false);
		input.facade()?.setMarkHover(null);
		stageCursor = null;
		input.session.setHover(null);
		hoverSelection = null;
		hoverMove = false;
		if (!ports.hostDragging()) {
			input.measureTool()?.hover(null);
			input.eraserTool()?.hover(null);
			input.paintTool()?.hover(null);
			input.setEraseHover(null);
			input.setPaintHover(null);
		}
	}

	function resolveHover(): void {
		hoverFrame = null;
		const sample = hoverSample;
		hoverSample = null;
		const stage = input.facade();
		const id = stage?.evaluationId() ?? null;
		if (
			sample === null ||
			stage === null ||
			id === null ||
			input.session.gesture() !== null ||
			ports.dragging()
		)
			return;
		stageCursor = null;
		// An armed host tool previews its own winner (the Eraser's dashes, Measure's
		// second point); the ordinary subject hover would compete with it.
		const armedHostTool = input.armedHostTool();
		if (armedHostTool !== null) {
			stage.idleHoverIntent({
				phase: 'cancel',
				css: sample.css,
				evaluationId: id,
				coarse: sample.coarse,
				shift: sample.shift,
			});
			const toolInput = { css: sample.css, evaluationId: id, coarse: sample.coarse };
			if (armedHostTool === 'measure') input.measureTool()?.hover(toolInput);
			else if (armedHostTool === 'erase') input.eraserTool()?.hover(toolInput);
			else input.paintTool()?.hover({ ...toolInput, shift: sample.shift });
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			input.onRefreshHostTools();
			return;
		}
		// The pin is the sheet's one display handle. It sits above the sheet pick
		// so a tap can select its Opening and a drag can move the anchor without
		// selecting the Wall body underneath.
		if (input.unfold.pinAt(sample.css, sample.coarse, stage) !== null) {
			stage.idleHoverIntent({
				phase: 'cancel',
				css: sample.css,
				evaluationId: id,
				coarse: sample.coarse,
				shift: sample.shift,
			});
			stage.setMarkHover(null);
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			input.unfold.setPinHovered(true);
			stageCursor = 'grab';
			return;
		}
		input.unfold.setPinHovered(false);
		// The mark tier is above world candidates: a hovered grip suppresses the
		// subject tint underneath, so two emphases never compete for one pointer.
		const mark = stage.hitMark({ css: sample.css, coarse: sample.coarse });
		if (mark !== null) {
			stage.idleHoverIntent({
				phase: 'cancel',
				css: sample.css,
				evaluationId: id,
				coarse: sample.coarse,
				shift: sample.shift,
			});
			stage.setMarkHover({ adapterId: mark.adapterId, id: mark.id });
			stageCursor =
				mark.mark.resizeCursor === undefined
					? null
					: stageResizeCursorCss(mark.mark.resizeCursor, mark.mark.direction);
			input.session.setHover(null);
			hoverSelection = null;
			// A selected Wall's own grips are draggable; every other
			// mark (an Opening's track, a disclosure) is not a body move.
			const primary = primaryEntry(stage.selectionState());
			hoverMove =
				primary !== null &&
				primary.reference.domain === 'layout' &&
				primary.reference.subject.kind === 'wall' &&
				mark.adapterId === 'layout' &&
				mark.id.startsWith('layout-wall-') &&
				mark.id !== 'layout-wall-preview';
			return;
		}
		stage.setMarkHover(null);
		stageCursor = null;
		const idleMark = stage.idleHoverIntent({
			phase: 'move',
			css: sample.css,
			evaluationId: id,
			coarse: sample.coarse,
			shift: sample.shift,
		});
		if (idleMark !== null) {
			stage.setMarkHover({ adapterId: idleMark.adapterId, id: idleMark.id });
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = true;
			return;
		}
		stage.idleHoverIntent({
			phase: 'cancel',
			css: sample.css,
			evaluationId: id,
			coarse: sample.coarse,
			shift: sample.shift,
		});
		if (
			stage.hoverIntent({
				phase: 'move',
				css: sample.css,
				evaluationId: id,
				shift: sample.shift,
				coarse: sample.coarse,
			})
		) {
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const result = stage.resolvePick({
			css: sample.css,
			evaluationId: id,
			purpose: 'hover',
			tool: null,
		});
		if (result.kind !== 'resolved') {
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const hit = result.hit;
		const planKind = hit.reference === undefined ? planSourceKindOf(hit.sourceKind) : null;
		// The 3D Room lid is a Paint-only hit; selection and hover resolve a Room
		// through its floor and never name the lid.
		if (hit.reference === undefined && planKind === null) {
			input.session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const representation =
			hit.reference === undefined
				? {
						sourceId: hit.sourceId,
						sourceKind: planKind!,
						generationId: hit.generationId,
						stream: hit.stream,
						subRef: hit.subRef,
					}
				: undefined;
		const reference = hit.reference ?? layoutSelectionReference(representation!, stage.snapshot());
		input.session.setHover({ reference });
		const primary = primaryEntry(stage.selectionState());
		// The pick winner is the selected Wall itself, so a press here
		// would be claimed as its body drag. Select keeps the host Wall first here.
		hoverMove =
			primary !== null &&
			primary.reference.domain === 'layout' &&
			primary.reference.subject.kind === 'wall' &&
			hit.sourceKind === 'wall' &&
			hit.sourceId === primary.reference.subject.id;
		const nextHover =
			primary !== null && sameReference(primary.reference, reference)
				? null
				: representation === undefined
					? { reference }
					: { reference, representation };
		// Identity, not object identity: a pointer moving within one subject must not
		// rebuild the Stage's ink every frame.
		if (nextHover === null) hoverSelection = null;
		else if (
			hoverSelection === null ||
			!sameReference(hoverSelection.reference, nextHover.reference)
		)
			hoverSelection = nextHover;
	}

	function sample(css: [number, number], shift: boolean, coarse: boolean): void {
		hoverSample = { css, shift, coarse };
		if (hoverFrame === null) hoverFrame = requestAnimationFrame(resolveHover);
	}

	return {
		get selection() {
			return hoverSelection;
		},
		get move() {
			return hoverMove;
		},
		get cursor() {
			return stageCursor;
		},
		clear: clearHover,
		sample,
		resetSelection() {
			hoverSelection = null;
			hoverMove = false;
		},
		clearSelection() {
			hoverSelection = null;
		},
	};
}
