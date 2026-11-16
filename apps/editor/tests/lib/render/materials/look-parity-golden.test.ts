/**
 * The Look parity golden — captured before the Scene 8 schema change.
 *
 * The golden was generated from `main` at `17d86b00` (Scene 7), before any
 * production source changed. It pins two things the Scene 8 work must not move:
 *
 * - `sceneLookFor` for every catalogue look, every roughness/metalness instance
 *   and every colour-map instance — including the tinted map (`wood-walnut`
 *   keeps `#3d2a1a` over its map);
 * - `resolveSkySun` for Daylight, Golden hour, Dusk and Paper, on the visit and
 *   Stage frames.
 *
 * Regenerate deliberately with `LOOK_PARITY_GOLDEN=write npx vitest run
 * tests/lib/render/materials/look-parity-golden.test.ts`, never to make a red
 * parity test green.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { sceneLookFor } from '$lib/render/materials/scene-instance-material';
import { resolveSkySun } from '$lib/render/world-environment';
import {
	LOOK_CASES,
	SUN_CASES,
	lookCaseDocument,
	lookCaseInstanceId,
	sunCaseLook
} from './fixtures/look-parity-cases';
import { parityMismatches } from './fixtures/parity-compare';

const GOLDEN_PATH = fileURLToPath(
	new URL('./__fixtures__/look-parity-golden.json', import.meta.url)
);

type LookGolden = {
	readonly case: string;
	readonly material: unknown;
	readonly textures: unknown;
};

type SunGolden = {
	readonly case: string;
	readonly descriptor: unknown;
};

export type LookParityGolden = {
	readonly version: 1;
	readonly capturedFrom: string;
	readonly looks: readonly LookGolden[];
	readonly suns: readonly SunGolden[];
};

/** The current output for the recorded cases, in the golden's own order. */
export function currentLookParityGolden(): LookParityGolden {
	return {
		version: 1,
		capturedFrom: 'Scene 7 main (17d86b00), before the Scene 8 look schema',
		looks: LOOK_CASES.map((lookCase) => {
			const look = sceneLookFor(
				lookCaseDocument(lookCase),
				{
					materialInstanceId:
						lookCase.instance === null ? null : lookCaseInstanceId(lookCase),
					fallbackCatalogueId: lookCase.fallbackCatalogueId
				},
				lookCase.surface
			);
			return { case: lookCase.id, material: look.material, textures: look.textures };
		}),
		suns: SUN_CASES.map((sunCase) => ({
			case: sunCase.id,
			descriptor: resolveSkySun(sunCaseLook(sunCase.preset), sunCase.frame)
		}))
	};
}

function serialized(golden: LookParityGolden): string {
	return `${JSON.stringify(golden, null, 2)}\n`;
}


describe('look parity golden', () => {
	it('matches the descriptors captured from main before the Scene 8 change', () => {
		const current = currentLookParityGolden();
		if (process.env.LOOK_PARITY_GOLDEN === 'write') {
			writeFileSync(GOLDEN_PATH, serialized(current));
		}
		const recorded = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as LookParityGolden;
		const mismatches: string[] = [];
		parityMismatches(recorded, current, '$', mismatches);
		expect(mismatches).toEqual([]);
		// Scene 8 adds a mapping to every textured spec; no golden case authored
		// one, so every recorded case must still draw at the identity mapping.
		for (const look of current.looks) {
			const textures = look.textures as {
				readonly rotation?: number;
				readonly offset?: readonly [number, number];
			} | null;
			if (textures === null) continue;
			expect(textures.rotation, look.case).toBe(0);
			expect(textures.offset, look.case).toEqual([0, 0]);
		}
	});

	it('covers every catalogue id and every preset', () => {
		const recorded = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as LookParityGolden;
		expect(recorded.looks).toHaveLength(LOOK_CASES.length);
		expect(recorded.looks.filter((entry) => entry.case.startsWith('catalogue:'))).toHaveLength(6);
		expect(recorded.suns.map((entry) => entry.case)).toEqual(
			SUN_CASES.map((entry) => entry.id)
		);
	});
});
