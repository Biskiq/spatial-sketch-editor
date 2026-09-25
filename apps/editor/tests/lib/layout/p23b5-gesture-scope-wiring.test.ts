/**
 * P23B.5 S4 — call-site proof for the gesture-scoped preflight sample owner.
 *
 * The machinery (the store's key grammar, refusal attribution and lifetime) is
 * proven behaviourally in `p23b5-preflight-scope.test.ts`. Nothing there would
 * notice if the viewport stopped threading the scope or stopped releasing it:
 * those tests supply their own scope and call `reset()` themselves. The wiring
 * lives in a component surface whose pointer handlers the server-side render
 * harness cannot drive, so this is the narrow source contract P23B.5's own
 * lifetime rule needs (tests/README rules 3 and 6):
 *
 *   - one non-reactive scope per viewport, created exactly once;
 *   - started empty at pointer-down, BEFORE any candidate is derived from it;
 *   - released at every path that releases the frozen baseline: the shared
 *     finish path, and the direct-clear bypass that never reaches it;
 *   - threaded into the PREFLIGHT call only, never into the proposal stage.
 *
 * Each claim is asserted inside the owning function body rather than anywhere in
 * the file, so a reset in the wrong lifecycle site cannot satisfy it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const viewportPath = path.resolve(here, '../../../src/lib/editor/layout/LayoutPlanViewport.svelte');
const viewport = fs.readFileSync(viewportPath, 'utf8');

const SCOPE = 'architectureEditSampling';

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

const occurrenceCount = (text: string, needle: string): number =>
	text.split(needle).length - 1;

describe('P23B.5 S4 gesture-scope wiring (source contract)', () => {
	it('owns exactly one non-reactive scope for the viewport', () => {
		expect(occurrenceCount(viewport, `const ${SCOPE} = createWallSamplingDerivation();`)).toBe(1);
		expect(occurrenceCount(viewport, 'createWallSamplingDerivation()')).toBe(1);
		// Derived machinery keyed on baseline centreline objects must not enter the
		// reactive graph, where a read could pin an entry to a re-render.
		expect(viewport).not.toMatch(new RegExp(`${SCOPE}\\s*=\\s*\\$state`));
	});

	it('starts the gesture from an empty scope, before anything is derived from it', () => {
		const body = functionBody('beginArchitectureEditGesture');
		const capture = body.indexOf('captureLayoutPreviewSnapshot(preview)');
		const reset = body.indexOf(`${SCOPE}.reset()`);
		expect(capture, 'the baseline is captured at pointer-down').toBeGreaterThanOrEqual(0);
		expect(reset, 'the scope is reset at pointer-down').toBeGreaterThanOrEqual(0);
		expect(reset, 'the reset follows the baseline capture').toBeGreaterThan(capture);
	});

	it('releases the scope on the shared finish path', () => {
		expect(functionBody('finishArchitectureEditGesture')).toContain(`${SCOPE}.reset()`);
	});

	it('releases the scope on the bypass path that never reaches that finish path', () => {
		expect(functionBody('cancelLocalPlanInteraction')).toContain(`${SCOPE}.reset()`);
	});

	it('threads the scope into the preflight call and nowhere else', () => {
		const attempt = callBody('transientArchitectureEdit');
		expect(attempt).toContain('baseline: architectureEditBaselineDocument()');
		expect(attempt).toContain(`sampling: ${SCOPE}`);
		// The proposal is deliberately unscoped, and the release planner owns its
		// own chain: the scope must not reach either.
		expect(viewport).not.toContain('proposeWallFirstArchitectureGeometry(baseline, coreIntent, ');
		expect(occurrenceCount(viewport, `sampling: ${SCOPE}`)).toBe(1);
	});
});
