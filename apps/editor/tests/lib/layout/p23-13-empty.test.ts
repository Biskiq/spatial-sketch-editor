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
