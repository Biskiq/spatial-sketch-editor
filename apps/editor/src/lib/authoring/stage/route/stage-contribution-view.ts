/**
 * X3 / decomposition contract S — contribution, Find, Dock and toolbar reads.
 *
 * These are the projections the route used to carry inline: which contributed
 * tools are home on the dock, what the Head's Find lists, which dock key is
 * armed, what the one instrument home shows and what the host tools draw. They
 * are pure reads over the facade and already-owned view state; commands stay in
 * `stage-shell-commands.ts`, and no record here can open a task, accept a
 * source or allocate a renderer object.
 */
import type { ViewportRect } from '@portfolio/camera-core';
import {
	layoutSelectionReference,
	sameReference,
	type StageSelectionEntry
} from '../semantic-selection';
import type {
	StageFacade,
	StageInstrumentContent,
	StageSourceHit
} from '../stage-facade';
import type { StageTask } from '../stage-session';
import type { StageEraseCandidate } from '../stage-eraser';
import type { StageEraserController } from '../stage-eraser';
import type { StageMeasureController } from '../stage-measure';
import { STAGE_ERASER_TASK } from '../stage-eraser';
import { STAGE_MEASURE_TASK } from '../stage-measure';
import {
	SCALE_DETENTS
} from '../stage-drafting';
import {
	stageDockKeys,
	stageDockTools,
	stageFindEntries,
	STAGE_HOST_ADAPTER_ID,
	type StageContributionRow,
	type StageDockKey,
	type StageDockTool
} from '../stage-contributions';
import type { WorldIndexModel } from '../shell/world-index-model';

export type StageDockView = {
	readonly tools: readonly StageDockTool[];
	readonly keys: readonly StageDockKey[];
};

/** The dock's armable tools and its fixed keys, in their one owner-approved order. */
export function stageDockView(input: {
	readonly facade: StageFacade | null;
	readonly revision: number;
}): StageDockView {
	void input.revision;
	const tools = stageDockTools(input.facade);
	return { tools, keys: stageDockKeys(tools) };
}

/**
 * The Head's bounded Find list: contributed entries, the Index's located
 * subjects, scope destinations, the existing view commands, the Scale detents
 * and the former menu's permanent-home capabilities.
 */
export function stageFindView(input: {
	readonly facade: StageFacade | null;
	readonly revision: number;
	readonly lens: 'world' | 'experience';
	readonly query: string;
	readonly worldIndex: WorldIndexModel;
	readonly dockKeys: readonly StageDockKey[];
}): { readonly contributions: readonly StageContributionRow[]; readonly entries: readonly StageHeadFindEntry[] } {
	void input.revision;
	const contributions = stageFindEntries(input.facade);
	const needle = input.query.trim().toLowerCase();
	const entries: StageHeadFindEntry[] = [
		{ id: 'starter', adapterId: 'project-replacement', label: 'Use enclosed room starter', verb: 'Replace' },
		...input.worldIndex.rows.map((row) => ({
			id: row.sourceId,
			adapterId: 'subject',
			label: row.label,
			verb: 'Select'
		})),
		...input.worldIndex.contexts.map((context) => ({
			id: context.id,
			adapterId: 'scope',
			label: context.label,
			verb: 'Go to'
		})),
		...['Zoom in', 'Zoom out', 'Fit'].map((label, index) => ({
			id: String(index),
			adapterId: 'view-command',
			label,
			verb: 'Run'
		})),
		...input.dockKeys
			.filter((key) => !key.unavailableReason)
			.map((key) => ({
				id: key.id,
				adapterId: key.adapterId,
				label: key.label,
				verb: 'Arm'
			})),
		...contributions.map((entry) => ({
			id: entry.id,
			adapterId: entry.adapterId,
			label: entry.label,
			verb: 'Invoke'
		})),
		// O8: the Scale detents stay reachable after the Scale word leaves the
		// toolbar. They are the same existing zoom intent, not a second control.
		...SCALE_DETENTS.map((ratio) => ({
			id: `scale:${ratio}`,
			adapterId: 'scale',
			label: `Scale 1:${ratio}`,
			verb: 'Zoom'
		})),
		// R217.S20: the former ☰ menu's capabilities keep a Find entry beside their
		// permanent homes, and Keys, which has no other home.
		...HEAD_PREFERENCE_ENTRIES,
		{ id: 'keys', adapterId: 'keys', label: 'Keys', verb: 'Show' },
		...(input.lens === 'experience'
			? [{ id: 'tips', adapterId: 'experience', label: 'Show Experience tips', verb: '' }]
			: []),
		...HEAD_PROJECT_ENTRIES
	];
	return {
		contributions,
		entries: needle === '' ? entries : entries.filter((entry) => entry.label.toLowerCase().includes(needle))
	};
}

export type StageHeadFindEntry = {
	readonly id: string;
	readonly adapterId: string;
	readonly label: string;
	readonly verb: string;
};

/**
 * R217.S20 — viewing preferences the Head's Find reaches. The Stage's ⚙ holds
 * the same values; Find is the second door, and both write the one preference.
 */
export const HEAD_PREFERENCE_ENTRIES: readonly StageHeadFindEntry[] = [
	{ id: 'appearance:paper', adapterId: 'preference', label: '2D appearance: Paper', verb: 'Set' },
	{ id: 'appearance:shaded', adapterId: 'preference', label: '2D appearance: Shaded', verb: 'Set' },
	{ id: 'height-sheet:right', adapterId: 'preference', label: 'Height Sheet: Right', verb: 'Set' },
	{ id: 'height-sheet:left', adapterId: 'preference', label: 'Height Sheet: Left', verb: 'Set' },
	{ id: 'reduce-motion', adapterId: 'preference', label: 'Reduce motion', verb: 'Toggle' },
	{ id: 'motion-speed:slow', adapterId: 'preference', label: 'Motion speed: Slow', verb: 'Set' },
	{ id: 'motion-speed:normal', adapterId: 'preference', label: 'Motion speed: Normal', verb: 'Set' },
	{ id: 'motion-speed:fast', adapterId: 'preference', label: 'Motion speed: Fast', verb: 'Set' }
];

/**
 * R217.S20 — the project procedures under the project name. Rename and delete
 * run in the Head's own lifecycle dialog; download and source replacement run
 * the same route commands the project menu runs.
 */
export const HEAD_PROJECT_ENTRIES: readonly StageHeadFindEntry[] = [
	{ id: 'rename', adapterId: 'project-menu', label: 'Rename project', verb: 'Run' },
	{ id: 'delete', adapterId: 'project-menu', label: 'Delete project', verb: 'Run' },
	{ id: 'download', adapterId: 'project-menu', label: 'Download source JSON', verb: 'Run' },
	{ id: 'source', adapterId: 'project-menu', label: 'Open source JSON', verb: 'Replace' }
];

/** The armed host tool, read from the one task the session holds. */
export function stageArmedHostTool(task: StageTask | null): 'measure' | 'erase' | null {
	return task?.kind === STAGE_MEASURE_TASK
		? 'measure'
		: task?.kind === STAGE_ERASER_TASK
			? 'erase'
			: null;
}

/**
 * The armed dock key: Select when no task is open, the armed tool's key while
 * one is, and none while a non-dock task (Compose, Import) holds the column.
 */
export function stageArmedDockId(input: {
	readonly task: StageTask | null;
	readonly armedHostTool: 'measure' | 'erase' | null;
	readonly armedTool: { readonly id: string; readonly adapterId: string } | null;
	readonly dockKeys: readonly StageDockKey[];
}): string {
	if (input.task === null) return 'host-select';
	if (input.armedHostTool !== null) return input.task.kind;
	const armed = input.armedTool;
	if (
		armed !== null &&
		input.dockKeys.some((key) => key.id === armed.id && key.adapterId === armed.adapterId)
	) {
		return armed.id;
	}
	return (
		input.dockKeys.find(
			(key) => key.taskKind === input.task?.kind && key.adapterId !== STAGE_HOST_ADAPTER_ID
		)?.id ?? ''
	);
}

/** The instrument content contributed by the adapter whose task is open, if any. */
export function stageContributedInstrument(input: {
	readonly facade: StageFacade | null;
	readonly contributedTaskId: { readonly id: string; readonly adapterId: string } | null;
	readonly revision: number;
}): StageInstrumentContent | null {
	void input.revision;
	return input.contributedTaskId === null
		? null
		: (input.facade?.instrumentForTask(input.contributedTaskId.id, input.contributedTaskId.adapterId) ??
				null);
}

/** A parked task, offered only where it can actually be resumed in this lens. */
export function stageInactiveTask(input: {
	readonly facade: StageFacade | null;
	readonly lens: 'world' | 'experience';
	readonly revision: number;
}): StageTask | null {
	void input.revision;
	const lifecycle = input.facade?.session.taskLifecycle();
	if (lifecycle?.status !== 'inactive') return null;
	// Only where it can actually be resumed: a world task in the Experience lens
	// refuses Resume, so showing its panel there would stack two controls that
	// cannot act on each other.
	return (lifecycle.task.lens ?? 'world') === input.lens ? lifecycle.task : null;
}

/** The instrument host's task view: the explicit target may differ from selection. */
export function stageTaskHost(input: {
	readonly task: StageTask | null;
	readonly armedHostTool: 'measure' | 'erase' | null;
}): {
	readonly kind: string;
	readonly label: string;
	readonly targetLabel: string | null;
} | null {
	if (input.task === null || input.armedHostTool !== null) return null;
	return {
		kind: input.task.kind,
		label: input.task.label,
		targetLabel:
			input.task.targetRef === null
				? null
				: sourceLabel(input.task.targetRef.sourceId, input.task.targetRef.sourceKind)
	};
}

/** A compact, complete reference: the source kind plus its canonical identity. */
export function sourceLabel(sourceId: string, kind: string): string {
	return `${kind === 'room-floor' ? 'floor' : kind} · ${sourceId}`;
}

export type StageHostToolOverlay = {
	readonly measure: {
		readonly from: readonly [number, number];
		readonly to: readonly [number, number];
		readonly label: string;
		readonly live: boolean;
	} | null;
	readonly notice: {
		readonly css: readonly [number, number];
		readonly message: string;
		readonly kind: string;
	} | null;
};

/**
 * Project what the host tools draw through the same evaluation as everything
 * else. Identity is kept while the subject is unchanged, so a pointer moving
 * within one subject does not rebuild the Stage's ink.
 */
export function stageHostToolOverlay(input: {
	readonly facade: StageFacade | null;
	readonly armedHostTool: 'measure' | 'erase' | null;
	readonly measureTool: StageMeasureController | null;
	readonly eraserTool: StageEraserController | null;
	readonly rect: ViewportRect | null;
	readonly measure: () => ViewportRect;
}): {
	readonly overlay: StageHostToolOverlay | null;
	readonly eraseHover: StageSelectionEntry | null;
} {
	const stage = input.facade;
	const id = stage?.evaluationId() ?? null;
	if (stage === null || id === null || input.armedHostTool === null) {
		return { overlay: null, eraseHover: null };
	}
	const local = (point: readonly [number, number, number]): readonly [number, number] | null => {
		const projected = stage.projectWorld([point[0], point[1], point[2]], id);
		if (projected.kind !== 'projected') return null;
		const current = input.rect ?? input.measure();
		return [projected.css[0] - current.left, projected.css[1] - current.top];
	};
	let measured: StageHostToolOverlay['measure'] = null;
	const view = input.armedHostTool === 'measure' ? (input.measureTool?.view() ?? null) : null;
	if (view !== null) {
		const from = local(view.from.point);
		const to = local(view.to.point);
		if (from !== null && to !== null) {
			measured = { from, to, label: view.label, live: view.live };
		}
	}
	const eraseNotice = input.armedHostTool === 'erase' ? (input.eraserTool?.notice() ?? null) : null;
	const overlay: StageHostToolOverlay = { measure: measured, notice: eraseNotice };
	const candidate: StageEraseCandidate | null =
		input.armedHostTool === 'erase' ? (input.eraserTool?.candidate() ?? null) : null;
	if (candidate === null || candidate.refusal !== null) {
		return { overlay, eraseHover: null };
	}
	const hit: StageSourceHit = candidate.hit;
	const representation =
		hit.reference === undefined
			? {
					sourceId: hit.sourceId,
					sourceKind: hit.sourceKind,
					generationId: hit.generationId,
					stream: hit.stream,
					subRef: hit.subRef
				}
			: undefined;
	const reference =
		hit.reference ?? layoutSelectionReference(representation!, stage.snapshot());
	const eraseHover: StageSelectionEntry =
		representation === undefined ? { reference } : { reference, representation };
	return { overlay, eraseHover };
}

/** Whether the Eraser's current winner is the one already shown. */
export function sameEraseHover(
	current: StageSelectionEntry | null,
	next: StageSelectionEntry | null
): boolean {
	if (current === null || next === null) return current === next;
	return sameReference(current.reference, next.reference);
}
