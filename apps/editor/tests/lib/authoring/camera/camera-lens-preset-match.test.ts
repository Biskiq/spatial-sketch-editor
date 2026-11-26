import { describe, expect, it } from 'vitest';
import {
	CAMERA_LENS_PRESETS,
	findMatchingLensPreset,
	fovDegreesToFocalLengthMm
} from '$lib/authoring/camera/editor-camera-framing-authoring';

function fovForFocalLength(focalLengthMm: number): number {
	return (2 * Math.atan(12 / focalLengthMm) * 180) / Math.PI;
}

describe('findMatchingLensPreset (B7 focal-length tolerance)', () => {
	it('converts FOV to focal length on the 24 mm sensor-height convention', () => {
		expect(fovDegreesToFocalLengthMm(fovForFocalLength(24.4))).toBeCloseTo(24.4, 6);
		expect(fovDegreesToFocalLengthMm(fovForFocalLength(50))).toBeCloseTo(50, 6);
	});

	it('matches the 24 mm step for a View at 24.4 mm', () => {
		const preset = findMatchingLensPreset(fovForFocalLength(24.4));
		expect(preset?.name).toBe('wide');
		expect(preset?.focalLengthMm).toBe(24);
	});

	it('matches each preset within 1 mm of its focal length', () => {
		for (const preset of CAMERA_LENS_PRESETS) {
			expect(findMatchingLensPreset(fovForFocalLength(preset.focalLengthMm + 0.9))?.name).toBe(
				preset.name
			);
			expect(findMatchingLensPreset(fovForFocalLength(preset.focalLengthMm - 0.9))?.name).toBe(
				preset.name
			);
		}
	});

	it('leaves a View more than 1 mm away from every preset as Custom', () => {
		expect(findMatchingLensPreset(fovForFocalLength(26))).toBeNull();
		expect(findMatchingLensPreset(fovForFocalLength(37))).toBeNull();
	});

	it('returns null for non-positive or non-finite FOV', () => {
		expect(findMatchingLensPreset(0)).toBeNull();
		expect(findMatchingLensPreset(Number.NaN)).toBeNull();
	});
});
