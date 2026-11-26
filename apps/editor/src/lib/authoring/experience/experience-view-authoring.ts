import type { OperationChange } from '@portfolio/project-model/f4';
import type {
	Experience,
	ExperiencePresentation,
	ProjectEnvelope,
} from '@portfolio/project-model/units';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { viewUpdateIntent } from './commands-presentation';
import { capturedFovDegrees, capturedViewPose, type CapturedViewPose } from './commands-references';
import { captureBindIntent, presentationUpdateIntent } from './commands-structure';
import type { ExperienceSubject } from './experience-model';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];
type Revision = { readonly projectId: string; readonly revisionId: string };

export type ExperienceViewPorts = {
	readonly snapshot: () => ProjectEnvelope;
	readonly current: () => Experience | null;
	readonly selectedPresentation: () => ExperiencePresentation | null;
	readonly datumMeters: () => number;
	readonly draftLabel: () => string;
	readonly resetDraftLabel: () => void;
	readonly feedback: () => string;
	readonly say: (kind: 'success' | 'info' | 'refusal', text: string) => void;
	readonly newId: () => string;
	readonly revision: () => Revision;
	readonly run: (
		builder: () => Submission,
		success?: (changes: readonly OperationChange[]) => string,
	) => Promise<boolean>;
	readonly focus: {
		readonly openExperience: (experienceId: string) => void;
		readonly select: (subject: ExperienceSubject) => void;
	};
	readonly readServices: () => StageAdapterServices;
	readonly perfMark: (name: string, data?: Record<string, unknown>) => void;
	readonly alsoIn: (viewId: string, presentationId: string) => readonly ExperiencePresentation[];
	readonly presentationDisplayName: (presentationId: string) => string;
};

/** One exact authored View pose, as the Stage's Camera reads it. */
export type ExperienceViewPose = {
	readonly eye: [number, number, number];
	readonly target: [number, number, number];
	readonly fov: number;
};

export type ExperiencePlacement =
	| {
			readonly kind: 'placed';
			readonly presentationId: string;
			readonly viewId: string;
			readonly createdPresentation: boolean;
	  }
	| { readonly kind: 'refused'; readonly message: string };

export type ExperienceViewUpdate =
	| { readonly kind: 'updated' }
	| { readonly kind: 'needs-confirmation'; readonly alsoIn: readonly string[] }
	| { readonly kind: 'refused'; readonly message: string };

export function createExperienceViewAuthoring(ports: ExperienceViewPorts) {
	function stepExperience(): {
		readonly id: string;
		readonly presentations: number;
		readonly newLabel: string | null;
	} {
		const experience = ports.current();
		return experience === null
			? { id: ports.newId(), presentations: 0, newLabel: ports.draftLabel() }
			: { id: experience.id, presentations: experience.presentations.length, newLabel: null };
	}

	function currentCapturePose() {
		const evaluation = ports.readServices().stage.evaluation();
		if (evaluation === null) {
			ports.say(
				'refusal',
				'The Stage has not evaluated a reading yet; wait for the reading to settle.',
			);
			return null;
		}
		// Plan is orthographic: its eye/target would record a perspective View the
		// creator never saw. Capture is a 3D-reading action.
		if (evaluation.projectionKind !== 'perspective-3d') {
			ports.say(
				'refusal',
				'Capture needs the 3D reading: switch to 3D, frame the View, then capture.',
			);
			return null;
		}
		const fov = capturedFovDegrees(evaluation.projectionMatrix);
		if (fov === null) {
			ports.say('refusal', 'The Stage projection is degenerate; frame the View again.');
			return null;
		}
		return capturedViewPose({
			label: `View ${ports.snapshot().units.camera.data.views.length + 1}`,
			eye: evaluation.eye,
			target: evaluation.target,
			fov,
		});
	}

	/**
	 * A new Presentation from the ports.current() 3D framing: View + Presentation in one accepted
	 * install. It binds the given Scene entity or none, and never a Guide or a Stop.
	 */
	async function captureNewPresentation(
		subjectEntityId: string | null,
		presentationLabelText: string | null,
		exactPose: CapturedViewPose | null = null,
	): Promise<boolean> {
		const view = exactPose ?? currentCapturePose();
		if (view === null) return false;
		const experience = stepExperience();
		const presentationId = ports.newId();
		const accepted = await ports.run(() =>
			captureBindIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId(), view: ports.newId(), presentation: presentationId },
				experienceId: experience.id,
				view,
				presentationLabel:
					presentationLabelText ??
					(subjectEntityId === null ? `Presentation ${experience.presentations + 1}` : null),
				subjectEntityId,
				text: null,
				guideId: null,
				afterStopId: null,
				newExperienceLabel: experience.newLabel,
			}),
		);
		if (accepted) {
			if (experience.newLabel !== null) {
				ports.focus.openExperience(experience.id);
				ports.resetDraftLabel();
			}
			ports.focus.select({ kind: 'presentation', presentationId });
			// Measurement anchor for the capture/bind → Preview entry row.
			ports.perfMark('experience:capture-accepted', { firstGuide: false });
		}
		return accepted;
	}

	/**
	 * Dock Capture. Into the visibly selected Presentation (or the one a selected
	 * View belongs to) when there is one: the new View is appended, joined by a Cut, and
	 * the Default (View 1) is unchanged. A Presentation with no View takes it as its
	 * Default, and the message says so. Otherwise a new standpoint Presentation with no
	 * subject and no Stop.
	 */
	async function captureView(view: CapturedViewPose): Promise<boolean> {
		const target = ports.selectedPresentation();
		const experience = ports.current();
		if (experience === null || target === null) return captureNewPresentation(null, null, view);
		const hadDefault = target.views.length > 0;
		const accepted = await ports.run(() =>
			presentationUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId(), view: ports.newId() },
				experienceId: experience.id,
				presentationId: target.id,
				view,
			}),
		);
		if (accepted && !hadDefault) {
			ports.say('info', `${target.label} had no Default View, so this View is now its Default.`);
		}
		return accepted;
	}

	async function capture(): Promise<boolean> {
		const view = currentCapturePose();
		if (view === null) return false;
		return captureView(view);
	}

	function viewLabel(): string {
		return `View ${ports.snapshot().units.camera.data.views.length + 1}`;
	}

	async function capturePose(pose: {
		readonly eye: readonly [number, number, number];
		readonly target: readonly [number, number, number];
		readonly fov: number;
	}): Promise<boolean> {
		return captureView(
			capturedViewPose({ label: viewLabel(), eye: pose.eye, target: pose.target, fov: pose.fov }),
		);
	}

	async function presentThisFramed(
		entityId: string,
		_label: string,
		pose: {
			readonly eye: readonly [number, number, number];
			readonly target: readonly [number, number, number];
			readonly fov: number;
		},
	): Promise<boolean> {
		// G24: the Presentation follows the object's live name; the copied label is gone.
		return captureNewPresentation(
			entityId,
			null,
			capturedViewPose({ label: viewLabel(), eye: pose.eye, target: pose.target, fov: pose.fov }),
		);
	}

	async function placeView(pose: {
		readonly eye: readonly [number, number, number];
		readonly target: readonly [number, number, number];
		readonly fov: number;
	}): Promise<ExperiencePlacement> {
		const viewId = ports.newId();
		const view = capturedViewPose({
			label: viewLabel(),
			eye: pose.eye,
			target: pose.target,
			fov: pose.fov,
		});
		const target = ports.selectedPresentation();
		const focused = ports.current();
		if (focused !== null && target !== null) {
			const accepted = await ports.run(
				() =>
					presentationUpdateIntent({
						envelope: ports.snapshot(),
						revision: ports.revision(),
						ids: { operation: ports.newId(), view: viewId },
						experienceId: focused.id,
						presentationId: target.id,
						view,
					}),
				() => '',
			);
			if (!accepted) return { kind: 'refused', message: ports.feedback() ?? '' };
			ports.focus.select({ kind: 'view', viewId, presentationId: target.id });
			return { kind: 'placed', presentationId: target.id, viewId, createdPresentation: false };
		}
		const presentationId = ports.newId();
		const experience = stepExperience();
		const accepted = await ports.run(
			() =>
				captureBindIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId(), view: viewId, presentation: presentationId },
					experienceId: experience.id,
					view,
					presentationLabel: `Presentation ${experience.presentations + 1}`,
					subjectEntityId: null,
					text: null,
					guideId: null,
					afterStopId: null,
					newExperienceLabel: experience.newLabel,
				}),
			() => '',
		);
		if (!accepted) return { kind: 'refused', message: ports.feedback() ?? '' };
		if (experience.newLabel !== null) {
			ports.focus.openExperience(experience.id);
			ports.resetDraftLabel();
		}
		ports.focus.select({ kind: 'presentation', presentationId });
		return { kind: 'placed', presentationId, viewId, createdPresentation: true };
	}

	async function updateViewPose(
		viewId: string,
		pose: {
			readonly eye: readonly [number, number, number];
			readonly target: readonly [number, number, number];
			readonly fov: number;
		},
		presentationId: string,
		options: { readonly confirmShared?: boolean } = {},
	): Promise<ExperienceViewUpdate> {
		const view = ports
			.snapshot()
			.units.camera.data.views.find((candidate) => candidate.id === viewId);
		if (view === undefined) return { kind: 'refused', message: 'That View is not in this project' };
		const shared = ports.alsoIn(viewId, presentationId);
		if (shared.length > 0 && options.confirmShared !== true) {
			return {
				kind: 'needs-confirmation',
				alsoIn: shared.map((presentation) => ports.presentationDisplayName(presentation.id)),
			};
		}
		const accepted = await ports.run(
			() =>
				viewUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					view,
					eye: pose.eye,
					target: pose.target,
					fov: pose.fov,
				}),
			() =>
				shared.length > 0
					? `View updated; it also changes ${shared.map((entry) => entry.label).join(', ')}.`
					: '',
		);
		return accepted ? { kind: 'updated' } : { kind: 'refused', message: ports.feedback() ?? '' };
	}

	async function setViewFraming(
		viewId: string,
		framing: { readonly fov?: number; readonly eyeHeightMetres?: number },
	): Promise<boolean> {
		const view = ports
			.snapshot()
			.units.camera.data.views.find((candidate) => candidate.id === viewId);
		if (view === undefined) {
			ports.say('refusal', 'That View is not in this project.');
			return false;
		}
		const eye: [number, number, number] = [view.eye[0], view.eye[1], view.eye[2]];
		const target: [number, number, number] = [view.target[0], view.target[1], view.target[2]];
		let fov = view.fov;
		if (framing.fov !== undefined) {
			if (!Number.isFinite(framing.fov) || framing.fov <= 0 || framing.fov >= 180) {
				ports.say('refusal', 'That lens is not a supported field of view.');
				return false;
			}
			fov = framing.fov;
		}
		if (framing.eyeHeightMetres !== undefined) {
			if (!Number.isFinite(framing.eyeHeightMetres)) {
				ports.say('refusal', 'That eye height is not a number.');
				return false;
			}
			const delta = ports.datumMeters() + framing.eyeHeightMetres - view.eye[1];
			eye[1] += delta;
			target[1] += delta;
		}
		return ports.run(
			() =>
				viewUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					view,
					eye,
					target,
					fov,
				}),
			() => '',
		);
	}

	return {
		stepExperience,
		currentCapturePose,
		captureNewPresentation,
		captureView,
		capture,
		viewLabel,
		capturePose,
		presentThisFramed,
		placeView,
		updateViewPose,
		setViewFraming,
	};
}
