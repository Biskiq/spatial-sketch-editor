// @vitest-environment jsdom
/**
 * Mounted Canvas parity for authored lights and the shared Scene 9 Sky. The
 * authored light snapshots come from E8 (30301614). The Sky snapshots reflect S2.
 * Regenerate with LIGHT_PARITY_GOLDEN=write from the editor workspace.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	// The sky gradient asks for a 2D context jsdom does not have; null is its handled path.
	HTMLCanvasElement.prototype.getContext = (() => null) as never;
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});
const threlte = vi.hoisted(() => ({ scene: null as unknown, invalidate: (() => {}) as () => void }));
vi.mock('@threlte/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@threlte/core')>();
	return { ...actual, useThrelte: () => ({ ...actual, scene: threlte.scene, invalidate: () => threlte.invalidate() }) };
});

import { LIGHT_PARITY_CASES } from '../fixtures/light-parity-cases';
import { runLightParityCase } from '../fixtures/light-parity-run';

import baseline from '../fixtures/light-parity-baseline.json';

const BASELINE = baseline as Record<string, Record<string, unknown>>;

const regeneration = process.env.LIGHT_PARITY_GOLDEN === 'write';
const regenerated: Record<string, Record<string, unknown>> = {};

describe('Canvas light realization parity', () => {
	it('the baseline covers every case and step', () => {
		expect(Object.keys(BASELINE)).toEqual(LIGHT_PARITY_CASES.map((parity) => parity.name));
		for (const parity of LIGHT_PARITY_CASES) {
			expect(Object.keys(BASELINE[parity.name]!)).toEqual([
				'mounted',
				...parity.steps.map((step) => step.name),
				'unmounted'
			]);
		}
	});

	for (const parity of LIGHT_PARITY_CASES) {
		it(`${parity.name}: every step reads the recorded lights`, () => {
			const record = runLightParityCase(parity, threlte);
			if (regeneration) {
				regenerated[parity.name] = record;
				if (Object.keys(regenerated).length === LIGHT_PARITY_CASES.length) {
					writeFileSync(resolve('tests/lib/render/fixtures/light-parity-baseline.json'),
						JSON.stringify(regenerated, null, 2) + '\n');
				}
				return;
			}
			for (const [step, lights] of Object.entries(record)) {
				expect(lights, `${parity.name} / ${step}`).toEqual(BASELINE[parity.name]![step]);
			}
		});
	}
});
