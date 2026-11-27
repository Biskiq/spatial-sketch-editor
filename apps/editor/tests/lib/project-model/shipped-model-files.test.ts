/**
 * Every shipped GLB is served at exactly the bytes its pin declares.
 *
 * This is the runtime half of the D8a identity invariant: the pin ledger keeps
 * the registry honest, and this suite hashes the production files under
 * `apps/editor/static` so a replaced or reprocessed file cannot keep its id.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	SHIPPED_MODELS,
	shippedModelContentRevision,
} from '@portfolio/project-model/package';

const STATIC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../static');
const PRODUCTION_MODEL_FILE = /^\/(?:museum\/models|models\/fixtures)\/.+\.glb$/;

describe('shipped model production files', () => {
	it('declares a pin exactly when a production file exists', () => {
		for (const entry of SHIPPED_MODELS) {
			expect(entry.pin === null, entry.assetId).toBe(entry.productionFile === null);
			expect(entry.fallbackOnly, entry.assetId).toBe(entry.productionFile === null);
			if (entry.productionFile !== null) {
				// D8c ships fixtures from `/models/fixtures/`; museum models stay under
				// `/museum/models/`. Both are production static paths.
				expect(entry.productionFile, entry.assetId).toMatch(PRODUCTION_MODEL_FILE);
				expect(existsSync(resolve(STATIC_ROOT, entry.productionFile.slice(1))), entry.assetId).toBe(
					true,
				);
			}
		}
	});

	it('accepts both production model directories, including D8c fixtures', () => {
		expect('/museum/models/furniture/chair/salon-chair.glb').toMatch(PRODUCTION_MODEL_FILE);
		expect('/models/fixtures/salon-chair.glb').toMatch(PRODUCTION_MODEL_FILE);
		expect('/models/salon-chair.glb').not.toMatch(PRODUCTION_MODEL_FILE);
	});

	it('hashes every shipped GLB against its exact pin', () => {
		const files: string[] = [];
		for (const entry of SHIPPED_MODELS) {
			if (entry.productionFile === null || entry.pin === null) continue;
			const bytes = readFileSync(resolve(STATIC_ROOT, entry.productionFile.slice(1)));
			const digest = `sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`;
			expect(bytes.byteLength, entry.assetId).toBe(entry.pin.byteSize);
			expect(digest, entry.assetId).toBe(shippedModelContentRevision(entry.pin));
			expect(entry.pin.mime, entry.assetId).toBe('model/gltf-binary');
			files.push(entry.productionFile);
		}
		expect(new Set(files).size).toBe(files.length);
	});
});
