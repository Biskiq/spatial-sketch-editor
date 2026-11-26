import type { OperationChange } from '@portfolio/project-model/f4';
import type {
	Experience,
	ExperienceGuide,
	ExperienceGuidePacing,
	ExperienceInvitation,
	ExperienceTransitionKind,
	ProjectEnvelope,
} from '@portfolio/project-model/units';
import { EXPERIENCE_STAY_MIN_SECONDS } from '@portfolio/project-model/units';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { guideUpdateIntent } from './commands-presentation';
import {
	guideCreateIntent,
	guideOrderIntent,
	stopCreateIntent,
	stopUpdateIntent,
} from './commands-structure';
import type { ExperienceSubject } from './experience-model';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];
type Revision = { readonly projectId: string; readonly revisionId: string };

export type ExperienceStopPorts = {
	readonly snapshot: () => ProjectEnvelope;
	readonly current: () => Experience | null;
	readonly currentGuide: () => ExperienceGuide | null;
	readonly contextGuide: () => ExperienceGuide | null;
	readonly selectedStop: () => { readonly id: string } | null;
	readonly say: (kind: 'success' | 'info' | 'refusal', text: string) => void;
	readonly newId: () => string;
	readonly revision: () => Revision;
	readonly run: (
		builder: () => Submission,
		success?: (changes: readonly OperationChange[]) => string,
	) => Promise<boolean>;
	readonly connectionPool: () => string[];
	readonly focus: {
		readonly openGuide: (guideId: string | null) => void;
		readonly select: (subject: ExperienceSubject) => void;
	};
};

export function createExperienceStopAuthoring(ports: ExperienceStopPorts) {
	async function addStop(
		presentationId: string,
		options: { readonly afterStopId?: string; readonly entryViewId?: string | null } = {},
	): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		if (!experience.presentations.some((entry) => entry.id === presentationId)) {
			ports.say('refusal', 'That Presentation is not in this Experience.');
			return false;
		}
		const stopId = ports.newId();
		if (experience.guides.length === 0) {
			// D-9: the first Stop creates the first Guide, named Tour, with no prompt.
			const guideId = ports.newId();
			const accepted = await ports.run(() =>
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
					label: 'Tour',
					entryViewId: options.entryViewId ?? null,
					staySeconds: null,
					transition: 'cut',
				}),
			);
			if (accepted) {
				ports.focus.openGuide(guideId);
				ports.focus.select({ kind: 'stop', stopId });
			}
			return accepted;
		}
		const guide =
			ports.currentGuide() ??
			experience.guides.find((entry) => entry.id === experience.entryGuideId) ??
			experience.guides[0]!;
		const selected = ports.selectedStop();
		const afterStopId =
			options.afterStopId !== undefined
				? options.afterStopId
				: selected !== null && guide.stopIds.includes(selected.id)
					? selected.id
					: null;
		const accepted = await ports.run(() =>
			stopCreateIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId(), stop: stopId, connections: ports.connectionPool() },
				experienceId: experience.id,
				presentationId,
				guideId: guide.id,
				afterStopId,
				entryViewId: options.entryViewId ?? null,
				staySeconds: null,
				transition: 'cut',
			}),
		);
		// A refused insert must not select a Stop the accepted source does not carry.
		if (accepted) {
			ports.focus.openGuide(guide.id);
			ports.focus.select({ kind: 'stop', stopId });
		}
		return accepted;
	}

	/** Reorders target the same Guide the instrument reads: the active one, else the entry Guide. */
	async function moveStopTo(stopId: string, index: number): Promise<boolean> {
		const experience = ports.current();
		const guide = ports.currentGuide() ?? ports.contextGuide();
		if (experience === null || guide === null) return false;
		const at = guide.stopIds.indexOf(stopId);
		if (at === -1) return false;
		const order = guide.stopIds.filter((entry) => entry !== stopId);
		const to = Math.max(0, Math.min(Math.trunc(index), order.length));
		order.splice(to, 0, stopId);
		if (order.every((entry, position) => entry === guide.stopIds[position])) return false;
		return ports.run(() =>
			guideOrderIntent({
				envelope: ports.snapshot(),
				revision: ports.revision(),
				ids: { operation: ports.newId(), connections: ports.connectionPool() },
				experienceId: experience.id,
				guideId: guide.id,
				stopIds: order,
			}),
		);
	}

	async function moveStop(stopId: string, direction: -1 | 1): Promise<boolean> {
		const guide = ports.currentGuide() ?? ports.contextGuide();
		if (guide === null) return false;
		const at = guide.stopIds.indexOf(stopId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= guide.stopIds.length) return false;
		return moveStopTo(stopId, to);
	}

	/** One captured connection id per Travel use in the Experience, plus one. */

	async function updateStop(
		stopId: string,
		fields: {
			readonly entryViewId?: string | null;
			readonly staySeconds?: number;
			readonly invitation?: ExperienceInvitation | null;
			readonly transition?: ExperienceTransitionKind | null;
		},
	): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		if (!experience.stops.some((entry) => entry.id === stopId)) return false;
		return ports.run(
			() =>
				stopUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId(), connections: ports.connectionPool() },
					experienceId: experience.id,
					stopId,
					...fields,
				}),
			() => '',
		);
	}

	/* --- One Card field per setting (sheet §32) ------------------------------- */

	/** Guide Card · Pacing: Automatic plays on after each stay; Manual waits for Next. */
	async function setGuidePacing(guideId: string, pacing: ExperienceGuidePacing): Promise<boolean> {
		const experience = ports.current();
		if (experience === null) return false;
		const guide = experience.guides.find((entry) => entry.id === guideId);
		if (guide === undefined || guide.pacing === pacing) return false;
		return ports.run(
			() =>
				guideUpdateIntent({
					envelope: ports.snapshot(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					experienceId: experience.id,
					guideId,
					pacing,
				}),
			() =>
				pacing === 'manual'
					? 'Manual: every Stop now waits for Next. Each Stop keeps its time, unused, for switching back.'
					: 'Automatic: each Stop stays for its time, then the tour moves on by itself.',
		);
	}

	/** Stop Card · Enter at: one of its Presentation's Views; the Default follows View 1. */
	async function setStopEntry(stopId: string, viewId: string | null): Promise<boolean> {
		const stop = ports.current()?.stops.find((entry) => entry.id === stopId);
		const presentation = ports
			.current()
			?.presentations.find((entry) => entry.id === stop?.presentationId);
		if (stop === undefined || presentation === undefined) return false;
		const entry = viewId;
		if (entry === stop.entryViewId) return false;
		if (entry !== null && !presentation.views.some((view) => view.viewId === entry)) return false;
		return updateStop(stopId, { entryViewId: entry });
	}

	/** Stop Card · Stay: finite seconds, at least 1 s. */
	async function setStopStay(stopId: string, seconds: number): Promise<boolean> {
		const stop = ports.current()?.stops.find((entry) => entry.id === stopId);
		if (stop === undefined) return false;
		if (!Number.isFinite(seconds) || seconds < EXPERIENCE_STAY_MIN_SECONDS) {
			ports.say('refusal', `A stay is at least ${EXPERIENCE_STAY_MIN_SECONDS} s.`);
			return false;
		}
		const rounded = Math.round(seconds * 2) / 2;
		if (rounded === stop.staySeconds) return false;
		return updateStop(stopId, { staySeconds: rounded });
	}

	/** Stop Card · Invite to explore: `null` is off; an empty prompt is the default wording. */
	async function setStopInvitation(
		stopId: string,
		invitation: { readonly prompt: string | null } | null,
	): Promise<boolean> {
		const stop = ports.current()?.stops.find((entry) => entry.id === stopId);
		if (stop === undefined) return false;
		const normalized =
			invitation === null
				? null
				: {
						prompt:
							invitation.prompt === null || invitation.prompt.trim() === ''
								? null
								: invitation.prompt.trim(),
					};
		if (JSON.stringify(normalized) === JSON.stringify(stop.invitation)) return false;
		return updateStop(stopId, { invitation: normalized });
	}

	return {
		updateStop,
		addStop,
		moveStopTo,
		moveStop,
		setGuidePacing,
		setStopEntry,
		setStopStay,
		setStopInvitation,
	};
}
