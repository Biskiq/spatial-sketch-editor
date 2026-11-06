/**
 * The shared Card's identity and facts for each Experience subject (R217.S25).
 *
 * Every Experience subject (a Presentation, a View, a Stop, a Stop's transition, the Experience
 * itself and a Scene object) is shown through the one Card. Each helper here returns the Card's kind
 * word, its name and status, and the few facts the Card lists in More. The helpers are pure
 * functions over plain values: the route reads the controller and passes labels, counts and
 * positions in, and nothing here names a DOM, a Svelte rune or a source writer.
 *
 * Writers edit through the Card's own controls, so no fact carries a field id and the
 * writer field lists stay empty.
 */
import type { StageCardFact } from '../stage/stage-facade';
import type { ResolvedContinuation } from './experience-model';

export type ExperienceCardIdentity = {
	readonly sourceId: string;
	readonly label: string;
	readonly kind: string;
	readonly status: string;
};

export type ExperienceCardModel = {
	readonly identity: ExperienceCardIdentity;
	readonly facts: readonly StageCardFact[];
};

/** The Card fields the Presentation writer edits. Empty: the Card's own controls carry them. */
export const PRESENTATION_WRITER_FIELDS: readonly string[] = [];

/** The Card fields the Stop writer edits. Empty: the Card's own controls carry them. */
export const STOP_WRITER_FIELDS: readonly string[] = [];

export function presentationSourceId(presentationId: string): string {
	return `experience:presentation:${presentationId}`;
}

export function viewSourceId(viewId: string): string {
	return `experience:view:${viewId}`;
}

export function stopSourceId(stopId: string): string {
	return `experience:stop:${stopId}`;
}

export function transitionSourceId(stopId: string): string {
	return `experience:transition:${stopId}`;
}

export function experienceSourceId(experienceId: string): string {
	return `experience:experience:${experienceId}`;
}

export function subjectSourceId(entityId: string): string {
	return `experience:subject:${entityId}`;
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** A Presentation about a Scene subject names that subject in its kind word. */
export function presentationCardModel(input: {
	readonly presentationId: string;
	readonly label: string;
	/** True when the Presentation is about a Scene subject, false for an environment or region. */
	readonly hasSubject: boolean;
	readonly viewCount: number;
	/** How many Stops visit the Presentation. */
	readonly stopCount: number;
	readonly hasDefaultView: boolean;
}): ExperienceCardModel {
	const { presentationId, label, hasSubject, viewCount, stopCount, hasDefaultView } = input;
	return {
		identity: {
			sourceId: presentationSourceId(presentationId),
			label,
			kind: hasSubject ? 'Presentation · about' : 'Presentation',
			status: hasDefaultView ? 'Default View set' : 'No Default View'
		},
		facts: [
			{ label: 'Views', value: String(viewCount) },
			{ label: 'Used in', value: stopCount === 0 ? 'No Stop yet' : plural(stopCount, 'Stop') }
		]
	};
}

/** A View is shown by its name; its status says which Presentation it belongs to. */
export function viewCardModel(input: {
	readonly viewId: string;
	readonly label: string;
	readonly presentationLabel: string;
}): ExperienceCardModel {
	const { viewId, label, presentationLabel } = input;
	return {
		identity: {
			sourceId: viewSourceId(viewId),
			label,
			kind: 'View in',
			status: presentationLabel
		},
		facts: []
	};
}

/**
 * A Stop in the active Guide is named by its place; a Stop the active Guide does not list
 * (`position` null) is named by the Presentation it visits, with no invented place.
 */
export function stopCardModel(input: {
	readonly stopId: string;
	readonly presentationLabel: string;
	/** The Stop's one-based place in the active Guide, or null when the Guide does not list it. */
	readonly position: number | null;
	readonly guideLength: number;
	readonly guideLabel: string;
}): ExperienceCardModel {
	const { stopId, presentationLabel, position, guideLength, guideLabel } = input;
	const kind =
		position === null
			? `Stop · ${presentationLabel}`
			: `Stop ${position} of ${guideLength} · ${guideLabel}`;
	return {
		identity: {
			sourceId: stopSourceId(stopId),
			label: presentationLabel,
			kind,
			status: position === null ? 'Not in this Guide' : guideLabel
		},
		facts: []
	};
}

/** The arrow line that names where a Stop's continuation leads, from the Stop's own place. */
export function transitionLabel(continuation: ResolvedContinuation, fromPosition: number): string {
	const from = `Stop ${fromPosition}`;
	switch (continuation.kind) {
		case 'adjacent':
			return `${from} → Stop ${continuation.position}`;
		case 'jump':
			return continuation.position === null
				? `${from} → another Guide's Stop`
				: `${from} → Stop ${continuation.position}`;
		case 'end':
			return `${from} → End`;
	}
}

/** A Stop's outgoing continuation: its arrow line names the target, its status the cut or travel. */
export function transitionCardModel(input: {
	readonly stopId: string;
	/** The Stop's one-based place in the active Guide. */
	readonly fromPosition: number;
	readonly guideLabel: string;
	readonly continuation: ResolvedContinuation;
}): ExperienceCardModel {
	const { stopId, fromPosition, guideLabel, continuation } = input;
	const status =
		continuation.kind === 'end' ? 'End' : continuation.transition === 'travel' ? 'Travel' : 'Cut';
	return {
		identity: {
			sourceId: transitionSourceId(stopId),
			label: transitionLabel(continuation, fromPosition),
			kind: `Transition · ${guideLabel}`,
			status
		},
		facts: []
	};
}

/** The Experience itself: the Card when nothing is selected (D-2). */
export function experienceCardModel(input: {
	readonly experienceId: string;
	readonly label: string;
	readonly guideCount: number;
}): ExperienceCardModel {
	const { experienceId, label, guideCount } = input;
	return {
		identity: {
			sourceId: experienceSourceId(experienceId),
			label,
			kind: 'Experience',
			status: guideCount === 0 ? 'No Guides yet' : plural(guideCount, 'Guide')
		},
		facts: []
	};
}

/** A Scene object shown in the Experience lens, named by its entity label. */
export function subjectCardModel(input: {
	readonly entityId: string;
	readonly label: string;
}): ExperienceCardModel {
	const { entityId, label } = input;
	return {
		identity: {
			sourceId: subjectSourceId(entityId),
			label,
			kind: 'Scene object',
			status: 'In the Scene'
		},
		facts: []
	};
}
