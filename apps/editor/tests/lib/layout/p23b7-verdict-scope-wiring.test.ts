/**
 * P23B.7 S4 — call-site proof for the gesture-scoped VERDICT owner.
 *
 * The machinery (initialization, affected-only passes, fallback and lifetime) is
 * proven behaviourally in `p23b7-verdict-scope.test.ts`; that file supplies its
 * own scopes and calls `reset()` itself, so it would not notice if the viewport
 * stopped building or dropping the scope. The wiring lives in a component surface
 * whose pointer handlers the server-side render harness cannot drive, so this is
 * the narrow source contract P23B.7's OR-8 lifetime rule needs (tests/README
 * rules 3 and 6):
 *
 *   - one non-reactive verdict scope per viewport, declared exactly once;
 *   - BUILT at pointer-down from the same frozen baseline the proposal reads,
 *     after the baseline is captured and before any candidate is derived;
 *   - RELEASED on both paths that release the frozen baseline: the shared finish
 *     path and the direct-clear bypass that never reaches it;
 *   - threaded into the PREFLIGHT call only — the proposal stage and the release
 *     planner keep their canonical paths.
 *
 * Each claim is asserted inside the owning function body rather than anywhere in
 * the file, so a release in the wrong lifecycle site cannot satisfy it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const viewportPath = path.resolve(here, '../../../src/lib/editor/layout/LayoutPlanViewport.svelte');
const viewport = fs.readFileSync(viewportPath, 'utf8');

const SCOPE = 'architectureEditVerdictScope';

/**
 * The body of one top-level `function name(...)` declaration: from its header to
 * the next top-level declaration. Nested functions/callbacks are indented deeper,
 * so the next `\n\tfunction ` really is the following sibling.
 */
function functionBody(name: string): string {
	const header = `\n\tfunction ${name}(`;
	const start = viewport.indexOf(header);
	expect(start, `${name} is declared at the top level`).toBeGreaterThanOrEqual(0);
	const end = viewport.indexOf('\n\tfunction ', start + header.length);
	return end === -1 ? viewport.slice(start) : viewport.slice(start, end);
}

/** The body of one `name({ ... })` call, from the call to its closing `});`. */
function callBody(callee: string): string {
	const start = viewport.indexOf(`${callee}({`);
	expect(start, `${callee} is called`).toBeGreaterThanOrEqual(0);
	const end = viewport.indexOf('});', start);
	expect(end, `${callee} call is a closed object literal`).toBeGreaterThan(start);
	return viewport.slice(start, end);
}

const occurrenceCount = (text: string, needle: string): number => text.split(needle).length - 1;

describe('P23B.7 S4 verdict-scope wiring (source contract)', () => {
	it('owns exactly one non-reactive verdict scope for the viewport', () => {
		expect(occurrenceCount(viewport, 'createWallFirstArchitectureVerdictScope(')).toBe(1);
		expect(
			occurrenceCount(viewport, `let ${SCOPE}: WallFirstArchitectureVerdictScope | null = null;`)
		).toBe(1);
		// Derived machinery keyed on a frozen baseline must not enter the reactive
		// graph, where a read could pin a verdict to a re-render. The declaration
		// above is the whole spelling; any reactive form would be an assignment this
		// counter finds, so the claim is not vacuous.
		expect(occurrenceCount(viewport, `${SCOPE} = $state`), 'never a reactive owner').toBe(0);
	});

	it('builds the scope at pointer-down, after the baseline is frozen and before any move', () => {
		const body = functionBody('beginArchitectureEditGesture');
		const capture = body.indexOf('captureLayoutPreviewSnapshot(preview)');
		const sampleReset = body.indexOf('architectureEditSampling.reset()');
		const build = body.indexOf('createWallFirstArchitectureVerdictScope(');
		expect(body).toContain('const verdictBaseline = architectureEditBaselineDocument();');
		expect(capture, 'the baseline is captured at pointer-down').toBeGreaterThanOrEqual(0);
		expect(sampleReset).toBeGreaterThan(capture);
		expect(build, 'the verdict scope is built at pointer-down').toBeGreaterThan(sampleReset);
	});

	it('releases the verdict scope on the shared finish path', () => {
		expect(functionBody('finishArchitectureEditGesture')).toContain(`${SCOPE} = null;`);
	});

	it('releases the verdict scope on the bypass path that never reaches that finish path', () => {
		expect(functionBody('cancelLocalPlanInteraction')).toContain(`${SCOPE} = null;`);
	});

	it('threads the verdict scope into the preflight call and nowhere else', () => {
		const attempt = callBody('transientArchitectureEdit');
		expect(attempt).toContain('baseline: architectureEditBaselineDocument()');
		expect(attempt).toContain(`sampling: architectureEditSampling`);
		expect(attempt).toContain(`verdictScope: ${SCOPE}`);
		// Once in the whole surface: not into the proposal, not into the release
		// planner, not into any other call.
		expect(occurrenceCount(viewport, `verdictScope: ${SCOPE}`)).toBe(1);
		expect(occurrenceCount(viewport, 'verdictScope:')).toBe(1);
		expect(functionBody('planArchitectureEditTarget')).not.toContain(SCOPE);
	});
});
