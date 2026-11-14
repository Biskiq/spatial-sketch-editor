/**
 * What the two Layout drawing controllers (`ink-session`, `opening-placement-session`)
 * share: the adapter-lifetime Ink memory and the narrow ports a binding hands them.
 *
 * The memory is the **adapter's**, not a binding's: a creator draws a run of Walls
 * at one thickness and height, and an accepted write rebuilds every binding, so
 * these defaults survive the rebind. Everything captured by a gesture — the chain,
 * the press, the hover, the identity capture, the candidate, the leases — lives in
 * the controllers themselves and ends with their binding. Nothing here is
 * serialized.
 */
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';

import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

import type { CandidatePaperGeometry, LayoutCandidatePaper } from './candidate-preview';
import type { LayoutCandidatePresenter } from './candidate-presenter';
import type { InkOpeningOptions, InkReading, InkWallMode } from './ink';

/** Ink's adapter-lifetime defaults; UI state only, the intent carries resolved numbers. */
export type InkMemory = {
	/** The Wall thickness the next chain is drawn at, or `null` for the planner default. */
	thickness: number | null;
	/** The Wall height the next chain is drawn at, or `null` for the planner default. */
	height: number | null;
	/**
	 * The one Ink tool's current reading. Adapter memory so a content install's
	 * binding rebuild re-arms the tool on the reading the creator was using.
	 */
	reading: InkReading;
	/** Line, Arc, Box or Circle for the Wall reading; adapter memory for the same reason. */
	wallMode: InkWallMode;
	/** The next Opening's kind and exact defaults. */
	openingOptions: Required<InkOpeningOptions>;
	/** The palette's fields are currently valid; pointer placement must honour that. */
	openingOptionsValid: boolean;
};

export function createInkMemory(): InkMemory {
	return {
		thickness: null,
		height: null,
		reading: 'wall',
		wallMode: 'line',
		openingOptions: { kind: 'door', profile: 'rectangular', width: 0.9, height: 2.1, sillHeight: 0 },
		openingOptionsValid: true
	};
}

/** What one binding lends a drawing controller; none of it outlives the binding. */
export type LayoutSessionPorts = {
	readonly services: StageAdapterServices;
	/** The accepted Layout document this binding was built from. */
	readonly document: LayoutDocumentWallFirst;
	readonly levelId: string;
	/** E4 — this binding's candidate presenter; it dies with the binding. */
	readonly presenter: LayoutCandidatePresenter;
	readonly memory: InkMemory;
	/** Whether the Ink task is the task this binding is showing. */
	readonly inkTaskOpen: () => boolean;
	/** Publish the palette's chapter (the binding's own live state). */
	readonly publish: () => void;
	/** Install one created Layout subject as the selection, by id, on the fresh source. */
	readonly select: (sourceKind: 'wall' | 'opening', sourceId: string) => void;
	/** The filtered Paper drawing for one planner candidate document. */
	readonly candidatePaper: (
		document: LayoutDocumentWallFirst,
		datumMeters: number,
		subjectIds: ReadonlySet<string>,
		affectedIds: ReadonlySet<string>
	) => { readonly paper: LayoutCandidatePaper } | null;
	/** The 3D reading's Opening outline, or `null` while the Plan does not evaluate. */
	readonly openingFace: (
		document: LayoutDocumentWallFirst,
		openingIds: ReadonlySet<string>,
		datumMeters: number
	) => CandidatePaperGeometry | null;
};
