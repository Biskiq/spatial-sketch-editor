/**
 * The Experience lens's shared Index groups.
 *
 * A read of the controller plus the few lens slots the Index mutates: the
 * expanded Presentation, the open Guide and the one Card selection. Every action
 * is one of the controller's commands or that selection; no source or Camera
 * state lives here.
 */
import type { ExperienceIndexGroups } from '../stage/shell/experience-index-groups';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperienceSubject } from './experience-model';

export type ExperienceIndexInput = {
	readonly lens: 'world' | 'experience';
	readonly controller: ExperienceController | null;
	readonly guideOpen: boolean;
	readonly expandedPresentationId: string | null;
	readonly select: (subject: ExperienceSubject | null) => void;
	readonly setExpanded: (presentationId: string | null) => void;
	readonly setCardOpen: (open: boolean) => void;
	readonly setGuideOpen: (open: boolean) => void;
};

export function experienceIndexFor(input: ExperienceIndexInput): ExperienceIndexGroups | null {
	if (input.lens !== 'experience') return null;
	const controller = input.controller;
	if (controller === null) {
		return {
			pending: true,
			experiences: [],
			draftLabel: '',
			current: null,
			guides: [],
			presentations: [],
			totalPresentations: 0,
			query: '',
			busy: false,
			onQuery: () => {},
			onOpenExperience: () => {},
			onCreateExperience: () => {},
			onRenameExperience: async () => ({ kind: 'refused' as const }),
			onOpenGuide: () => {},
			onRenameGuide: async () => ({ kind: 'refused' as const }),
			onRemoveGuide: () => {},
			onAddStopFromView: () => {},
			onSelectPresentation: () => {},
			onToggleExpand: () => {},
			onSelectView: () => {}
		};
	}
	const current = controller.current;
	const subject = controller.subject;
	// The open chip reads the active Guide; the Stop numbers and On tour read the
	// context Guide (entry before open).
	const activeGuideId = controller.currentGuide?.id ?? null;
	const stopNumbers = new Map<string, number[]>();
	controller.guideStops.forEach((stop, index) => {
		stopNumbers.set(stop.presentationId, [...(stopNumbers.get(stop.presentationId) ?? []), index + 1]);
	});
	return {
		pending: false,
		experiences: controller.experiences.map((entry) => ({
			id: entry.id,
			label: entry.label,
			stopCount: entry.stops.length,
			presentationCount: entry.presentations.length
		})),
		draftLabel: controller.draftLabel,
		current: current === null ? null : { id: current.id, label: current.label },
		guides: controller.guides.map((guide) => ({
			id: guide.id,
			label: guide.label,
			stopCount: guide.stopIds.length,
			open: input.guideOpen && guide.id === activeGuideId,
			opening: current?.entryGuideId === guide.id
		})),
		presentations: controller.filteredPresentations.map((entry) => ({
			id: entry.id,
			label: controller.presentationDisplayName(entry.id),
			viewCount: entry.views.length,
			explorable: entry.explorable,
			stopNumbers: stopNumbers.get(entry.id) ?? [],
			selected: subject?.kind === 'presentation' && subject.presentationId === entry.id,
			expanded: input.expandedPresentationId === entry.id,
			views: (controller.viewsOf.get(entry.id) ?? []).map((view) => ({
				id: view.id,
				label: view.label,
				onTour: controller.viewStops(view.id).length > 0,
				isDefault: entry.views[0]?.viewId === view.id,
				selected:
					subject?.kind === 'view' && subject.viewId === view.id && subject.presentationId === entry.id
			}))
		})),
		totalPresentations: current?.presentations.length ?? 0,
		query: controller.query,
		busy: controller.busy,
		onQuery: (query: string) => {
			controller.query = query;
		},
		onOpenExperience: (experienceId: string) => {
			controller.openExperience(experienceId);
			input.setExpanded(null);
			input.setCardOpen(true);
		},
		onCreateExperience: (label?: string) => {
			// A pending name prompt or an expanded row belongs to the Experience it was opened in.
			input.setExpanded(null);
			return controller.createExperience(label);
		},
		onRenameExperience: (label: string) => controller.renameExperience(label),
		onOpenGuide: (guideId: string | null) => {
			if (guideId !== null) controller.openGuide(guideId);
			input.setGuideOpen(true);
			// D-2: a Guide has no Card; opening it keeps the Experience Card.
			input.select({ kind: 'experience' });
		},
		onRenameGuide: (guideId: string, label: string) => controller.renameGuide(guideId, label),
		onRemoveGuide: (guideId: string) => void controller.remove({ kind: 'guide', guideId }),
		onAddStopFromView: (viewId: string, presentationId: string) => {
			void controller.addStop(presentationId, { entryViewId: viewId });
		},
		onSelectPresentation: (presentationId: string) => {
			input.select({ kind: 'presentation', presentationId });
		},
		onToggleExpand: (presentationId: string) => {
			input.setExpanded(input.expandedPresentationId === presentationId ? null : presentationId);
		},
		onSelectView: (viewId: string, presentationId: string) => {
			input.select({ kind: 'view', viewId, presentationId });
		}
	};
}
