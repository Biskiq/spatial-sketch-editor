/**
 * P23B measurement-only step — call-site proof for the release-path DEV marks.
 *
 * The containment model (`$lib/bench/p23b-containment`) is proven behaviourally
 * in `tests/lib/bench/p23b-containment.test.ts`; nothing there would notice if
 * the viewport stopped emitting the marks it binds. The marks live in pointer
 * handlers the server-side render harness cannot drive, so this is the narrow
 * source contract that step needs (tests/README rules 3 and 6):
 *
 *   - the selection press names its hit resolution (`selection-hit`);
 *   - the direct-edit release names its commit + history write
 *     (`gesture-commit`) — the work that sits OUTSIDE `plan-apply`;
 *   - the wall-authoring click names its whole release (`authoring-release`),
 *     because that path has no `plan-apply` boundary at all;
 *   - all three go through `p2311Measure`, which is the shipped DEV +
 *     `__P2311_PERF__` gate, so no production telemetry is added and nothing
 *     can land in a `/museum` chunk.
 *
 * Each claim is asserted inside the owning function body, so a mark placed in
 * the wrong lifecycle site cannot satisfy it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const viewportPath = path.resolve(here, '../../../src/lib/editor/layout/LayoutPlanViewport.svelte');
const viewport = fs.readFileSync(viewportPath, 'utf8');
const gatePath = path.resolve(here, '../../../../../packages/layout-core/src/p2311-perf.ts');
const gate = fs.readFileSync(gatePath, 'utf8');

/** The body of one top-level `function name(...)` declaration. */
function functionBody(name: string): string {
	const header = `\n\tfunction ${name}(`;
	const start = viewport.indexOf(header);
	expect(start, `${name} is declared at the top level`).toBeGreaterThanOrEqual(0);
	const end = viewport.indexOf('\n\tfunction ', start + header.length);
	return end === -1 ? viewport.slice(start) : viewport.slice(start, end);
}

const occurrenceCount = (text: string, needle: string): number => text.split(needle).length - 1;

describe('P23B measurement-only step — release-path mark wiring (source contract)', () => {
	it('names the selection press hit resolution', () => {
		const body = functionBody('onPointerDown');
		expect(body).toContain("p2311Measure('selection-hit'");
		expect(body).toContain('resolvePlanHit(');
		expect(occurrenceCount(viewport, "p2311Measure('selection-hit'")).toBe(1);
	});

	it('names the direct-edit commit and history write inside the release chain', () => {
		const body = functionBody('commitArchitectureEditGesture');
		expect(body).toContain("commit: () => p2311Measure('gesture-commit'");
		expect(body).toContain('onLayoutTransactionCommit()');
		expect(occurrenceCount(viewport, "p2311Measure('gesture-commit'")).toBe(1);
	});

	it('names the whole wall-authoring release', () => {
		const body = functionBody('p23bClick');
		expect(body).toContain("p23bMeasureGesture(gesture, 'wall-authoring', 'release'");
		expect(body).toContain("p2311Measure('authoring-release'");
		expect(body).toContain('onClick(event)');
		expect(occurrenceCount(viewport, "p2311Measure('authoring-release'")).toBe(1);
	});

	it('emits no raw measurement mark of its own', () => {
		for (const name of ['selection-hit', 'gesture-commit', 'authoring-release']) {
			expect(viewport).not.toContain(`performance.measure('p2311:${name}'`);
		}
	});

	it('rides the shipped DEV + __P2311_PERF__ gate, so nothing reaches production', () => {
		expect(gate).toContain('env?.DEV');
		expect(gate).toContain('__P2311_PERF__');
		expect(gate).toContain('if (viteDev === false || !(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__) return work();');
	});
});
