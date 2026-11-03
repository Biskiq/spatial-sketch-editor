/**
 * The Card's identity and ordinary facts for an Experience subject (R217.S25).
 *
 * A Presentation and a Stop are shown through the shared Card, so each needs an identity
 * (its kind word and name) and the facts the Card lists in More. Pure data: the route
 * builds it from the controller's reads, and nothing here names a DOM, a Camera or a
 * source writer. The fields the writers edit are named by their `fieldId`, so the Card
 * never repeats a value a writer already shows.
 */
import type { ExperiencePresentation, ExperienceStop } from '@portfolio/project-model/units';
import type { StageCardFact } from '../stage/stage-facade';

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

/** The Card field ids the Presentation writer edits. Their facts are not repeated. */
export const PRESENTATION_WRITER_FIELDS = ['default-view'] as const;

/** The Card field ids the Stop writer edits. Their facts are not repeated. */
export const STOP_WRITER_FIELDS = ['entry-view', 'hold', 'continuation', 'transition'] as const;

export function presentationSourceId(presentationId: string): string {
	return `experience:presentation:${presentationId}`;
}

export function stopSourceId(stopId: string): string {
	return `experience:stop:${stopId}`;
}

export function presentationCardModel(input: {
	readonly presentation: ExperiencePresentation;
	/** The View labels the Presentation uses, in its own order. */
	readonly views: readonly { readonly id: string; readonly label: string }[];
	/** How many Stops visit the Presentation. */
	readonly stopCount: number;
}): ExperienceCardModel {
	const { presentation, views, stopCount } = input;
	const defaultView = views.find((view) => view.id === presentation.defaultViewId) ?? null;
	// An unset Default and a Default that names a View the source no longer carries are different honest states.
	const defaultValue =
		presentation.defaultViewId === null
			? 'Unset: cannot be entered'
			: defaultView === null
				? 'Missing View: cannot be entered'
				: defaultView.label;
	const subject =
		presentation.subject === null
			? 'Environment or region'
			: `${presentation.subject.domain} ${presentation.subject.subject.kind}`;
	return {
		identity: {
			sourceId: presentationSourceId(presentation.id),
			label: presentation.label,
			kind: 'Presentation',
			status: defaultView === null ? 'No Default View' : 'Default View set'
		},
		facts: [
			{ label: 'Views', value: String(views.length) },
			{
				label: 'Default View',
				value: defaultValue,
				fieldId: 'default-view'
			},
			{ label: 'Subject', value: subject },
			{ label: 'Used in', value: stopCount === 0 ? 'No Stop yet' : `${stopCount} Stop${stopCount === 1 ? '' : 's'}` }
		]
	};
}

export function stopCardModel(input: {
	readonly stop: ExperienceStop;
	/** The Stop's one-based place in its Guide. */
	readonly position: number;
	readonly guideLength: number;
	readonly presentationLabel: string;
	readonly guideLabel: string | null;
}): ExperienceCardModel {
	const { stop, position, guideLength, presentationLabel, guideLabel } = input;
	// A Stop the open Guide does not list has no place to name: the Card says what it visits, nothing more.
	const placed = position > 0;
	return {
		identity: {
			sourceId: stopSourceId(stop.id),
			label: placed ? `${position}. ${presentationLabel}` : presentationLabel,
			kind: 'Stop',
			status: guideLabel ?? 'Guide'
		},
		facts: [
			{ label: 'Presentation', value: presentationLabel },
			...(placed ? [{ label: 'Position', value: `${position} of ${guideLength}` }] : []),
			...(guideLabel === null ? [] : [{ label: 'Guide', value: guideLabel }])
		]
	};
}
