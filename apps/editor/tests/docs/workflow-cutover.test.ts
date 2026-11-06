/**
 * The #259 workflow cutover gate.
 *
 * Replaces `parallel-track-gates.test.ts`: the release list, batons, architecture
 * cycle and closeout skills are retired, so their structural assertions are
 * replaced by the guarantees that now carry the workflow — a valid capability
 * ledger, the status/focus/workflow routes, and the absence of the retired
 * routes with archives still present as evidence.
 *
 * The documentation walk and link/anchor resolution stay owned by
 * `documentation-references.test.ts`; product/domain boundaries stay in their
 * existing architecture suites. This file adds only the cutover guarantee.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { anchorsOf, REPO_ROOT, markdownFiles } from '../helpers/docs-references';

const read = (path: string) => readFileSync(resolve(REPO_ROOT, path), 'utf8');

/** Routes retired by the 2026-11-06 cutover, with the evidence kept instead. */
export const RETIRED_ROUTES = [
	'docs/roadmap/now.md',
	'docs/roadmap/cross-track-execution.md',
	'docs/roadmap/parallel-track-cutover',
	'docs/operations/current.md',
	'docs/operations/architecture-cycle.md',
	'.agents/skills/slice-closeout',
	'.agents/skills/phase-closeout'
] as const;

export const ARCHIVED_ROUTES: Record<string, string> = {
	'docs/roadmap/now.md': 'docs/archive/roadmap/release-list-2026-11-06.md',
	'docs/roadmap/cross-track-execution.md':
		'docs/archive/roadmap/cross-track-execution-2026-11-06.md',
	'docs/roadmap/parallel-track-cutover': 'docs/archive/roadmap/parallel-track-cutover',
	'docs/operations/current.md': 'docs/archive/process/operations-current-2026-11-06.md',
	'docs/operations/architecture-cycle.md':
		'docs/archive/process/architecture-cycle-2026-11-06.md',
	'.agents/skills/slice-closeout': 'docs/archive/process/skills/slice-closeout',
	'.agents/skills/phase-closeout': 'docs/archive/process/skills/phase-closeout'
};

/** Retired routes named by one Markdown document. Exported for the mutation control. */
export function retiredReferencesIn(source: string): string[] {
	return RETIRED_ROUTES.filter((route) => source.includes(route));
}

/** Live Markdown: the permanent archive/audit exclusions from the docs gate. */
function liveMarkdown(): string[] {
	return markdownFiles().filter((file) => {
		const path = file.slice(REPO_ROOT.length + 1);
		return !path.startsWith('docs/archive/') && !path.startsWith('Repo-Audit/');
	});
}

describe('the capability ledger drives work', () => {
	const ledger = JSON.parse(read('capabilities.json')) as {
		schemaVersion: number;
		capabilities: Array<{ id: string; northStar: string; summary: string; area: string }>;
	};

	it('is a non-empty schema-1 ledger with unique dotted ids', () => {
		expect(ledger.schemaVersion).toBe(1);
		expect(ledger.capabilities.length).toBeGreaterThan(0);
		const ids = ledger.capabilities.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of ledger.capabilities) {
			expect(entry.id).toMatch(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/);
			expect(entry.summary.trim().length).toBeGreaterThan(0);
			expect(['T1', 'T2', 'T3', 'T4', 'T5']).toContain(entry.area);
		}
	});

	it('points every capability at a real North Star heading', () => {
		const anchors = new Set(anchorsOf(read('docs/reference/north-star.md')));
		for (const entry of ledger.capabilities) {
			const fragment = entry.northStar.replace(/^north-star\.md#/, '');
			expect(anchors.has(fragment), `${entry.id} → ${entry.northStar}`).toBe(true);
		}
	});
});

describe('the replacement workflow is routed', () => {
	const workflow = read('docs/workflow.md');
	const router = read('docs/README.md');

	it('states focus, claims, flags, tiers, plans and closeout in one contract', () => {
		for (const marker of [
			'Tier 0',
			'Tier 1',
			'Tier 2',
			'needs-decision',
			'needs-ux',
			'needs-research',
			'ambiguous',
			'`bug`',
			'Claim:',
			'A plan is written when the work needs one',
			'reviewed in that draft before code is written',
			'Tier 2 waits',
			"for the owner's decision",
			'Merging is the closeout'
		]) {
			expect(workflow, marker).toContain(marker);
		}
		expect(read('focus.md')).toMatch(/Current priority:/);
		expect(read('focus.md')).toContain('**Hold:**');
	});

	it('routes "what next" through status and focus, not the retired release list', () => {
		expect(router).toContain('npm run status');
		expect(router).toContain('../focus.md');
		expect(router).toContain('./workflow.md');
		expect(router).not.toContain('phase-closeout');
		expect(read('AGENTS.md')).toContain('docs/workflow.md');
	});
});

describe('retired process routes are gone and archived', () => {
	it('removes every retired route', () => {
		for (const route of RETIRED_ROUTES) {
			expect(existsSync(resolve(REPO_ROOT, route)), route).toBe(false);
		}
	});

	it('keeps the old->new archive mapping as evidence', () => {
		for (const [route, archive] of Object.entries(ARCHIVED_ROUTES)) {
			expect(existsSync(resolve(REPO_ROOT, archive)), `${route} → ${archive}`).toBe(true);
		}
		expect(read('docs/operations/README.md')).toContain('retired on 2026-11-06');
	});

	it('has no live document pointing at a retired route', () => {
		const offenders = liveMarkdown().flatMap((file) => {
			const path = file.slice(REPO_ROOT.length + 1);
			const hits = retiredReferencesIn(readFileSync(file, 'utf8'));
			return hits.map((hit) => `${path} → ${hit}`);
		});
		expect(offenders).toEqual([]);
	});

	it('fails when a retired route is reintroduced', () => {
		expect(retiredReferencesIn('see docs/operations/current.md')).toEqual([
			'docs/operations/current.md'
		]);
		expect(retiredReferencesIn('see docs/workflow.md and focus.md')).toEqual([]);
	});
});

describe('on-demand skills', () => {
	it('keeps recovery, owner checkpointing, gardening and breaking without schedules', () => {
		const checkpoint = read('.agents/skills/work-checkpoint/SKILL.md');
		expect(checkpoint).toContain('active draft pull request');
		expect(checkpoint).not.toMatch(/baton/i);
		const owner = read('.agents/skills/owner-checkpoint/SKILL.md');
		expect(owner).toContain('Tier 1');
		expect(owner).toContain('ranked');
		expect(owner).toContain('unclaimed');
		const gardener = read('.agents/skills/gardener/SKILL.md');
		const breaker = read('.agents/skills/breaker/SKILL.md');
		expect(gardener).toContain('ARCHIVE ONLY');
		expect(gardener).toContain('never delete outright');
		expect(breaker).toContain('failing tagged test');
		expect(breaker).toContain('<core|edge>');
		for (const skill of [gardener, breaker]) {
			expect(skill.toLowerCase()).toContain('not a required');
		}
	});
});
