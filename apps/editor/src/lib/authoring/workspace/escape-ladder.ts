import type { WorkspaceOwner } from './protocol';

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
	{ rung: 'sky', owner: 'sky' },
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
] as const satisfies readonly { readonly rung: string; readonly owner: WorkspaceOwner }[];

export type EscapeRung = (typeof ESCAPE_LADDER)[number]['rung'];
