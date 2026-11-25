/**
 * SL1 P2 — a failed cap assembly is never silent (§2.2).
 *
 * The gate is test 3's zero-issues catalogue; this suite covers the runtime path
 * when a group genuinely does not balance. The Layer used to hand its issues to an
 * **optional** callback the Canvas never passed, so an open group drew its edges and
 * said nothing at all.
 *
 * Now the assembly reports through `reportCapIssues`: one `console.error` per group
 * per geometry revision (a Sheet drag bumps the revision continuously and must not
 * flood), and a counter QA reads through `__STAGE_SLICE_DIAGNOSTICS__`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sectionMeshes, type SectionInput } from '$lib/authoring/stage/slice/mesh-plane-section';
import {
	readCapIssues,
	reportCapIssues,
	resetCapIssueReporting
} from '$lib/authoring/stage/slice/slice-diagnostics';
import { EDITOR_ROOT } from '../../../../helpers/import-closure';

/** A single triangle straddling the cut: an open group, so it cannot balance. */
const OPEN: SectionInput = {
	identity: 'wall:open',
	group: 'layout-structure',
	positions: new Float32Array([0, 1.0, 0, 1, 1.4, 0, 1, 1.0, 1]),
	index: [0, 1, 2]
};

const CUT = { normal: [0, -1, 0] as const, constant: 1.2 };

afterEach(() => {
	resetCapIssueReporting();
	delete (globalThis as unknown as Record<string, unknown>).__STAGE_SLICE_DIAGNOSTICS__;
});

describe('reportCapIssues: an open group is reported, once per revision', () => {
	it('reports the assembly issue the section actually produced', () => {
		const result = sectionMeshes([OPEN], CUT);

		expect(result.issues.length).toBeGreaterThan(0);
		expect(result.issues[0]!.group).toBe('layout-structure');
		expect(result.issues[0]!.unmatchedVertices).toBeGreaterThan(0);
	});

	it('logs once per group and revision, and publishes the counter', () => {
		const result = sectionMeshes([OPEN], CUT);
		const lines: string[] = [];
		const error = (message: string): void => {
			lines.push(message);
		};

		const first = reportCapIssues(result.issues, 'rev-1', { error });
		expect(first.logged).toBe(1);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain('layout-structure');
		expect(readCapIssues()).toMatchObject({
			capIssues: result.issues.length,
			groups: ['layout-structure'],
			revision: 'rev-1'
		});

		// A Sheet drag re-assembles constantly; the same revision is not re-logged.
		const again = reportCapIssues(result.issues, 'rev-1', { error });
		expect(again.logged).toBe(0);
		expect(lines).toHaveLength(1);
		// The counter still reflects the current assembly (QA must not read a stale 0).
		expect(readCapIssues()?.capIssues).toBe(result.issues.length);

		// A new revision is a new geometry: heard again.
		const revised = reportCapIssues(result.issues, 'rev-2', { error });
		expect(revised.logged).toBe(1);
		expect(lines).toHaveLength(2);
	});

	it('reports zero issues without logging', () => {
		const lines: string[] = [];
		const report = reportCapIssues([], 'rev-clean', {
			error: (message: string) => lines.push(message)
		});

		expect(report.logged).toBe(0);
		expect(lines).toEqual([]);
		expect(readCapIssues()).toEqual({ capIssues: 0, groups: [], revision: 'rev-clean' });
	});

	it('is wired into the Slice layer, not merely available', () => {
		const layer = readFileSync(
			path.join(EDITOR_ROOT, 'src/lib/authoring/stage/shell/StageSliceLayer.svelte'),
			'utf8'
		);
		expect(layer).toContain('reportCapIssues(result.issues, revision)');
	});
});
