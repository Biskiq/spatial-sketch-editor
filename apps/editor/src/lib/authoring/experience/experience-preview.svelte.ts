/**
 * The Experience Preview controller.
 *
 * Preview is a Camera handover: the Stage's inspection run hands its one output
 * to an isolated visitor run, and leaving returns it. The controller owns the
 * ephemeral run identity, the warm surface and the entry request; it never owns
 * the project source, the Stage or the Camera itself.
 *
 * Construct it during route initialisation so its warming `$effect` belongs to
 * the route's effect tree. `reset()` drops a surface built from a replaced
 * source; the chunk stays cached.
 */
import { previewEntryFor, type EnterablePreviewEntry } from './preview-entry';
import { enterPreview, nextPreviewRunEpoch, previewReturnToken, returnPreview } from './preview-handover';
import { loweringProblem } from './experience-problems';
import { guideTimeMapForProgram } from './playback-map';
import type { StageFacade } from '../stage/stage-facade';

import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';

type VisitorSurface = (typeof import('$lib/visitor/VisitorPreviewSurface.svelte'))['default'];

export type ExperiencePreviewHost = {
	/** The admitted source, or null while booting/failed. */
	lens: () => 'world' | 'experience';
	snapshot: () => {
		readonly domain: unknown;
		readonly sourceContentId: string;
		readonly sessionEpoch: string;
	} | null;
	token: () => unknown;
	isCurrent: (token: unknown) => boolean;
	/** The current project envelope for availability, labels and entry lowering. */
	envelope: () => unknown;
	envelopeOf: (snapshot: unknown) => unknown;
	focus: () => unknown;
	setProblem: (problem: unknown) => void;
	stage: () => StageFacade | null;
	/** End Follow and restore its exact entry before the Camera ticket moves. */
	stopAndRestore: () => void;
	snapSuspended: () => boolean;
	patchDrafting: (patch: { snapSuspended: boolean }) => void;
	notice: (message: string) => void;
	prepareArtwork?: (domain: unknown, signal: AbortSignal) => Promise<ArtworkScope | null>;
	perfMark: (name: string, data?: Record<string, unknown>) => void;
};

export function createExperiencePreview(host: ExperiencePreviewHost) {
	/**
	 * The isolated visitor Preview session.
	 *
	 * `epoch` is the protocol run epoch and the interpreter's run identity at
	 * once, so an older completion can neither drive the restored inspection
	 * output nor be accepted by a newer run.
	 */
	let preview = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number } | null>(null);
	/**
	 * The last entry a mounted visitor surface carries.
	 *
	 * The surface is built once and reused: leaving Preview hides it and ends its
	 * Camera claim, but keeps the loaded chunk, renderer and scene alive.
	 */
	let previewView = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number } | null>(null);
	/**
	 * The read the mounted surface was built from, frozen at its entry.
	 *
	 * A hidden surface must not rebuild itself for every accepted authoring edit;
	 * the next entry supplies the current read instead.
	 */
	let previewViewRead = $state.raw<unknown | null>(null);
	let previewSurface = $state.raw<VisitorSurface | null>(null);
	let previewEpoch = 0;
	let artworkScope = $state.raw<ArtworkScope | null>(null);
	let artworkPreparation: AbortController | null = null;
	function releaseArtwork() {
		artworkPreparation?.abort();
		artworkPreparation = null;
		artworkScope?.dispose();
		artworkScope = null;
	}
	let previewBusy = $state(false);
	/** An explicit Card action's entry mode (guided or free), or null for the head Preview. */
	let previewRequestedMode = $state<'guided' | 'free' | null>(null);
	let previewWarming = false;

	/** The visitor-facing View labels Places reads; program ids stay the identity. */
	const viewLabels = $derived.by(() => {
		const envelope = host.envelope() as {
			readonly units: { readonly camera: { readonly data: { readonly views: readonly { readonly id: string; readonly label: string }[] } } };
		} | null;
		return new Map<string, string>((envelope?.units.camera.data.views ?? []).map((view) => [view.id, view.label]));
	});

	/** The welcome chooser's guided estimate, from the one lowered time map. */
	const guideStats = $derived.by(() => {
		const view = previewView;
		const graph = (previewViewRead as { readonly graph?: unknown } | null)?.graph ?? null;
		if (view === null || view.entry.kind !== 'program' || graph === null) return { stops: 0, seconds: 0 };
		const read = guideTimeMapForProgram({
			program: view.entry.program,
			transitions: view.entry.transitions,
			graph: graph as Parameters<typeof guideTimeMapForProgram>[0]['graph'],
			entryStopId: view.entry.program.entryStopId
		});
		return {
			stops: view.entry.program.stops.length,
			seconds: read.kind === 'ready' ? read.map.totalSeconds : 0
		};
	});

	const available = $derived.by(() => {
		const envelope = host.envelope() as {
			readonly units: { readonly experience: { readonly data: { readonly experiences: readonly unknown[] } } };
		} | null;
		return envelope !== null && envelope.units.experience.data.experiences.length > 0;
	});

	/**
	 * Build the visitor surface before the first press.
	 *
	 * The chunk, renderer and scene are the cold-entry cost, and none of them
	 * depends on the Camera handoff. Building at admission blocked the first dock
	 * interaction, so the cost stays behind an explicit lens choice.
	 */
	async function warm(): Promise<void> {
		if (previewWarming || previewSurface !== null || preview !== null) return;
		const snapshot = host.snapshot();
		if (snapshot === null) return;
		const token = host.token();
		previewWarming = true;
		try {
			const module = await import('$lib/visitor/VisitorPreviewSurface.svelte');
			// A replacement during the load owns the source now: an old read is
			// never installed over it.
			if (!host.isCurrent(token) || host.snapshot() !== snapshot) return;
			if (preview !== null || previewView !== null) return;
			previewSurface = module.default;
			previewViewRead = snapshot.domain;
			const entry = previewEntryFor({
				envelope: host.envelopeOf(snapshot) as Parameters<typeof previewEntryFor>[0]['envelope'],
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: snapshot.sessionEpoch,
				epoch: 0,
				focus: host.focus() as Parameters<typeof previewEntryFor>[0]['focus']
			});
			if (entry.kind !== 'unavailable' && previewView === null) previewView = { entry, epoch: 0 };
			host.perfMark('preview:warmed');
		} catch {
			// The press path loads and reports its own failure.
		} finally {
			previewWarming = false;
		}
	}

	// The Experience lens is the intent to author what Preview shows; building
	// the hidden scene here means the first press is already warm.
	$effect(() => {
		if (host.lens() !== 'experience' || host.snapshot() === null || previewSurface !== null || preview !== null) return;
		void warm();
	});

	/**
	 * Leave Preview and return the Camera output to the Stage.
	 *
	 * Only a valid return restores the inspection run. When no Preview claim
	 * survives — a source/project change ended it through the protocol's rebase —
	 * nothing is reinstated.
	 */
	function close(): void {
		releaseArtwork();
		const stage = host.stage();
		const active = preview;
		preview = null;
		previewRequestedMode = null;
		// A hold entered before Preview may have been released while its keyup was
		// guarded; leaving Preview always reconciles Snap to the physical modifier.
		if (host.snapSuspended()) host.patchDrafting({ snapSuspended: false });
		// The takeover stays mounted, so the Exit control is now inside an inert
		// subtree and would keep focus while invisible.
		if (typeof document !== 'undefined') {
			const focused = document.activeElement;
			if (focused instanceof HTMLElement && focused.closest('.preview-takeover') !== null) focused.blur();
		}
		if (active === null || stage === null) return;
		const returned = returnPreview(stage.camera);
		host.perfMark('preview:returned', { outcome: returned.kind });
		if (returned.kind === 'refused') {
			stage.acquireInspection('exclusive');
			host.notice(returned.message);
		}
	}

	/**
	 * Enter Preview through the Camera handover.
	 *
	 * The entry rule resolves first, then the isolated chunk loads, and only then
	 * does the Stage hand its output to the Preview run.
	 */
	async function open(mode: 'guided' | 'free' | null = null, guideId: string | null = null): Promise<void> {
		if (previewBusy || preview !== null || host.snapshot() === null) return;
		host.perfMark('preview:press');
		const stage = host.stage();
		const snapshot = host.snapshot();
		if (stage === null || snapshot === null) return;
		previewRequestedMode = mode;
		// Playback is a Guide instrument, not an authoring mode that survives a
		// visitor takeover. Restore synchronously before the Camera ticket moves.
		host.stopAndRestore();
		const token = host.token();
		previewBusy = true;
		let entered = false;
		try {
			const runEpoch = nextPreviewRunEpoch(stage.camera.output(), ++previewEpoch);
			// A Card action names its own Guide; it must not inherit a selected Stop,
			// another open Guide, or a previously focused Presentation.
			const focus = guideId === null
				? host.focus()
				: { ...(host.focus() as Record<string, unknown>), guideId, stopId: null, presentationId: null };
			const entry = previewEntryFor({
				envelope: host.envelopeOf(snapshot) as Parameters<typeof previewEntryFor>[0]['envelope'],
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: snapshot.sessionEpoch,
				epoch: runEpoch,
				focus: focus as Parameters<typeof previewEntryFor>[0]['focus']
			});
			if (entry.kind === 'unavailable') {
				host.setProblem(
					entry.refusal == null
						? null
						: loweringProblem(
							host.envelopeOf(snapshot) as Parameters<typeof loweringProblem>[0],
							entry.refusal
						)
				);
				host.notice(entry.message);
				return;
			}
			host.setProblem(null);
			host.perfMark('preview:entry-resolved', { kind: entry.kind });
			// The visitor surface is its own chunk: a failure never leaves the output
			// owned by a Preview that did not mount.
			if (previewSurface === null) {
				try {
					const module = await import('$lib/visitor/VisitorPreviewSurface.svelte');
					previewSurface = module.default;
					host.perfMark('preview:chunk-ready');
				} catch {
					host.notice('The visitor Preview could not be loaded; the Stage kept the Camera output.');
					return;
				}
			}
			// A load is asynchronous: the source this entry resolved against must
			// still be the mounted one before ownership moves.
			if (!host.isCurrent(token) || stage !== host.stage()) return;
			if (host.prepareArtwork) {
				const abort = new AbortController();
				artworkPreparation = abort;
				try {
					const ready = await host.prepareArtwork(snapshot.domain, abort.signal);
					if (abort.signal.aborted || !host.isCurrent(token) || host.snapshot() !== snapshot) {
						ready?.dispose();
						return;
					}
					artworkScope = ready;
				} catch (error) {
					if (!abort.signal.aborted && host.isCurrent(token)) {
						host.notice(error instanceof Error ? error.message : 'Artwork could not be loaded for Preview.');
					}
					return;
				} finally {
					if (artworkPreparation === abort) artworkPreparation = null;
				}
			}
			const handover = enterPreview(stage.camera, {
				runEpoch,
				returnToken: previewReturnToken(
					snapshot.sessionEpoch,
					runEpoch
				)
			});
			if (handover.kind === 'refused') {
				releaseArtwork();
				host.notice(handover.message);
				return;
			}
			host.notice('');
			host.perfMark('preview:handover', { runEpoch: handover.runEpoch });
			previewViewRead = snapshot.domain;
			previewView = { entry, epoch: handover.runEpoch };
			preview = { entry, epoch: handover.runEpoch };
			entered = true;
			host.perfMark('preview:entered', { runEpoch: handover.runEpoch, mode: entry.kind });
		} finally {
			// Any abandoned entry must not keep playback suppressed by a stale mode.
			if (!entered) previewRequestedMode = null;
			previewBusy = false;
		}
	}

	/** Drop a run and a surface built from a replaced source; the chunk stays cached. */
	function reset(): void {
		releaseArtwork();
		preview = null;
		previewView = null;
		previewViewRead = null;
		previewSurface = null;
		previewRequestedMode = null;
		previewBusy = false;
	}

	return {
		get artworkScope() { return artworkScope; },
		get preview() {
			return preview;
		},
		get view() {
			return previewView;
		},
		get viewRead() {
			return previewViewRead;
		},
		get surface() {
			return previewSurface;
		},
		get requestedMode() {
			return previewRequestedMode;
		},
		get busy() {
			return previewBusy;
		},
		get openState() {
			return preview !== null;
		},
		get labels() {
			return viewLabels;
		},
		get stats() {
			return guideStats;
		},
		get available() {
			return available;
		},
		warm,
		open,
		close,
		reset
	};
}

export type ExperiencePreview = ReturnType<typeof createExperiencePreview>;
