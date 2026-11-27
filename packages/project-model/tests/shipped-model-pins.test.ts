/**
 * The committed shipped-model pin ledger is the append-only guard.
 *
 * The registry may add an id; it may never lose one or change an existing pin,
 * because one shipped id names one byte revision forever. These tests exercise
 * the comparison itself with synthetic registries (append passes, change and
 * removal fail) and then hold the committed ledger to the shipped registry.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	SHIPPED_MODEL_PIN_LEDGER_VERSION,
	shippedModelContentRevision,
	shippedModelPinLedgerIssues,
	type ShippedModelPin,
} from '../src/shipped-model-pins';
import { SHIPPED_MODELS, type ShippedModelEntry } from '../src/shipped-static';

const LEDGER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../shipped-model-pins.json');

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
