import type { EditorWorkspace } from '../editor-types';

/** Shell domain the Inspector's workspace resolution reads. Null = relic (no shell state). */
export type InspectorShellDomain = 'scene' | 'camera';
/** Shell view the Inspector's workspace resolution reads. Null = relic. */
export type InspectorShellView = 'plan' | '3d';
/** Plan local mode the Inspector's workspace resolution reads. Null = relic/unknown. */
export type InspectorPlanViewMode = 'layout' | 'staging';

export type InspectorWorkspaceInput = {
	/** Shell domain, or null when the caller passes no shell state (relic). */
	domain: InspectorShellDomain | null;
	/** Shell view, or null when the caller passes no shell state (relic). */
	view: InspectorShellView | null;
	/** Plan local mode, or null when unknown/relic. */
	planViewMode: InspectorPlanViewMode | null;
	/** Legacy workspace mapping, kept for the relic only. */
	fallback: EditorWorkspace;
};

/**
 * P23.14 follow-up — resolve the Inspector's workspace from the actual shell
 * state (domain × view × local mode), not the legacy workspace mapping.
 *
 * The shell maps BOTH Scene Plan modes onto the legacy `'layout'` workspace
 * (`EditorApp.svelte`), so reading the legacy workspace collapses Layout and
 * Arrange into one state: Scene Plan Arrange with a Scene selection then
 * resolves exposure with `workspace === 'layout'`, which exposes no Scene slot
 * and drops the Arrange panel into its empty state. The shell state keeps them
 * distinct:
 *
 * - Scene + Plan + Layout → `'layout'` (Layout authority; a remembered Scene
 *   selection stays remembered, not presented);
 * - Scene + Plan + Arrange → `'scene'` (owner-aware Layout override still
 *   applies downstream via `staging` in `resolveInspectorDomain`);
 * - Scene + 3D → `'scene'`;
 * - Camera + Plan/3D → `'camera'`;
 * - relic (no shell state) → legacy `fallback`, ungated as before.
 *
 * Pure: exposure changes, stored selection never does.
 */
export function resolveInspectorWorkspace({
	domain,
	view,
	planViewMode,
	fallback
}: InspectorWorkspaceInput): EditorWorkspace {
	if (domain === null || domain === undefined) return fallback;
	if (domain === 'camera') return 'camera';
	if (view === 'plan' && planViewMode === 'layout') return 'layout';
	return 'scene';
}

/** The canonical active selection's domain, or `none` while nothing is active. */
export type InspectorSelectionDomain = EditorWorkspace | 'none';

export type InspectorTargetInput = {
	/** The domain the SHELL is in — what the panel is allowed to present. */
	workspace: EditorWorkspace;
	/** The canonical active selection's domain (see `deriveActiveSelection`). */
	selectionDomain: InspectorSelectionDomain;
	/** Scene Plan in Arrange: the layout owner applies to a layout target. */
	staging: boolean;
};

/**
 * P23.14 §2.5/§13 — the Inspector's ONE exposed target.
 *
 * The workspace owns exposure. The canonical selection is remembered across a
 * domain switch (S3 view-switch preservation) but is only *presented* while it
 * belongs to the workspace that is on screen, so a Scene workspace can never
 * mount the Camera editor (F1) and the header can never describe an entity
 * whose editor is not below it (F2).
 *
 * Scene is one workspace across Plan and 3D, so its Layout drafting target is
 * exposed there beside Scene entities. Camera exposes neither.
 *
 * Nothing here clears, re-derives or re-scopes stored selection: only its
 * exposure changes.
 */
export function resolveInspectorDomain({
	workspace,
	selectionDomain,
	staging
}: InspectorTargetInput): EditorWorkspace {
	if (staging) return selectionDomain === 'layout' ? 'layout' : 'scene';
	if (selectionDomain === 'none') return workspace;
	if (selectionDomain === workspace) return selectionDomain;
	if (workspace === 'scene' && selectionDomain === 'layout') return 'layout';
	return workspace;
}

/** Which remembered selection slots the current workspace may present. */
export type InspectorExposure = {
	readonly layout: boolean;
	readonly scene: boolean;
	readonly camera: boolean;
};

/**
 * Slot exposure for the raw selection stores. The selection *slots* are memory
 * (`deriveActiveSelection` already keeps the navigation slot out of the active
 * selection while Scene is live), but the Inspector reads the slots directly
 * for its panels and its header, so it must apply the same gate: a remembered
 * Camera node is not a Scene selection, and a remembered Scene placement is
 * not a Camera one.
 */
export function resolveInspectorExposure(workspace: EditorWorkspace): InspectorExposure {
	const scene = workspace === 'scene';
	return { layout: scene, scene, camera: workspace === 'camera' };
}
