/**
 * P23.14 Task 5 — property-first Inspector + deferred destructive entries.
 *
 * The slice finish adds surfaces, never authorities:
 *
 * - the Inspector opens on the selection (kind icon, name-or-reference,
 *   secondary reference, kind) instead of a summary block and a prose lead;
 * - raw canonical IDs stay behind Technical details;
 * - consequential actions come last in every entity block;
 * - Junction dissolve gets its Inspector / Navigator-row / Plan-menu entry
 *   points, all routing through the one planner-backed adapter, and all
 *   reason-coded from the core planner's own eligibility verdict;
 * - the two carried rows this task owns (external-history cancellation of an
 *   open numeric field, and click-commit Opening insertion).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	createEmptyLayoutPreviewState,
	dissolveWallFirstJunction,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	wallFirstJunctionDissolveRefusal,
	type LayoutPreviewState
} from '$lib/editor/layout/layout-preview-state.svelte';

const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

function readLib(relativePath: string): string {
	return readFileSync(resolve(LIB, relativePath), 'utf8');
}

const LINE = { kind: 'line' } as const;

/**
 * A canonical wall-first run whose Junction `B` is degree-2 and *collinear*
 * (dissolvable: `w1` and `w2` continue the same straight line) while `C` is
 * degree-2 on a turn (the planner refuses a non-collinear join). One fixture,
 * both verdicts.
 */
function squareDocument(): Record<string, unknown> {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor', name: 'Floor', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] },
			{ id: 'B', point: [4, 0] },
			{ id: 'C', point: [8, 0] },
			{ id: 'D', point: [8, 4] }
		],
		walls: [
			{ id: 'w1', startJunctionId: 'A', endJunctionId: 'B', role: 'partition', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'partition', thickness: 0.2, height: 3, centerline: LINE },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'partition', thickness: 0.2, height: 3, centerline: LINE }
		],
		rooms: [],
		openings: [],
		objects: []
	};
}

function makeState(): LayoutPreviewState {
	const state = createEmptyLayoutPreviewState();
	expect(importLayoutPreviewJson(state, JSON.stringify(squareDocument()))).toBe(true);
	return state;
}

describe('P23.14 §13 — the refusal query is the core planner, read-only', () => {
	it('answers null when the planner would accept, and the planner message when it refuses', () => {
		const state = makeState();
		// `B` joins two collinear straight Walls: the planner accepts.
		expect(wallFirstJunctionDissolveRefusal(state, 'B')).toBeNull();
		// `C` is a right-angle turn: the planner refuses and says why. The reason
		// is the SAME string the mutation adapter reports, because both ask
		// `planDissolveJunction` — there is no second eligibility authority.
		const refusal = wallFirstJunctionDissolveRefusal(state, 'C');
		expect(refusal).toBeTruthy();
		const applied = dissolveWallFirstJunction(state, 'C');
		expect(applied.success).toBe(false);
		expect(applied.success ? null : applied.message).toBe(refusal);
	});

	it('never installs a status message just because something asked', () => {
		const state = makeState();
		state.lastMutationMessage = null;
		expect(wallFirstJunctionDissolveRefusal(state, 'C')).toBeTruthy();
		// A query is not an attempt: the panel must be able to state the reason
		// without pretending an action ran.
		expect(state.lastMutationMessage).toBeNull();
	});

	it('names the legacy reason instead of throwing at a non-wall-first document', () => {
		const state = createEmptyLayoutPreviewState();
		expect(wallFirstJunctionDissolveRefusal(state, 'B')).toBe(
			'This operation requires a wall-first layout'
		);
	});
});

describe('P23.14 §13 — one dissolve authority, three entry points', () => {
	it('exposes the Plan context-menu item as a reason-coded destructive command', () => {
		const menu = readLib('editor/context-menu/plan-menu-items.ts');
		// The canonical Junction target exists on the shared target union.
		expect(menu).toContain("| { kind: 'junction'; junctionId: string }");
		// The item is destructive, states the caller-resolved refusal reason, and
		// is omitted (never stubbed) by a caller that cannot dissolve.
		expect(menu).toContain("if (target.kind === 'junction') {");
		expect(menu).toContain("id: 'dissolve-junction'");
		expect(menu).toContain("label: 'Dissolve junction…'");
		expect(menu).toContain('danger: true');
		expect(menu).toContain(
			'disabledReason: input.mutationBlockedReason ?? input.dissolveBlockedReason ?? null'
		);
		expect(menu).toContain('if (!input.actions.dissolveJunction) return [];');
		// No second eligibility implementation lives in the menu model: the
		// planner is not imported here at all.
		expect(menu).not.toContain('planDissolveJunction');
	});

	it('reaches the menu from the Plan viewport through the resolved endpoint Junction', () => {
		const viewport = readLib('editor/layout/LayoutPlanViewport.svelte');
		// The endpoint hit defers its Junction id to the document, exactly like
		// the click-select path — no second hit resolver.
		expect(viewport).toContain('wallEndpointJunctionId(target.wallId, target.endpoint)');
		expect(viewport).toContain('selectLayoutJunction(interaction, hitJunctionId)');
		expect(viewport).toContain("menuTarget = { kind: 'junction', junctionId: hitJunctionId };");
		// The reason is the planner's, and the command is the existing authority.
		expect(viewport).toContain('wallFirstJunctionDissolveRefusal(preview, hitJunctionId)');
		expect(viewport).toContain('dissolveJunction: (junctionId: string) => onJunctionDissolve?.(junctionId)');
		// Omitted-don't-dummy: the item only exists when the mount can dissolve.
		expect(viewport).toContain('...(onJunctionDissolve && hitJunctionId');
		expect(viewport).not.toContain('planDissolveJunction');
	});

	it('reaches the menu from the Navigator Junction row, under the row-authority gate', () => {
		const navigator = readLib('editor/hierarchy/HierarchyNavigator.svelte');
		expect(navigator).toContain(
			"else if (entity.kind === 'junction') onJunctionContextMenu(event, entity.junctionId);"
		);
		const tree = readLib('editor/UnifiedProjectTree.svelte');
		expect(tree).toContain('onJunctionContextMenu={onJunctionRowContextMenu}');
		// An inert row opens no menu at all, so the menu can never bypass the gate.
		expect(tree).toContain('if (!roomRowInteractive(row)) return;');
		expect(tree).toContain('dissolveBlockedReason: wallFirstJunctionDissolveRefusal(layoutPreview, junctionId)');
		expect(tree).toContain('dissolveWallFirstJunction(layoutPreview, junctionId)');
		expect(tree).not.toContain('planDissolveJunction');
	});

	it('exposes the Inspector action, disabled with the planner reason and destructive last', () => {
		const inspector = readLib('editor/EditorInspector.svelte');
		expect(inspector).toContain('dissolveWallFirstJunction(layoutPreview, junction.id)');
		expect(inspector).toContain('Dissolve junction…');
		expect(inspector).toContain('disabled={junctionDissolveRefusal !== null}');
		expect(inspector).toContain('const junctionDissolveRefusal = $derived(');
		// Refusal reasons are shown, never a silent no-op.
		expect(inspector).toContain(
			'{#if junctionDissolveRefusal}<p class="layout-inspector-note" role="status">{junctionDissolveRefusal}</p>{/if}'
		);
		expect(inspector).not.toContain('planDissolveJunction');
		// The handler sets the shared fixed `none` policy (the Junction is gone).
		const handlerStart = inspector.indexOf('function dissolveSelectedJunction(): void {');
		expect(handlerStart).toBeGreaterThan(-1);
		const handler = inspector.slice(handlerStart, inspector.indexOf('function updateSelectedJunction'));
		expect(handler).toContain("layoutInteraction.selection = { kind: 'none' }");
		// Destructive last: the action renders after the identity disclosure.
		const junctionStart = inspector.indexOf('aria-label="Selected wall-first junction"');
		const junctionEnd = inspector.indexOf('{:else if selectedWallFirstOpening');
		const junctionBlock = inspector.slice(junctionStart, junctionEnd);
		expect(junctionBlock.indexOf('Dissolve junction…')).toBeGreaterThan(
			junctionBlock.indexOf('<summary>Technical details</summary>')
		);
	});
});

describe('P23.14 §13 — the Inspector is property-first', () => {
	it('opens on the selection instead of a summary block or a prose lead', () => {
		const inspector = readLib('editor/EditorInspector.svelte');
		// The document-wide summary block is gone (its counts have other owners).
		expect(inspector).not.toContain('layoutPreview.model.rooms.length');
		expect(inspector).not.toContain('layoutPreview.model.objects.length');
		// The prose lead is gone; the panel keeps a plain title with no selection.
		expect(inspector).not.toContain('Layout Plan editing · preview-only');
		expect(inspector).not.toContain('Select a room or place a shape to begin editing.');
		// The header is the identity line: icon, name-or-reference, secondary
		// reference, kind.
		expect(inspector).toContain('<header class="inspector-header" aria-label="Current selection">');
		expect(inspector).toContain('{@const HeaderIcon = selectionHeader.icon}');
		expect(inspector).toContain('{selectionHeader.primary}');
		expect(inspector).toContain('{#if selectionHeader.secondary}<span class="inspector-header__reference">{selectionHeader.secondary}</span>{/if}');
		expect(inspector).toContain('<span class="inspector-header__kind">{selectionHeader.kind}</span>');
	});

	it('keeps the wall-first headers on the identity layer and the raw IDs behind Technical details', () => {
		const inspector = readLib('editor/EditorInspector.svelte');
		// The text layer stays the P23.12 authority.
		expect(inspector).toContain('selectedWallFirstWall.name ?? selectedWallReference ??');
		expect(inspector).toContain('selectedJunctionReference ??');
		expect(inspector).toContain('selectedWallFirstOpening.name ?? selectedOpeningReference ??');
		expect(inspector).toContain('<strong>{selectedWallFirstRoom.name}</strong>');
		// A Scene selection's raw entity/Room IDs leave the normal surface.
		expect(inspector).not.toContain('<div><dt>Room</dt><dd>{singleEditableObject.roomId}</dd></div>');
		expect(inspector).not.toContain('<div><dt>Room</dt><dd>{singleSelectedEntity.roomId}</dd></div>');
		expect(inspector).toContain('{#if singleEditableObject.roomId}<span class="technical-id">Room {singleEditableObject.roomId}</span>{/if}');
		expect(inspector).toContain('{#if singleSelectedEntity.roomId}<span class="technical-id">Room {singleSelectedEntity.roomId}</span>{/if}');
		// The Scene disclosure is its own state: a domain switch must not carry a
		// Layout disclosure onto a Scene entity.
		expect(inspector).toContain('let sceneTechnicalDetailsOpen = $state(false);');
	});

	it('renders the same identity header in the Camera Plan panel', () => {
		const camera = readLib('editor/app/CameraPlanInspector.svelte');
		expect(camera).toContain('<span class="identity-title">');
		// P23.0b — a canonical node carries no Room, so the locality badge is
		// derived from the node instead of asserting the legacy format.
		expect(camera).toContain("Camera node · {node.roomId ? 'room-local' : 'world-local'}");
		expect(camera).not.toContain('Camera node · room-local</span>');
		expect(camera).toContain('<span class="identity-kind">Camera connection · {connection.positionPath.kind}</span>');
		expect(camera).toContain("Camera path · {anchor.roomId ? 'room-local' : 'world-local'}");
		// The Room slot is diagnosis, not a placeholder: a world-local node has no
		// Room to name.
		expect(camera).toContain('{#if node.roomId}<span class="technical-id">Room {node.roomId}</span>{/if}');
		// No unguarded Room slot: a world-local node must not print an empty one.
		expect(camera).not.toContain('\n\t\t\t<span class="technical-id">Room {node.roomId}</span>');
		// The raw camera IDs are diagnosis, not identity copy.
		expect(camera).not.toContain('<h2>Camera node</h2>');
		expect(camera).not.toContain('<dd class="id">{node.id}</dd>');
		expect(camera).not.toContain('<dd class="id">{connection.id}</dd>');
		expect(camera).not.toContain('<dd class="id">{anchor.id}</dd>');
		expect(camera).toContain('<span class="technical-id">{node.id}</span>');
		expect(camera).toContain('<span class="technical-id">{connection.id}</span>');
		expect(camera).toContain('<span class="technical-id">{anchor.id}</span>');
		expect(camera).toContain('<span class="technical-id">{viewKeyframe.id}</span>');
		expect(camera.match(/<details class="technical-details" bind:open=\{technicalDetailsOpen\}>/g)).toHaveLength(4);
	});

	it('derives the locality badge from the selection everywhere, never a fixed string', () => {
		// P23.0b made world-local the canonical Scene format, so a panel that
		// always says the legacy word tells the user something untrue about the
		// document they are editing. Each badge follows its own selection.
		expect(readLib('editor/camera/EditorCameraInspector.svelte')).toContain(
			"{pendingNode ? 'Not saved' : node.roomId ? 'Room-local' : 'World-local'}"
		);
		expect(readLib('editor/EditorTransformInspector.svelte')).toContain(
			"{selectedObject.roomId ? 'Room-local' : 'World-local'}"
		);
		// The Arrange/Plan staging transform is room-owned by construction (a
		// world-local placement is refused upstream with its own reason text), so
		// its legend keeps the room-local wording on purpose.
		expect(readLib('editor/EditorInspector.svelte')).toContain('<legend>Room-local Plan transform</legend>');
	});

	it('orders consequential actions last in the canonical Wall and Opening blocks', () => {
		const inspector = readLib('editor/EditorInspector.svelte');
		const wallStart = inspector.indexOf('aria-label="Selected wall-first wall"');
		const wallEnd = inspector.indexOf('{:else if selectedWallFirstJunction}');
		const wallBlock = inspector.slice(wallStart, wallEnd);
		expect(wallBlock.indexOf('Delete wall')).toBeGreaterThan(
			wallBlock.indexOf('<summary>Technical details</summary>')
		);
		expect(wallBlock.indexOf('Delete wall')).toBeGreaterThan(wallBlock.indexOf('Bounded rooms'));

		const openingStart = inspector.indexOf('aria-label="Selected wall-first opening"');
		const openingEnd = inspector.indexOf('{:else if selectedLayoutOpening');
		const openingBlock = inspector.slice(openingStart, openingEnd);
		expect(openingBlock.indexOf('Delete opening')).toBeGreaterThan(
			openingBlock.indexOf('<summary>Technical details</summary>')
		);
	});
});

describe('P23.14 Task 5 carried rows', () => {
	it('cancels an open numeric field when an external history transaction replaces the document', () => {
		const viewport = readLib('editor/layout/LayoutPlanViewport.svelte');
		// `reframeVersion` is the established document/history replacement
		// signal; an external undo/redo/import must not leave a stale typed value
		// pointing at geometry that no longer exists.
		const effectStart = viewport.indexOf('let numericEntryReplacementVersion = $state<number | null>(null);');
		expect(effectStart).toBeGreaterThan(-1);
		const effect = viewport.slice(effectStart, viewport.indexOf('function frameView', effectStart));
		expect(effect).toContain('const version = preview.reframeVersion;');
		expect(effect).toContain('if (numericEntry) closeNumericEntry();');
	});

	it('commits an Opening insert on click and holds no viewport candidate', () => {
		const viewport = readLib('editor/layout/LayoutPlanViewport.svelte');
		// The door/window click path creates the canonical Opening through the
		// owner command and returns to Select: no transient candidate is parked in
		// the viewport, so there is nothing for a later click to "finish".
		expect(viewport).toContain(
			"onWallOpeningCreate?.(target.wallId, interaction.tool, target.projection.offset);"
		);
		expect(viewport).toContain("beginLayoutWallOpeningDrag(interaction");
		// Cancel/deselect paths leave only the tool reset behind.
		expect(viewport).toContain("if (interaction.tool === 'door' || interaction.tool === 'window') {\n\t\t\t\tsetLayoutDraftTool(interaction, 'select');");
	});
});
