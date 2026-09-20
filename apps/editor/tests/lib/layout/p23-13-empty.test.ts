/**
 * P23.13 S9 (step 2) — empty / sparse states (§8).
 *
 * Pins the §8 copy agreement and the open-corner sketch contract:
 * exact toolbar labels (Wall, Rect Room, Poly Room), zoom/pan hint, no fake
 * dimension promise, open corner (never a closed rect), illustrative only
 * (aria-hidden, pointer-events none, never serialized), and a startup-only
 * first-run message: the first drafting gesture dismisses it (not the
 * commit), and undoing back to an empty plan never restores it (planEmpty
 * still requires zero rooms/walls/objects/scene entities).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { componentPath, componentRule } from '../../helpers/plan-render-harness';
import {
	beginLayoutPrimitiveDraft,
	beginRectangle,
	cancelLayoutPrimitiveDraft,
	createLayoutInteractionState,
	hasLayoutTransientInteraction,
	setLayoutViewMode,
	updateRectangle
} from '$lib/editor/layout/layout-interaction';

const here = dirname(fileURLToPath(import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

const ghost = readLibSource('editor/layout/PlanEmptyGhost.svelte');
const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');

describe('P23.13 S9 empty states (§8)', () => {
	it('carries the §8 copy agreement with exact toolbar labels', () => {
		for (const source of [ghost, viewport]) {
			expect(source).toContain('Start your plan');
			expect(source).toContain('Rect Room or Poly Room');
			expect(source).toContain('Scroll to zoom');
			expect(source).toContain('Middle-drag to pan');
		}
		// The drafting sentence names the Wall tool first, per §8.
		expect(viewport).toContain(
			'Draw connected walls with Wall, or start with Rect Room or Poly Room.'
		);
	});

	it('draws a neutral open corner, never a closed rect or dimension promise', () => {
		expect(ghost).toContain('<polyline');
		expect(ghost).toContain('ghost-corner');
		expect(ghost).not.toContain('<rect');
		expect(ghost).not.toContain('10.0');
		expect(ghost).not.toContain('8.0');
		expect(ghost).not.toContain('ghost-dims');
	});

	it('mounts the sketch through the viewport’s own visibility gate, in neutral plan ink', () => {
		// T3 review pass: the accumulator shipped a session-scoped ghost/card `it`
		// whose pins were pruned as duplicates of this file, but three of them had
		// no successor here. The mount and the gate it hangs on are restored; the
		// ink is now read from the *compiled* stylesheet (T2b A-series mechanism)
		// rather than sliced out of the component source.
		expect(viewport).toContain('{#if ghostVisible}');
		expect(viewport).toContain('<PlanEmptyGhost planView={interaction.planView} />');
		// Pinning only the gate's consumer leaves a rewrite of the derivation —
		// say `planEmpty` alone — green, and the sketch would then paint over the
		// 3D view and ignore a dismissal. The gate's three terms are the contract.
		expect(viewport).toContain('const ghostVisible = $derived(');
		expect(viewport).toContain(
			"planEmpty && interaction.planViewMode === 'layout' && !ghostDismissed"
		);
		// Neutral ink: `#adb6bd` is the P23.13 §8 sketch value, so a re-tint to a
		// semantic/accent colour (or a filled shape) is the regression this catches.
		const corner = componentRule(
			componentPath('editor/layout/PlanEmptyGhost.svelte'),
			'.ghost-corner'
		);
		expect(corner.stroke).toBe('#adb6bd');
	});

	it('is illustrative only: hidden from assistive tech, pointer-transparent, unserialized', () => {
		expect(ghost).toContain('aria-hidden="true"');
		expect(ghost).toContain('pointer-events: none');
		expect(ghost).not.toContain('<button');
		// Session dismissal lives in viewport-local state, never the document.
		expect(viewport).toContain('let ghostDismissed = $state(false)');
		expect(viewport).not.toContain('ghostDismissed:');
	});

	it('removes the first-run message at the first drafting gesture, never restoring it on undo', () => {
		// planEmpty is the document gate for both ghost and card.
		expect(viewport).toContain('preview.model.rooms.length === 0');
		expect(viewport).toContain('(preview.geometry.walls ?? []).length === 0');
		expect(viewport).toContain('preview.model.objects.length === 0');
		expect(viewport).toContain('(scene?.entities.length ?? 0) === 0');
		// The card is startup-only: a session latch dismisses it on the first
		// drafting gesture or first commit, so an undo back to empty cannot
		// resurrect it.
		expect(viewport).toContain('hasLayoutTransientInteraction(interaction)');
		expect(viewport).toContain('planEmpty && !ghostVisible && !planHintDismissed');
		// The latch is owned by the editor session, never the viewport: the
		// Plan surface unmounts on Plan → 3D, so viewport-local state would
		// resurrect the card on the way back (draft → cancel/undo → 3D → Plan).
		expect(viewport).toContain('planHintDismissed = $bindable(false)');
		expect(viewport).not.toContain('let planHintDismissed = $state(false)');
		// One-way latch: nothing ever clears it, so a view round-trip before
		// any drafting still shows the card, and any round-trip after drafting
		// keeps it dismissed.
		expect(viewport).not.toContain('planHintDismissed = false');
	});

	it('lifts the latch above the Plan mount boundary (view round-trip cannot resurrect it)', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const workspace = readLibSource('editor/app/PlanWorkspace.svelte');
		// EditorApp owns the session latch at the composition root — outside
		// the `{#if viewState.activeView === 'plan'}` swap that unmounts the
		// Plan surface in 3D — and binds it into the workspace.
		expect(app).toContain('let planHintDismissed = $state(false)');
		expect(app).toContain('{#if viewState.activeView ===');
		expect(app).toContain('bind:planHintDismissed');
		// PlanWorkspace forwards the binding into the viewport.
		expect(workspace).toContain('planHintDismissed = $bindable(false)');
		expect(workspace).toContain('bind:planHintDismissed');
	});
});

describe('P23.13 S9 empty-state latch — the gate it closes on (T2b)', () => {
	// **What is behavioural here, and what is not.** The card's own visibility is
	// one line inside the viewport — `planEmpty && !ghostVisible &&
	// !planHintDismissed`, dismissed by `!planHintDismissed && (!planEmpty ||
	// hasLayoutTransientInteraction(interaction))` — and the latch is a component
	// `$state` binding three components deep. A server-side render neither runs
	// effects nor survives a view round trip, so the *ownership* half (who owns
	// the latch, and that nothing ever clears it) has no same-defect successor and
	// stays source-pinned above. What the harness can settle is that both inputs
	// of that rule answer as the rule assumes — including the case the latch
	// exists for: after a cancelled gesture the gate's inputs say "show the card"
	// again, so only a one-way latch can keep an undo from resurrecting it.

	it('sees a live drafting gesture, and comes back to rest when it is cancelled', () => {
		const interaction = createLayoutInteractionState();
		expect(hasLayoutTransientInteraction(interaction)).toBe(false);
		beginRectangle(interaction, [0, 0]);
		updateRectangle(interaction, [4, 2]);
		// A held Rect Room drag is the "first drafting gesture" the §8 rule
		// dismisses on — before anything is committed.
		expect(hasLayoutTransientInteraction(interaction)).toBe(true);
		setLayoutViewMode(interaction, 'plan');
		expect(hasLayoutTransientInteraction(interaction)).toBe(false);

		const primitive = createLayoutInteractionState();
		beginLayoutPrimitiveDraft(primitive, 'box', [0, 0]);
		expect(hasLayoutTransientInteraction(primitive)).toBe(true);
		cancelLayoutPrimitiveDraft(primitive);
		// Cancelled: the document is untouched and the gesture is gone, so this
		// input is *not* what keeps the card dismissed afterwards.
		expect(hasLayoutTransientInteraction(primitive)).toBe(false);
	});

	it('reads emptiness from the document, so the first commit closes the gate too', () => {
		// The rule's other input is document truth, not session truth: an empty
		// wall-first document reports zero of everything the gate counts, and one
		// committed Wall is already non-empty. That is why the *commit* — not just
		// the gesture — dismisses, and why the dismissal has to be latched in the
		// session rather than recomputed from the document.
		const empty = compileWallFirstLayoutGeometry(createEmptyWallFirstLayoutDocument()).geometry;
		expect((empty.walls ?? []).length).toBe(0);
		expect(empty.rooms.length).toBe(0);
		const layout = createEmptyWallFirstLayoutDocument();
		layout.junctions = [
			{ id: 'j-a', point: [0, 0] },
			{ id: 'j-b', point: [4, 0] }
		];
		layout.walls = [
			{
				id: 'wall-a',
				startJunctionId: 'j-a',
				endJunctionId: 'j-b',
				role: 'boundary',
				thickness: 0.2,
				height: 3,
				centerline: { kind: 'line' }
			}
		];
		const committed = compileWallFirstLayoutGeometry(layout).geometry;
		expect((committed.walls ?? []).length).toBeGreaterThan(0);
		expect(committed.rooms.length).toBe(0);
	});
});
