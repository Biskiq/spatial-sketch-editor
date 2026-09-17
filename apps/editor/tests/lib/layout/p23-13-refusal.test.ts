import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlanInteractionProjection, PlanRenderPrimitive } from '$lib/layout/plan-render-model';
import {
	PLAN_REFUSAL_PERSISTENCE_MS,
	beginPlanRefusal,
	planRefusalAt,
	planRefusalRemainingMs,
	withPlanRefusalAnnotation,
	type PlanRefusal
} from '$lib/editor/layout/plan-refusal';

/**
 * P23.13 S8 / §6 + §7 — the refused attempt's bounded feedback.
 *
 * The transient contract already restores the frozen baseline on refusal, so the
 * original keeps its committed ink by construction. What this suite pins is the
 * *lifetime*: the mark does not vanish with the drag that produced it, it expires
 * on its own, and a silent refusal marks nothing at all.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(here, '../../../');

function source(relative: string): string {
	return fs.readFileSync(path.join(editorRoot, 'src/lib/editor/layout', relative), 'utf8');
}

function baseProjection(): PlanInteractionProjection {
	const committed: PlanRenderPrimitive = {
		kind: 'polyline',
		key: 'plan/committed/wall',
		points: [
			[0, 0],
			[4, 0]
		],
		style: 'wall-line'
	};
	return {
		selection: [],
		handles: [],
		drafts: [committed],
		labels: []
	};
}

function refusal(atMs = 1_000): PlanRefusal {
	return {
		kind: 'architecture-edit',
		locus: [2, 1],
		reason: 'Wall would cross another wall',
		startedAtMs: atMs,
		ownerKey: 'junction-1'
	};
}

describe('P23.13 S8 refusal lifecycle', () => {
	it('records a refusal with a locus and a reason', () => {
		const record = beginPlanRefusal({
			kind: 'opening-drag',
			locus: [1, 2],
			reason: 'Opening does not fit on this wall',
			atMs: 500,
			ownerKey: 'opening-1'
		});
		expect(record).toMatchObject({
			kind: 'opening-drag',
			locus: [1, 2],
			reason: 'Opening does not fit on this wall',
			startedAtMs: 500,
			ownerKey: 'opening-1'
		});
		// The locus is copied, so a later mutation of the caller's array cannot
		// move the mark.
		expect(record?.locus).not.toBe([1, 2]);
	});

	it('marks nothing for a refusal that answers nothing', () => {
		// No locus: nowhere to mark. No reason: a mark that explains nothing is
		// worse than no mark (the same rule the status line already follows).
		expect(
			beginPlanRefusal({ kind: 'architecture-edit', locus: null, reason: 'x', atMs: 0, ownerKey: 'k' })
		).toBeNull();
		expect(
			beginPlanRefusal({ kind: 'architecture-edit', locus: [1, 1], reason: null, atMs: 0, ownerKey: 'k' })
		).toBeNull();
	});

	it('persists for the bounded window and then expires on its own', () => {
		const record = refusal(1_000);
		expect(planRefusalAt(record, 1_000)).not.toBeNull();
		expect(planRefusalAt(record, 1_000 + PLAN_REFUSAL_PERSISTENCE_MS - 1)).not.toBeNull();
		expect(planRefusalAt(record, 1_000 + PLAN_REFUSAL_PERSISTENCE_MS)).toBeNull();
		expect(planRefusalAt(record, 9_999)).toBeNull();
		// A restored clock (or a negative age) keeps the mark rather than dropping
		// it: expiry must never fire because time moved backwards.
		expect(planRefusalAt(record, 500)).not.toBeNull();
		expect(planRefusalRemainingMs(record, 1_000)).toBe(PLAN_REFUSAL_PERSISTENCE_MS);
		expect(planRefusalRemainingMs(record, 1_000 + PLAN_REFUSAL_PERSISTENCE_MS)).toBe(0);
		expect(planRefusalAt(null, 0)).toBeNull();
	});
});

describe('P23.13 S8 refusal paint', () => {
	it('is a no-op without a refusal', () => {
		const projection = baseProjection();
		expect(withPlanRefusalAnnotation(projection, null)).toBe(projection);
	});

	it('adds the stop, the × and the planner\u2019s own reason at the refused locus', () => {
		const projection = withPlanRefusalAnnotation(baseProjection(), refusal());
		const stop = projection.drafts.find((primitive) => primitive.style === 'refusal-stop');
		expect(stop).toMatchObject({ kind: 'circle', center: [2, 1], shape: 'octagon' });
		const cross = projection.drafts.find((primitive) => primitive.style === 'refusal-cross');
		expect(cross).toMatchObject({ kind: 'circle', center: [2, 1], shape: 'cross' });
		const reason = projection.labels.find((primitive) => primitive.style === 'refusal-reason');
		expect(reason).toMatchObject({
			kind: 'text',
			anchor: [2, 1],
			text: 'Wall would cross another wall'
		});
	});

	it('never removes or replaces what was already drawn', () => {
		const before = baseProjection();
		const after = withPlanRefusalAnnotation(before, refusal());
		// The original geometry keeps its own primitive, at its own coordinates:
		// refusal is an annotation *over* the drawing, never a restyle of it.
		expect(after.drafts).toContainEqual(before.drafts[0]);
		expect(after.selection).toEqual(before.selection);
		expect(after.handles).toEqual(before.handles);
	});

	it('keys the mark by canonical owner, so two refusals cannot collide', () => {
		const first = withPlanRefusalAnnotation(baseProjection(), refusal());
		const second = withPlanRefusalAnnotation(baseProjection(), {
			...refusal(),
			ownerKey: 'junction-2'
		});
		const keys = (projection: PlanInteractionProjection) =>
			projection.drafts
				.filter((primitive) => primitive.style.startsWith('refusal-'))
				.map((primitive) => primitive.key);
		expect(keys(first)).not.toEqual(keys(second));
	});
});

describe('P23.13 S8 refusal lifetime wiring (source contract)', () => {
	// The viewport is a component surface, so the wiring itself is pinned as a
	// source contract — the same reason the opening release-truth pins are.
	const viewport = source('LayoutPlanViewport.svelte');

	it('arms the annotation on a rejected release and on a refused Opening drag', () => {
		expect(viewport).toContain('armPlanRefusal({');
		expect(viewport).toContain("kind: 'architecture-edit'");
		expect(viewport).toContain("kind: 'opening-drag'");
	});

	it('expires it on the bounded window and clears it on the next deliberate action', () => {
		expect(viewport).toContain('PLAN_REFUSAL_PERSISTENCE_MS');
		expect(viewport).toContain('planRefusalAt(planRefusal, Date.now())');
		// Any new press clears the mark, and Escape (the cancel path) clears it too.
		expect(viewport).toContain('function onPointerDown(event: PointerEvent) {\n\t\t// P23.13 S8');
		expect(viewport).toContain('function cancelArchitectureEditGesture(): void {');
		expect(viewport).toContain('clearPlanRefusal();');
	});

	it('composes the annotation over the live proposal instead of replacing it', () => {
		expect(viewport).toContain(
			'withPlanRefusalAnnotation(architectureEditProjection, activePlanRefusal)'
		);
	});
});
