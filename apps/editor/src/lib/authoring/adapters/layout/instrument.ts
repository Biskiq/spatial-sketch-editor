/**
 * T1.P01.S04 — the Dimensions instrument's framework-free controller.
 *
 * Explicit inputs (the accepted source, the subject, the session revision),
 * explicit commands (`edit`, `commit`, `cancel`, `blur`, `place`) and an
 * observable result. No Svelte, host, route or renderer import, so the same
 * behaviour the browser view renders is what the tests drive:
 *
 * - **Enter accepts**, **Esc cancels**, **blur does not commit**. Blur discards
 *   the pending text and restores the accepted value; it never sends an intent.
 * - **Exact typed values.** The committed value is the parsed number, not a
 *   rounded display value; the planner rejects non-finite and non-positive
 *   values and its own message is shown unchanged.
 * - **Blank is not zero.** A blank field is an `empty` state with a reason and
 *   sends nothing; it can never become a zero-metre edit.
 * - **One proposal at a time.** A second commit while a write is in flight is
 *   refused locally; the in-flight command owns the document revision.
 * - **Placement captures identity first.** The new `layout-object` id is
 *   captured from the *pre-commit* document and passed as an allocation, so the
 *   retained preset planner must agree with it or the placement is refused.
 */

import {
	nextLayoutPresetObjectId,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import type { AuthoringIntent, SemanticReference } from '@portfolio/project-model';

import {
	LAYOUT_ENTITY_NAME_KIND,
	LAYOUT_OPENING_MEASURE_KIND,
	LAYOUT_PLINTH_PLACE_KIND,
	LAYOUT_WALL_HEIGHT_KIND,
	LAYOUT_WALL_THICKNESS_KIND,
	buildLayoutIntent,
	isLayoutOpeningField,
	layoutFacts,
	layoutWritableFacts,
	parseMeasureInput,
	parsePlacementXZ,
	type LayoutSubject,
	type LayoutWritableFact
} from './precision';

export type LayoutWriteOutcome =
	| { readonly kind: 'installed' | 'unchanged' | 'no-op' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

/** The narrow authoring port the instrument needs; `StageAdapterServices['authoring']` satisfies it. */
export type LayoutWritePort = {
	accept(intent: AuthoringIntent): Promise<LayoutWriteOutcome>;
	acceptedRevision(): { readonly revisionId: string };
};

/**
 * The host's one gesture lease, expressed as the two things a proposal needs.
 *
 * `acquire()` answers whether this proposal now owns the lease. A refused
 * acquisition (another gesture is live, or the evaluation ended) leaves the
 * instrument usable but does not claim Undo is blocked.
 */
export type LayoutGesturePort = {
	acquire(): boolean;
	release(): void;
};

export type LayoutInstrumentOptions = {
	readonly subject: LayoutSubject;
	readonly document: LayoutDocumentWallFirst;
	readonly projectId: string;
	readonly contentRevision: string;
	readonly port: LayoutWritePort;
	/** Present in the mounted host; absent in pure controller tests. */
	readonly gesture?: LayoutGesturePort;
	readonly mintOperationId?: () => string;
};

export type LayoutFieldState = {
	readonly id: string;
	readonly label: string;
	readonly unit: 'm' | 'text';
	/** The accepted value as display text (full precision, never rounded). */
	readonly value: string;
	/** The current edit buffer; equals `value` until the creator types. */
	readonly text: string;
	readonly error: string | null;
};

export type LayoutInstrumentOutcome =
	| { readonly kind: 'accepted' }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string }
	| { readonly kind: 'invalid'; readonly code: 'blank' | 'non-finite' | 'malformed'; readonly message: string }
	| { readonly kind: 'busy' }
	| { readonly kind: 'unknown-field' }
	| { readonly kind: 'unknown-subject' };

export type LayoutInstrument = {
	readonly subject: LayoutSubject;
	/** Every settled fact, including the read-only ones. */
	facts(): ReturnType<typeof layoutFacts>;
	fields(): readonly LayoutFieldState[];
	/** The current raw placement inputs (working-plane X/Z). */
	placement(): { readonly x: string; readonly z: string; readonly error: string | null };
	setPlacement(x: string, z: string): void;
	edit(id: string, text: string): LayoutFieldState | null;
	/** Enter: parse, build the captured intent and submit it once. */
	commit(id: string): Promise<LayoutInstrumentOutcome>;
	/** Esc: discard the edit buffer and any error, without committing. */
	cancel(id: string): LayoutFieldState | null;
	/** Blur: discard the edit buffer and any error, without committing. */
	blur(id: string): LayoutFieldState | null;
	/** Place → Layout plinth at the typed working-plane X/Z. */
	place(): Promise<LayoutInstrumentOutcome>;
	cancelPlacement(): void;
	/** True while this instrument holds the host's gesture lease for a proposal. */
	proposalLive(): boolean;
	/** Unmount: release the lease exactly once, without committing anything. */
	dispose(): void;
};

function displayOf(fact: LayoutWritableFact): string {
	return fact.unit === 'text' ? String(fact.value) : String(fact.value);
}

/**
 * The reference a Layout intent addresses. Built from the accepted source's own
 * level id and content revision, so the target cannot name another level.
 */
export function layoutSubjectReference(input: {
	readonly subject: LayoutSubject;
	readonly levelId: string;
	readonly contentRevision: string;
}): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: input.contentRevision },
		subject: { kind: input.subject.kind, id: input.subject.id },
		instancePath: [],
		location: {
			kind: 'layout-location',
			levelId: input.levelId,
			structureInstancePath: []
		},
		componentId: null,
		capabilityId: null
	};
}

export function createLayoutInstrument(options: LayoutInstrumentOptions): LayoutInstrument {
	const mint = options.mintOperationId ?? (() => globalThis.crypto.randomUUID());
	const levelId = options.document.floor.id;
	const accepted = new Map<string, string>(
		layoutWritableFacts(options.document, options.subject).map((fact) => [fact.id, displayOf(fact)])
	);
	const text = new Map<string, string>(accepted);
	const errors = new Map<string, string>();
	let placement = { x: '0', z: '0', error: null as string | null };
	let inFlight = false;
	let proposal = false;

	/**
	 * The first keystroke of a proposal takes the host lease; it is not history.
	 *
	 * Every keystroke asks the port, never this instance's own flag: the host can
	 * end the lease underneath a mounted instrument (a reading change releases a
	 * `cancel-on-reading-change` proposal), and a stale `true` would leave a typed
	 * value unguarded while Undo reported it available. The port answers `true`
	 * while its own grant is still alive and re-acquires a spent one.
	 */
	function beginProposal(): void {
		if (options.gesture === undefined) return;
		proposal = options.gesture.acquire();
	}

	function releaseProposal(): void {
		if (!proposal) return;
		options.gesture?.release();
		proposal = false;
	}

	function fieldState(id: string): LayoutFieldState | null {
		const fact = layoutWritableFacts(options.document, options.subject).find((entry) => entry.id === id);
		if (fact === undefined) return null;
		return {
			id,
			label: fact.label,
			unit: fact.unit,
			value: accepted.get(id) ?? displayOf(fact),
			text: text.get(id) ?? '',
			error: errors.get(id) ?? null
		};
	}

	function reference(): SemanticReference {
		return layoutSubjectReference({
			subject: options.subject,
			levelId,
			contentRevision: options.contentRevision
		});
	}

	async function submit(intent: AuthoringIntent): Promise<LayoutInstrumentOutcome> {
		inFlight = true;
		try {
			const outcome = await options.port.accept(intent);
			if (outcome.kind === 'refused') {
				return { kind: 'refused', code: outcome.code, message: outcome.message };
			}
			// An accepted change rebuilds the adapter binding; this controller instance
			// stays a read of the source it was built from. A `no-op`/`unchanged`
			// result is still a settled command for the caller, never a hidden rewrite.
			return { kind: 'accepted' };
		} finally {
			inFlight = false;
		}
	}

	function updateAccepted(id: string, value: number | null): void {
		if (value !== null) accepted.set(id, String(value));
	}

	return {
		subject: options.subject,
		facts: () => layoutFacts(options.document, options.subject),
		fields() {
			return layoutWritableFacts(options.document, options.subject)
				.map((fact) => fieldState(fact.id))
				.filter((state): state is LayoutFieldState => state !== null);
		},
		placement: () => ({ ...placement }),
		setPlacement(x, z) {
			// Typed working-plane input is a live placement proposal exactly as a
			// settled measure is: it takes the host lease on the first keystroke, so
			// Undo cannot move the document out from under a value about to be placed.
			beginProposal();
			placement = { x, z, error: null };
		},
		edit(id, next) {
			const current = fieldState(id);
			if (current === null) return null;
			beginProposal();
			text.set(id, next);
			errors.delete(id);
			return fieldState(id);
		},
		async commit(id) {
			const current = fieldState(id);
			if (current === null) return { kind: 'unknown-field' };
			if (inFlight) {
				// A busy return commits nothing, so it must not leave a lease behind for
				// the value that was just typed.
				releaseProposal();
				return { kind: 'busy' };
			}
			errors.delete(id);
			try {

			if (current.unit === 'text') {
				const name = current.text.trim();
				if (name.length === 0) {
					errors.set(id, 'Enter a name; an empty name is not a rename.');
					return { kind: 'invalid', code: 'blank', message: errors.get(id)! };
				}
				if (options.subject.kind === 'object') {
					return {
						kind: 'refused',
						code: 'read-only',
						message: 'A Layout object keeps its identity as its name; only Walls and Openings are renameable.'
					};
				}
				const outcome = await submit(
					buildLayoutIntent({
						kind: LAYOUT_ENTITY_NAME_KIND,
						operationId: mint(),
						projectId: options.projectId,
						revisionId: options.port.acceptedRevision().revisionId,
						contentRevision: options.contentRevision,
						targets: [reference()],
						payload: { subjectKind: options.subject.kind, subjectId: options.subject.id, name }
					})
				);
				if (outcome.kind === 'refused') errors.set(id, outcome.message);
				else if (outcome.kind === 'accepted') {
					accepted.set(id, name);
					releaseProposal();
				}
				return outcome;
			}

			const parsed = parseMeasureInput(current.text);
			if (!parsed.ok) {
				errors.set(id, parsed.reason);
				return { kind: 'invalid', code: parsed.code, message: parsed.reason };
			}
			if (parsed.value < 0 || (parsed.value === 0 && id !== 'offset' && id !== 'sillHeight')) {
				const reason =
					id === 'offset' || id === 'sillHeight'
						? 'Enter a value of zero or more.'
						: 'Enter a value greater than zero.';
				errors.set(id, reason);
				return { kind: 'invalid', code: 'malformed', message: reason };
			}

			let intent: AuthoringIntent;
			if (id === 'height' && options.subject.kind === 'wall') {
				intent = buildLayoutIntent({
					kind: LAYOUT_WALL_HEIGHT_KIND,
					operationId: mint(),
					projectId: options.projectId,
					revisionId: options.port.acceptedRevision().revisionId,
					contentRevision: options.contentRevision,
					targets: [reference()],
					payload: { wallId: options.subject.id, height: parsed.value }
				});
			} else if (id === 'thickness' && options.subject.kind === 'wall') {
				intent = buildLayoutIntent({
					kind: LAYOUT_WALL_THICKNESS_KIND,
					operationId: mint(),
					projectId: options.projectId,
					revisionId: options.port.acceptedRevision().revisionId,
					contentRevision: options.contentRevision,
					targets: [reference()],
					payload: { wallId: options.subject.id, thickness: parsed.value }
				});
			} else if (options.subject.kind === 'opening' && isLayoutOpeningField(id)) {
				intent = buildLayoutIntent({
					kind: LAYOUT_OPENING_MEASURE_KIND,
					operationId: mint(),
					projectId: options.projectId,
					revisionId: options.port.acceptedRevision().revisionId,
					contentRevision: options.contentRevision,
					targets: [reference()],
					payload: { openingId: options.subject.id, field: id, value: parsed.value }
				});
			} else {
				const reason = `"${current.label}" has no supported writer on this subject.`;
				errors.set(id, reason);
				return { kind: 'refused', code: 'unavailable', message: reason };
			}

			const outcome = await submit(intent);
			if (outcome.kind === 'refused') errors.set(id, outcome.message);
			else if (outcome.kind === 'accepted') {
				updateAccepted(id, parsed.value);
				releaseProposal();
			}
			return outcome;
			} finally {
				// A completed attempt — accepted, refused, invalid or thrown — ends the
				// proposal. A lease must never outlive the value it was opened for.
				releaseProposal();
			}
		},
		cancel(id) {
			const current = fieldState(id);
			if (current === null) return null;
			text.set(id, current.value);
			errors.delete(id);
			releaseProposal();
			return fieldState(id);
		},
		blur(id) {
			const current = fieldState(id);
			if (current === null) return null;
			text.set(id, current.value);
			errors.delete(id);
			releaseProposal();
			return fieldState(id);
		},
		async place() {
			if (inFlight) {
				releaseProposal();
				return { kind: 'busy' };
			}
			try {
				const parsed = parsePlacementXZ(placement.x, placement.z);
				if (!parsed.ok) {
					placement = { ...placement, error: parsed.reason };
					return { kind: 'invalid', code: parsed.code, message: parsed.reason };
				}
				const objectId = nextLayoutPresetObjectId(options.document);
				const point: LayoutVec2 = parsed.point;
				const outcome = await submit(
					buildLayoutIntent({
						kind: LAYOUT_PLINTH_PLACE_KIND,
						operationId: mint(),
						projectId: options.projectId,
						revisionId: options.port.acceptedRevision().revisionId,
						contentRevision: options.contentRevision,
						targets: [],
						payload: {
							point: [point[0], point[1]],
							floorElevation: options.document.floor.elevation,
							objectId
						},
						allocatedIds: [{ kind: 'layout-object', id: objectId }]
					})
				);
				if (outcome.kind === 'refused') placement = { ...placement, error: outcome.message };
				return outcome;
			} finally {
				// A placement attempt — accepted, refused, invalid or thrown — ends the
				// proposal; the lease must never outlive the value it was opened for.
				releaseProposal();
			}
		},
		cancelPlacement() {
			placement = { x: placement.x, z: placement.z, error: null };
			releaseProposal();
		},
		proposalLive: () => proposal,
		dispose: () => releaseProposal()
	};
}
