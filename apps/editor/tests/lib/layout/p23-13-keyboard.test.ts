/**
 * P23.13 S10 — control-group keyboard traversal (spec §9).
 *
 * Pure contract: groups follow canonical endpoint/arc order, stepping wraps,
 * unknown ids yield absence (never a guess), and announcements name role +
 * position + owner for keyboard moves only.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	planTraversalAnnouncement,
	planTraversalGroup,
	planTraversalStep,
	type PlanTraversalLayout
} from '$lib/editor/layout/plan-keyboard-traversal';

const here = dirname(fileURLToPath(import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(resolve(here, '../../../src/lib', relativePath), 'utf8');
}

function layout(): PlanTraversalLayout {
	return {
		walls: new Map([
			['wall-line', { startJunctionId: 'j-a', endJunctionId: 'j-b', knotIds: [] }],
			[
				'wall-curve',
				{ startJunctionId: 'j-b', endJunctionId: 'j-c', knotIds: ['knot-1', 'knot-2'] }
			]
		]),
		junctions: new Set(['j-a', 'j-b', 'j-c'])
	};
}

describe('P23.13 S10 traversal groups (§9)', () => {
	it('reads a straight wall in endpoint order', () => {
		const group = planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-line' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['j-a', 'j-b']);
		expect(group?.[0]).toMatchObject({ kind: 'junction', ownerId: 'j-a' });
	});

	it('reads a curved wall start → knots in arc order → end', () => {
		const group = planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-curve' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['j-b', 'knot-1', 'knot-2', 'j-c']);
		expect(group?.[1]).toMatchObject({ kind: 'curve-control', ownerId: 'wall-curve' });
	});

	it('reads an opening start edge → slide → end edge', () => {
		const group = planTraversalGroup({ kind: 'wallOpening', openingId: 'op-1' }, layout());
		expect(group?.map((control) => control.id)).toEqual(['op-1:start', 'op-1:slide', 'op-1:end']);
		expect(group?.map((control) => control.kind)).toEqual([
			'opening-edge',
			'opening-slide',
			'opening-edge'
		]);
	});

	it('treats a junction selection as its own single control', () => {
		const group = planTraversalGroup({ kind: 'junction', junctionId: 'j-a' }, layout());
		expect(group).toHaveLength(1);
		expect(group?.[0]).toMatchObject({ kind: 'junction', id: 'j-a', ownerId: 'j-a' });
	});

	it('answers null where the document supplies no group', () => {
		const known = layout();
		expect(planTraversalGroup({ kind: 'other' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'physicalWall', wallId: 'wall-missing' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'junction', junctionId: 'j-missing' }, known)).toBeNull();
		expect(planTraversalGroup({ kind: 'wallOpening', openingId: '' }, known)).toBeNull();
		expect(
			planTraversalGroup(
				{ kind: 'physicalWall', wallId: 'wall-line' },
				{ walls: known.walls, junctions: new Set(['j-a']) }
			)
		).toBeNull();
	});
});

describe('P23.13 S10 traversal stepping (§9)', () => {
	const group = [
		{ kind: 'junction' as const, id: 'j-a', ownerId: 'j-a' },
		{ kind: 'opening-slide' as const, id: 'op-1:slide', ownerId: 'op-1' },
		{ kind: 'junction' as const, id: 'j-b', ownerId: 'j-b' }
	];

	it('steps forward and backward with wrap', () => {
		expect(planTraversalStep(group, 'j-a', 1)?.id).toBe('op-1:slide');
		expect(planTraversalStep(group, 'j-b', 1)?.id).toBe('j-a');
		expect(planTraversalStep(group, 'j-a', -1)?.id).toBe('j-b');
		expect(planTraversalStep(group, 'op-1:slide', -1)?.id).toBe('j-a');
	});

	it('enters at the pressed end with no focus, and stays on a single control', () => {
		expect(planTraversalStep(group, null, 1)?.id).toBe('j-a');
		expect(planTraversalStep(group, null, -1)?.id).toBe('j-b');
		expect(planTraversalStep(group, 'elsewhere', 1)?.id).toBe('j-a');
		expect(planTraversalStep([group[0]!], 'j-a', 1)?.id).toBe('j-a');
		expect(planTraversalStep([], 'j-a', 1)).toBeNull();
	});
});

describe('P23.13 S10 traversal announcements (§9)', () => {
	it('names role, position and owner for a keyboard move', () => {
		expect(
			planTraversalAnnouncement(
				{ kind: 'opening-slide', id: 'op-1:slide', ownerId: 'op-1' },
				1,
				3,
				'Door D-0007 · 0.90 m'
			)
		).toBe('Opening slide 2 of 3 — Door D-0007 · 0.90 m');
	});
});

describe('P23.13 S10 viewport wiring (§9)', () => {
	const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');

	it('walks the group on arrows only on a quiet layout canvas', () => {
		expect(viewport).toContain("event.key === 'ArrowRight'");
		expect(viewport).toContain("event.key === 'ArrowLeft'");
		expect(viewport).toContain('planTraversalStep(group, current, direction');
		expect(viewport).toContain('planTraversalGestureQuiet()');
		// Same LOD gate the overlay draws controls with: invisible controls
		// are never focused.
		expect(viewport).toContain(
			'if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return null;'
		);
	});

	it('enters the group on Enter before reaching the numeric door', () => {
		const enterAt = viewport.indexOf('focusPlanControlByKeyboard(first, 0, group.length)');
		expect(enterAt).toBeGreaterThan(-1);
		const numericAt = viewport.indexOf('beginNumericEntryFromFocus()', enterAt);
		expect(numericAt).toBeGreaterThan(enterAt);
	});

	it('unwinds focus on Escape without touching selection or history', () => {
		const dropAt = viewport.indexOf('clearPlanFocus(interaction);\n\t\t\t\tplanFocusAnnouncement = null;');
		expect(dropAt).toBeGreaterThan(-1);
		// After every gesture/draft branch (which return above), before the
		// coarse tail clears drafts.
		const tailAt = viewport.indexOf('clearLayoutDraft(interaction);\n\t\t\tcancelRoomEdit(interaction);');
		expect(tailAt).toBeGreaterThan(dropAt);
	});

	it('moves focus without ever writing selection or history', () => {
		const focusAt = viewport.indexOf('function focusPlanControlByKeyboard');
		const endAt = viewport.indexOf('/**\n\t * Close the field.', focusAt);
		const body = viewport.slice(focusAt, endAt);
		expect(body).toContain('setPlanFocus(interaction,');
		expect(body).toContain('planFocusAnnouncement = planTraversalAnnouncement(');
		for (const writer of [
			'selectLayout',
			'clearLayoutSelection',
			'onLayoutTransaction',
			'commitLayout',
			'History'
		]) {
			expect(body, writer).not.toContain(writer);
		}
	});

	it('announces keyboard moves once, and never pointer focus', () => {
		expect(viewport).toContain('<div class="plan-focus-announcement" role="status">{planFocusAnnouncement}</div>');
		expect(viewport).toContain('.plan-focus-announcement { position: absolute; width: 1px;');
		// Exactly two assignments beyond the declaration: announce on a
		// keyboard move, clear on unwind. The pointer path focuses silently.
		const assignments = viewport.split('planFocusAnnouncement =').length - 1;
		expect(assignments).toBe(3);
		expect(viewport).toContain('planFocusAnnouncement = planTraversalAnnouncement(');
		expect(viewport).toContain('planFocusAnnouncement = null;');
	});
});
