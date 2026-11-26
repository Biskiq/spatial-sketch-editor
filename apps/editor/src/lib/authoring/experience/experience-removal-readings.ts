import {
	planGuideRemoval,
	planPresentationRemoval,
	planPresentationViewRemoval,
	planStopRemoval,
	type Experience,
	type ExperienceGuide,
	type ExperienceRemovalPlan,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';
import {
	removalLines,
	type ExperienceRemovalPreview,
	type ExperienceRemovalTarget,
	type RemovalNames,
} from './experience-removal';
import type { ExperienceSubject } from './experience-model';

/** The names and plans one removal preview reads, against the live accepted source. */
export type ExperienceRemovalReadingsPorts = {
	readonly experience: () => Experience | null;
	readonly contextGuide: () => ExperienceGuide | null;
	readonly envelope: () => ProjectEnvelope;
	readonly presentationLabel: (presentationId: string) => string;
	readonly presentationDisplayName: (presentationId: string) => string;
};

export function createExperienceRemovalReadings(ports: ExperienceRemovalReadingsPorts) {
	const names: RemovalNames = {
		stop: (stopId) => {
			const at = ports.contextGuide()?.stopIds.indexOf(stopId) ?? -1;
			if (at !== -1) return `Stop ${at + 1}`;
			const stop = ports.experience()?.stops.find((entry) => entry.id === stopId);
			return stop === undefined
				? 'a Stop'
				: `a Stop of ${ports.presentationLabel(stop.presentationId)}`;
		},
		presentation: (presentationId) => ports.presentationLabel(presentationId),
		view: (viewId) =>
			ports.envelope().units.camera.data.views.find((entry) => entry.id === viewId)?.label ??
			viewId,
		guide: (guideId) =>
			ports.experience()?.guides.find((entry) => entry.id === guideId)?.label ?? 'the Guide',
	};

	function planOf(target: ExperienceRemovalTarget): ExperienceRemovalPlan | null {
		const experience = ports.experience();
		if (experience === null) return null;
		const experiencesNow = ports.envelope().units.experience.data.experiences;
		const camera = ports.envelope().units.camera.data;
		switch (target.kind) {
			case 'stop':
				return planStopRemoval(experience, target.stopId);
			case 'guide':
				return planGuideRemoval(experience, target.guideId);
			case 'presentation':
				return planPresentationRemoval(
					experiencesNow,
					camera,
					experience.id,
					target.presentationId,
				);
			case 'view':
				return planPresentationViewRemoval(
					experiencesNow,
					camera,
					experience.id,
					target.presentationId,
					target.viewId,
					target.newDefaultViewId ?? null,
				);
		}
	}

	function removalPreview(target: ExperienceRemovalTarget): ExperienceRemovalPreview {
		const plan = planOf(target);
		if (plan === null) return { kind: 'refused', reason: 'There is no Experience to remove from.' };
		if (plan.kind === 'refused') return { kind: 'refused', reason: plan.reason };
		const isDefault =
			target.kind === 'view' &&
			ports.experience()?.presentations.find((entry) => entry.id === target.presentationId)
				?.views[0]?.viewId === target.viewId;
		return {
			kind: 'ready',
			lines: removalLines(target, plan.consequences, names),
			chooseDefault:
				isDefault && target.kind === 'view'
					? (
							ports.experience()?.presentations.find((entry) => entry.id === target.presentationId)
								?.views ?? []
						)
							.filter((view) => view.viewId !== target.viewId)
							.map((view) => ({ id: view.viewId, label: names.view(view.viewId) }))
					: null,
			runnable: true,
		};
	}

	/** The parent a removal selects: removing the selected subject selects its parent. */
	function parentOf(target: ExperienceRemovalTarget): ExperienceSubject | null {
		if (target.kind === 'view')
			return { kind: 'presentation', presentationId: target.presentationId };
		// A Stop's parent is the Guide instrument, which is not a Card subject (D-2).
		return null;
	}

	/** Whether the subject is (or hangs from) what a removal takes away. */
	function removes(target: ExperienceRemovalTarget, subject: ExperienceSubject | null): boolean {
		if (subject === null) return false;
		switch (target.kind) {
			case 'stop':
				return (
					(subject.kind === 'stop' || subject.kind === 'transition') &&
					subject.stopId === target.stopId
				);
			case 'guide':
				return false;
			case 'presentation':
				return (
					(subject.kind === 'presentation' || subject.kind === 'view') &&
					subject.presentationId === target.presentationId
				);
			case 'view':
				return (
					subject.kind === 'view' &&
					subject.viewId === target.viewId &&
					subject.presentationId === target.presentationId
				);
		}
	}

	function remaining(target: ExperienceRemovalTarget, after: Experience): string {
		switch (target.kind) {
			case 'stop': {
				const guide = after.guides.find((entry) => entry.id === ports.contextGuide()?.id);
				return guide === undefined
					? ''
					: `${guide.label} has ${guide.stopIds.length} ${guide.stopIds.length === 1 ? 'Stop' : 'Stops'}.`;
			}
			case 'guide':
				return after.guides.length === 0
					? 'No Guide yet.'
					: `${after.guides.length} ${after.guides.length === 1 ? 'Guide remains' : 'Guides remain'}.`;
			case 'presentation':
				return `${after.presentations.length} ${after.presentations.length === 1 ? 'Presentation remains' : 'Presentations remain'}.`;
			case 'view': {
				const presentation = after.presentations.find(
					(entry) => entry.id === target.presentationId,
				);
				return presentation === undefined
					? ''
					: `${ports.presentationDisplayName(presentation.id)} has ${presentation.views.length} ${presentation.views.length === 1 ? 'View' : 'Views'}.`;
			}
		}
	}

	/** Whether a subject still names something in the ports.experience Experience. */
	function resolves(candidate: ExperienceSubject): boolean {
		const experience = ports.experience();
		if (experience === null) return false;
		switch (candidate.kind) {
			case 'presentation':
				return experience.presentations.some((entry) => entry.id === candidate.presentationId);
			case 'view':
				return experience.presentations.some(
					(entry) =>
						entry.id === candidate.presentationId &&
						entry.views.some((view) => view.viewId === candidate.viewId),
				);
			case 'stop':
			case 'transition':
				return experience.stops.some((entry) => entry.id === candidate.stopId);
			case 'experience':
				return true;
		}
	}

	function subjectName(candidate: ExperienceSubject): string {
		switch (candidate.kind) {
			case 'presentation':
				return names.presentation(candidate.presentationId);
			case 'view':
				return names.view(candidate.viewId);
			case 'stop':
				return names.stop(candidate.stopId);
			case 'transition':
				return `${names.stop(candidate.stopId)} onward`;
			case 'experience':
				return ports.experience()?.label ?? 'Experience';
		}
	}

	return { names, planOf, removalPreview, parentOf, removes, remaining, resolves, subjectName };
}
