import type { OperationChange } from '@portfolio/project-model/f4';
import type { Experience, ProjectEnvelope } from '@portfolio/project-model/units';
import { lowerExperienceProgram, presentationDisplayName as displayPresentationName } from '@portfolio/project-model/units';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { removeIntent, viewRemoveIntent } from './commands-presentation';
import { sceneEntitySubject } from './commands-references';
import { createExperienceIntent, presentationUpdateIntent } from './commands-structure';
import type { ExperienceRemovalTarget } from './experience-removal';
import type { createExperienceRemovalReadings } from './experience-removal-readings';
import type { ExperienceSubject } from './experience-model';
import { readExperiencePath } from './experience-paths';
import type { PlaybackSource } from './playback.svelte';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];
type Revision = { readonly projectId: string; readonly revisionId: string };

export type ExperienceLevelPorts = {
	readonly snapshot: () => ProjectEnvelope;
	readonly current: () => Experience | null;
	readonly contextGuide: () => Experience['guides'][number] | null;
	readonly graph: () => Parameters<typeof readExperiencePath>[0]['graph'] | null;
	readonly experiences: () => readonly Experience[];
	readonly readServices: () => StageAdapterServices;
	readonly say: (kind: 'success' | 'info' | 'refusal', text: string) => void;
	readonly newId: () => string;
	readonly revision: () => Revision;
	readonly run: (builder: () => Submission, success?: (changes: readonly OperationChange[]) => string) => Promise<boolean>;
	readonly focus: {
		readonly openExperience: (experienceId: string) => void;
		readonly select: (subject: ExperienceSubject | null) => void;
		readonly openGuide: (guideId: string | null) => void;
		readonly subject: ExperienceSubject | null;
		readonly guideId: string | null;
	};
	readonly connectionPool: () => string[];
	readonly removals: () => ReturnType<typeof createExperienceRemovalReadings>;
	readonly captureNewPresentation: (entityId: string, label: string | null) => Promise<boolean>;
};

export function createExperienceLevelAuthoring(ports: ExperienceLevelPorts) {
	function lowerPlaybackSource(guideId: string): PlaybackSource | null {
		const experience = ports.current();
		const graph = ports.graph();
		if (experience === null || graph === null) return null;
		const guide = experience.guides.find((entry) => entry.id === guideId);
		if (guide === undefined) return null;
		const read = ports.readServices().stage.snapshot();
		const lowered = lowerExperienceProgram(ports.snapshot(), {
			experienceId: experience.id,
			sourceContentId: read.sourceContentId,
			sessionEpoch: read.sessionEpoch,
			guideId: guide.id
		});
		if (lowered.kind !== 'lowered') return null;
		return {
			program: lowered.program,
			transitions: lowered.transitions,
			graph,
			entryStopId: guide.stopIds[0]!
		};
	}
	const playbackSource = $derived.by((): PlaybackSource | null => {
		const guide = ports.contextGuide();
		return guide === null ? null : lowerPlaybackSource(guide.id);
	});


	async function createExperience(label?: string): Promise<boolean> {
		const experienceId = ports.newId();
		const named = label?.trim() || `Experience ${ports.experiences().length + 1}`;
		const accepted = await ports.run(() =>
			createExperienceIntent({
				revision: ports.revision(),
				ids: { operation: ports.newId(), experience: experienceId },
				label: named
			})
		);
		// Focus never names an identity the source does not carry: a refused create
		// must not point Preview at a non-existent Experience.
		if (accepted) ports.focus.openExperience(experienceId);
		return accepted;
	}


	async function presentThis(entityId: string, _label?: string): Promise<boolean> {
		return ports.captureNewPresentation(entityId, null);
	}


	async function remove(target: ExperienceRemovalTarget): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		const preview = ports.removals().removalPreview(target);
		if (preview.kind === 'refused') {
			ports.say('refusal', preview.reason);
			return false;
		}
		if (!preview.runnable) {
			ports.say('refusal', 'Choose the new Default View first.');
			return false;
		}
		const plan = ports.removals().planOf(target);
		if (plan === null || plan.kind !== 'planned') return false;
		const after = plan.experience;
		const parent = ports.removals().parentOf(target);
		// Read before the install: the route clears a subject that stops resolving.
		const selectsParent = ports.removals().removes(target, ports.focus.subject);
		const removedName =
			target.kind === 'stop'
				? ports.removals().names.stop(target.stopId)
				: target.kind === 'guide'
					? ports.removals().names.guide(target.guideId)
					: target.kind === 'presentation'
						? ports.removals().names.presentation(target.presentationId)
						: ports.removals().names.view(target.viewId);
		const ok = await ports.run(
			() =>
				target.kind === 'view'
					? viewRemoveIntent({
							envelope: ports.snapshot(),
							revision: ports.revision(),
							ids: { operation: ports.newId(), connections: ports.connectionPool() },
							experienceId: experience.id,
							presentationId: target.presentationId,
							viewId: target.viewId,
							defaultViewId: target.newDefaultViewId ?? null
						})
					: removeIntent({
							envelope: ports.snapshot(),
							revision: ports.revision(),
							ids: { operation: ports.newId(), connections: ports.connectionPool() },
							experienceId: experience.id,
							subject: target.kind,
							id: target.kind === 'stop' ? target.stopId : target.kind === 'guide' ? target.guideId : target.presentationId
						}),
			() => `${removedName} removed. ${ports.removals().remaining(target, after)}`.trim()
		);
		if (ok) {
			if (selectsParent) ports.focus.select(parent);
			if (target.kind === 'guide' && ports.focus.guideId === target.guideId) ports.focus.openGuide(null);
		}
		return ok;
	}


	function presentationSubjectName(presentationId: string): string | null {
		const reference = ports.current()?.presentations.find((entry) => entry.id === presentationId)?.subject ?? null;
		if (reference === null || reference.domain !== 'scene' || reference.subject.kind !== 'entity') return null;
		return ports.snapshot().units.scene.data.entities.find((entity) => entity.id === reference.subject.id)?.name ?? null;
	}

	function presentationDisplayName(presentationId: string): string {
		const presentation = ports.current()?.presentations.find((entry) => entry.id === presentationId) ?? null;
		if (presentation === null) return presentationId;
		return displayPresentationName(presentation, presentationSubjectName(presentationId));
	}

	function presentationLabel(presentationId: string): string {
		return presentationDisplayName(presentationId);
	}

	const linkCandidates = $derived(
		ports.snapshot().units.scene.data.entities.map((entity) => ({ id: entity.id, label: entity.name }))
	);

	async function linkPresentation(presentationId: string, entityId: string): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		if (!ports.snapshot().units.scene.data.entities.some((entity) => entity.id === entityId)) return false;
		return ports.run(
			() =>
				presentationUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					presentationId,
					subject: sceneEntitySubject(ports.snapshot(), entityId),
					label: null
				}),
			() => `Linked to ${ports.snapshot().units.scene.data.entities.find((entity) => entity.id === entityId)?.name ?? 'the object'}.`
		);
	}

	async function unlinkPresentation(presentationId: string): Promise<boolean> {
		const experience = ports.current();
		const presentation = experience?.presentations.find((entry) => entry.id === presentationId);
		if (experience === null || presentation === undefined || presentation.subject === null) return false;
		return ports.run(
			() =>
				presentationUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					presentationId,
					subject: null,
					label: presentationDisplayName(presentationId)
				}),
			() => 'Unlinked from its object.'
		);
	}

	async function followPresentation(presentationId: string): Promise<boolean> {
		const experience = ports.current();
		const presentation = experience?.presentations.find((entry) => entry.id === presentationId);
		if (experience === null || presentation === undefined || presentation.subject === null || presentation.label === null) return false;
		return ports.run(
			() =>
				presentationUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					presentationId,
					label: null
				}),
			() => 'Following the object\'s name.'
		);
	}


	return {
		get playbackSource() {
			return playbackSource;
		},
		get linkCandidates() {
			return linkCandidates;
		},
		playbackSourceFor: lowerPlaybackSource,
		createExperience,
		presentThis,
		remove,
		linkPresentation,
		unlinkPresentation,
		followPresentation,
		presentationSubjectName,
		presentationDisplayName,
		presentationLabel
	};
}
