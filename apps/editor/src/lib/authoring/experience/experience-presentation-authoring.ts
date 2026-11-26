import type { OperationChange } from '@portfolio/project-model/f4';
import type {
	Experience,
	ExperienceGuide,
	ExperiencePresentation,
	ExperiencePresentationView,
	ExperienceTransitionKind,
	ProjectEnvelope,
} from '@portfolio/project-model/units';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { guideUpdateIntent, viewRenameIntent } from './commands-presentation';
import {
	experienceUpdateIntent,
	guideCreateIntent,
	presentationUpdateIntent,
	stopCreateIntent,
} from './commands-structure';
import type { ExperienceSubject } from './experience-model';
import { resolvePathOccurrence } from './experience-paths';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];
type Revision = { readonly projectId: string; readonly revisionId: string };
export type ExperienceRenameOutcome = {
	readonly kind: 'accepted' | 'refused';
	readonly message?: string;
};

export type ExperiencePresentationPorts = {
	readonly snapshot: () => ProjectEnvelope;
	readonly current: () => Experience | null;
	readonly contextGuide: () => ExperienceGuide | null;
	readonly feedback: () => string;
	readonly setDraftLabel: (label: string) => void;
	readonly nameNeeded: string;
	readonly say: (kind: 'success' | 'info' | 'refusal', text: string) => void;
	readonly newId: () => string;
	readonly revision: () => Revision;
	readonly run: (
		builder: () => Submission,
		success?: (changes: readonly OperationChange[]) => string,
	) => Promise<boolean>;
	readonly connectionPool: () => string[];
	readonly updateStop: (
		stopId: string,
		fields: { readonly transition?: ExperienceTransitionKind | null },
	) => Promise<boolean>;
	readonly focus: {
		readonly openGuide: (guideId: string | null) => void;
		readonly select: (subject: ExperienceSubject) => void;
	};
	readonly presentationDisplayName: (presentationId: string) => string;
	readonly presentationLabel: (presentationId: string) => string;
};

export function createExperiencePresentationAuthoring(ports: ExperiencePresentationPorts) {
	async function writePresentationViews(
		presentationId: string,
		views: readonly ExperiencePresentationView[],
		message: () => string = () => '',
	): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		const presentation = experience.presentations.find((entry) => entry.id === presentationId);
		if (presentation === undefined) return false;
		// A step belongs to the View it leaves (A-1), and the last View has none (D-12).
		const normalize = (list: readonly ExperiencePresentationView[]) =>
			list.map((view, index) =>
				index === list.length - 1 || view.transition === undefined
					? { viewId: view.viewId }
					: { viewId: view.viewId, transition: view.transition },
			);
		const normalized = normalize(views);
		if (JSON.stringify(normalized) === JSON.stringify(normalize(presentation.views))) {
			return false;
		}
		return ports.run(
			() =>
				presentationUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId(), connections: ports.connectionPool() },
					experienceId: experience.id,
					presentationId,
					views: normalized,
				}),
			message,
		);
	}

	/** Set one outgoing step; reconciliation adds any required Camera path atomically. */
	async function setPresentationStep(
		presentationId: string,
		toIndex: number,
		kind: 'cut' | 'travel',
	): Promise<boolean> {
		const presentation = ports
			.current()
			?.presentations.find((entry) => entry.id === presentationId);
		if (
			presentation === undefined ||
			!Number.isInteger(toIndex) ||
			toIndex <= 0 ||
			toIndex >= presentation.views.length
		)
			return false;
		const views = presentation.views.map((view, index) =>
			index === toIndex - 1 ? { viewId: view.viewId, transition: kind } : view,
		);
		return writePresentationViews(
			presentationId,
			views,
			() => `${kind === 'travel' ? 'Travel' : 'Cut'}. Exploring adds no Guide time.`,
		);
	}

	/**
	 * Presentation Card · reorder (drag, or Alt+↑↓). Each View keeps the Cut/Travel
	 * it leaves by; moving a View to the top makes it the Default, and Stops without
	 * their own entry follow it.
	 */
	async function movePresentationView(
		presentationId: string,
		viewId: string,
		index: number,
	): Promise<boolean> {
		const presentation = ports
			.current()
			?.presentations.find((entry) => entry.id === presentationId);
		if (
			presentation === undefined ||
			!Number.isInteger(index) ||
			index < 0 ||
			index >= presentation.views.length
		)
			return false;
		const from = presentation.views.findIndex((view) => view.viewId === viewId);
		if (from === -1 || from === index) return false;
		const order = [...presentation.views];
		const [moved] = order.splice(from, 1);
		order.splice(index, 0, moved!);
		const label = (id: string) =>
			ports.snapshot().units.camera.data.views.find((view) => view.id === id)?.label ?? id;
		return writePresentationViews(presentationId, order, () =>
			index === 0
				? `${label(viewId)} is now View 1, the Default. Stops without their own entry follow it.`
				: from === 0
					? `${label(viewId)} moves to ${index + 1}; ${label(order[0]!.viewId)} becomes the Default.`
					: `${label(viewId)} moves to ${index + 1}. New neighbours keep their Cut or Travel.`,
		);
	}

	/**
	 * Cut or Travel to the next Stop in the context Guide. The last Stop has no next
	 * Stop, so it has no outgoing step at all (D-12); a Travel between two Stops that
	 * enter the same View is refused and stays a Cut (D-7).
	 */
	async function setTransition(stopId: string, transition: 'cut' | 'travel'): Promise<boolean> {
		const experience = ports.current();
		const stop = experience?.stops.find((entry) => entry.id === stopId);
		const guide = ports.contextGuide();
		if (experience === null || stop === undefined || guide === null) return false;
		const at = guide.stopIds.indexOf(stopId);
		if (at === -1 || at === guide.stopIds.length - 1) return false;
		if ((stop.transition ?? 'cut') === transition) return false;
		// A Travel between two Stops that enter the same View stays a Cut, and a
		// Travel's straight path is added by reconciliation in the same change.
		const resolved =
			transition === 'travel'
				? resolvePathOccurrence(experience, guide, { kind: 'transition', stopId })
				: null;
		if (transition === 'travel' && (resolved === null || resolved.fromViewId === resolved.toViewId))
			return false;
		return ports.updateStop(stopId, { transition });
	}

	/**
	 * The Card's inline rename of a Presentation: one label edit through the same
	 * acceptance port every edit uses, so the rename is one accepted result.
	 */
	function renamePresentation(
		presentationId: string,
		label: string,
	): Promise<ExperienceRenameOutcome> {
		const experience = ports.current();
		if (experience === null)
			return Promise.resolve({
				kind: 'refused',
				message: 'There is no Experience to rename a Presentation in.',
			});
		const presentation =
			experience.presentations.find((entry) => entry.id === presentationId) ?? null;
		return rename(
			label,
			presentation === null ? null : ports.presentationDisplayName(presentationId),
			(trimmed) =>
				presentationUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					presentationId,
					label: trimmed,
				}),
		);
	}

	async function updatePresentationText(presentationId: string, body: string): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		return ports.run(() =>
			presentationUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				experienceId: experience.id,
				presentationId,
				text: body === '' ? null : { kind: 'plain', body },
			}),
		);
	}

	async function setExplorable(presentationId: string, explorable: boolean): Promise<boolean> {
		const experience = ports.current();
		const presentation = experience?.presentations.find((entry) => entry.id === presentationId);
		if (experience === null || presentation === undefined || presentation.explorable === explorable)
			return false;
		return ports.run(() =>
			presentationUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				experienceId: experience.id,
				presentationId,
				explorable,
			}),
		);
	}

	async function setWelcome(body: string): Promise<boolean> {
		const experience = ports.current();
		const welcome = body.trim() === '' ? null : { kind: 'plain' as const, body };
		if (experience === null || (experience.welcome?.body ?? null) === (welcome?.body ?? null))
			return false;
		return ports.run(() =>
			experienceUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				experienceId: experience.id,
				welcome,
			}),
		);
	}

	/** Make default moves the View to the top of the list: View 1 is the Default. */
	async function setDefaultView(presentationId: string, viewId: string): Promise<void> {
		await movePresentationView(presentationId, viewId, 0);
	}

	/* --- Structure -------------------------------------------------------------- */

	async function rename(
		label: string,
		previous: string | null,
		builder: (trimmed: string) => Submission,
	): Promise<ExperienceRenameOutcome> {
		const trimmed = label.trim();
		if (trimmed === '') return { kind: 'refused', message: ports.nameNeeded };
		if (previous === null)
			return { kind: 'refused', message: 'That subject is no longer in this Experience.' };
		// An unchanged name is no edit, so it adds no history entry.
		if (trimmed === previous) return { kind: 'accepted' };
		const ok = await ports.run(
			() => builder(trimmed),
			() => '',
		);
		return ok
			? { kind: 'accepted' }
			: { kind: 'refused', message: ports.feedback() ?? "That change didn't go through." };
	}

	function renameExperience(label: string): Promise<ExperienceRenameOutcome> {
		const experience = ports.current();
		// The draft is not saved yet: its name is kept here until the first step creates it.
		if (experience === null) {
			const trimmed = label.trim();
			if (trimmed === '')
				return Promise.resolve({ kind: 'refused', message: 'A name cannot be empty.' });
			ports.setDraftLabel(trimmed);
			return Promise.resolve({ kind: 'accepted' });
		}
		return rename(label, experience?.label ?? null, (trimmed) =>
			experienceUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				experienceId: experience!.id,
				label: trimmed,
			}),
		);
	}

	function renameGuide(guideId: string, label: string): Promise<ExperienceRenameOutcome> {
		const experience = ports.current();
		const guide = experience?.guides.find((entry) => entry.id === guideId) ?? null;
		return rename(label, guide?.label ?? null, (trimmed) =>
			guideUpdateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				experienceId: experience!.id,
				guideId,
				label: trimmed,
			}),
		);
	}

	function renameView(viewId: string, label: string): Promise<ExperienceRenameOutcome> {
		const view =
			ports.snapshot().units.camera.data.views.find((entry) => entry.id === viewId) ?? null;
		return rename(label, view?.label ?? null, (trimmed) =>
			viewRenameIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId() },
				view: view!,
				label: trimmed,
			}),
		);
	}

	async function makeOpeningGuide(guideId: string): Promise<boolean> {
		const experience = ports.current();
		const guide = experience?.guides.find((entry) => entry.id === guideId);
		if (experience == null || guide === undefined || experience.entryGuideId === guideId)
			return false;
		return ports.run(
			() =>
				experienceUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					entryGuideId: guideId,
				}),
			() => `The Experience now opens on ${guide.label}.`,
		);
	}

	async function addToGuide(
		presentationId: string,
		guideId: string,
		entryViewId: string | null = null,
	): Promise<boolean> {
		const experience = ports.current();
		const guide = experience?.guides.find((entry) => entry.id === guideId);
		if (experience == null || guide === undefined) return false;
		const stopId = ports.newId();
		const ok = await ports.run(
			() =>
				stopCreateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId(), stop: stopId },
					experienceId: experience.id,
					presentationId,
					guideId,
					afterStopId: null,
					entryViewId,
					staySeconds: null,
					transition: 'cut',
				}),
			() => `Added as Stop ${guide.stopIds.length + 1} of ${guide.label}.`,
		);
		if (ok) {
			ports.focus.openGuide(guideId);
			ports.focus.select({ kind: 'stop', stopId });
		}
		return ok;
	}

	async function createGuide(
		presentationId: string,
		entryViewId: string | null = null,
	): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		const used = new Set(experience.guides.map((guide) => guide.label.trim().toLowerCase()));
		let n = experience.guides.length + 1;
		let label = n === 1 ? 'Tour' : `Tour ${n}`;
		while (used.has(label.toLowerCase())) {
			n += 1;
			label = `Tour ${n}`;
		}
		const guideId = ports.newId();
		const stopId = ports.newId();
		const ok = await ports.run(
			() =>
				guideCreateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: {
						operation: ports.newId(),
						guide: guideId,
						stop: stopId,
						connections: ports.connectionPool(),
					},
					experienceId: experience.id,
					presentationId,
					label,
					entryViewId,
					staySeconds: null,
					transition: 'cut',
				}),
			() => `${label} created with ${ports.presentationLabel(presentationId)} as Stop 1.`,
		);
		if (ok) {
			ports.focus.openGuide(guideId);
			ports.focus.select({ kind: 'stop', stopId });
		}
		return ok;
	}

	function alsoIn(viewId: string, presentationId: string): readonly ExperiencePresentation[] {
		return (
			ports
				.current()
				?.presentations.filter(
					(entry) =>
						entry.id !== presentationId && entry.views.some((view) => view.viewId === viewId),
				) ?? []
		);
	}

	async function moveViewTo(
		presentationId: string,
		viewId: string,
		index: number,
	): Promise<boolean> {
		const presentation = ports
			.current()
			?.presentations.find((entry) => entry.id === presentationId);
		if (presentation === undefined) return false;
		const to = Math.max(0, Math.min(Math.trunc(index), presentation.views.length - 1));
		return movePresentationView(presentationId, viewId, to);
	}

	async function moveView(
		presentationId: string,
		viewId: string,
		direction: -1 | 1,
	): Promise<boolean> {
		const presentation = ports
			.current()
			?.presentations.find((entry) => entry.id === presentationId);
		if (presentation === undefined) return false;
		const at = presentation.views.findIndex((view) => view.viewId === viewId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= presentation.views.length) return false;
		return movePresentationView(presentationId, viewId, to);
	}

	return {
		setPresentationStep,
		movePresentationView,
		setTransition,
		renamePresentation,
		updatePresentationText,
		setExplorable,
		setWelcome,
		setDefaultView,
		renameExperience,
		renameGuide,
		renameView,
		makeOpeningGuide,
		addToGuide,
		createGuide,
		alsoIn,
		moveViewTo,
		moveView,
	};
}
