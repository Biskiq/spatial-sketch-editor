/**
 * The semantic DOM / Info Panel companion (AM-6, T3.P01.S06).
 *
 * A framework-free view model over one program run: what a visitor can reach,
 * what is current, what the Info Panel shows and what should be announced. It
 * produces no DOM, no renderer object and no editor state, so the same model
 * drives keyboard/DOM navigation and the Canvas path with the same Activate
 * meaning. Progress and `aria-current` are occurrence-derived, never object
 * positions, raycast hits or array indices presented as identity.
 */

import type { ExecutionProgram } from '../../program/types';
import type { ExperienceRunState } from './interpreter';

export type CompanionDestination = {
	readonly stopId: string;
	readonly label: string;
	readonly presentationId: string;
	/** The current occurrence's Stop. */
	readonly current: boolean;
	/** False only when a supplied gap makes this required destination unreachable. */
	readonly reachable: boolean;
	readonly gap: string | null;
};

export type ExperienceCompanion = {
	readonly experienceId: string;
	readonly title: string;
	readonly current: {
		readonly stopId: string;
		readonly occurrenceId: string;
		readonly label: string;
		readonly content: readonly { readonly id: string; readonly text: string }[];
		/** `aria-current` value, or `null` before the first arrival. */
		readonly ariaCurrent: 'step' | null;
	} | null;
	readonly progress: {
		readonly visited: number;
		readonly total: number;
		readonly index: number | null;
		readonly occurrences: readonly string[];
	};
	readonly destinations: readonly CompanionDestination[];
	readonly panel: {
		readonly title: string;
		readonly content: readonly { readonly id: string; readonly text: string }[];
		readonly focusOnOpen: 'content';
		readonly escapeReturnsTo: 'canvas';
	} | null;
	readonly instructions: {
		readonly activate: string;
		readonly navigation: string;
	};
	readonly announcements: readonly string[];
	readonly gaps: readonly { readonly stopId: string; readonly message: string }[];
};

/**
 * Build the companion for one run.
 *
 * `gaps` names destinations a required transition cannot reach (a Travel gap, an
 * unresolved View). A gap disables that destination and is explained; it never
 * silently removes it or substitutes a Cut.
 */
export function buildExperienceCompanion(
	program: ExecutionProgram,
	state: ExperienceRunState,
	gaps: ReadonlyMap<string, string> = new Map()
): ExperienceCompanion {
	const stopIndex = new Map(program.stops.map((stop, index) => [stop.id, index]));
	const presentationById = new Map(program.presentations.map((presentation) => [presentation.id, presentation]));
	const destinations: CompanionDestination[] = program.stops.map((stop) => {
		const presentation = presentationById.get(stop.presentationId);
		const gap = gaps.get(stop.id) ?? null;
		return {
			stopId: stop.id,
			label: presentation?.label ?? stop.id,
			presentationId: stop.presentationId,
			current: state.stopId === stop.id,
			reachable: gap === null,
			gap
		};
	});
	const currentPresentation = state.presentationId === null ? undefined : presentationById.get(state.presentationId);
	const panel = state.panel === null
		? null
		: {
				title: state.panel.title,
				content: state.panel.content,
				focusOnOpen: 'content' as const,
				escapeReturnsTo: 'canvas' as const
			};
	return {
		experienceId: program.experienceId,
		title: currentPresentation?.label ?? program.experienceId,
		current: state.stopId === null || state.occurrenceId === null
			? null
			: {
					stopId: state.stopId,
					occurrenceId: state.occurrenceId,
					label: currentPresentation?.label ?? state.stopId,
					content: state.panel?.content ?? [],
					ariaCurrent: 'step'
				},
		progress: {
			visited: state.visited.length,
			total: program.stops.length,
			index: state.stopId === null ? null : stopIndex.get(state.stopId) ?? null,
			occurrences: state.visited.map((visit) => visit.occurrenceId)
		},
		destinations,
		panel,
		instructions: {
			activate: 'Open this Stop',
			navigation: 'Every destination is reachable by keyboard from the navigation list; the same Activate means the same thing on the canvas.'
		},
		announcements: announcements(program, state),
		gaps: [...gaps].map(([stopId, message]) => ({ stopId, message }))
	};
}

function announcements(program: ExecutionProgram, state: ExperienceRunState): string[] {
	const lines: string[] = [];
	if (state.phase === 'completed') lines.push('The Experience is complete.');
	if (state.phase === 'cancelled') lines.push('The Experience was cancelled.');
	if (state.phase === 'blocked') lines.push('Continue is required to proceed.');
	if (state.phase === 'holding') lines.push('This Stop holds before the next one.');
	if (state.stopId !== null && state.phase !== 'completed' && state.phase !== 'cancelled') {
		const index = program.stops.findIndex((stop) => stop.id === state.stopId);
		lines.push(`Stop ${index + 1} of ${program.stops.length}.`);
	}
	return lines;
}
