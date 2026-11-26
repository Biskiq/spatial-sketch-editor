/**
 * Named shell command dispatch.
 *
 * Selection, task, dock/tool, Find and destructive-action commands go through
 * one narrow dispatcher. Every command delegates to an existing
 * authority:
 *
 * - selection writes go through the facade/session canonical selection;
 * - tasks are opened, resumed and closed by the facade's one task home;
 * - dock tools arm the very same contributed task the Index invokes;
 * - deletion is the selected subject's own contributed Card action, after its
 *   planner-derived disclosure;
 * - Find arms or invokes the existing command, never a second implementation.
 *
 * The dispatcher holds no presentation state of its own: the shell owner owns
 * disclosures and mirrors, and the route supplies the existing command
 * callbacks it composes (view commands, replacement, download, Welcome).
 */
import { inkSurface } from '../../adapters/layout/ink';
import { type PlanEvaluation } from '@portfolio/layout-core/world';
import type { StageCardActionRecord, StageFacade } from '../stage-facade';
import type { StageSession, StageTask } from '../stage-session';
import { type StageSelectionEntry } from '../semantic-selection';
import { STAGE_ERASER_TASK } from '../stage-eraser';
import { STAGE_PAINT_TASK } from '../stage-painter';
import { STAGE_MEASURE_TASK } from '../stage-measure';
import type { WorldToolId } from '$lib/authoring/world-toolbar/registry';
import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
import type { ExperienceLens } from '$lib/authoring/experience/experience-lens.svelte';
import { STAGE_HOST_ADAPTER_ID, type StageDockKey } from '../stage-contributions';
import type { StageDockSlot } from '../stage-input';
import type { StageShellState } from './stage-shell-state.svelte';
import { createStageShellSelection } from './stage-shell-selection';
import type { StageHeadFindEntry } from './stage-contribution-view';
import { stageArmedDockId } from './stage-contribution-view';
import type { WorldScope } from '../shell/world-index-model';

export type StageShellCommandInput = {
	readonly facade: () => StageFacade | null;
	readonly planView: () => PlanEvaluation | null;
	readonly session: StageSession;
	readonly shell: StageShellState;
	readonly selection: () => StageSelectionEntry | null;
	readonly setSelection: (entry: StageSelectionEntry | null) => void;
	readonly clearExperienceFocus: () => void;
	readonly experience: {
		readonly lens: ExperienceLens;
		readonly active: () => ExperienceController | null;
	};
	readonly cardActions: () => readonly StageCardActionRecord[];
	readonly dockKeys: () => readonly StageDockKey[];
	readonly notice: (message: string) => void;
	readonly refreshHostTools: () => void;
	readonly cancelArtwork: () => void;
	readonly view: {
		readonly zoomIn: () => void;
		readonly zoomOut: () => void;
		readonly fit: () => void;
		readonly requestScaleDetent: (ratio: number) => void;
	};
	readonly project: {
		readonly requestReplacement: (kind: 'starter' | 'source') => void;
		readonly downloadSourceJson: () => void;
	};
	readonly showExperienceWelcome: () => void;
	/** End a drawn gesture when Slice is re-armed as Level. */
	readonly levelSlice: () => void;
	readonly lightArmed: (projectId: string) => boolean;
	readonly isStudioTool: (id: WorldToolId) => boolean;
	/**
	 * Object Studio scopes the tools to Select, Measure, Eraser and Objects. Read live:
	 * a refused arm says so in words and changes nothing, so a shortcut cannot reach a
	 * tool the Studio dock does not show.
	 */
	readonly studioActive?: () => boolean;
	/**
	 * Whether the Select-mode selection qualifies as a Library Replace target
	 * (one paintable object or present surface). Read when the dock or `L` opens it.
	 */
	readonly libraryReplaceQualified?: () => boolean;
	/** Run one of Find's Object Studio entries by its id. */
	readonly runStudioEntry?: (id: string) => void;
};

export function createStageShellCommands(input: StageShellCommandInput) {
	const shell = input.shell;
	const selection = createStageShellSelection({ ...input, armWorldTool: (id) => armWorldTool(id) });
	const {
		syncPrimarySelection,
		selectHit,
		selectUnfoldedSubject,
		selectSource,
		selectStageReference,
		closeSelection,
		openSpaceCreated,
		closeCard,
	} = selection;

	/** `true` (and a word) when Object Studio does not offer this tool. */
	function studioRefuses(allowed: boolean): boolean {
		if (allowed || input.studioActive?.() !== true) return false;
		input.notice('That tool is not part of Object Studio. Go back to the World to use it.');
		return true;
	}

	/**
	 * Keep the instrument home's mirror of the facade's contributed task in step.
	 *
	 * The facade owns the task and its instrument content: an adapter can reopen
	 * its own persistent task after an accepted install closed it.
	 */
	function syncContributedTask(): void {
		const stage = input.facade();
		if (stage === null) return;
		const lifecycle = stage.session.taskLifecycle();
		if (lifecycle === null) {
			shell.setContributedTask(null);
			rearmDockTool();
			return;
		}
		if (lifecycle.status !== 'active') return;
		const current = shell.contributedTaskId;
		if (current !== null && stage.instrumentForTask(current.id, current.adapterId) !== null) return;
		for (const entry of stage.tasks()) {
			if (stage.instrumentForTask(entry.id, entry.adapterId) !== null) {
				shell.setContributedTask({ id: entry.id, adapterId: entry.adapterId });
				return;
			}
		}
		shell.setContributedTask(null);
	}

	/**
	 * Invoke a contributed operation. The facade owns the task and its instrument
	 * content; this host only mirrors them into the one instrument home.
	 */
	function invokeContribution(adapterId: string, id: string, revealInstrument = true): void {
		const stage = input.facade();
		if (stage === null) return;
		// Opening any other contributed operation takes the lower column: put the
		// dock tool down first, or a completion that closes this task would re-arm a
		// tool the creator had already left (the only re-arm is the armed tool's own).
		const keepsArmedTool =
			shell.armedTool !== null &&
			shell.armedTool.id === id &&
			shell.armedTool.adapterId === adapterId;
		if (!keepsArmedTool) shell.setArmedTool(null);
		const opened = stage.openFindEntry(adapterId, id);
		if (opened.kind !== 'opened') {
			input.notice(opened.message);
			return;
		}
		shell.setTask(opened.task);
		if (revealInstrument) shell.setPaletteOpen(true);
		shell.setContributedTask({ id: opened.taskId, adapterId: opened.adapterId });
	}

	function closeTask(): void {
		// Disarm **before** closing: the close notifies the contribution surface,
		// and a notification re-arms an armed dock tool.
		shell.setArmedTool(null);
		shell.clearHostTools();
		input.facade()?.closeTask();
		shell.setTask(null);
		shell.setContributedTask(null);
	}

	function resumeTask(): void {
		const result = input.facade()?.resumeTask();
		if (result?.kind === 'refused') input.notice(result.message);
		else {
			shell.setTask(input.session.task());
			input.notice('');
		}
		shell.bumpContributions();
	}

	/** The host task an armed Measure, Eraser or Paint holds. It names no target. */
	function hostToolTask(kind: string): StageTask | null {
		if (kind === STAGE_MEASURE_TASK) {
			return { kind, label: 'Measure', targetRef: null, target: null };
		}
		if (kind === STAGE_ERASER_TASK) {
			return { kind, label: 'Eraser', targetRef: null, target: null };
		}
		if (kind === STAGE_PAINT_TASK) {
			return { kind, label: 'Paint', targetRef: null, target: null };
		}
		return null;
	}

	/**
	 * Arm Measure, Eraser or Paint. Like every dock key it takes the lower column
	 * and leaves the selection exactly as it was; it opens no adapter instrument.
	 */
	function armHostTool(kind: string): void {
		const stage = input.facade();
		const next = hostToolTask(kind);
		if (stage === null || next === null) return;
		closeTask();
		if (!stage.openTask(next)) return;
		shell.setTask(next);
		shell.setArmedTool({ id: kind, adapterId: STAGE_HOST_ADAPTER_ID });
		shell.setPaletteOpen(true);
		shell.setWorldPlateOpen(true);
		shell.setPendingDelete(null);
		input.notice('');
		input.refreshHostTools();
	}

	/**
	 * Arm a dock tool: the very same contributed task the Index invokes, so a
	 * tool has one operation behind it, never a second dock-only path.
	 */
	function armDockTool(tool: { readonly id: string; readonly adapterId: string }): void {
		invokeContribution(tool.adapterId, tool.id);
		shell.setArmedTool({ id: tool.id, adapterId: tool.adapterId });
		shell.setPaletteOpen(true);
		shell.setWorldPlateOpen(true);
		shell.setPendingDelete(null);
	}

	/** Select — the host's own tool: close the contributed task and keep selection. */
	function selectTool(): void {
		input.cancelArtwork();
		closeTask();
	}

	/** Arm one dock key (from the dock, its key or Find). */
	function armDockKey(key: StageDockKey): void {
		if (
			studioRefuses(
				key.slot === 'select' ||
					key.slot === 'library' ||
					(key.adapterId === STAGE_HOST_ADAPTER_ID && key.id !== STAGE_PAINT_TASK),
			)
		)
			return;
		shell.setFurnishStripOpen(false);
		if (key.slot === 'slice') {
			// Arming Slice opens the reading, not a task. Level is the immediate SL1
			// reading; the plate's Drawn arm replaces it with the finite gesture.
			shell.setLibraryOpen(false);
			shell.setActiveWorldTool('slice');
			shell.setPaletteOpen(false);
			input.levelSlice();
			input.notice('');
			return;
		}
		if (key.slot === 'select') {
			shell.setActiveWorldTool('select');
			shell.setLibraryOpen(false);
			selectTool();
		} else if (key.adapterId === STAGE_HOST_ADAPTER_ID) {
			shell.setActiveWorldTool(
				key.id === STAGE_MEASURE_TASK ? 'measure' : key.id === STAGE_PAINT_TASK ? 'paint' : 'erase',
			);
			shell.setLibraryOpen(false);
			armHostTool(key.id);
		} else if (key.slot === 'library') {
			shell.setActiveWorldTool('objects');
			shell.setLibraryOpen(false);
			armDockTool({ id: key.id, adapterId: key.adapterId });
		} else if (key.slot === 'ink') {
			shell.setActiveWorldTool(worldToolOfReading(shell.inkReading));
			shell.setLibraryOpen(false);
			armDockTool({ id: key.id, adapterId: key.adapterId });
			shell.setPaletteOpen(false);
		} else {
			armDockTool({ id: key.id, adapterId: key.adapterId });
		}
	}

	/** The World row tool an Ink reading belongs to: Wall is `walls`, Roof is `roofline`. */
	function worldToolOfReading(
		reading: 'wall' | 'opening' | 'room' | 'terrace' | 'roof',
	): WorldToolId {
		return reading === 'wall' ? 'walls' : reading === 'roof' ? 'roofline' : reading;
	}

	/** The Living Draft row's one bridge into the existing dock/host controllers. */
	function armWorldTool(id: WorldToolId): void {
		if (studioRefuses(input.isStudioTool(id))) return;
		// One tool strip at a time: any tool press folds Furnish's quick strip.
		shell.setFurnishStripOpen(false);
		input.cancelArtwork();
		shell.setWorldPlateOpen(id !== 'select');
		if (id === 'library') {
			toggleWorldLibrary();
			return;
		}
		shell.setLibraryOpen(false);
		if (id === 'select') {
			shell.setActiveWorldTool('select');
			selectTool();
			return;
		}
		if (
			id === 'walls' ||
			id === 'opening' ||
			id === 'room' ||
			id === 'terrace' ||
			id === 'roofline'
		) {
			const key = input.dockKeys().find((candidate) => candidate.slot === 'ink');
			if (key === undefined) {
				input.notice('Ink is not available in this project.');
				return;
			}
			const reading = id === 'walls' ? 'wall' : id === 'roofline' ? 'roof' : id;
			shell.setInkReading(reading);
			armDockTool({ id: key.id, adapterId: key.adapterId });
			inkSurface()?.controller.setReading(reading);
			shell.setActiveWorldTool(id);
			shell.setPaletteOpen(false);
			return;
		}
		if (id === 'lights') {
			const previous = shell.activeWorldTool;
			closeTask();
			shell.setLibraryInvocation({ intent: 'browse', kind: 'lights', from: 'lights' });
			shell.setLibraryOpen(true);
			shell.setToolBeforeLibrary(previous === 'library' ? 'select' : previous);
			shell.setActiveWorldTool('lights');
			shell.setWorldPlateOpen(true);
			shell.setPaletteOpen(false);
			return;
		}
		if (id === 'objects') {
			const key = input.dockKeys().find((candidate) => candidate.slot === 'library');
			if (key === undefined) {
				input.notice('Objects is not available in this project.');
				return;
			}
			armDockTool({ id: key.id, adapterId: key.adapterId });
			shell.setActiveWorldTool('objects');
			shell.setPaletteOpen(false);
			return;
		}
		if (id === 'measure' || id === 'erase' || id === 'paint') {
			armHostTool(
				id === 'measure'
					? STAGE_MEASURE_TASK
					: id === 'paint'
						? STAGE_PAINT_TASK
						: STAGE_ERASER_TASK,
			);
			shell.setActiveWorldTool(id);
			shell.setPaletteOpen(false);
			return;
		}
		if (id === 'slice') {
			// Level is the immediate SL1 reading; the plate's Drawn arm replaces it
			// with the finite gesture. Choosing Slice again returns to Level.
			closeTask();
			shell.setActiveWorldTool('slice');
			shell.setPaletteOpen(false);
			input.levelSlice();
			input.notice('');
			return;
		}
		// A planned row is inspectable, but it writes nothing until its post-merge branch.
		closeTask();
		shell.setActiveWorldTool(id);
		shell.setPaletteOpen(false);
	}

	/**
	 * Open or close the Library. The opener names why it opened: Paint's *Browse
	 * all* picks for Paint, the Card's *Swap…* swaps, Furnish browses Objects, and
	 * the dock or `L` replaces a qualified Select-mode selection or browses.
	 * Closing a Furnish visit returns to its quick strip.
	 */
	function toggleWorldLibrary(opener: 'dock' | 'paint' | 'furnish' | 'card' = 'dock'): void {
		if (studioRefuses(false)) return;
		if (shell.libraryOpen) {
			const returnsToFurnish = shell.libraryInvocation.from === 'furnish';
			shell.setLibraryOpen(false);
			shell.setActiveWorldTool(
				shell.toolBeforeLibrary === 'library' ? 'select' : shell.toolBeforeLibrary,
			);
			if (returnsToFurnish) shell.setFurnishStripOpen(true);
			return;
		}
		const intent =
			opener === 'paint' || (opener === 'dock' && shell.armedHostTool === 'paint')
				? 'paint'
				: opener === 'card'
					? 'swap'
					: opener === 'dock' &&
							shell.activeWorldTool === 'select' &&
							input.libraryReplaceQualified?.() === true
						? 'replace'
						: 'browse';
		shell.setLibraryInvocation({
			intent,
			kind: opener === 'furnish' ? 'objects' : intent === 'browse' ? null : 'materials',
			from: opener,
		});
		shell.setFurnishStripOpen(false);
		shell.setToolBeforeLibrary(
			shell.activeWorldTool === 'library' ? 'select' : shell.activeWorldTool,
		);
		closeTask();
		shell.setLibraryOpen(true);
		shell.setActiveWorldTool('library');
		shell.setWorldPlateOpen(true);
		shell.setPaletteOpen(false);
	}

	/**
	 * Furnish's key: toggle its placeholder quick strip. The current selection
	 * stays, and any armed tool is put down so no placement is armed.
	 */
	function toggleFurnishStrip(): void {
		if (studioRefuses(false)) return;
		if (shell.furnishStripOpen) {
			shell.setFurnishStripOpen(false);
			return;
		}
		if (shell.libraryOpen) toggleWorldLibrary();
		if (shell.activeWorldTool !== 'select') {
			input.cancelArtwork();
			shell.setActiveWorldTool('select');
			selectTool();
		}
		shell.setWorldPlateOpen(false);
		shell.setPaletteOpen(false);
		shell.setFurnishStripOpen(true);
	}

	/** Furnish › *Browse all*: the shared Library on Objects, in ordinary browse mode. */
	function browseFurnish(): void {
		if (shell.libraryOpen) return;
		toggleWorldLibrary('furnish');
	}

	function pickWorldObject(assetId: string): void {
		shell.setLibraryOpen(false);
		armWorldTool('objects');
		input.notice(
			assetId === ''
				? 'Choose a placement in the Objects panel.'
				: 'Choose the object in the Objects panel to place it.',
		);
	}

	/** A dock press: arm the key, or fold/unfold the armed key's own palette. */
	function pressDockKey(key: StageDockKey): void {
		const armedDockId = stageArmedDockId({
			task: shell.task,
			armedHostTool: shell.armedHostTool,
			armedTool: shell.armedTool,
			dockKeys: input.dockKeys(),
		});
		if (key.id === armedDockId && key.slot !== 'select') {
			if (key.palette) shell.togglePalette();
			return;
		}
		armDockKey(key);
	}

	/** A dock shortcut: the same press as the key, or a word when the key is absent. */
	function pressDockSlot(slot: StageDockSlot): void {
		// `L` is the Library key in the World: the same press as the dock's Library.
		if (slot === 'library' && input.studioActive?.() !== true) {
			toggleWorldLibrary('dock');
			return;
		}
		const key = input.dockKeys().find((candidate) => candidate.slot === slot);
		if (key === undefined) {
			input.notice('That tool is not available in this project.');
			return;
		}
		pressDockKey(key);
	}

	/**
	 * Re-arm the dock's tool after an accepted install.
	 *
	 * The install closed the task; this re-opens the **same** contributed entry
	 * once its rebound adapter publishes it again. It is a no-op for a tool the
	 * creator disarmed, and for an entry whose adapter no longer contributes it.
	 */
	function rearmDockTool(): void {
		const stage = input.facade();
		if (stage === null) return;
		const armed = shell.armedTool;
		// The light arm is session fact in the adapter: it survives the install's
		// task close, and is already cleared when a glyph selects and disarms.
		const lightProjectId = stage.snapshot().acceptedRevision.projectId;
		if (armed === null && input.lightArmed(lightProjectId)) {
			const lightTask = stage
				.tasks()
				.find((entry) => entry.id === 'light-place' && entry.adapterId === 'light');
			if (lightTask !== undefined && stage.session.task() === null) {
				const opened = stage.openContributedTask(lightTask.id, lightTask.adapterId);
				if (opened.kind === 'opened') {
					shell.setTask(opened.task);
					shell.setContributedTask({ id: opened.taskId, adapterId: opened.adapterId });
					shell.setActiveWorldTool('lights');
					shell.setLibraryOpen(true);
					shell.setWorldPlateOpen(true);
				}
			}
			return;
		}
		if (armed === null) return;
		if (armed.adapterId === STAGE_HOST_ADAPTER_ID) {
			// An erase installs new content, which closes the task; the Eraser stays armed.
			const next = hostToolTask(armed.id);
			if (next !== null && stage.session.task() === null && stage.openTask(next)) {
				shell.setTask(next);
			}
			return;
		}
		// Other contributed tasks re-open directly; Find entries are the other arm shape.
		const taskEntry = stage
			.tasks()
			.find((entry) => entry.id === armed.id && entry.adapterId === armed.adapterId);
		if (taskEntry !== undefined) {
			if (stage.session.task() === null) {
				const opened = stage.openContributedTask(taskEntry.id, taskEntry.adapterId);
				if (opened.kind === 'opened') {
					shell.setTask(opened.task);
					shell.setContributedTask({ id: opened.taskId, adapterId: opened.adapterId });
				}
			}
			// The install briefly closed the task, so the task/chrome sync reset the
			// World tool to Select. Keep the re-armed Ink row attached to its task.
			if (armed.id === 'layout-ink') {
				shell.setActiveWorldTool(worldToolOfReading(shell.inkReading));
				shell.setWorldPlateOpen(true);
			}
			return;
		}
		const stillContributed = stage
			.findEntries()
			.some((entry) => entry.id === armed.id && entry.adapterId === armed.adapterId);
		if (!stillContributed) return;
		invokeContribution(armed.adapterId, armed.id, false);
		if (armed.id === 'layout-ink') {
			shell.setActiveWorldTool(worldToolOfReading(shell.inkReading));
			shell.setWorldPlateOpen(true);
		}
	}

	/** A Find preference entry writes the same browser preference the ⚙ writes. */
	function runPreferenceEntry(id: string): void {
		if (id === 'reduce-motion') {
			shell.toggleReducedMotion();
			return;
		}
		const [name, value] = id.split(':');
		if (name === 'appearance' && (value === 'paper' || value === 'shaded')) {
			shell.updatePreferences({ ...shell.preferences, planAppearance: value });
		} else if (name === 'height-sheet' && (value === 'left' || value === 'right')) {
			shell.setHeightSheetSide(value);
		} else if (
			name === 'motion-speed' &&
			(value === 'slow' || value === 'normal' || value === 'fast')
		) {
			shell.updatePreferences({ ...shell.preferences, motionSpeed: value });
		}
	}

	/** Reach a Find result: a dock tool arms, an Index entry invokes. */
	function runHeadFindEntry(entry: Pick<StageHeadFindEntry, 'id' | 'adapterId'>): void {
		if (entry.adapterId === 'project-replacement' && entry.id === 'starter') {
			input.project.requestReplacement('starter');
			return;
		}
		if (entry.adapterId === 'scope') {
			shell.setWorldScope(entry.id as WorldScope);
			shell.setIndexOpen(true);
			return;
		}
		if (entry.adapterId === 'view-command') {
			if (entry.id === '0') input.view.zoomIn();
			else if (entry.id === '1') input.view.zoomOut();
			else input.view.fit();
			return;
		}
		if (entry.adapterId === 'studio') {
			input.runStudioEntry?.(entry.id);
			return;
		}
		if (entry.adapterId === 'subject') {
			selectSource(entry.id);
			return;
		}
		if (entry.adapterId === 'scale') {
			input.view.requestScaleDetent(Number(entry.id.slice('scale:'.length)));
			return;
		}
		if (entry.adapterId === 'preference') {
			runPreferenceEntry(entry.id);
			return;
		}
		if (entry.adapterId === 'keys') {
			shell.setKeysOpen(true);
			return;
		}
		if (entry.adapterId === 'experience' && entry.id === 'tips') {
			input.showExperienceWelcome();
			return;
		}
		if (entry.adapterId === 'project-menu') {
			// Rename and delete open the Head's own dialog and never reach the route.
			if (entry.id === 'download') input.project.downloadSourceJson();
			else if (entry.id === 'source') input.project.requestReplacement('source');
			return;
		}
		const key = input
			.dockKeys()
			.find((candidate) => candidate.id === entry.id && candidate.adapterId === entry.adapterId);
		if (key !== undefined) {
			armDockKey(key);
			if (key.palette) shell.setPaletteOpen(true);
			return;
		}
		invokeContribution(entry.adapterId, entry.id);
	}

	/**
	 * The keyboard route to a subject's own destructive action.
	 *
	 * The first press names the consequences the owning adapter disclosed; the
	 * second confirms. The confirmation is bound to that exact disclosure.
	 */
	function requestDelete(): void {
		const selected = input.selection();
		const destructive = input.cardActions().filter((action) => action.destructive === true);
		if (selected === null || destructive.length !== 1) {
			shell.setPendingDelete(null);
			input.notice(
				selected === null ? 'Select a subject to delete it.' : 'Nothing here can be deleted.',
			);
			return;
		}
		const record = destructive[0]!;
		const subjectKey = `${selected.reference.subject.kind}:${selected.reference.subject.id}`;
		const detail = record.detail ?? null;
		const pending = shell.pendingDelete;
		if (
			pending !== null &&
			pending.subjectKey === subjectKey &&
			pending.actionId === record.id &&
			pending.detail === detail
		) {
			shell.setPendingDelete(null);
			void runCardAction(record, subjectKey);
			return;
		}
		shell.setPendingDelete({ subjectKey, actionId: record.id, detail });
		const disclosed = record.detail ?? 'the owning domain disclosed no consequences';
		input.notice(
			`${record.label} — ${disclosed.endsWith('.') ? disclosed : `${disclosed}.`} Press Delete again to confirm, or Escape to keep it.`,
		);
	}

	/** Run one contributed Card action and report exactly what it said. */
	async function runCardAction(record: StageCardActionRecord, subjectKey: string): Promise<void> {
		const outcome = await record.run();
		if (shell.pendingDelete?.subjectKey === subjectKey) shell.setPendingDelete(null);
		input.notice(
			outcome.kind === 'accepted' ? '' : (outcome.message ?? `${record.label} was not applied.`),
		);
	}

	return {
		syncPrimarySelection,
		openSpaceCreated,
		selectHit,
		selectUnfoldedSubject,
		selectSource,
		selectStageReference,
		closeSelection,
		closeCard,
		syncContributedTask,
		invokeContribution,
		closeTask,
		resumeTask,
		armHostTool,
		armDockTool,
		selectTool,
		armDockKey,
		armWorldTool,
		toggleWorldLibrary,
		toggleFurnishStrip,
		browseFurnish,
		pickWorldObject,
		pressDockKey,
		pressDockSlot,
		rearmDockTool,
		runPreferenceEntry,
		runHeadFindEntry,
		requestDelete,
		runCardAction,
	};
}

export type StageShellCommands = ReturnType<typeof createStageShellCommands>;
