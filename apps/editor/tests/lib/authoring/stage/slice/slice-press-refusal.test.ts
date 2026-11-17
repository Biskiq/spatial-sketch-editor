/**
 * SL1 §9 — the refusal belongs to the armed Slice **tool**, not to a live cut.
 *
 * The defect this pins: gating the Stage press on `sliceReading.isActive()` blocked
 * normal selection and manipulation for as long as a cut existed. SL1's central
 * workflow is "return to Select and edit everything below the cut", so the predicate
 * has to distinguish three states, not two:
 *
 * 1. the Slice tool is armed — a Stage press refuses, in words;
 * 2. Select is armed while the cut stays — a press is ordinary and selects;
 * 3. Put back — a press is ordinary, exactly as before any Slice.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLICE_PRESS_REFUSAL, slicePressRefusal } from '$lib/authoring/stage/stage-input';

describe('slicePressRefusal', () => {
	it('refuses while the Slice tool is armed', () => {
		expect(slicePressRefusal(true)).toBe('Drag the Height Sheet to move the cut.');
		expect(SLICE_PRESS_REFUSAL).toBe('Drag the Height Sheet to move the cut.');
	});

	it('does not refuse on Select with the cut still on', () => {
		// The reading exists; the tool does not. Editing below the cut is the point.
		expect(slicePressRefusal(false)).toBeNull();
	});

	it('does not refuse after Put back', () => {
		expect(slicePressRefusal(false)).toBeNull();
	});
});

describe('the arbiter asks about the tool, not the reading', () => {
	const input = readFileSync(
		path.join(process.cwd(), 'src/lib/authoring/stage/route/stage-input.svelte.ts'),
		'utf8'
	);
	const route = readFileSync(
		path.join(process.cwd(), 'src/routes/project/[projectId]/spatial/+page.svelte'),
		'utf8'
	);

	it('passes the armed tool into the pure predicate', () => {
		expect(input).toContain('slicePressRefusal(input.sliceToolArmed())');
		// A reading-only check is the defect: it must not appear in the arbiter.
		expect(input).not.toContain('sliceActive()');
	});

	it('wires the tool state from the shell', () => {
		const at = route.indexOf('sliceToolArmed:');
		expect(at).toBeGreaterThan(0);
		expect(route.slice(at, at + 120)).toContain("shell.activeWorldTool === 'slice'");
	});
});
