/**
 * The Experience lens controller (R217.S24).
 *
 * ExperienceSurface.svelte renders this controller and keeps only its markup and
 * styles. The controller holds what the surface held before, moved without a change
 * of behaviour: the reactive reading of the accepted source the lens shows, the
 * Experience commands (each one an intent built by commands.ts and submitted through
 * the host's one F.4 acceptance port), the surface's message and busy flag, and its
 * drafts and Presentation filter.
 *
 * It is not an authority. Focus stays in focus.svelte.ts, the one writable owner of
 * what the lens works on; travel gaps stay in travel-gap.ts; every intent stays in
 * commands.ts. The controller has no DOM access and holds no selection or Camera state.
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
import { travelGapMessages } from './travel-gap';
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

/** The lens's typed-but-uncommitted input. Each field is one control's value. */
export type ExperienceDrafts = {
	firstGuideLabel: string;
	presentationLabel: string;
	presentationText: string;
	stopEntryView: string;
	stopHold: string;
	stopTarget: string;
	stopTransition: 'cut' | 'travel';
};

export type ExperienceViewChoice = { readonly id: string; readonly label: string };

export type ExperienceController = {
	readonly experiences: readonly Experience[];
	readonly current: Experience | null;
	readonly currentGuide: ExperienceGuide | null;
	readonly selectedPresentation: ExperiencePresentation | null;
	readonly selectedStop: ExperienceStop | null;
	readonly travelGaps: readonly string[];
	readonly stopUsage: ReadonlyMap<string, readonly string[]>;
	readonly guideStops: readonly ExperienceStop[];
	readonly viewsOf: ReadonlyMap<string, readonly ExperienceViewChoice[]>;
	readonly filteredPresentations: readonly ExperiencePresentation[];
	readonly message: string;
	readonly busy: boolean;
	readonly drafts: ExperienceDrafts;
	/** The Presentation filter the lens's search field writes. */
	query: string;
	firstGuidePresentation(): { readonly id: string; readonly label: string } | null;
	presentationLabel(presentationId: string): string;
	/** Focus an Experience the lens's selector names. */
	openExperience(experienceId: string): void;
	/** Focus the named Guide of the current Experience, with its entry Stop. */
	chooseGuide(guideId: string): void;
	selectPresentation(presentationId: string): void;
	selectStop(stopId: string): void;
	createExperience(): Promise<void>;
	captureAndBind(): Promise<void>;
	createFirstGuide(): Promise<void>;
	rebindToCapturedView(): Promise<void>;
	savePresentation(): Promise<void>;
	setDefaultView(presentationId: string, viewId: string): Promise<void>;
	insertStop(): Promise<void>;
	moveStop(stopId: string, direction: -1 | 1): Promise<void>;
	saveStop(): Promise<void>;
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
	const currentGuide = $derived.by(() => {
		if (current === null || experienceFocus.guideId === null) return null;
		return current.guides.find((guide) => guide.id === experienceFocus.guideId) ?? null;
	});
	const selectedPresentation = $derived.by(() => {
		if (current === null || experienceFocus.presentationId === null) return null;
		return current.presentations.find((entry) => entry.id === experienceFocus.presentationId) ?? null;
	});
	const selectedStop = $derived.by(() => {
		if (current === null || experienceFocus.stopId === null) return null;
		return current.stops.find((entry) => entry.id === experienceFocus.stopId) ?? null;
	});
	const travelGaps = $derived.by(() =>
		current === null || selectedStop === null ? [] : travelGapMessages(snapshot, current.id, selectedStop.id)
	);
	const stopUsage = $derived.by(() => {
		const usage = new Map<string, string[]>();
		for (const stop of current?.stops ?? []) {
			usage.set(stop.presentationId, [...(usage.get(stop.presentationId) ?? []), stop.id]);
		}
		return usage;
	});
	const guideStops = $derived.by(() =>
		currentGuide === null
			? []
			: currentGuide.stopIds
					.map((stopId) => current?.stops.find((stop) => stop.id === stopId) ?? null)
					.filter((stop): stop is NonNullable<typeof stop> => stop !== null)
	);
	let query = $state('');
	const filteredPresentations = $derived.by(() => {
		if (current === null) return [];
		const needle = query.trim().toLowerCase();
		if (needle === '') return current.presentations;
		return current.presentations.filter((entry) => entry.label.toLowerCase().includes(needle));
	});
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

	let message = $state('');
	let busy = $state(false);
	const drafts = $state<ExperienceDrafts>({
		firstGuideLabel: '',
		presentationLabel: '',
		presentationText: '',
		stopEntryView: '',
		stopHold: '',
		stopTarget: 'sequence-next',
		stopTransition: 'cut'
	});

	$effect(() => {
		const presentation = selectedPresentation;
		untrack(() => {
			drafts.presentationLabel = presentation?.label ?? '';
			drafts.presentationText = presentation?.text?.body ?? '';
		});
	});
	$effect(() => {
		const stop = selectedStop;
		untrack(() => {
			drafts.stopEntryView = stop?.entryViewId ?? '';
			drafts.stopHold = stop?.holdSeconds === undefined ? '' : String(stop.holdSeconds);
			const continuation = stop?.continuation;
			drafts.stopTarget =
				continuation?.kind === 'stop' ? continuation.stopId : continuation?.kind === 'end' ? 'end' : 'sequence-next';
			drafts.stopTransition =
				continuation !== undefined && continuation.kind !== 'end' ? continuation.transition ?? 'cut' : 'cut';
		});
	});

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

	function selectionSubjectEntityId(): string | null {
		const primary = readServices().stage.selectionState().primary;
		if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		return primary.subject.id;
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
	 * Capture the Stage framing as a View and bind a Presentation to it.
	 *
	 * With a Guide open the Stop joins that Guide; with no Guide at all the capture
	 * stays Guide-free unless the creator asked for the first Guide, in which case
	 * View + Presentation + Guide + Stop are one accepted install.
	 */
	async function captureAndBind(): Promise<void> {
		if (current === null) return;
		const view = currentCapturePose();
		if (view === null) return;
		const presentationId = newId();
		const stopId = newId();
		const guideId = newId();
		const subjectEntityId = selectionSubjectEntityId();
		const wantsFirstGuide = current.guides.length === 0 && drafts.firstGuideLabel.trim() !== '';
		const accepted = await run(() =>
			captureBindIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId(), presentation: presentationId, stop: stopId, guide: guideId },
				experienceId: current.id,
				view,
				presentationLabel: `Presentation ${current.presentations.length + 1}`,
				subjectEntityId,
				text: null,
				guideId: wantsFirstGuide ? null : currentGuide?.id ?? null,
				firstGuideLabel: wantsFirstGuide ? drafts.firstGuideLabel.trim() : null,
				afterStopId: selectedStop?.id ?? null
			})
		);
		if (accepted) {
			experienceFocus.selectPresentation(presentationId);
			if (wantsFirstGuide) {
				experienceFocus.openGuide(guideId, stopId);
				drafts.firstGuideLabel = '';
			}
			// Measurement anchor for the capture/bind → Preview entry row.
			perfMark('experience:capture-accepted', { firstGuide: wantsFirstGuide });
		}
	}

	/** The Presentation a first Guide can start from: the selected Stop's, else the selection. */
	function firstGuidePresentation(): { readonly id: string; readonly label: string } | null {
		if (current === null) return null;
		const fromStop =
			selectedStop === null ? null : current.presentations.find((entry) => entry.id === selectedStop.presentationId) ?? null;
		return fromStop ?? selectedPresentation;
	}

	/**
	 * Create the Experience's first Guide and its initial distinct Stop.
	 *
	 * The Stop reuses the Presentation's own View: no Camera pose or FOV is copied
	 * and no Connection is manufactured. The Experience's entry Guide is set
	 * explicitly by the operation, never inferred.
	 */
	async function createFirstGuide(): Promise<void> {
		if (current === null) return;
		const presentation = firstGuidePresentation();
		if (presentation === null) {
			message = 'Select a Presentation, or a Stop whose Presentation the Guide starts from.';
			return;
		}
		const guideId = newId();
		const stopId = newId();
		const accepted = await run(() =>
			guideCreateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), guide: guideId, stop: stopId },
				experienceId: current.id,
				presentationId: presentation.id,
				label: drafts.firstGuideLabel.trim() === '' ? 'Guide' : drafts.firstGuideLabel.trim(),
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		if (accepted) {
			experienceFocus.openGuide(guideId, stopId);
			drafts.firstGuideLabel = '';
		}
	}

	async function rebindToCapturedView(): Promise<void> {
		if (current === null || selectedPresentation === null) return;
		const view = currentCapturePose();
		if (view === null) return;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), view: newId() },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				view
			})
		);
	}

	async function savePresentation(): Promise<void> {
		if (current === null || selectedPresentation === null) return;
		const text = drafts.presentationText;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				label: drafts.presentationLabel,
				text: text === '' ? null : { kind: 'plain', body: text }
			})
		);
	}

	async function setDefaultView(presentationId: string, viewId: string): Promise<void> {
		if (current === null) return;
		await run(() =>
			presentationUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				presentationId,
				defaultViewId: viewId
			})
		);
	}

	async function insertStop(): Promise<void> {
		if (current === null || currentGuide === null || selectedPresentation === null) return;
		const stopId = newId();
		const accepted = await run(() =>
			stopCreateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId(), stop: stopId },
				experienceId: current.id,
				presentationId: selectedPresentation.id,
				guideId: currentGuide.id,
				afterStopId: selectedStop?.id ?? null,
				entryViewId: null,
				holdSeconds: null,
				continuation: { kind: 'sequence-next', transition: 'cut' }
			})
		);
		// A refused insert must not select a Stop the accepted source does not carry.
		if (accepted) experienceFocus.selectStop(stopId);
	}

	async function moveStop(stopId: string, direction: -1 | 1): Promise<void> {
		if (current === null || currentGuide === null) return;
		const order = [...currentGuide.stopIds];
		const at = order.indexOf(stopId);
		const to = at + direction;
		if (at === -1 || to < 0 || to >= order.length) return;
		[order[at], order[to]] = [order[to]!, order[at]!];
		await run(() =>
			guideOrderIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				guideId: currentGuide.id,
				stopIds: order
			})
		);
	}

	async function saveStop(): Promise<void> {
		if (current === null || selectedStop === null) return;
		const hold = drafts.stopHold.trim() === '' ? null : Number(drafts.stopHold);
		if (hold !== null && (!Number.isFinite(hold) || hold < 0)) {
			message = 'A hold is a finite number of seconds, or blank for none.';
			return;
		}
		let continuation: ExperienceContinuation | null = null;
		if (drafts.stopTarget === 'end') continuation = { kind: 'end' };
		else if (drafts.stopTarget === 'sequence-next') continuation = { kind: 'sequence-next', transition: drafts.stopTransition };
		else continuation = { kind: 'stop', stopId: drafts.stopTarget, transition: drafts.stopTransition };
		await run(() =>
			stopUpdateIntent({
				envelope: snapshot,
				revision: revision(),
				ids: { operation: newId() },
				experienceId: current.id,
				stopId: selectedStop.id,
				entryViewId: drafts.stopEntryView === '' ? null : drafts.stopEntryView,
				holdSeconds: hold,
				continuation
			})
		);
	}

	function presentationLabel(presentationId: string): string {
		return current?.presentations.find((entry) => entry.id === presentationId)?.label ?? presentationId;
	}

	function chooseGuide(guideId: string): void {
		const guide = current?.guides.find((entry) => entry.id === guideId) ?? null;
		experienceFocus.openGuide(guide?.id ?? null, guide?.entryStopId ?? null);
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
		get selectedPresentation() {
			return selectedPresentation;
		},
		get selectedStop() {
			return selectedStop;
		},
		get travelGaps() {
			return travelGaps;
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
		drafts,
		get query() {
			return query;
		},
		set query(next: string) {
			query = next;
		},
		firstGuidePresentation,
		presentationLabel,
		openExperience: (experienceId: string) => experienceFocus.openExperience(experienceId),
		chooseGuide,
		selectPresentation: (presentationId: string) => experienceFocus.selectPresentation(presentationId),
		selectStop: (stopId: string) => experienceFocus.selectStop(stopId),
		createExperience,
		captureAndBind,
		createFirstGuide,
		rebindToCapturedView,
		savePresentation,
		setDefaultView,
		insertStop,
		moveStop,
		saveStop
	};
}
