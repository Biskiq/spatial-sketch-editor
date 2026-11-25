/**
 * The Experience lens controller.
 *
 * The Experience homes read this controller: the shared Index, the Card's writers and
 * the lower-edge Guide and dock. It holds the reactive reading of the accepted source
 * the lens shows, the Experience commands (each one an intent built by commands.ts and
 * submitted through the host's one F.4 acceptance port), the message and busy flag, and
 * the Presentation filter.
 *
 * It also owns the structure commands (renames, additional Guides, the Opening Guide, a
 * Guide's start, View order) and the four removals. A removal is previewed from the same
 * pure plan its planner installs, so the Card's consequence block names exactly what runs.
 * Back reads the focus's session history.
 *
 * It is not an authority. Focus stays in focus.svelte.ts, the one writable owner of what
 * the lens works on (one Card subject); the readings stay in experience-model.ts;
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
	CameraView,
	Experience,
	ExperienceGuide,
	ExperienceGuidePacing,
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
	stopEntryViewId,
	stopsGuiding,
	viewFactsOf,
	type ExperienceReach,
	type GuidedViewPosition,
	type ExperienceSubject,
	type ExperienceViewFacts,
	type ResolvedContinuation
} from './experience-model';
import { travelGapMessagesByStop } from './experience-problems';
import {
	readExperiencePath,
	type ExperiencePathOccurrence,
	type ExperiencePathRead
} from './experience-paths';
import type { OperationChange } from '@portfolio/project-model/f4';
import {
	type ExperienceRemovalPreview,
	type ExperienceRemovalTarget,
} from './experience-removal';
import type { PlaybackSource } from './playback.svelte';
import { createExperienceRemovalReadings } from './experience-removal-readings';
import {
	createExperienceViewAuthoring,
	type ExperiencePlacement,
	type ExperienceViewPose,
	type ExperienceViewUpdate
} from './experience-view-authoring';
import { createExperienceStopAuthoring } from './experience-stop-authoring';
import { createExperienceCameraSession } from './experience-camera-session.svelte';
import { createExperiencePresentationAuthoring } from './experience-presentation-authoring';
import { createExperienceLevelAuthoring } from './experience-level-authoring.svelte';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];

export type ExperienceViewChoice = { readonly id: string; readonly label: string };

/**
 * What a passing line is. The kind is carried by the write that
 * produced it, never inferred from the text: a success, an informational notice
 * and a refusal are three different things and are styled as three.
 */
export type ExperienceFeedbackKind = 'success' | 'info' | 'refusal';
export type ExperienceFeedback = { readonly kind: ExperienceFeedbackKind; readonly text: string };

/** The outcome an inline rename field reads: accepted, or refused with the reason to show. */
/** The ready draft's name until the creator renames it (Experience review 1). */
export const DRAFT_EXPERIENCE_LABEL = 'Untitled experience';

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
	/** The Guided move whose Camera path the Path action edits; session state, never selection authority. */
	readonly pathOccurrence: ExperiencePathOccurrence | null;
	/** The one derived Camera path read of `pathOccurrence`, or null. */
	readonly selectedPath: ExperiencePathRead | null;
	/** Derive one occurrence's path for the Guide's connectors and shot list. */
	pathFor(occurrence: ExperiencePathOccurrence): ExperiencePathRead | null;
	/** Path is an armed Stage mode; only Plan inserts and drags. Session state. */
	/** The selected interior point of the selected path, or null. */
	readonly selectedAnchorId: string | null;
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
	/** The passing line: success, info or refusal, never guessed from its words. */
	readonly feedback: ExperienceFeedback | null;
	readonly busy: boolean;
	/** The Presentation filter the lens's search field writes. */
	query: string;
	presentationLabel(presentationId: string): string;
	/** The Presentation's own name, or the linked Scene entity's live name. */
	presentationDisplayName(presentationId: string): string;
	/** The linked Scene entity's live name, or null when unlinked. */
	presentationSubjectName(presentationId: string): string | null;
	/** Scene entities the About picker can link this Presentation to. */
	readonly linkCandidates: readonly { readonly id: string; readonly label: string }[];
	/** Link to a Scene entity and follow its live name. */
	linkPresentation(presentationId: string, entityId: string): Promise<boolean>;
	/** Store the current effective name as the own name and unlink. */
	unlinkPresentation(presentationId: string): Promise<boolean>;
	/** Resume following a linked Scene entity's live name. */
	followPresentation(presentationId: string): Promise<boolean>;
	/** Select the one Card subject (or clear it). Nothing here touches the Stage selection. */
	select(subject: ExperienceSubject | null): void;
	/** Focus an Experience the lens's selector names. */
	openExperience(experienceId: string): void;
	/** Make a Guide of the current Experience the active one. It selects nothing. */
	openGuide(guideId: string): void;
	viewFacts(viewId: string): ExperienceViewFacts | null;
	/** Where a Stop's continuation goes, read against the context Guide. */
	resolveContinuation(stopId: string): ResolvedContinuation | null;
	/** The context Guide's Stops that guide this View. */
	viewStops(viewId: string): readonly GuidedViewPosition[];
	presentationsAbout(entityId: string): readonly ExperiencePresentation[];
	reach(guide?: ExperienceGuide | null): ExperienceReach;
	/** Create and open an empty Experience; the label defaults to *Experience n*. */
	createExperience(label?: string): Promise<boolean>;
	/**
	 * Experience review 1 (ready draft): with no Experience yet the lens shows an
	 * unsaved draft under this name. Its first Capture, Present this or Place a View
	 * creates the Experience in the same accepted change.
	 */
	readonly draftLabel: string;
	/**
	 * Dock Capture: the current 3D viewpoint into the subject's Presentation,
	 * keeping its Default View, else a new standpoint Presentation. Never adds a Stop.
	 */
	capture(): Promise<boolean>;
	/** Subject Card Present this: a new Presentation about this Scene entity, from the 3D framing, no Stop. */
	presentThis(entityId: string, label: string): Promise<boolean>;
	/**
	 * D-9: with no Guide, the first Stop creates Tour automatically. `entryViewId` is the View
	 * the Stop enters at. `afterStopId` undefined: after the selected Stop when it is in the
	 * Guide, else at the end.
	 */
	addStop(
		presentationId: string,
		options?: { readonly afterStopId?: string; readonly entryViewId?: string | null }
	): Promise<boolean>;
	/** A guide-order permutation of the active Guide. */
	moveStopTo(stopId: string, index: number): Promise<boolean>;
	moveStop(stopId: string, direction: -1 | 1): Promise<boolean>;
	/** Guide Card · Pacing (sheet §31, §32). */
	setGuidePacing(guideId: string, pacing: ExperienceGuidePacing): Promise<boolean>;
	/** Stop Card · Enter at: a View of its Presentation; `null` follows the Default. */
	setStopEntry(stopId: string, viewId: string | null): Promise<boolean>;
	/** Stop Card · Stay: at least 1 s; Manual keeps it unused. */
	setStopStay(stopId: string, seconds: number): Promise<boolean>;
	/** Stop Card · Invite to explore: `null` is off. */
	setStopInvitation(stopId: string, invitation: { readonly prompt: string | null } | null): Promise<boolean>;
	/** Presentation Card spine: Cut or Travel into View `toIndex`, as one Undo. */
	setPresentationStep(presentationId: string, toIndex: number, kind: 'cut' | 'travel'): Promise<boolean>;
	/** Presentation Card reorder: View 1 is the Default. */
	movePresentationView(presentationId: string, viewId: string, index: number): Promise<boolean>;
	setExplorable(presentationId: string, explorable: boolean): Promise<boolean>;
	setWelcome(body: string): Promise<boolean>;
	/** Cut or Travel to the next Stop in its Guide. The last Stop has no step. */
	setTransition(stopId: string, transition: 'cut' | 'travel'): Promise<boolean>;
	/** Choose the occurrence the Path action reads; step occurrences live inside a Stop. */
	selectPath(occurrence: ExperiencePathOccurrence | null): void;
	/** Experience review 1 — the World's saved environment preset. */
	/** Choose the World's environment: one accepted Scene change, one Undo. */
	selectAnchor(anchorId: string | null): void;
	/** Add the one Camera path a Travel needs; never for a Cut. */
	createPath(occurrence: ExperiencePathOccurrence): Promise<boolean>;
	previewPathDrag(anchorId: string | null, point: readonly [number, number, number], origin: readonly [number, number, number]): ExperiencePathRead['samples'] | null;
	/**
	 * Insert an interior point at a validated canonical slot in authored order.
	 * Omitted, the slot is derived from Camera's own directed curve progress.
	 */
	addPathAnchor(point: readonly [number, number, number], slot?: number, near?: readonly [number, number, number]): Promise<boolean>;
	movePathAnchor(anchorId: string, point: readonly [number, number, number]): Promise<boolean>;
	removePathAnchor(anchorId: string): Promise<boolean>;
	straightenPath(): Promise<boolean>;
	/** A positive finite duration, or null for Camera's automatic duration. */
	setPathDuration(seconds: number | null): Promise<boolean>;
	/** The Card's inline rename of one Presentation's label. */
	renamePresentation(
		presentationId: string,
		label: string
	): Promise<ExperienceRenameOutcome>;
	/** An empty body clears the Presentation's text. */
	updatePresentationText(presentationId: string, body: string): Promise<boolean>;
	/** The View Card's Make default: the only place a Default View changes. */
	setDefaultView(presentationId: string, viewId: string): Promise<void>;
	/* Structure. Each rename refuses an empty name and adds nothing when unchanged. */
	renameExperience(label: string): Promise<ExperienceRenameOutcome>;
	renameGuide(guideId: string, label: string): Promise<ExperienceRenameOutcome>;
	renameView(viewId: string, label: string): Promise<ExperienceRenameOutcome>;
	/** The Guide Card's Make this the opening Guide. */
	makeOpeningGuide(guideId: string): Promise<boolean>;
	/** A Stop of this Presentation at the end of a chosen Guide, which becomes active. */
	addToGuide(presentationId: string, guideId: string): Promise<boolean>;
	/** New Guide… — a new, active Guide with this Presentation as its Stop 1. */
	createGuide(presentationId: string, entryViewId?: string | null): Promise<boolean>;
	/** Other Presentations that list this View, for *Also in*. */
	alsoIn(viewId: string, presentationId: string): readonly ExperiencePresentation[];
	/** A permutation of one Presentation's View order. */
	moveViewTo(presentationId: string, viewId: string, index: number): Promise<boolean>;
	moveView(presentationId: string, viewId: string, direction: -1 | 1): Promise<boolean>;
	/** The consequence block's reading of a removal, from the plan its planner installs. */
	removalPreview(target: ExperienceRemovalTarget): ExperienceRemovalPreview;
	/** Run one previewed removal; on success the parent of the removed subject is selected. */
	remove(target: ExperienceRemovalTarget): Promise<boolean>;
	/** The accepted Camera Views; the Stage's marks and Look-through read them here. */
	readonly cameraViews: readonly CameraView[];
	/** The accepted source content identity: a snapshot cache key, never an authored value. */
	readonly sourceRevision: string;
	/** The one lowered program + Camera graph playback reads; null when lowering refuses. */
	readonly playbackSource: PlaybackSource | null;
	/** The accepted source for an explicit Guide, independent of the open Guide. */
	playbackSourceFor(guideId: string): PlaybackSource | null;
	/** The Guide that lists a Stop, preferring the active Guide. */
	guideForStop(stopId: string): string | null;
	viewPose(viewId: string): ExperienceViewPose | null;
	/** Lens and Eye height steps write the exact Camera View. */
	setViewFraming(
		viewId: string,
		framing: { readonly fov?: number; readonly eyeHeightMetres?: number }
	): Promise<boolean>;
	/** Place a View in the selected Presentation, else a new one. Never adds a Stop. */
	placeView(pose: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number }): Promise<ExperiencePlacement>;
	/** Update View from Look through; a shared View needs its named consequence confirmed. */
	updateViewPose(
		viewId: string,
		pose: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number },
		presentationId: string,
		options?: { readonly confirmShared?: boolean }
	): Promise<ExperienceViewUpdate>;
	/** Capture an exact provisional pose as a new View, without reading the painted frame. */
	capturePose(pose: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number }): Promise<boolean>;
	/** Present this, after Camera has visibly framed the subject. */
	presentThisFramed(
		entityId: string,
		label: string,
		pose: { readonly eye: readonly [number, number, number]; readonly target: readonly [number, number, number]; readonly fov: number }
	): Promise<boolean>;
	/** The subject Back returns to, or null. */
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
	/** The Floor datum the accepted Stage read carries; eye heights are relative to it. */
	const datumMeters = $derived.by(() => {
		void version;
		// A host read always carries its domain; a controller-only test double may not.
		return readServices().stage.snapshot().domain?.datumMeters ?? 0;
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
	let draftLabel = $state(DRAFT_EXPERIENCE_LABEL);
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
		return viewFactsOf(current, snapshot.units.camera.data.views, subject.viewId, subject.presentationId, datumMeters);
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
	// The Path action's occurrence and its one derived Camera read. The
	// occurrence is a selection *within* the Card subject, never a second authority.
	// One accepted read supplies both the canonical Camera graph and the compiled
	// Layout geometry; never rebuild either for a derived path.
	const acceptedDomain = $derived.by(() => {
		void version;
		return readServices().stage.snapshot().domain ?? null;
	});
	const acceptedGeometry = $derived(acceptedDomain?.geometry ?? null);
	const acceptedGraph = $derived(acceptedDomain?.graph ?? null);
	// The one lowered program the timeline/playback reads. It is the
	// same lowering Preview and the visitor use, never a second topology.
	const paths = createExperienceCameraSession({
		experience: () => current,
		guide: () => contextGuide,
		graph: () => acceptedGraph,
		geometry: () => acceptedGeometry,
		envelope: () => snapshot,
		say: (kind, text) => say(kind, text),
		newId,
		revision,
		run
	});

	const level = createExperienceLevelAuthoring({
		snapshot: () => snapshot,
		current: () => current,
		contextGuide: () => contextGuide,
		graph: () => acceptedGraph,
		experiences: () => experiences,
		readServices,
		say: (kind, text) => say(kind, text),
		newId,
		revision,
		run,
		focus: experienceFocus,
		connectionPool,
		removals: () => removals,
		captureNewPresentation: (entityId, label) => views.captureNewPresentation(entityId, label)
	});

	let query = $state('');
	const viewsOf = $derived.by(() => {
		const views = snapshot.units.camera.data.views;
		const byPresentation = new Map<string, ExperienceViewChoice[]>();
		for (const presentation of current?.presentations ?? []) {
			byPresentation.set(
				presentation.id,
				presentation.views.map(({ viewId }) => ({
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
				level.presentationDisplayName(entry.id).toLowerCase().includes(needle) ||
				(viewsOf.get(entry.id) ?? []).some((view) => view.label.toLowerCase().includes(needle))
		);
	});

	let feedback = $state<ExperienceFeedback | null>(null);
	// Feedback is a passing line: success and info fade quickly, a refusal stays long enough to read.
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	/**
	 * Experience review 1 — a refusal reaches the creator in their own words: text
	 * that carries a JSON path, an internal kind or a raw identity is replaced by
	 * one plain sentence (the detail stays in the source findings' Copy details).
	 */
	function creatorMessage(text: string): string {
		const technical = /\$\.|\([a-z]+(?:-[a-z]+)+\)|[a-z]+:[a-z-]+|"[0-9a-f-]{8,}"|[a-z]+(?:-[a-z]+){2,}/;
		return technical.test(text) ? "That change didn't go through. Undo is unchanged." : text;
	}
	function say(kind: ExperienceFeedbackKind, text: string): void {
		clearTimeout(feedbackTimer);
		if (text === '') {
			feedback = null;
			return;
		}
		const shown: ExperienceFeedback = { kind, text };
		feedback = shown;
		feedbackTimer = setTimeout(
			() => {
				if (feedback === shown) feedback = null;
			},
			kind === 'refusal' ? 8000 : 4000
		);
	}
	let busy = $state(false);

	function newId(): string {
		return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	/** The retained Camera authoring convention, kept local so the controller imports no Camera module. */

	function revision() {
		return readServices().stage.snapshot().acceptedRevision;
	}

	/**
	 * The consequences planning added to an accepted change
	 * reach the creator: a Cut normalisation or a straight path the edit required.
	 * One sentence, appended to the action's own success line.
	 */
	function planChangeSentence(changes: readonly OperationChange[], source: ProjectEnvelope | undefined): string {
		if (changes.length === 0 || source === undefined) return '';
		const experience =
			source.units.experience.data.experiences.find((entry) => entry.id === current?.id) ??
			source.units.experience.data.experiences[0];
		if (experience === undefined) return '';
		const labelOf = (viewId: string): string =>
			source.units.camera.data.views.find((view) => view.id === viewId)?.label ?? viewId;
		const guide = contextGuide === null
			? undefined
			: experience.guides.find((entry) => entry.id === contextGuide.id);
		const placeOf = (stopId: string): number => (guide?.stopIds.indexOf(stopId) ?? -1) + 1;
		const entryViewOf = (stopId: string): string | null => {
			const stop = experience.stops.find((entry) => entry.id === stopId);
			if (stop === undefined) return null;
			return stopEntryViewId(experience, stop);
		};
		const clauses: string[] = [];
		for (const change of changes) {
			if (change.kind === 'experience.transition.normalised') {
				const [stopId, nextStopId] = change.subjectIds;
				if (stopId === undefined) continue;
				const fromPlace = placeOf(stopId);
				if (fromPlace === 0) continue;
				if (nextStopId === undefined) {
					clauses.push(`Stop ${fromPlace} is last, so its Travel became a Cut`);
				} else {
					const toPlace = placeOf(nextStopId);
					const view = entryViewOf(stopId);
					clauses.push(
						`Stop ${fromPlace} → ${toPlace === 0 ? fromPlace + 1 : toPlace} is now a Cut: both show ${view === null ? 'the same View' : labelOf(view)}`
					);
				}
			} else if (change.kind === 'experience.presentation-view.transition.normalised') {
				const viewId = change.subjectIds[1];
				if (viewId !== undefined) clauses.push(`View ${labelOf(viewId)} is last, so its Travel became a Cut`);
			} else if (change.kind === 'camera.connection.created') {
				const connectionId = change.subjectIds[0];
				const connection = source.units.camera.data.connections.find((entry) => entry.id === connectionId);
				if (connection !== undefined) {
					clauses.push(`a straight Camera path joins ${labelOf(connection.fromNodeId)} and ${labelOf(connection.toNodeId)}`);
				}
			}
		}
		if (clauses.length === 0) return '';
		const [first, ...rest] = clauses;
		return ` ${first!.charAt(0).toUpperCase()}${first!.slice(1)}${rest.length === 0 ? '' : `; ${rest.join('; ')}`}.`;
	}

	/** Submit one command; `true` only when the source actually changed. */
	async function run(
		builder: () => Submission,
		success: (changes: readonly OperationChange[]) => string = () => ''
	): Promise<boolean> {
		if (busy) return false;
		busy = true;
		try {
			const outcome = await readServices().authoring.accept(builder());
			if (outcome.kind === 'refused') {
				say('refusal', creatorMessage(outcome.message));
				return false;
			}
			if (outcome.kind !== 'installed') {
				say('refusal', 'No change to accept.');
				return false;
			}
			const changes = outcome.changes ?? [];
			say('success', `${success(changes)}${planChangeSentence(changes, outcome.source)}`.trim());
			return true;
		} finally {
			busy = false;
		}
	}

	/**
	 * The Experience a first step joins: the current one, or the ready draft, which
	 * that same accepted change creates under `draftLabel`.
	 */
	const views = createExperienceViewAuthoring({
		snapshot: () => snapshot,
		current: () => current,
		selectedPresentation: () => selectedPresentation,
		datumMeters: () => datumMeters,
		draftLabel: () => draftLabel,
		resetDraftLabel: () => (draftLabel = DRAFT_EXPERIENCE_LABEL),
		feedback: () => feedback?.text ?? '',
		say: (kind, text) => say(kind, text),
		newId,
		revision,
		run,
		focus: experienceFocus,
		readServices,
		perfMark,
		alsoIn: (viewId, presentationId) => presentation.alsoIn(viewId, presentationId),
		presentationDisplayName: (id) => level.presentationDisplayName(id)
	});

	/** One captured connection id per Travel use in the Experience, plus one. */
	function connectionPool(): string[] {
		const experience = current;
		const travels = experience === null
			? 0
			: experience.stops.filter((stop) => stop.transition === 'travel').length +
				experience.presentations.reduce(
					(total, presentation) => total + presentation.views.filter((view) => view.transition === 'travel').length,
					0
				);
		return Array.from({ length: travels + 1 }, () => newId());
	}

	const stops = createExperienceStopAuthoring({
		snapshot: () => snapshot,
		current: () => current,
		currentGuide: () => currentGuide,
		contextGuide: () => contextGuide,
		selectedStop: () => selectedStop,
		say: (kind, text) => say(kind, text),
		newId,
		revision,
		run,
		connectionPool,
		focus: experienceFocus
	});

	const presentation = createExperiencePresentationAuthoring({
		snapshot: () => snapshot,
		current: () => current,
		contextGuide: () => contextGuide,
		feedback: () => feedback?.text ?? '',
		setDraftLabel: (label) => (draftLabel = label),
		nameNeeded: NAME_NEEDED,
		say: (kind, text) => say(kind, text),
		newId,
		revision,
		run,
		connectionPool,
		updateStop: (stopId, fields) => stops.updateStop(stopId, fields),
		focus: experienceFocus,
		presentationDisplayName: (id) => level.presentationDisplayName(id),
		presentationLabel: (id) => level.presentationLabel(id)
	});


	/** Write one Presentation's whole View list (order and steps) as one accepted change. */
	/** Names as the creator reads them: Stops by their position in the context Guide. */	const removals = createExperienceRemovalReadings({
		experience: () => current,
		contextGuide: () => contextGuide,
		envelope: () => snapshot,
		presentationLabel: (id) => level.presentationLabel(id),
		presentationDisplayName: (id) => level.presentationDisplayName(id)
	});

	const backTarget = $derived.by(() => {
		void subject;
		return experienceFocus.previous(removals.resolves);
	});



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
		get pathOccurrence() {
			return paths.occurrence;
		},
		get selectedPath() {
			return paths.read;
		},
		get selectedAnchorId() {
			return paths.anchorId;
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
		get feedback() {
			return feedback;
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
		presentationLabel: level.presentationLabel,
		presentationDisplayName: level.presentationDisplayName,
		presentationSubjectName: level.presentationSubjectName,
		get linkCandidates() {
			return level.linkCandidates;
		},
		linkPresentation: level.linkPresentation,
		unlinkPresentation: level.unlinkPresentation,
		followPresentation: level.followPresentation,
		get cameraViews() {
			return snapshot.units.camera.data.views;
		},
		get sourceRevision() {
			// The accepted source read owns the content identity; the envelope does not.
			return readServices().stage.snapshot().sourceContentId;
		},
		get playbackSource() {
			return level.playbackSource;
		},
		playbackSourceFor(guideId: string) {
			return level.playbackSourceFor(guideId);
		},
		guideForStop(stopId: string) {
			const containing = (current?.guides ?? []).filter((guide) => guide.stopIds.includes(stopId));
			return containing.find((guide) => guide.id === currentGuide?.id)?.id ?? containing[0]?.id ?? null;
		},
		viewPose(viewId: string) {
			const view = snapshot.units.camera.data.views.find((candidate) => candidate.id === viewId);
			return view === undefined
				? null
				: { eye: [view.eye[0], view.eye[1], view.eye[2]], target: [view.target[0], view.target[1], view.target[2]], fov: view.fov };
		},
		setViewFraming: views.setViewFraming,
		placeView: views.placeView,
		updateViewPose: views.updateViewPose,
		capturePose: views.capturePose,
		presentThisFramed: views.presentThisFramed,
		select: (next: ExperienceSubject | null) => {
			experienceFocus.select(next);
			paths.selectSubject(next);
		},
		openExperience: (experienceId: string) => experienceFocus.openExperience(experienceId),
		openGuide,
		viewFacts: (viewId: string) =>
			current === null
				? null
				: viewFactsOf(current, snapshot.units.camera.data.views, viewId, undefined, datumMeters),
		resolveContinuation: (stopId: string) =>
			current === null ? null : resolveStopContinuation(current, contextGuide, stopId),
		viewStops: (viewId: string) => (current === null ? [] : stopsGuiding(current, contextGuide, viewId)),
		presentationsAbout: (entityId: string) =>
			current === null ? [] : presentationsAboutEntity(current, entityId),
		reach: (guide = contextGuide) =>
			current === null
				? { presentations: 0, views: 0, freePresentations: 0, freeViews: 0, viewsOnlyFree: 0, hiddenViews: 0 }
				: reachSummary(current, guide),
		createExperience: level.createExperience,
		get draftLabel() {
			return draftLabel;
		},
		capture: views.capture,
		presentThis: level.presentThis,
		addStop: stops.addStop,
		moveStopTo: stops.moveStopTo,
		moveStop: stops.moveStop,
		setGuidePacing: stops.setGuidePacing,
		setStopEntry: stops.setStopEntry,
		setStopStay: stops.setStopStay,
		setStopInvitation: stops.setStopInvitation,
		setPresentationStep: presentation.setPresentationStep,
		movePresentationView: presentation.movePresentationView,
		setExplorable: presentation.setExplorable,
		setWelcome: presentation.setWelcome,
		setTransition: presentation.setTransition,
		pathFor: (occurrence: ExperiencePathOccurrence) =>
			current === null
				? null
				: acceptedGraph === null
					? null
					: readExperiencePath({
							experience: current,
							guide: contextGuide,
							graph: acceptedGraph,
							occurrence,
							geometry: acceptedGeometry
						}),
		selectPath: paths.select,
		selectAnchor: paths.selectAnchor,
		createPath: paths.createPath,
		previewPathDrag: paths.previewPathDrag,
		addPathAnchor: paths.addPathAnchor,
		movePathAnchor: paths.movePathAnchor,
		removePathAnchor: paths.removePathAnchor,
		straightenPath: paths.straightenPath,
		setPathDuration: paths.setPathDuration,
		renamePresentation: presentation.renamePresentation,
		updatePresentationText: presentation.updatePresentationText,
		setDefaultView: presentation.setDefaultView,
		renameExperience: presentation.renameExperience,
		renameGuide: presentation.renameGuide,
		renameView: presentation.renameView,
		makeOpeningGuide: presentation.makeOpeningGuide,
		addToGuide: presentation.addToGuide,
		createGuide: presentation.createGuide,
		alsoIn: presentation.alsoIn,
		moveViewTo: presentation.moveViewTo,
		moveView: presentation.moveView,
		removalPreview: removals.removalPreview,
		remove: level.remove,
		get backTarget() {
			return backTarget;
		},
		back: () => experienceFocus.back(removals.resolves),
		subjectName: removals.subjectName
	};
}
