import type { EscapeContext, EscapeResult, WorkspaceOwner } from './protocol';

export const ESCAPE_LADDER = [
	// The deepest open context closes first. Live proposals are deeper than their tools.
	{ rung: 'pending-delete', owner: 'core' },
	{ rung: 'finish-gesture', owner: 'appearance' },
	// A claimed cancel may only restore numeric entry. Preserve the active press.
	{ rung: 'adapter-gesture-cancel', owner: 'core' },
	{ rung: 'disclosure', owner: 'core' },
	{ rung: 'adapter-keyboard-cancel', owner: 'core' },
	{ rung: 'press', owner: 'core' },
	{ rung: 'library', owner: 'library' },
	{ rung: 'align', owner: 'appearance' },
	{ rung: 'material-editor', owner: 'appearance' },
	{ rung: 'material-import', owner: 'appearance' },
	{ rung: 'repair-drawer', owner: 'appearance' },
	// The armed host tool clears its own proposal before tool or palette unwinding.
	{ rung: 'measure', owner: 'core' },
	{ rung: 'erase', owner: 'core' },
	{ rung: 'paint-picker', owner: 'appearance' },
	{ rung: 'paint-tool', owner: 'appearance' },
	// Return to the last committed segment before putting the cut back.
	{ rung: 'slice-draft', owner: 'layout-readings' },
	{ rung: 'palette', owner: 'core' },
	// Read the focus before closing a task or strip so Select can take it.
	{ rung: 'task', owner: 'core' },
	{ rung: 'world-tool', owner: 'core' },
	{ rung: 'sky', owner: 'sky', feature: true },
	{ rung: 'furnish-strip', owner: 'core' },
	// Fold the plate before moving the selection.
	{ rung: 'world-plate', owner: 'core' },
	// A posture can claim the remaining unwind after the tools and panels close.
	{ rung: 'unwind-claim', owner: 'core' },
	{ rung: 'leave', owner: 'studio' },
	{ rung: 'selection', owner: 'core' },
	{ rung: 'lift', owner: 'layout-readings' },
	// The earlier tool rung keeps the cut. A later Escape puts it back.
	{ rung: 'slice', owner: 'layout-readings' },
] as const satisfies readonly {
	readonly rung: string;
	readonly owner: WorkspaceOwner;
	readonly feature?: true;
}[];

export type EscapeRung = (typeof ESCAPE_LADDER)[number]['rung'];

type EscapeRow = (typeof ESCAPE_LADDER)[number];
type FeatureEscapeRow = Extract<EscapeRow, { readonly feature: true }>;
export type BuiltInEscapeRung = Exclude<EscapeRung, FeatureEscapeRow['rung']>;
type EscapeHandler = (context: EscapeContext) => EscapeResult;

export type FeatureEscapeRegistration = {
	[Owner in FeatureEscapeRow['owner']]: {
		readonly id: Owner;
		readonly escapeRungs: Record<
			Extract<FeatureEscapeRow, { owner: Owner }>['rung'],
			EscapeHandler
		>;
	};
}[FeatureEscapeRow['owner']];

export function compileEscapeLadder(
	builtIn: Record<BuiltInEscapeRung, EscapeHandler>,
	features: readonly FeatureEscapeRegistration[],
) {
	const handlers = new Map(Object.entries(builtIn) as [string, EscapeHandler][]);
	const expected = new Map<string, WorkspaceOwner>();
	for (const row of ESCAPE_LADDER) {
		if ('feature' in row) expected.set(row.rung, row.owner);
	}
	for (const { id, escapeRungs } of features as readonly {
		readonly id: WorkspaceOwner;
		readonly escapeRungs: Record<string, EscapeHandler>;
	}[]) {
		for (const [rung, handler] of Object.entries(escapeRungs)) {
			if (expected.get(rung) !== id) throw new Error(`Unexpected Escape rung ${id} → ${rung}`);
			expected.delete(rung);
			handlers.set(rung, handler);
		}
	}
	if (expected.size) throw new Error(`Missing Escape rungs: ${[...expected.keys()].join(', ')}`);
	return ESCAPE_LADDER.map(({ rung }) => handlers.get(rung)!);
}
