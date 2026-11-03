/**
 * The Experience lens controller (R217.S24, R217.S25).
 *
 * The Experience homes read this controller: the shared Index, the Card's writers and
 * the lower-edge Guide and dock. It holds the reactive reading of the accepted source
 * the lens shows, the Experience commands (each one an intent built by commands.ts and
 * submitted through the host's one F.4 acceptance port), the message and busy flag, and
 * the Presentation filter.
 *
 * It is not an authority. Focus stays in focus.svelte.ts, the one writable owner of what
 * the lens works on (one Card subject, D10); the readings stay in experience-model.ts;
 * travel gaps stay in travel-gap.ts; every intent stays in commands.ts. The controller
 * has no DOM access and never touches the Stage selection or the Camera.
 *
 * `readServices` and `readSnapshot` are getters, because the route can replace either
 * without unmounting the lens. The controller starts effects, so the surface must
 * create it during component initialisation.
 */
import { untrack } from 'svelte';
import { perfMark } from '$lib/platform/perf-marks';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { stageEnvelope } from '../stage/unit-stage-source';
import type {
	Experience,
	ExperienceContinuation,
	ExperienceGuide,
	ExperiencePresentation,
	ExperienceStop,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import { experienceFocus } from './focus.svelte';
import {
	guideStopsOf,
	presentationsAboutEntity,
	reachSummary,
	resolveContinuation as resolveStopContinuation,
	stopsEnteringAt,
	viewFactsOf,
	type ExperienceReach,
	type ExperienceSubject,
	type ExperienceViewFacts,
	type ResolvedContinuation
} from './experience-model';
import { travelGapMessagesByStop } from './travel-gap';
import {
	captureBindIntent,
	capturedFovDegrees,
	capturedViewPose,
	createExperienceIntent,
	guideCreateIntent,
	guideOrderIntent,
	presentationUpdateIntent,
	stopCreateIntent,
	stopUpdateIntent
} from './commands';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];

export type ExperienceViewChoice = { readonly id: string; readonly label: string };

export type ExperienceController = {
	readonly experiences: readonly Experience[];
	readonly current: Experience | null;
	/** The active Guide (context, not a selection). */
	readonly currentGuide: ExperienceGuide | null;
	readonly guides: readonly ExperienceGuide[];
	/** The one Card subject, or null. */
	readonly subject: ExperienceSubject | null;
	/** The subject's Presentation: a Presentation subject, or a View subject's. */
	readonly selectedPresentation: ExperiencePresentation | null;
	readonly selectedView: ExperienceViewFacts | null;
	/** The subject's Stop: a Stop subject, or a transition subject's source Stop. */
	readonly selectedStop: ExperienceStop | null;
	/** Travel gaps of the selected Stop's outgoing edge. */
	readonly travelGaps: readonly string[];
	/** Travel gaps by Stop, from one validation of the snapshot. A Stop without a gap is absent. */
	readonly travelGapsByStop: ReadonlyMap<string, readonly string[]>;
	readonly stopUsage: ReadonlyMap<string, readonly string[]>;
	/**
	 * The Guide the tour reads use (B): the active Guide, else the Experience's entry Guide.
	 * `currentGuide` stays the instrument's and the Index's open chip's; this one answers "where
	 * does a Stop sit" before any Guide is opened, so no Presentation reads as free for it.
	 */
	readonly contextGuide: ExperienceGuide | null;
	/** The context Guide's Stops in order. */
	readonly guideStops: readonly ExperienceStop[];
	readonly viewsOf: ReadonlyMap<string, readonly ExperienceViewChoice[]>;
	readonly filteredPresentations: readonly ExperiencePresentation[];
	readonly message: string;
	readonly busy: boolean;
	/** The Presentation filter the lens's search field writes. */
	query: string;
	presentationLabel(presentationId: string): string;
	/** Select the one Card subject (or clear it). Nothing here touches the Stage selection. */
	select(subject: ExperienceSubject | null): void;
	/** Focus an Experience the lens's selector names. */
	openExperience(experienceId: string): void;
	/** Make a Guide of the current Experience the active one. It selects nothing. */
	openGuide(guideId: string): void;
	viewFacts(viewId: string): ExperienceViewFacts | null;
	/** Where a Stop's continuation goes, read against the context Guide (D11). */
	resolveContinuation(stopId: string): ResolvedContinuation | null;
	/** The context Guide's Stops that enter at this View, with 1-based positions. */
	viewStops(viewId: string): readonly { readonly stopId: string; readonly position: number }[];
	presentationsAbout(entityId: string): readonly ExperiencePresentation[];
	reach(): ExperienceReach;
	createExperience(): Promise<void>;
	/**
	 * Dock Capture (D1, D2): the current 3D viewpoint into the subject's Presentation,
	 * keeping its Default View, else a new standpoint Presentation. Never adds a Stop.
	 */
	capture(): Promise<boolean>;
	/** Subject Card Present this: a new Presentation about this Scene entity, from the 3D framing, no Stop. */
	presentThis(entityId: string, label: string): Promise<boolean>;
	/**
	 * D8: the first Guide (needs `firstGuideLabel`) or a Stop in the active Guide.
	 * `afterStopId` undefined: after the selected Stop when it is in the Guide, else at the end.
	 */
	addStop(
		presentationId: string,
		options?: { readonly afterStopId?: string; readonly firstGuideLabel?: string }
	): Promise<boolean>;
	/** A guide-order permutation of the active Guide. */
	moveStopTo(stopId: string, index: number): Promise<boolean>;
	moveStop(stopId: string, direction: -1 | 1): Promise<boolean>;
	/** null follows the Presentation's Default. */
	setStopEntry(stopId: string, entryViewId: string | null): Promise<boolean>;
	setStopHold(stopId: string, holdSeconds: number | null): Promise<boolean>;
	/** Where Next goes. Keeps the Stop's Cut/Travel choice. */
	setContinuation(stopId: string, target: 'next' | 'end' | { readonly stopId: string }): Promise<boolean>;
	/** Cut or Travel on the continuation. Does nothing for End. */
	setTransition(stopId: string, transition: 'cut' | 'travel'): Promise<boolean>;
	/** The Card's inline rename of one Presentation's label. */
	renamePresentation(
		presentationId: string,
		label: string
	): Promise<{ readonly kind: 'accepted' | 'refused'; readonly message?: string }>;
	/** An empty body clears the Presentation's text. */
	updatePresentationText(presentationId: string, body: string): Promise<boolean>;
	/** The View Card's Make default: the only place a Default View changes. */
	setDefaultView(presentationId: string, viewId: string): Promise<void>;
};

export function createExperienceController(
	readServices: () => StageAdapterServices,
	readSnapshot: () => ProjectEnvelope | null
): ExperienceController {
	let version = $state(0);
	$effect(() => {
		const off = readServices().stage.onAdaptersChanged(() => (version += 1));
		return off;
	});
	const snapshot = $derived.by((): ProjectEnvelope => {
		void version;
		return readSnapshot() ?? stageEnvelope(readServices().stage.snapshot());
	});

	const experiences = $derived(snapshot.units.experience.data.experiences);
	const current = $derived.by((): Experience | null => {
		const focused = experienceFocus.experienceId;
		return experiences.find((entry) => entry.id === focused) ?? experiences[0] ?? null;
	});
	// Adopt the first Experience as focus, never create one implicitly.
	$effect(() => {
		if (experienceFocus.experienceId === null && current !== null) {
			untrack(() => (experienceFocus.experienceId = current!.id));
		}
	});
	const guides = $derived(current?.guides ?? []);
	const currentGuide = $derived.by(() => {
		if (current === null || experienceFocus.guideId === null) return null;
		return current.guides.find((guide) => guide.id === experienceFocus.guideId) ?? null;
	});
	const subject = $derived(experienceFocus.subject);
	const selectedPresentation = $derived.by(() => {
		if (current === null || subject === null) return null;
		if (subject.kind !== 'presentation' && subject.kind !== 'view') return null;
		return current.presentations.find((entry) => entry.id === subject.presentationId) ?? null;
	});
	const selectedView = $derived.by((): ExperienceViewFacts | null => {
		if (current === null || subject === null || subject.kind !== 'view') return null;
		return viewFactsOf(current, snapshot.units.camera.data.views, subject.viewId, subject.presentationId);
	});
	const selectedStop = $derived.by(() => {
		if (current === null || subject === null) return null;
		if (subject.kind !== 'stop' && subject.kind !== 'transition') return null;
		return current.stops.find((entry) => entry.id === subject.stopId) ?? null;
	});
	// One validation per snapshot, shared by every Stop card and the Transition Card.
	const travelGapsByStop = $derived.by(() =>
		current === null ? new Map<string, readonly string[]>() : travelGapMessagesByStop(snapshot, current.id)
	);
	const travelGaps = $derived(selectedStop === null ? [] : travelGapsByStop.get(selectedStop.id) ?? []);
	const stopUsage = $derived.by(() => {
		const usage = new Map<string, string[]>();
		for (const stop of current?.stops ?? []) {
			usage.set(stop.presentationId, [...(usage.get(stop.presentationId) ?? []), stop.id]);
		}
		return usage;
	});
	// The tour reads (B) fall back to the entry Guide until a Guide is opened; writes keep `currentGuide`.
	const contextGuide = $derived.by((): ExperienceGuide | null => {
		if (currentGuide !== null) return currentGuide;
		if (current === null) return null;
		return current.guides.find((guide) => guide.id === current.entryGuideId) ?? null;
	});
	const guideStops = $derived(current === null ? [] : guideStopsOf(current, contextGuide));
	let query = $state('');
	const viewsOf = $derived.by(() => {
		const views = snapshot.units.camera.data.views;
		const byPresentation = new Map<string, ExperienceViewChoice[]>();
		for (const presentation of current?.presentations ?? []) {
			byPresentation.set(
				presentation.id,
				presentation.viewIds.map((viewId) => ({
					id: viewId,
					label: views.find((view) => view.id === viewId)?.label ?? viewId
				}))
			);
		}
		return byPresentation;
	});
	// A Presentation matches by its own label or by any View's label (the Index placeholder says so).
	const filteredPresentations = $derived.by(() => {
		if (current === null) return [];
		const needle = query.trim().toLowerCase();
		if (needle === '') return current.presentations;
		return current.presentations.filter(
			(entry) =>
				entry.label.toLowerCase().includes(needle) ||
				(viewsOf.get(entry.id) ?? []).some((view) => view.label.toLowerCase().includes(needle))
		);
	});

	let message = $state('');
	let busy = $state(false);

	function newId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function revision() {
		return readServices().stage.snapshot().acceptedRevision;
	}

	/** Submit one command; `true` only when the source actually changed. */
	async function run(builder: () => Submission): Promise<boolean> {
		if (busy) return false;
		busy = true;
		try {
			const outcome = await readServices().authoring.accept(builder());
			if (outcome.kind === 'refused') {
				message = `${outcome.code}: ${outcome.message}`;
				return false;
			}
			if (outcome.kind !== 'installed') {
				message = 'No change to accept.';
				return false;
			}
			message = 'Accepted.';
			return true;
		} finally {
			busy = false;
		}
	}

	async function createExperience(): Promise<void> {
		const experienceId = newId();
		const accepted = await run(() =>
			createExperienceIntent({
				revision: revision(),
				ids: { operation: newId(), experience: experienceId },
				label: `Experience ${experiences.length + 1}`
			})
		);
		// Focus never names an identity the source does not carry: a refused create
		// must not point Preview at a non-existent Experience.
		if (accepted) experienceFocus.openExperience(experienceId);
	}

	function currentCapturePose() {
		const evaluation = readServices().stage.evaluation();
		if (evaluation === null) {
			message = 'The Stage has not evaluated a reading yet; wait for the reading to settle.';
			return null;
		}
		// Plan is orthographic: its eye/target would record a perspective View the
		// creator never saw. Capture is a 3D-reading action.
		if (evaluation.projectionKind !== 'perspective-3d') {
			message = 'Capture needs the 3D reading: switch to 3D, frame the View, then capture.';
			return null;
		}
		const fov = capturedFovDegrees(evaluation.projectionMatrix);
		if (fov === null) {
			message = 'The Stage projection is degenerate; frame the View again.';
			return null;
		}
		return capturedViewPose({
			label: `View ${snapshot.units.camera.data.views.length + 1}`,
			eye: evaluation.eye,
			target: evaluation.target,
			fov
		});
	}

	/**
	 * A new Presentation from the current 3D framing: View + Presentation in one accepted
	 * install. It binds the given Scene entity or none, and never a Guide or a Stop.
	 */
	async function captureNewPresentation(
		subjectEntityId: string | null,
		presentationLabelText: string | null
	): Promise<boolean> {
		if (current === null) return false;
		const view = currentCapturePose();
		if (view === null) return false;
		const experience = current;
		const presentationId = newId();
		const accepted = await run(() =>
			captureBindIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId(), presentation: presentationId },
				experienceId: experience.id,
				view,
				presentationLabel: presentationLabelText ?? `Presentation ${experience.presentations.length + 1}`,
				subjectEntityId,
				text: null,
				guideId: null,
				firstGuideLabel: null,
				afterStopId: null
			})
		);
		if (accepted) {
			experienceFocus.select({ kind: 'presentation', presentationId });
			// Measurement anchor for the capture/bind → Preview entry row.
			perfMark('experience:capture-accepted', { firstGuide: false });
		}
		return accepted;
	}

	/**
	 * Dock Capture (D1, D2). Into the visibly selected Presentation (or the one a selected
	 * View belongs to) when there is one: the new View is appended and the Presentation's
	 * Default is sent back unchanged, because planning applies `view` (which makes the new
	 * View the Default) and then `defaultViewId`. A Presentation with no Default takes the
	 * new View as its Default, and the message says so. Otherwise a new standpoint
	 * Presentation with no subject and no Stop.
	 */
	async function capture(): Promise<boolean> {
		if (current === null) return false;
		const target = selectedPresentation;
		if (target === null) return captureNewPresentation(null, null);
		const view = currentCapturePose();
		if (view === null) return false;
		const experience = current;
		const keptDefault = target.defaultViewId;
		const accepted = await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId() },
				experienceId: experience.id,
				presentationId: target.id,
				view,
				...(keptDefault === null ? {} : { defaultViewId: keptDefault })
			})
		);
		if (accepted && keptDefault === null) {
			message = `${target.label} had no Default View, so this View is now its Default.`;
		}
		return accepted;
	}

	async function presentThis(entityId: string, label: string): Promise<boolean> {
		return captureNewPresentation(entityId, label);
	}

	async function addStop(
		presentationId: string,
		options: { readonly afterStopId?: string; readonly firstGuideLabel?: string } = {}
	): Promise<boolean> {
		if (current === null) return false;
		const experience = current;
		if (!experience.presentations.some((entry) => entry.id === presentationId)) {
			message = 'That Presentation is not in this Experience.';
			return false;
		}
		const stopId = newId();
		if (experience.guides.length === 0) {
			const guideLabel = options.firstGuideLabel?.trim() ?? '';
			if (guideLabel === '') {
				message = 'Name the Guide first.';
				return false;
			}
			const guideId = newId();
			const accepted = await run(() =>
				guideCreateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId(), guide: guideId, stop: stopId },
					experienceId: experience.id,
					presentationId,
					label: guideLabel,
					entryViewId: null,
					holdSeconds: null,
					continuation: { kind: 'sequence-next', transition: 'cut' }
				})
			);
			if (accepted) {
				experienceFocus.openGuide(guideId);
				experienceFocus.select({ kind: 'stop', stopId });
			}
			return accepted;
		}
		const guide =
			currentGuide ??
			experience.guides.find((entry) => entry.id === experience.entryGuideId) ??
			experience.guides[0]!;
		const afterStopId =
			options.afterStopId !== undefined
				? options.afterStopId
				: selectedStop !== null && guide.stopIds.includes(selectedStop.id)
					? selectedStop.id
					: null;
		const accepted = await run(() =>
			stopCreateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), stop: stopId },
				experienceId: experience.id,
				presentationId,
				guideId: guide.id,
				afterStopId,
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		// A refused insert must not select a Stop the accepted source does not carry.
		if (accepted) {
			experienceFocus.openGuide(guide.id);
			experienceFocus.select({ kind: 'stop', stopId });
		}
		return accepted;
	}

	/** Reorders target the same Guide the instrument reads: the active one, else the entry Guide. */
	async function moveStopTo(stopId: string, index: number): Promise<boolean> {
		const guide = currentGuide ?? contextGuide;
		if (current === null || guide === null) return false;
		const experience = current;
		const at = guide.stopIds.indexOf(stopId);
		if (at === -1) return false;
		const order = guide.stopIds.filter((entry) => entry !== stopId);
		const to = Math.max(0, Math.min(Math.trunc(index), order.length));
		order.splice(to, 0, stopId);
		if (order.every((entry, position) => entry === guide.stopIds[position])) return false;
		return run(() =>
			guideOrderIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				guideId: guide.id,
				stopIds: order
			})
		);
	}

	async function moveStop(stopId: string, direction: -1 | 1): Promise<boolean> {
		const guide = currentGuide ?? contextGuide;
		if (guide === null) return false;
		const at = guide.stopIds.indexOf(stopId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= guide.stopIds.length) return false;
		return moveStopTo(stopId, to);
	}

	/**
	 * One Stop edit that sends only the changed field: planning keeps every omitted field
	 * and clears one with an explicit null.
	 */
	async function updateStop(
		stopId: string,
		fields: {
			readonly entryViewId?: string | null;
			readonly holdSeconds?: number | null;
			readonly continuation?: ExperienceContinuation | null;
		}
	): Promise<boolean> {
		if (current === null) return false;
		const experience = current;
		if (!experience.stops.some((entry) => entry.id === stopId)) return false;
		return run(() =>
			stopUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				stopId,
				...fields
			})
		);
	}

	const setStopEntry = (stopId: string, entryViewId: string | null) => updateStop(stopId, { entryViewId });

	async function setStopHold(stopId: string, holdSeconds: number | null): Promise<boolean> {
		if (holdSeconds !== null && (!Number.isFinite(holdSeconds) || holdSeconds < 0)) {
			message = 'A hold is a finite number of seconds, or blank for none.';
			return false;
		}
		return updateStop(stopId, { holdSeconds });
	}

	/** The Cut/Travel choice a continuation carries; End carries none. */
	function transitionOf(continuation: ExperienceContinuation | undefined) {
		return continuation === undefined || continuation.kind === 'end' ? undefined : continuation.transition;
	}

	async function setContinuation(
		stopId: string,
		target: 'next' | 'end' | { readonly stopId: string }
	): Promise<boolean> {
		const stop = current?.stops.find((entry) => entry.id === stopId);
		if (stop === undefined) return false;
		const transition = transitionOf(stop.continuation);
		const carried = transition === undefined ? {} : { transition };
		const continuation: ExperienceContinuation =
			target === 'end'
				? { kind: 'end' }
				: target === 'next'
					? { kind: 'sequence-next', ...carried }
					: { kind: 'stop', stopId: target.stopId, ...carried };
		return updateStop(stopId, { continuation });
	}

	/** Cut or Travel needs a next Stop: an End continuation, explicit or on the Guide's last Stop, has none. */
	async function setTransition(stopId: string, transition: 'cut' | 'travel'): Promise<boolean> {
		const stop = current?.stops.find((entry) => entry.id === stopId);
		if (current === null || stop === undefined) return false;
		const existing = stop.continuation;
		// Explicit End is narrowed here; the implicit one (the Guide's last Stop) is read through the Guide.
		if (existing?.kind === 'end' || resolveStopContinuation(current, contextGuide, stopId)?.kind === 'end') {
			return false;
		}
		const continuation: ExperienceContinuation =
			existing === undefined ? { kind: 'sequence-next', transition } : { ...existing, transition };
		return updateStop(stopId, { continuation });
	}

	/**
	 * The Card's inline rename of a Presentation: one label edit through the same
	 * acceptance port every edit uses, so the rename is one accepted result.
	 */
	async function renamePresentation(
		presentationId: string,
		label: string
	): Promise<{ readonly kind: 'accepted' | 'refused'; readonly message?: string }> {
		if (current === null) return { kind: 'refused', message: 'There is no Experience to rename a Presentation in.' };
		const experience = current;
		const accepted = await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				presentationId,
				label
			})
		);
		return accepted ? { kind: 'accepted' } : { kind: 'refused', message };
	}

	async function updatePresentationText(presentationId: string, body: string): Promise<boolean> {
		if (current === null) return false;
		const experience = current;
		return run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				presentationId,
				text: body === '' ? null : { kind: 'plain', body }
			})
		);
	}

	async function setDefaultView(presentationId: string, viewId: string): Promise<void> {
		if (current === null) return;
		const experience = current;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				presentationId,
				defaultViewId: viewId
			})
		);
	}

	function presentationLabel(presentationId: string): string {
		return current?.presentations.find((entry) => entry.id === presentationId)?.label ?? presentationId;
	}

	function openGuide(guideId: string): void {
		// Focus never names a Guide the source does not carry.
		if (current?.guides.some((entry) => entry.id === guideId)) experienceFocus.openGuide(guideId);
	}

	return {
		get experiences() {
			return experiences;
		},
		get current() {
			return current;
		},
		get currentGuide() {
			return currentGuide;
		},
		get contextGuide() {
			return contextGuide;
		},
		get guides() {
			return guides;
		},
		get subject() {
			return subject;
		},
		get selectedPresentation() {
			return selectedPresentation;
		},
		get selectedView() {
			return selectedView;
		},
		get selectedStop() {
			return selectedStop;
		},
		get travelGaps() {
			return travelGaps;
		},
		get travelGapsByStop() {
			return travelGapsByStop;
		},
		get stopUsage() {
			return stopUsage;
		},
		get guideStops() {
			return guideStops;
		},
		get viewsOf() {
			return viewsOf;
		},
		get filteredPresentations() {
			return filteredPresentations;
		},
		get message() {
			return message;
		},
		get busy() {
			return busy;
		},
		get query() {
			return query;
		},
		set query(next: string) {
			query = next;
		},
		presentationLabel,
		select: (next: ExperienceSubject | null) => experienceFocus.select(next),
		openExperience: (experienceId: string) => experienceFocus.openExperience(experienceId),
		openGuide,
		viewFacts: (viewId: string) =>
			current === null ? null : viewFactsOf(current, snapshot.units.camera.data.views, viewId),
		resolveContinuation: (stopId: string) =>
			current === null ? null : resolveStopContinuation(current, contextGuide, stopId),
		viewStops: (viewId: string) => (current === null ? [] : stopsEnteringAt(current, contextGuide, viewId)),
		presentationsAbout: (entityId: string) =>
			current === null ? [] : presentationsAboutEntity(current, entityId),
		reach: () =>
			current === null
				? { presentations: 0, views: 0, viewsOnlyFree: 0 }
				: reachSummary(current, contextGuide),
		createExperience,
		capture,
		presentThis,
		addStop,
		moveStopTo,
		moveStop,
		setStopEntry,
		setStopHold,
		setContinuation,
		setTransition,
		renamePresentation,
		updatePresentationText,
		setDefaultView
	};
}
