// @vitest-environment jsdom
/**
 * E10/R6 — exact light parity with the pre-E10 components.
 *
 * `fixtures/light-parity-baseline.json` was recorded on the E8 merge commit
 * (30301614) from the components this packet retired — `EntityLight.svelte`
 * (authored Point/Spot through Threlte) and the Sun `T.DirectionalLight` in
 * `WorldEnvironment.svelte` — by replaying `LIGHT_PARITY_CASES` through the real
 * `VisitorEntityGroups` and `WorldEnvironment`. Each case now replays through
 * the resolved descriptors and the Canvas light store, and every step must read
 * the identical snapshot: kind, colour, intensity, range, decay, cone, shadow
 * flag, the full shadow configuration and shadow-camera projection, world
 * placement and target.
 *
 * The baseline is frozen evidence. Re-record it only for an approved lighting
 * change, from the revision whose lighting is the reference, never to make this
 * test pass.
 */
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

describe('E10 light parity: the store realizes exactly what the retired components did', () => {
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
			for (const [step, lights] of Object.entries(record)) {
				expect(lights, `${parity.name} / ${step}`).toEqual(BASELINE[parity.name]![step]);
			}
		});
	}
});
