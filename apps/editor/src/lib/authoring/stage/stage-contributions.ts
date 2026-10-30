/**
 * The host's **generic consumption** of AM-5 adapter contributions (T1.P01.S07).
 *
 * A domain adapter registers its tasks, Find entries, Card facts and instrument
 * content with the Stage facade. Nothing in the shell knows about a particular
 * domain: this module turns whatever is registered into the plain data the shell
 * renders, so a T2 or T3 adapter reaches the Index, the Card and the one
 * `StageInstrumentHost` without editing a shell or route module.
 *
 * The whole module is pure and deterministic: order comes from the facade (which
 * sorts by explicit order, then adapter ID, then entry ID), and grouping preserves
 * the first appearance of each rail family / capability pair.
 */
import { STAGE_DOCK_SHORTCUTS, type StageDockSlot } from './stage-input';
import { STAGE_ERASER_TASK } from './stage-eraser';
import { STAGE_MEASURE_TASK } from './stage-measure';
import type {
	StageCardActionRecord,
	StageCardFact,
	StageCardSubject,
	StageCardWriterRecord,
	StageFacade
} from './stage-facade';

/** One contributed operation row, ready to render. */
export type StageContributionRow = {
	readonly id: string;
	readonly label: string;
	readonly adapterId: string;
	readonly taskKind: string;
};

/** One armable **dock** tool contributed by an adapter. */
export type StageDockTool = {
	readonly id: string;
	readonly label: string;
	readonly adapterId: string;
	readonly taskKind: string;
	readonly order: number;
	readonly slot?: 'ink' | 'library';
};

/** The adapter id the host's own dock keys (Select, Measure, Eraser) are stamped with. */
export const STAGE_HOST_ADAPTER_ID = 'host';

/**
 * One key the **dock** draws (R217.S10): the host's Select, Measure and Eraser
 * plus the contributed Ink and Library, in the owner-ruled order
 * Select · Ink · Measure · Eraser | Library.
 */
export type StageDockKey = {
	readonly id: string;
	/** `null` for a contributed key the dock has no fixed slot for. */
	readonly slot: StageDockSlot | null;
	readonly label: string;
	/** The one production key, e.g. `M`; `null` for a slotless contributed key. */
	readonly shortcut: string | null;
	readonly adapterId: string;
	/** The task kind arming this key opens; Select opens none. */
	readonly taskKind: string | null;
	/** The key opens a palette above the dock (its invoked instrument). */
	readonly palette: boolean;
	/** Draw the separator before this key (Library sits beside the tools). */
	readonly separated: boolean;
};

const HOST_DOCK_KEYS: Readonly<Record<'select' | 'measure' | 'erase', { id: string; label: string; taskKind: string | null }>> = {
	select: { id: 'host-select', label: 'Select', taskKind: null },
	measure: { id: STAGE_MEASURE_TASK, label: 'Measure', taskKind: STAGE_MEASURE_TASK },
	erase: { id: STAGE_ERASER_TASK, label: 'Eraser', taskKind: STAGE_ERASER_TASK }
};

/**
 * The dock's keys, in dock order. The host contributes only its own tools; a
 * missing contributed slot (no Library mounted) is simply absent, never an inert key.
 */
export function stageDockKeys(tools: readonly StageDockTool[]): readonly StageDockKey[] {
	const host = (slot: 'select' | 'measure' | 'erase'): StageDockKey => ({
		...HOST_DOCK_KEYS[slot],
		slot,
		shortcut: STAGE_DOCK_SHORTCUTS[slot],
		adapterId: STAGE_HOST_ADAPTER_ID,
		palette: false,
		separated: false
	});
	const contributed = (tool: StageDockTool, separated = false): StageDockKey => ({
		id: tool.id,
		slot: tool.slot ?? null,
		label: tool.label,
		shortcut: tool.slot === undefined ? null : STAGE_DOCK_SHORTCUTS[tool.slot],
		adapterId: tool.adapterId,
		taskKind: tool.taskKind,
		palette: true,
		separated
	});
	const ink = tools.find((tool) => tool.slot === 'ink');
	const library = tools.find((tool) => tool.slot === 'library');
	const others = tools.filter((tool) => tool.slot === undefined);
	return [
		host('select'),
		...(ink === undefined ? [] : [contributed(ink)]),
		host('measure'),
		host('erase'),
		...others.map((tool) => contributed(tool)),
		...(library === undefined ? [] : [contributed(library, true)])
	];
}

/**
 * The armable tools the **bottom dock** shows: every contributed Find entry whose
 * declared home is `dock`, in the facade's deterministic order.
 *
 * The dock is chrome over declarations, not a second task registry: arming a tool
 * opens the very same contributed task the Index would have invoked, and the host
 * adds no domain-specific slot of its own.
 */
export function stageDockTools(facade: StageFacade | null): readonly StageDockTool[] {
	if (facade === null) return [];
	return facade
		.findEntries()
		.filter((entry) => entry.home === 'dock')
		.map((entry) => ({
			id: entry.id,
			label: entry.label,
			adapterId: entry.adapterId,
			taskKind: entry.taskKind,
			order: entry.order,
			...(entry.slot === undefined ? {} : { slot: entry.slot })
		}));
}

/** Every non-dock contribution remains reachable by Find. */
export function stageFindEntries(facade: StageFacade | null): readonly StageContributionRow[] {
	return (facade?.findEntries() ?? []).filter((entry) => entry.home !== 'dock').map((entry) => ({
		id: entry.id, label: entry.label, adapterId: entry.adapterId, taskKind: entry.taskKind
	}));
}

/**
 * The Card's facts: the host's own facts first, then every adapter's facts for the
 * selected subject.
 *
 * Contributed labels are disambiguated with their owning adapter when they collide
 * with a host fact or another adapter's fact, so the Card never silently drops one
 * adapter's fact in favour of another's identically named one.
 */
export function stageCardFacts(
	facade: StageFacade | null,
	subject: StageCardSubject | null,
	own: readonly StageCardFact[] = []
): readonly StageCardFact[] {
	const facts: StageCardFact[] = [...own];
	if (facade === null || subject === null) return facts;
	const used = new Set(facts.map((fact) => fact.label));
	for (const contributed of facade.cardFacts(subject)) {
		let label = contributed.label;
		if (used.has(label)) label = `${contributed.label} (${contributed.adapterId})`;
		let suffix = 2;
		while (used.has(label)) {
			label = `${contributed.label} (${contributed.adapterId} ${suffix})`;
			suffix += 1;
		}
		used.add(label);
		facts.push({ label, value: contributed.value });
	}
	return facts;
}

/**
 * The Card's contributed **writer** for one subject, or `null`.
 *
 * One adapter owns it (deterministic adapter-ID order in the facade), exactly like
 * the name writer: two writers for one field set would be two authorities over the
 * same fact.
 */
export function stageCardWriter(
	facade: StageFacade | null,
	subject: StageCardSubject | null
): StageCardWriterRecord | null {
	if (facade === null || subject === null) return null;
	return facade.cardWriter(subject);
}

/** The Card's scoped contributed actions for one subject, in deterministic order. */
export function stageCardActions(
	facade: StageFacade | null,
	subject: StageCardSubject | null
): readonly StageCardActionRecord[] {
	if (facade === null || subject === null) return [];
	return facade.cardActions(subject);
}
