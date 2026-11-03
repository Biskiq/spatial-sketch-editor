/**
 * The Experience lens controller (R217.S24, R217.S25, R217.S26).
 *
 * The Experience homes read this controller: the shared Index, the Card's writers and
 * the lower-edge Guide and dock. It holds the reactive reading of the accepted source
 * the lens shows, the Experience commands (each one an intent built by commands.ts and
 * submitted through the host's one F.4 acceptance port), the message and busy flag, and
 * the Presentation filter.
 *
 * R217.S26 adds the structure commands (renames, additional Guides, the Opening Guide, a
 * Guide's start, View order) and the four E4 removals. A removal is previewed from the same
 * pure plan its planner installs, so the Card's consequence block names exactly what runs.
 * Back (E17) reads the focus's session history.
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
import {
	EXPERIENCE_STEP_DEFAULT_HOLD_SECONDS,
	planGuideRemoval,
	planPresentationRemoval,
	planPresentationViewRemoval,
	planStopRemoval,
	type ExperienceRemovalPlan
} from '@portfolio/project-model/units';
import type {
	Experience,
	ExperienceContinuation,
	ExperienceGuide,
	ExperienceGuidedView,
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
	stopsGuiding,
	viewFactsOf,
	type ExperienceReach,
	type GuidedViewPosition,
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
	experienceUpdateIntent,
	guideCreateIntent,
	guideOrderIntent,
	guideUpdateIntent,
	presentationUpdateIntent,
	removeIntent,
	stopCreateIntent,
	stopUpdateIntent,
	viewRemoveIntent,
	viewRenameIntent
} from './commands';
import {
	removalLines,
	type ExperienceRemovalPreview,
	type ExperienceRemovalTarget,
	type RemovalNames
} from './experience-removal';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];

export type ExperienceViewChoice = { readonly id: string; readonly label: string };

/** The outcome an inline rename field reads: accepted, or refused with the reason to show. */
export type ExperienceRenameOutcome = { readonly kind: 'accepted' | 'refused'; readonly message?: string };

/** The creator-facing refusal for an empty name (every Experience rename field). */
export const NAME_NEEDED = 'A name is needed';

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
	/** The context Guide's Stops that guide this View. */
	viewStops(viewId: string): readonly GuidedViewPosition[];
	presentationsAbout(entityId: string): readonly ExperiencePresentation[];
	reach(guide?: ExperienceGuide | null): ExperienceReach;
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
	setStopViews(stopId: string, views: readonly ExperienceGuidedView[]): Promise<boolean>;
	includeView(stopId: string, viewId: string): Promise<boolean>;
	leaveOutView(stopId: string, viewId: string): Promise<boolean>;
	setViewHold(stopId: string, viewId: string, holdSeconds: number | null): Promise<boolean>;
	moveGuidedViewTo(stopId: string, viewId: string, index: number): Promise<boolean>;
	moveGuidedView(stopId: string, viewId: string, direction: -1 | 1): Promise<boolean>;
	setExplorable(presentationId: string, explorable: boolean): Promise<boolean>;
	setWelcome(body: string): Promise<boolean>;
	/** Where Next goes. Keeps the Stop's Cut/Travel choice. */
	setContinuation(stopId: string, target: 'next' | 'end' | { readonly stopId: string }): Promise<boolean>;
	/** Cut or Travel on the continuation. Does nothing for End. */
	setTransition(stopId: string, transition: 'cut' | 'travel'): Promise<boolean>;
	/** The Card's inline rename of one Presentation's label. */
	renamePresentation(
		presentationId: string,
		label: string
	): Promise<ExperienceRenameOutcome>;
	/** An empty body clears the Presentation's text. */
	updatePresentationText(presentationId: string, body: string): Promise<boolean>;
	/** The View Card's Make default: the only place a Default View changes. */
	setDefaultView(presentationId: string, viewId: string): Promise<void>;
	/* R217.S26 — structure. Each rename refuses an empty name and adds nothing when unchanged. */
	renameExperience(label: string): Promise<ExperienceRenameOutcome>;
	renameGuide(guideId: string, label: string): Promise<ExperienceRenameOutcome>;
	renameView(viewId: string, label: string): Promise<ExperienceRenameOutcome>;
	/** The Guide Card's Make this the opening Guide. */
	makeOpeningGuide(guideId: string): Promise<boolean>;
	/** Start the tour here (E6): the context Guide's start Stop. Order is untouched. */
	setGuideStart(stopId: string): Promise<boolean>;
	/** E5: a Stop of this Presentation at the end of a chosen Guide, which becomes active. */
	addToGuide(presentationId: string, guideId: string): Promise<boolean>;
	/** E5: New Guide… — a new, active Guide with this Presentation as its Stop 1. */
	createGuide(presentationId: string, label: string): Promise<boolean>;
	/** Other Presentations that list this View, for *Also in*. */
	alsoIn(viewId: string, presentationId: string): readonly ExperiencePresentation[];
	/** A permutation of one Presentation's View order. */
	moveViewTo(presentationId: string, viewId: string, index: number): Promise<boolean>;
	moveView(presentationId: string, viewId: string, direction: -1 | 1): Promise<boolean>;
	/** The consequence block's reading of a removal, from the plan its planner installs. */
	removalPreview(target: ExperienceRemovalTarget): ExperienceRemovalPreview;
	/** Run one previewed removal; on success the parent of the removed subject is selected. */
	remove(target: ExperienceRemovalTarget): Promise<boolean>;
	/** The subject Back returns to, or null (E17). */
	readonly backTarget: ExperienceSubject | null;
	/** Back to the previous subject. It changes only what is looked at; it never undoes. */
	back(): boolean;
	/** A short name for a subject: *Stop 2*, a Presentation, View or Guide label. */
	subjectName(subject: ExperienceSubject): string;
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
	/** Success lines fade quickly; anything else (a refusal) stays long enough to read. */
	const accepted = new Set<string>(['Accepted.']);
	// Feedback is a passing line: success fades quickly, a refusal stays long enough to read.
	let messageTimer: ReturnType<typeof setTimeout> | undefined;
	function say(text: string): void {
		message = text;
		clearTimeout(messageTimer);
		const shown = text;
		messageTimer = setTimeout(() => {
			if (message === shown) message = '';
		}, accepted.has(text) ? 2400 : 6000);
	}
	let busy = $state(false);

	function newId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function revision() {
		return readServices().stage.snapshot().acceptedRevision;
	}

	/** Submit one command; `true` only when the source actually changed. `success` is the fading message. */
	async function run(builder: () => Submission, success: () => string = () => 'Accepted.'): Promise<boolean> {
		if (busy) return false;
		busy = true;
		try {
			const outcome = await readServices().authoring.accept(builder());
			if (outcome.kind === 'refused') {
				say(outcome.message);
				return false;
			}
			if (outcome.kind !== 'installed') {
				say('No change to accept.');
				return false;
			}
			say(success());
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
			say('The Stage has not evaluated a reading yet; wait for the reading to settle.');
			return null;
		}
		// Plan is orthographic: its eye/target would record a perspective View the
		// creator never saw. Capture is a 3D-reading action.
		if (evaluation.projectionKind !== 'perspective-3d') {
			say('Capture needs the 3D reading: switch to 3D, frame the View, then capture.');
			return null;
		}
		const fov = capturedFovDegrees(evaluation.projectionMatrix);
		if (fov === null) {
			say('The Stage projection is degenerate; frame the View again.');
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
			say(`${target.label} had no Default View, so this View is now its Default.`);
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
			say('That Presentation is not in this Experience.');
			return false;
		}
		const stopId = newId();
		if (experience.guides.length === 0) {
			const guideLabel = options.firstGuideLabel?.trim() ?? '';
			if (guideLabel === '') {
				say('Name the Guide first.');
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
			readonly views?: readonly ExperienceGuidedView[];
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

	const setStopViews = (stopId: string, views: readonly ExperienceGuidedView[]) => updateStop(stopId, { views });
	const guidedViews = (stopId: string) => current?.stops.find((entry) => entry.id === stopId)?.views;

	/** A View moved into the entry position no longer has an incoming step. */
	function withoutEntryTransition(views: readonly ExperienceGuidedView[]): readonly ExperienceGuidedView[] {
		const [first, ...rest] = views;
		if (first?.transition === undefined) return views;
		const { transition: _transition, ...entry } = first;
		return [entry, ...rest];
	}

	async function includeView(stopId: string, viewId: string): Promise<boolean> {
		const views = guidedViews(stopId);
		if (views === undefined || views.some((view) => view.viewId === viewId)) return false;
		return setStopViews(stopId, [...views, { viewId, holdSeconds: EXPERIENCE_STEP_DEFAULT_HOLD_SECONDS }]);
	}

	async function leaveOutView(stopId: string, viewId: string): Promise<boolean> {
		const views = guidedViews(stopId);
		if (views === undefined || !views.some((view) => view.viewId === viewId)) return false;
		if (views.length === 1) {
			say('A Stop shows at least one View');
			return false;
		}
		return setStopViews(stopId, withoutEntryTransition(views.filter((view) => view.viewId !== viewId)));
	}

	async function setViewHold(stopId: string, viewId: string, holdSeconds: number | null): Promise<boolean> {
		if (holdSeconds !== null && (!Number.isFinite(holdSeconds) || holdSeconds < 0)) {
			say('A hold is a finite number of seconds, or blank for none.');
			return false;
		}
		const views = guidedViews(stopId);
		const selected = views?.find((view) => view.viewId === viewId);
		if (views === undefined || selected === undefined || selected.holdSeconds === (holdSeconds ?? undefined)) return false;
		const { holdSeconds: _oldHold, ...view } = selected;
		const updated = holdSeconds === null ? view : { ...view, holdSeconds };
		return setStopViews(stopId, views.map((entry) => entry.viewId === viewId ? updated : entry));
	}

	async function moveGuidedViewTo(stopId: string, viewId: string, index: number): Promise<boolean> {
		const views = guidedViews(stopId);
		if (views === undefined || !Number.isInteger(index) || index < 0 || index >= views.length) return false;
		const from = views.findIndex((view) => view.viewId === viewId);
		if (from === -1 || from === index) return false;
		const order = [...views];
		const [view] = order.splice(from, 1);
		order.splice(index, 0, view!);
		return setStopViews(stopId, withoutEntryTransition(order));
	}

	async function moveGuidedView(stopId: string, viewId: string, direction: -1 | 1): Promise<boolean> {
		const index = guidedViews(stopId)?.findIndex((view) => view.viewId === viewId) ?? -1;
		return index >= 0 && moveGuidedViewTo(stopId, viewId, index + direction);
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
	function renamePresentation(presentationId: string, label: string): Promise<ExperienceRenameOutcome> {
		if (current === null) return Promise.resolve({ kind: 'refused', message: 'There is no Experience to rename a Presentation in.' });
		const experience = current;
		const presentation = experience.presentations.find((entry) => entry.id === presentationId) ?? null;
		return rename(label, presentation?.label ?? null, (trimmed) =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				presentationId,
				label: trimmed
			})
		);
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

	async function setExplorable(presentationId: string, explorable: boolean): Promise<boolean> {
		const experience = current;
		const presentation = experience?.presentations.find((entry) => entry.id === presentationId);
		if (experience === null || presentation === undefined || presentation.explorable === explorable) return false;
		return run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				presentationId,
				explorable
			})
		);
	}

	async function setWelcome(body: string): Promise<boolean> {
		const experience = current;
		const welcome = body.trim() === '' ? null : { kind: 'plain' as const, body };
		if (experience === null || (experience.welcome?.body ?? null) === (welcome?.body ?? null)) return false;
		return run(() =>
			experienceUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience.id,
				welcome
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

	/* --- R217.S26 structure ------------------------------------------------------ */

	function succeed(text: string): string {
		accepted.add(text);
		return text;
	}

	async function rename(
		label: string,
		previous: string | null,
		builder: (trimmed: string) => Submission
	): Promise<ExperienceRenameOutcome> {
		const trimmed = label.trim();
		if (trimmed === '') return { kind: 'refused', message: NAME_NEEDED };
		if (previous === null) return { kind: 'refused', message: 'That subject is no longer in this Experience.' };
		// An unchanged name is no edit, so it adds no history entry.
		if (trimmed === previous) return { kind: 'accepted' };
		const ok = await run(() => builder(trimmed), () => succeed('Renamed.'));
		return ok ? { kind: 'accepted' } : { kind: 'refused', message };
	}

	function renameExperience(label: string): Promise<ExperienceRenameOutcome> {
		const experience = current;
		return rename(label, experience?.label ?? null, (trimmed) =>
			experienceUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience!.id,
				label: trimmed
			})
		);
	}

	function renameGuide(guideId: string, label: string): Promise<ExperienceRenameOutcome> {
		const experience = current;
		const guide = experience?.guides.find((entry) => entry.id === guideId) ?? null;
		return rename(label, guide?.label ?? null, (trimmed) =>
			guideUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: experience!.id,
				guideId,
				label: trimmed
			})
		);
	}

	function renameView(viewId: string, label: string): Promise<ExperienceRenameOutcome> {
		const view = snapshot.units.camera.data.views.find((entry) => entry.id === viewId) ?? null;
		return rename(label, view?.label ?? null, (trimmed) =>
			viewRenameIntent({ envelope: snapshot, revision: revision(), ids: { operation: newId() }, view: view!, label: trimmed })
		);
	}

	async function makeOpeningGuide(guideId: string): Promise<boolean> {
		const experience = current;
		const guide = experience?.guides.find((entry) => entry.id === guideId);
		if (experience == null || guide === undefined || experience.entryGuideId === guideId) return false;
		return run(
			() =>
				experienceUpdateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId() },
					experienceId: experience.id,
					entryGuideId: guideId
				}),
			() => succeed(`The Experience now opens on ${guide.label}.`)
		);
	}

	async function setGuideStart(stopId: string): Promise<boolean> {
		const experience = current;
		const guide = contextGuide;
		if (experience === null || guide === null || !guide.stopIds.includes(stopId) || guide.entryStopId === stopId) return false;
		const position = guide.stopIds.indexOf(stopId) + 1;
		return run(
			() =>
				guideUpdateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId() },
					experienceId: experience.id,
					guideId: guide.id,
					entryStopId: stopId
				}),
			() => succeed(`The tour now starts at Stop ${position}.`)
		);
	}

	async function addToGuide(presentationId: string, guideId: string): Promise<boolean> {
		const experience = current;
		const guide = experience?.guides.find((entry) => entry.id === guideId);
		if (experience == null || guide === undefined) return false;
		const stopId = newId();
		const ok = await run(
			() =>
				stopCreateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId(), stop: stopId },
					experienceId: experience.id,
					presentationId,
					guideId,
					afterStopId: null,
					entryViewId: null,
					holdSeconds: null,
					continuation: { kind: 'sequence-next', transition: 'cut' }
				}),
			() => succeed(`Added as Stop ${guide.stopIds.length + 1} of ${guide.label}.`)
		);
		if (ok) {
			experienceFocus.openGuide(guideId);
			experienceFocus.select({ kind: 'stop', stopId });
		}
		return ok;
	}

	async function createGuide(presentationId: string, label: string): Promise<boolean> {
		const experience = current;
		const trimmed = label.trim();
		if (experience === null) return false;
		if (trimmed === '') {
			say(NAME_NEEDED);
			return false;
		}
		const guideId = newId();
		const stopId = newId();
		const ok = await run(
			() =>
				guideCreateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId(), guide: guideId, stop: stopId },
					experienceId: experience.id,
					presentationId,
					label: trimmed,
					entryViewId: null,
					holdSeconds: null,
					continuation: { kind: 'sequence-next', transition: 'cut' }
				}),
			() => succeed(`${trimmed} created with ${presentationLabel(presentationId)} as Stop 1.`)
		);
		if (ok) {
			experienceFocus.openGuide(guideId);
			experienceFocus.select({ kind: 'stop', stopId });
		}
		return ok;
	}

	function alsoIn(viewId: string, presentationId: string): readonly ExperiencePresentation[] {
		return current?.presentations.filter((entry) => entry.id !== presentationId && entry.viewIds.includes(viewId)) ?? [];
	}

	async function moveViewTo(presentationId: string, viewId: string, index: number): Promise<boolean> {
		const experience = current;
		const presentation = experience?.presentations.find((entry) => entry.id === presentationId);
		if (experience == null || presentation === undefined) return false;
		if (!presentation.viewIds.includes(viewId)) return false;
		const order = presentation.viewIds.filter((entry) => entry !== viewId);
		const to = Math.max(0, Math.min(Math.trunc(index), order.length));
		order.splice(to, 0, viewId);
		if (order.every((entry, position) => entry === presentation.viewIds[position])) return false;
		return run(
			() =>
				presentationUpdateIntent({
					envelope: snapshot,
					revision: revision(),
					ids: { operation: newId() },
					experienceId: experience.id,
					presentationId,
					viewIds: order
				}),
			() => succeed(`View moved to position ${to + 1}.`)
		);
	}

	async function moveView(presentationId: string, viewId: string, direction: -1 | 1): Promise<boolean> {
		const presentation = current?.presentations.find((entry) => entry.id === presentationId);
		if (presentation === undefined) return false;
		const at = presentation.viewIds.indexOf(viewId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= presentation.viewIds.length) return false;
		return moveViewTo(presentationId, viewId, to);
	}

	/** Names as the creator reads them: Stops by their position in the context Guide. */
	const names: RemovalNames = {
		stop: (stopId) => {
			const at = contextGuide?.stopIds.indexOf(stopId) ?? -1;
			if (at !== -1) return `Stop ${at + 1}`;
			const stop = current?.stops.find((entry) => entry.id === stopId);
			return stop === undefined ? 'a Stop' : `a Stop of ${presentationLabel(stop.presentationId)}`;
		},
		presentation: (presentationId) => presentationLabel(presentationId),
		view: (viewId) => snapshot.units.camera.data.views.find((entry) => entry.id === viewId)?.label ?? viewId,
		guide: (guideId) => current?.guides.find((entry) => entry.id === guideId)?.label ?? 'the Guide'
	};

	function planOf(target: ExperienceRemovalTarget): ExperienceRemovalPlan | null {
		const experience = current;
		if (experience === null) return null;
		const experiencesNow = snapshot.units.experience.data.experiences;
		const camera = snapshot.units.camera.data;
		switch (target.kind) {
			case 'stop':
				return planStopRemoval(experience, target.stopId);
			case 'guide':
				return planGuideRemoval(experience, target.guideId);
			case 'presentation':
				return planPresentationRemoval(experiencesNow, camera, experience.id, target.presentationId);
			case 'view':
				return planPresentationViewRemoval(
					experiencesNow,
					camera,
					experience.id,
					target.presentationId,
					target.viewId,
					target.newDefaultViewId ?? null
				);
		}
	}

	function removalPreview(target: ExperienceRemovalTarget): ExperienceRemovalPreview {
		const plan = planOf(target);
		if (plan === null) return { kind: 'refused', reason: 'There is no Experience to remove from.' };
		if (plan.kind === 'refused' && plan.code === 'default-needed' && target.kind === 'view') {
			const presentation = current?.presentations.find((entry) => entry.id === target.presentationId);
			const options = (presentation?.viewIds ?? [])
				.filter((viewId) => viewId !== target.viewId)
				.map((viewId) => ({ id: viewId, label: names.view(viewId) }));
			return {
				kind: 'ready',
				lines: [
					`Removes ${names.view(target.viewId)} from ${names.presentation(target.presentationId)}.`,
					'It is the Default View: choose the new Default.'
				],
				chooseDefault: options,
				runnable: false
			};
		}
		if (plan.kind === 'refused') return { kind: 'refused', reason: plan.reason };
		const isDefault =
			target.kind === 'view' &&
			current?.presentations.find((entry) => entry.id === target.presentationId)?.defaultViewId === target.viewId;
		return {
			kind: 'ready',
			lines: removalLines(target, plan.consequences, names),
			chooseDefault:
				isDefault && target.kind === 'view'
					? (current?.presentations.find((entry) => entry.id === target.presentationId)?.viewIds ?? [])
							.filter((viewId) => viewId !== target.viewId)
							.map((viewId) => ({ id: viewId, label: names.view(viewId) }))
					: null,
			runnable: true
		};
	}

	/** The parent a removal selects (E4: removing the selected subject selects its parent). */
	function parentOf(target: ExperienceRemovalTarget): ExperienceSubject | null {
		if (target.kind === 'view') return { kind: 'presentation', presentationId: target.presentationId };
		if (target.kind === 'stop' && contextGuide !== null && contextGuide.stopIds.length > 1) {
			return { kind: 'guide', guideId: contextGuide.id };
		}
		return null;
	}

	/** Whether the subject is (or hangs from) what a removal takes away. */
	function removes(target: ExperienceRemovalTarget, subject: ExperienceSubject | null): boolean {
		if (subject === null) return false;
		switch (target.kind) {
			case 'stop':
				return (subject.kind === 'stop' || subject.kind === 'transition') && subject.stopId === target.stopId;
			case 'guide':
				return subject.kind === 'guide' && subject.guideId === target.guideId;
			case 'presentation':
				return (subject.kind === 'presentation' || subject.kind === 'view') && subject.presentationId === target.presentationId;
			case 'view':
				return subject.kind === 'view' && subject.viewId === target.viewId && subject.presentationId === target.presentationId;
		}
	}

	async function remove(target: ExperienceRemovalTarget): Promise<boolean> {
		const experience = current;
		if (experience === null) return false;
		const preview = removalPreview(target);
		if (preview.kind === 'refused') {
			say(preview.reason);
			return false;
		}
		if (!preview.runnable) {
			say('Choose the new Default View first.');
			return false;
		}
		const plan = planOf(target);
		if (plan === null || plan.kind !== 'planned') return false;
		const after = plan.experience;
		const parent = parentOf(target);
		// Read before the install: the route clears a subject that stops resolving.
		const selectsParent = removes(target, experienceFocus.subject);
		const removedName =
			target.kind === 'stop'
				? names.stop(target.stopId)
				: target.kind === 'guide'
					? names.guide(target.guideId)
					: target.kind === 'presentation'
						? names.presentation(target.presentationId)
						: names.view(target.viewId);
		const ok = await run(
			() =>
				target.kind === 'view'
					? viewRemoveIntent({
							envelope: snapshot,
							revision: revision(),
							ids: { operation: newId() },
							experienceId: experience.id,
							presentationId: target.presentationId,
							viewId: target.viewId,
							defaultViewId: target.newDefaultViewId ?? null
						})
					: removeIntent({
							envelope: snapshot,
							revision: revision(),
							ids: { operation: newId() },
							experienceId: experience.id,
							subject: target.kind,
							id: target.kind === 'stop' ? target.stopId : target.kind === 'guide' ? target.guideId : target.presentationId
						}),
			() => succeed(`${removedName} removed. ${remaining(target, after)}`.trim())
		);
		if (ok) {
			if (selectsParent) experienceFocus.select(parent);
			if (target.kind === 'guide' && experienceFocus.guideId === target.guideId) experienceFocus.openGuide(null);
		}
		return ok;
	}

	/** What remains after a removal, read from the plan the planner installs. */
	function remaining(target: ExperienceRemovalTarget, after: Experience): string {
		switch (target.kind) {
			case 'stop': {
				const guide = after.guides.find((entry) => entry.id === contextGuide?.id);
				return guide === undefined ? '' : `${guide.label} has ${guide.stopIds.length} ${guide.stopIds.length === 1 ? 'Stop' : 'Stops'}.`;
			}
			case 'guide':
				return after.guides.length === 0
					? 'No Guide yet.'
					: `${after.guides.length} ${after.guides.length === 1 ? 'Guide remains' : 'Guides remain'}.`;
			case 'presentation':
				return `${after.presentations.length} ${after.presentations.length === 1 ? 'Presentation remains' : 'Presentations remain'}.`;
			case 'view': {
				const presentation = after.presentations.find((entry) => entry.id === target.presentationId);
				return presentation === undefined
					? ''
					: `${presentation.label} has ${presentation.viewIds.length} ${presentation.viewIds.length === 1 ? 'View' : 'Views'}.`;
			}
		}
	}

	/** Whether a subject still names something in the current Experience. */
	function resolves(candidate: ExperienceSubject): boolean {
		const experience = current;
		if (experience === null) return false;
		switch (candidate.kind) {
			case 'presentation':
				return experience.presentations.some((entry) => entry.id === candidate.presentationId);
			case 'view':
				return experience.presentations.some(
					(entry) => entry.id === candidate.presentationId && entry.viewIds.includes(candidate.viewId)
				);
			case 'stop':
			case 'transition':
				return experience.stops.some((entry) => entry.id === candidate.stopId);
			case 'guide':
				return experience.guides.some((entry) => entry.id === candidate.guideId);
		}
	}

	const backTarget = $derived.by(() => {
		void subject;
		return experienceFocus.previous(resolves);
	});

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
			case 'guide':
				return names.guide(candidate.guideId);
		}
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
		viewStops: (viewId: string) => (current === null ? [] : stopsGuiding(current, contextGuide, viewId)),
		presentationsAbout: (entityId: string) =>
			current === null ? [] : presentationsAboutEntity(current, entityId),
		reach: (guide = contextGuide) =>
			current === null
				? { presentations: 0, views: 0, freePresentations: 0, freeViews: 0, viewsOnlyFree: 0, hiddenViews: 0 }
				: reachSummary(current, guide),
		createExperience,
		capture,
		presentThis,
		addStop,
		moveStopTo,
		moveStop,
		setStopViews,
		includeView,
		leaveOutView,
		setViewHold,
		moveGuidedViewTo,
		moveGuidedView,
		setExplorable,
		setWelcome,
		setContinuation,
		setTransition,
		renamePresentation,
		updatePresentationText,
		setDefaultView,
		renameExperience,
		renameGuide,
		renameView,
		makeOpeningGuide,
		setGuideStart,
		addToGuide,
		createGuide,
		alsoIn,
		moveViewTo,
		moveView,
		removalPreview,
		remove,
		get backTarget() {
			return backTarget;
		},
		back: () => experienceFocus.back(resolves),
		subjectName
	};
}
