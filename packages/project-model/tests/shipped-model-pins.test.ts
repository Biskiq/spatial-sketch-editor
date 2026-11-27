/**
 * The committed shipped-model pin ledger is the append-only guard.
 *
 * The registry may add an id; it may never lose one or change an existing pin,
 * because one shipped id names one byte revision forever. These tests exercise
 * the comparison itself with synthetic registries (append passes, change and
 * removal fail) and then hold the committed ledger to the shipped registry.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	SHIPPED_MODEL_PIN_LEDGER_VERSION,
	shippedModelContentRevision,
	shippedModelPinBaselineIssues,
	shippedModelPinLedgerIssues,
	type ShippedModelPin,
} from '../src/shipped-model-pins';
import { SHIPPED_MODELS, type ShippedModelEntry } from '../src/shipped-static';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');
const LEDGER_PATH = resolve(PACKAGE_ROOT, 'shipped-model-pins.json');
const BASELINE_LEDGER_PATH = 'packages/project-model/shipped-model-pins.json';

function git(args: readonly string[]): string | null {
	try {
		return execFileSync('git', args, {
			cwd: REPO_ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return null;
	}
}

/**
 * The landed baseline comes from git, never from the working tree. In CI the
 * suite materializes `origin/main`; before this feature has merged, the commit
 * that introduced the ledger is the append-only anchor for later changes.
 */
function readBaselineLedger(): { readonly ref: string; readonly ledger: unknown } | null {
	for (const ref of ['origin/main', 'main']) {
		if (git(['rev-parse', '--verify', ref]) === null) continue;
		const text = git(['show', `${ref}:${BASELINE_LEDGER_PATH}`]);
		if (text !== null) return { ref, ledger: JSON.parse(text) };
	}
	const added = git(['log', '--diff-filter=A', '--format=%H', '--', BASELINE_LEDGER_PATH]);
	const first = added?.split('\n').filter(Boolean).at(-1);
	if (first === undefined) return null;
	const text = git(['show', `${first}:${BASELINE_LEDGER_PATH}`]);
	return text === null ? null : { ref: first, ledger: JSON.parse(text) };
}

function pin(seed: string): ShippedModelPin {
	return {
		sha256: seed.repeat(64).slice(0, 64),
		byteSize: 1024,
		mime: 'model/gltf-binary' as const,
	};
}

function entry(assetId: string, value = pin('a')): ShippedModelEntry {
	return {
		assetId,
		productionFile: `/models/${assetId}.glb`,
		fallbackOnly: false,
		pin: value,
	};
}

function ledger(models: Record<string, ReturnType<typeof pin>>) {
	return { formatVersion: SHIPPED_MODEL_PIN_LEDGER_VERSION, models };
}

describe('shipped model pin ledger', () => {
	it('matches the committed ledger to every pinned registry entry', () => {
		const committed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as unknown;
		expect(shippedModelPinLedgerIssues(committed, SHIPPED_MODELS)).toEqual([]);
		const models = (committed as { models: Record<string, unknown> }).models;
		expect(Object.keys(models).sort()).toEqual(
			SHIPPED_MODELS.filter((value) => value.pin !== null)
				.map((value) => value.assetId)
				.sort(),
		);
	});

	it('passes when a new id is appended to both the registry and the ledger', () => {
		const first = entry('asset-a');
		const appended = entry('asset-b', pin('b'));
		expect(
			shippedModelPinLedgerIssues(
				ledger({ 'asset-a': pin('a'), 'asset-b': pin('b') }),
				[first, appended],
			),
		).toEqual([]);
	});

	it('fails when an existing pin changes', () => {
		expect(
			shippedModelPinLedgerIssues(ledger({ 'asset-a': pin('b') }), [entry('asset-a')]),
		).toEqual(['ledger:changed-pin:asset-a']);
	});

	it('fails when a pinned id is removed from the registry', () => {
		expect(
			shippedModelPinLedgerIssues(ledger({ 'asset-a': pin('a') }), [
				entry('asset-a'),
				entry('asset-b', pin('b')),
			]),
		).toEqual(['ledger:missing-pin:asset-b']);
	});

	it('fails when a fallback-only id gains a pin', () => {
		const fallback: ShippedModelEntry = {
			assetId: 'asset-placeholder',
			productionFile: null,
			fallbackOnly: true,
			pin: null,
		};
		expect(
			shippedModelPinLedgerIssues(ledger({ 'asset-placeholder': pin('a') }), [fallback]),
		).toEqual(['ledger:fallback-only-pin:asset-placeholder']);
	});

	it('derives the one resource content-revision form from a pin', () => {
		expect(shippedModelContentRevision(pin('c'))).toBe(`sha256-${'c'.repeat(64)}`);
	});
});

describe('baseline pin guard', () => {
	it('rejects a registry and ledger change made together', () => {
		const changed = pin('b');
		expect(
			shippedModelPinBaselineIssues(
				ledger({ 'asset-a': pin('a') }),
				[entry('asset-a', changed)],
				ledger({ 'asset-a': changed }),
			),
		).toEqual(['baseline:changed-registry-pin:asset-a', 'baseline:changed-ledger-pin:asset-a']);
	});

	it('rejects a removed id even when the ledger is rewritten', () => {
		expect(
			shippedModelPinBaselineIssues(
				ledger({ 'asset-a': pin('a'), 'asset-b': pin('b') }),
				[entry('asset-a')],
				ledger({ 'asset-a': pin('a') }),
			),
		).toEqual(['baseline:missing-registry:asset-b', 'baseline:missing-ledger:asset-b']);
	});

	it('rejects a baseline id downgraded to fallback-only', () => {
		const fallback: ShippedModelEntry = {
			assetId: 'asset-a',
			productionFile: null,
			fallbackOnly: true,
			pin: null,
		};
		expect(
			shippedModelPinBaselineIssues(
				ledger({ 'asset-a': pin('a') }),
				[fallback],
				ledger({ 'asset-a': pin('a') }),
			),
		).toEqual(['baseline:fallback-only:asset-a', 'baseline:missing-production-file:asset-a']);
	});

	it('rejects a ledger-only change', () => {
		expect(
			shippedModelPinBaselineIssues(
				ledger({ 'asset-a': pin('a') }),
				[entry('asset-a')],
				ledger({ 'asset-a': pin('b') }),
			),
		).toEqual(['baseline:changed-ledger-pin:asset-a']);
	});

	it('allows a new id appended to the registry and ledger', () => {
		expect(
			shippedModelPinBaselineIssues(
				ledger({ 'asset-a': pin('a') }),
				[entry('asset-a'), entry('asset-b', pin('b'))],
				ledger({ 'asset-a': pin('a'), 'asset-b': pin('b') }),
			),
		).toEqual([]);
	});

	it('holds the committed registry and ledger to the baseline landed in git', () => {
		const baseline = readBaselineLedger();
		expect(
			baseline,
			'no baseline ledger is reachable from origin/main, main, or the introducing commit',
		).not.toBeNull();
		if (baseline === null) return;
		const committed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as unknown;
		expect(
			shippedModelPinBaselineIssues(baseline.ledger, SHIPPED_MODELS, committed),
			`baseline ${baseline.ref}`,
		).toEqual([]);
	});
});
