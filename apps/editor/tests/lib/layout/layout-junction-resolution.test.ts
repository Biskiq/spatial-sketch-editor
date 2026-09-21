/**
 * P23.15 Task 2 — Junction-local, renderer-neutral resolution.
 *
 * The Junction resolver inspects every incident leg together and returns
 * Wall-attributed resolved end geometry. The policy table is the contract:
 *
 *   degree 1                          → terminal cap
 *   degree 2 tangent continuation     → suppressed (no visible interface)
 *   degree 2 hard turn                → miter / bevel
 *   degree 2 outward rays ≈ 0°        → fold (invalid)
 *   degree ≥ 3                        → resolve across all incident legs
 *
 * Ownership is branch-cut-independent: rotating the whole fixture must not
 * change which Wall owns a seam.
 */
import { describe, expect, it } from 'vitest';

import {
	resolveJunctionGeometry,
	type CompiledJunctionLeg,
	type LayoutVec2
} from '@portfolio/layout-core';

function normalize(v: LayoutVec2): LayoutVec2 {
	const length = Math.hypot(v[0], v[1]) || 1;
	return [v[0] / length, v[1] / length];
}

function rotate(v: LayoutVec2, degrees: number): LayoutVec2 {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos];
}

function leg(
	wallId: string,
	tangentOut: LayoutVec2,
	options: { end?: 'start' | 'end'; thickness?: number; height?: number } = {}
): CompiledJunctionLeg {
	const t = normalize(tangentOut);
	const thickness = options.thickness ?? 0.2;
	const height = options.height ?? 3;
	return {
		wallId,
		end: options.end ?? 'start',
		tangentOut: t,
		normalOut: [-t[1], t[0]],
		outwardAngle: Math.atan2(t[1], t[0]),
		thickness,
		halfThickness: thickness / 2,
		bottomY: 0,
		topY: height,
		role: 'partition',
		endpointOpen: false,
		endpointSolidBands: [{ bottomY: 0, topY: height, solid: true }]
	};
}

function order(legs: CompiledJunctionLeg[]): CompiledJunctionLeg[] {
	return [...legs].sort((a, b) => a.outwardAngle - b.outwardAngle || (a.wallId < b.wallId ? -1 : 1));
}

const ORIGIN: LayoutVec2 = [0, 0];

describe('P23.15 Task 2 — Junction-local resolution policy', () => {
	it('resolves degree 1 as an exposed terminal cap', () => {
		const { resolution, issues } = resolveJunctionGeometry('j', ORIGIN, [leg('w1', [1, 0])]);
		expect(issues).toEqual([]);
		expect(resolution.joins).toHaveLength(1);
		expect(resolution.joins[0]!.kind).toBe('terminal');
		expect(resolution.joins[0]!.corner).toBeNull();
	});

	it('suppresses the internal interface for a tangent continuation', () => {
		const legs = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', [-1, 0], { end: 'end' })]);
		const { resolution, issues } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(issues).toEqual([]);
		expect(resolution.joins.every((join) => join.kind === 'suppressed' && join.interfaceSuppressed)).toBe(true);
		expect(resolution.joins.every((join) => join.corner === null)).toBe(true);
	});

	it('resolves a hard turn as a miter', () => {
		const legs = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', [0, 1], { end: 'start' })]);
		const { resolution, issues } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(issues).toEqual([]);
		const joins = resolution.joins;
		expect(joins.every((join) => join.kind === 'miter' && join.corner !== null)).toBe(true);
		// Exactly one owner per seam.
		expect(joins.filter((join) => join.ownedSeam !== null)).toHaveLength(1);
	});

	it('resolves a very sharp turn past the miter limit as a bevel', () => {
		const legs = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', rotate([1, 0], 10), { end: 'start' })]);
		const { resolution } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(resolution.joins.every((join) => join.kind === 'bevel')).toBe(true);
	});

	it('refuses a fold (outward rays ≈ 0°)', () => {
		const legs = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', [1, 0], { end: 'start' })]);
		const { resolution, issues } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(issues.map((issue) => issue.code)).toContain('junction_seam_fold');
		expect(resolution.joins.every((join) => join.kind === 'suppressed')).toBe(true);
	});

	it('keeps a continuation suppressed even with a thickness/height mismatch', () => {
		const legs = order([
			leg('wa', [1, 0], { end: 'start', thickness: 0.2, height: 1.2 }),
			leg('wb', [-1, 0], { end: 'end', thickness: 0.3, height: 3 })
		]);
		const { resolution } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(resolution.joins.every((join) => join.kind === 'suppressed')).toBe(true);
		// Bands span the union of both legs' heights, so the exposed step exists.
		const bands = resolution.joins[0]!.bands;
		expect(bands[0]!.bottomY).toBeCloseTo(0, 9);
		expect(bands.at(-1)!.topY).toBeCloseTo(3, 9);
	});

	it('resolves degree 3 across all incident legs (through-pair suppressed)', () => {
		const legs = order([
			leg('wr', [1, 0], { end: 'start' }),
			leg('ws', [0, 1], { end: 'end' }),
			leg('wl', [-1, 0], { end: 'end' })
		]);
		const { resolution } = resolveJunctionGeometry('j', ORIGIN, legs);
		// The collinear antiparallel pair is one through Wall and suppresses its
		// interface; the stem is a branch, trimmed flush at the Junction plane.
		const suppressed = resolution.joins.filter((join) => join.kind === 'suppressed');
		const trimmed = resolution.joins.filter((join) => join.kind === 'trim');
		expect(suppressed.map((join) => join.wallId).sort()).toEqual(['wl', 'wr']);
		expect(trimmed.map((join) => join.wallId)).toEqual(['ws']);
		expect(trimmed[0]!.corner).toBeNull();
		expect(trimmed[0]!.ownedSeam).toBeNull();
		// No miter against an unrelated leg: that would both bury a surface and
		// open a gap where the miter apexes cross.
			expect(resolution.joins.every((join) => join.corner === null)).toBe(true);
	});

	it('resolves degree 4 without duplicate wedge owners', () => {
		const legs = order([
			leg('wa', [1, 0]),
			leg('wb', [0, 1]),
			leg('wc', [-1, 0]),
			leg('wd', [0, -1])
		]);
		const { resolution } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(resolution.joins).toHaveLength(4);
		const owners = resolution.joins.map((join) => join.ownedSeam).filter((seam) => seam !== null);
		expect(new Set(owners.map((seam) => seam!.sector)).size).toBe(owners.length);
	});

	it('assigns seam ownership independently of absolute rotation', () => {
		const base = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', [0, 1], { end: 'start' })]);
		const rotated = order([
			leg('wa', rotate([1, 0], 37), { end: 'start' }),
			leg('wb', rotate([0, 1], 37), { end: 'start' })
		]);
		const ownerOf = (legs: CompiledJunctionLeg[]): string | undefined =>
			resolveJunctionGeometry('j', ORIGIN, legs).resolution.joins.find((join) => join.ownedSeam)?.wallId;
		// Ownership must not depend on an arbitrary angular zero: both legs are
		// start legs, so the smaller `wallId` owns it.
		expect(ownerOf(base)).toBe('wa');
		expect(ownerOf(rotated)).toBe(ownerOf(base));
	});

	it('stays renderer-neutral: no issues and finite bands for a clean corner', () => {
		const legs = order([leg('wa', [1, 0], { end: 'start' }), leg('wb', [0, 1], { end: 'start' })]);
		const { resolution, issues } = resolveJunctionGeometry('j', ORIGIN, legs);
		expect(issues).toEqual([]);
		for (const join of resolution.joins) {
			for (const band of join.bands) {
				expect(Number.isFinite(band.bottomY)).toBe(true);
				expect(band.topY).toBeGreaterThanOrEqual(band.bottomY);
			}
		}
		expect(Number.isFinite(resolution.bounds2.min[0])).toBe(true);
		expect(Number.isFinite(resolution.bounds2.max[1])).toBe(true);
	});
});
