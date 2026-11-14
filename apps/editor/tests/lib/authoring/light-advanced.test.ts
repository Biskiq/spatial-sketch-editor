/**
 * T2 gallery UX recovery — the Advanced registry.
 *
 * Groups are fixed-order, kind-filtered and never render an empty or
 * placeholder control; every group has a one-line summary in the shared
 * vocabulary and every row writes one `update-light` payload.
 */
import { describe, expect, it } from 'vitest';
import {
	advancedGroupsFor,
	advancedRowsFor,
	advancedSummary,
	LIGHT_ADVANCED_GROUPS,
	type LightAdvancedLight
} from '$lib/authoring/adapters/light/light-advanced';

function light(overrides: Partial<LightAdvancedLight> = {}): LightAdvancedLight {
	return {
		light: 'spot',
		color: '#ffffff',
		intensity: Math.PI,
		position: [3, 2.2, 2],
		rotation: [0, 0, 0],
		castShadow: false,
		angle: Math.PI / 6,
		...overrides
	};
}

describe('Advanced groups', () => {
	it('keeps the approved fixed order', () => {
		expect(LIGHT_ADVANCED_GROUPS.map((group) => group.id)).toEqual([
			'colour',
			'brightness',
			'shape',
			'position',
			'shadows'
		]);
	});

	it('renders no group that has no control for the kind', () => {
		expect(advancedGroupsFor('point').map((group) => group.id)).toEqual([
			'colour',
			'brightness',
			'shape',
			'position',
			'shadows'
		]);
		expect(advancedGroupsFor('spot').map((group) => group.id)).toEqual([
			'colour',
			'brightness',
			'shape',
			'position',
			'shadows'
		]);
		// Directional is retired: no kind has a Direction group or its rows.
		expect(LIGHT_ADVANCED_GROUPS.map((group) => group.id)).not.toContain('direction');
		expect(
			LIGHT_ADVANCED_GROUPS.flatMap((group) => group.rows.map((row) => row.id))
		).not.toContain('direction-from');
		const pointShape = advancedGroupsFor('point').find((group) => group.id === 'shape')!;
		expect(advancedRowsFor(pointShape, 'point').map((row) => row.id)).toEqual(['reach']);
	});

	it('holds at most five rows in a group and at most eight groups', () => {
		expect(LIGHT_ADVANCED_GROUPS.length).toBeLessThanOrEqual(8);
		for (const group of LIGHT_ADVANCED_GROUPS) {
			expect(group.rows.length).toBeLessThanOrEqual(5);
			expect(group.rows.length).toBeGreaterThan(0);
		}
	});

	it('summarises every group in the shared vocabulary', () => {
		const spot = light();
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[0]!, spot, 0)).toBe('Neutral white');
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[1]!, spot, 0)).toBe('1×');
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[2]!, spot, 0)).toBe('30° · sharp · unlimited');
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[3]!, spot, 0)).toBe('3.00 · 2.20 · 2.00 m');
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[4]!, spot, 0)).toBe('Off');
		const coloured = light({ color: '#ffa04d' });
		expect(advancedSummary(LIGHT_ADVANCED_GROUPS[0]!, coloured, 0)).toBe('Colour #ffa04d');
	});
});

describe('Advanced row writes', () => {
	function row(groupId: string, rowId: string) {
		const group = LIGHT_ADVANCED_GROUPS.find((candidate) => candidate.id === groupId)!;
		return group.rows.find((candidate) => candidate.id === rowId)!;
	}

	it('writes the warmth ramp colour from its slider', () => {
		expect(row('colour', 'warmth').write(-50, light(), 0)).toEqual({ color: '#ffd6a5' });
	});

	it('switches White → Colour and Colour → White on the stored colour only', () => {
		const mode = row('colour', 'colour-mode');
		expect(mode.read(light(), 0)).toBe('white');
		// Colour → White snaps to the nearest ramp w, which is Candle for this orange.
		expect(mode.write('white', light({ color: '#ffa04d' }), 0)).toEqual({
			color: '#ffb46b'
		});
		expect(mode.write('colour', light({ color: '#ffa04d' }), 0)).toEqual({
			color: '#ffa04d'
		});
	});

	it('writes Beam width in radians and keeps the exact angle in its summary', () => {
		const beam = row('shape', 'beam');
		expect(beam.write(45, light(), 0)).toEqual({ angle: Math.PI / 4 });
		expect(beam.summary(light({ angle: (100 * Math.PI) / 180 }), 0)).toBe('100°');
	});

	it('writes Reach as null or metres', () => {
		const reach = row('shape', 'reach');
		expect(reach.write(null, light(), 0)).toEqual({ range: null });
		expect(reach.write(2.5, light(), 0)).toEqual({ range: 2.5 });
	});

	it('reads position Height relative to the datum and writes it back', () => {
		const position = row('position', 'position');
		expect(position.read(light(), 0.2)).toEqual([3, 2, 2]);
		expect(position.write([3, 1, 2], light(), 0.2)).toEqual({ position: [3, 1.2, 2] });
	});

	it('writes Aim as rotation only and never implies a stored target', () => {
		const aim = row('position', 'aim');
		expect(aim.label).toContain('direction only');
		expect(aim.summary(light(), 0)).toBe('Direction');
		const payload = aim.write([3, 0, -1], light(), 0) as { rotation: [number, number, number] };
		expect(Object.keys(payload)).toEqual(['rotation']);
		expect(payload.rotation.every(Number.isFinite)).toBe(true);
	});

	it('writes Shadows as the authored castShadow flag', () => {
		expect(row('shadows', 'shadows').write(true, light(), 0)).toEqual({ castShadow: true });
	});
});
