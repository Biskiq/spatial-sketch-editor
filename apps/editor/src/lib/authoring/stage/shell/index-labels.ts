/**
 * R217.S21 — Index labels.
 *
 * A located subject's **display** label: its authored name when it has one, else a
 * session-stable `Kind n`, where `n` is its place among the subjects of that kind sorted
 * by canonical identity. Naming a subject never renumbers another, and filtering the
 * Index never changes a label, because numbering runs over the whole located list before
 * any search.
 *
 * The label is presentation only. A generated `Kind n` is never serialized and never
 * becomes a name: the rename writer reads the authored value, and no command receives a
 * label from this module. The full canonical identity stays in the row's accessible name.
 *
 * Pure: no Svelte, no DOM, no source access. The route reads the authored names and kinds
 * from the admitted source and passes them in.
 */

export type IndexLabelInput = {
	/** The canonical identity: the sort key that makes a generated number stable. */
	readonly identity: string;
	/** The human kind word (Wall, Door, Window, Floor, Box, Model, Primitive, Form, Light). */
	readonly kind: string;
	/** The authored name, or `null` / blank when the subject has none. */
	readonly name: string | null;
};

export type IndexLabel = {
	/** What the creator reads: the authored name, or `Kind n` when there is none. */
	readonly label: string;
	/** `true` when the label carries an authored name; `false` when it is generated. */
	readonly authored: boolean;
};

function compareIdentity(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function authoredNameOf(name: string | null): string | null {
	if (name === null) return null;
	const trimmed = name.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/**
 * The labels for one located list, keyed by canonical identity.
 *
 * - An authored name is the label. When two or more subjects of one kind share that
 *   name, each carries its `Kind n` as well, so repeated names stay distinguishable.
 * - A subject with no authored name is `Kind n`, numbered by its sorted identity among
 *   every subject of its kind.
 */
export function indexLabels(inputs: readonly IndexLabelInput[]): ReadonlyMap<string, IndexLabel> {
	const byKind = new Map<string, IndexLabelInput[]>();
	for (const input of inputs) {
		const group = byKind.get(input.kind) ?? [];
		group.push(input);
		byKind.set(input.kind, group);
	}

	const labels = new Map<string, IndexLabel>();
	for (const [kind, group] of byKind) {
		const sorted = [...group].sort((a, b) => compareIdentity(a.identity, b.identity));
		const ordinal = new Map(sorted.map((input, index) => [input.identity, index + 1]));
		const nameCounts = new Map<string, number>();
		for (const input of sorted) {
			const name = authoredNameOf(input.name);
			if (name !== null) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
		}
		for (const input of sorted) {
			const number = ordinal.get(input.identity) ?? 0;
			const name = authoredNameOf(input.name);
			if (name === null) {
				labels.set(input.identity, { label: `${kind} ${number}`, authored: false });
			} else if ((nameCounts.get(name) ?? 0) > 1) {
				labels.set(input.identity, { label: `${name} (${kind} ${number})`, authored: true });
			} else {
				labels.set(input.identity, { label: name, authored: true });
			}
		}
	}
	return labels;
}

/** The kind word for a Layout subject. `openingKind` is read from the Opening only. */
export function layoutKindWord(sourceKind: string, openingKind?: 'door' | 'window'): string {
	if (sourceKind === 'wall') return 'Wall';
	if (sourceKind === 'opening') return openingKind === 'window' ? 'Window' : 'Door';
	if (sourceKind === 'room-floor' || sourceKind === 'room') return 'Floor';
	if (sourceKind === 'object') return 'Object';
	return sourceKind.charAt(0).toUpperCase() + sourceKind.slice(1);
}

/** The kind word for a Scene entity. */
export function sceneKindWord(entityKind: string): string {
	if (entityKind === 'model') return 'Model';
	if (entityKind === 'primitive') return 'Primitive';
	if (entityKind === 'form') return 'Form';
	if (entityKind === 'light') return 'Light';
	return entityKind.charAt(0).toUpperCase() + entityKind.slice(1);
}

/** What a subject's Plan membership says, in words the creator reads. */
export const MEMBERSHIP_LABELS: Readonly<Record<string, string>> = {
	included: 'In the current Plan',
	'filtered-type': 'Hidden by the source-kind filter',
	'outside-depth': 'Below the Plan depth',
	'outside-span': 'Outside the Plan lateral span',
	'no-meaningful-projection': 'No meaningful projection'
};

export function membershipLabel(membership: string): string {
	return MEMBERSHIP_LABELS[membership] ?? membership;
}
