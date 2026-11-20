/**
 * Target qualification and pure binding.
 *
 * The suite catches: a target mapping refusing a legacy GLB instead of falling
 * back to identity UV0, an explicit surface mapping silently using identity, a
 * missing UV set becoming an empty texture sample, a degenerate UV frame
 * satisfying a normal map, stale facts being accepted, and a shared Finish being
 * bound differently from one definition.
 */
import { describe, expect, it } from 'vitest';
import {
	bindFinish,
	intersectTargetAvailability,
	materialMetricRepeat,
	qualifyAcrossTargets,
	readRecipe,
	resolveFinish,
	summarizeDrawGeometry,
	type BindingTarget,
	type Mapping,
	type Recipe,
	type TargetFacts
} from '@portfolio/project-model/materials';
import {
	FORM_FACTS,
	MODEL_FACTS,
	TWO_UV_FACTS,
	fixtureImageIndex,
	fullRecipe
} from './fixtures';

function readFull(mapping?: Mapping): Recipe {
	const input = fullRecipe();
	if (mapping !== undefined) {
		(input as { mapping: Mapping }).mapping = mapping;
	}
	const read = readRecipe(input);
	if (!read.success) throw new Error(JSON.stringify(read.issues));
	return read.recipe;
}

function resolutionFor(mapping?: Mapping) {
	return resolveFinish({ material: readFull(mapping) }, undefined, undefined, fixtureImageIndex());
}

const QUAD_POSITIONS = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];
const QUAD_UV0 = [0, 0, 1, 0, 1, 1, 0, 1];

describe('draw geometry facts', () => {
	it('derives one UV set and one normal frame from an indexed quad', () => {
		const draw = summarizeDrawGeometry('mesh-0', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			uvs: [QUAD_UV0, null]
		});
		expect(draw).toEqual({ drawKey: 'mesh-0', uvSets: [0], normalFrameSets: [0] });
	});

	it('lets an empty draw range contribute no requirement', () => {
		const draw = summarizeDrawGeometry('empty', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			drawRange: { start: 6, count: 0 },
			uvs: [null, null]
		});
		expect(draw).toEqual({ drawKey: 'empty', uvSets: [0, 1], normalFrameSets: [0, 1] });
	});

	it('applies the draw range before requiring a finite pair for every vertex', () => {
		const positions = [...QUAD_POSITIONS, 2, 0, 0, 2, 1, 0];
		const indices = [...QUAD_INDICES, 0, 1, 5];
		const uv0 = [...QUAD_UV0, 2, 0, 2, 1];
		const uv1 = [...QUAD_UV0, 0, 0, Number.NaN, 0, 1, 0];
		const full = summarizeDrawGeometry('full', {
			positions,
			indices,
			uvs: [uv0, uv1]
		});
		expect(full.uvSets).toEqual([0]);
		const ranged = summarizeDrawGeometry('first-triangle', {
			positions,
			indices,
			drawRange: { start: 0, count: 3 },
			uvs: [uv0, uv1]
		});
		expect(ranged.uvSets).toEqual([0, 1]);
		expect(ranged.normalFrameSets).toEqual([0, 1]);
	});

	it('accepts a mirrored UV island when its frame is non-singular', () => {
		const mirrored = [-1, 0, -1, 1, 0, 1, 0, 0];
		const draw = summarizeDrawGeometry('mirrored', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			uvs: [QUAD_UV0, mirrored]
		});
		expect(draw.uvSets).toEqual([0, 1]);
		expect(draw.normalFrameSets).toEqual([0, 1]);
	});

	it('separates a finite UV set from a usable tangent frame', () => {
		const collapsed = [0, 0, 0, 0, 0, 0, 0, 0];
		const draw = summarizeDrawGeometry('collapsed', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			uvs: [collapsed, null]
		});
		expect(draw.uvSets).toEqual([0]);
		expect(draw.normalFrameSets).toEqual([]);

		const degeneratePositions = [0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0];
		const degenerate = summarizeDrawGeometry('degenerate', {
			positions: degeneratePositions,
			indices: [0, 1, 2, 2, 1, 0],
			uvs: [QUAD_UV0, null]
		});
		expect(degenerate.uvSets).toEqual([0]);
		expect(degenerate.normalFrameSets).toEqual([]);
	});

	it('distinguishes malformed geometry from a legitimately empty range', () => {
		const empty = summarizeDrawGeometry('empty', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			drawRange: { start: 6, count: 0 },
			uvs: [QUAD_UV0, null]
		});
		expect(empty.invalidGeometry).toBeUndefined();
		expect(empty.uvSets).toEqual([0, 1]);

		const outOfRange = summarizeDrawGeometry('bad-index', {
			positions: QUAD_POSITIONS,
			indices: [0, 1, 99],
			uvs: [QUAD_UV0, null]
		});
		expect(outOfRange).toEqual({ drawKey: 'bad-index', invalidGeometry: true, uvSets: [], normalFrameSets: [] });

		const partialTriangle = summarizeDrawGeometry('partial', {
			positions: QUAD_POSITIONS,
			indices: [0, 1, 2, 3],
			uvs: [QUAD_UV0, null]
		});
		expect(partialTriangle.invalidGeometry).toBe(true);
	});

	it('uses material groups as the active ranges', () => {
		const uv1 = [0, 0, 1, 0, 1, 1, Number.NaN, 1];
		const both = summarizeDrawGeometry('two-groups', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			groups: [
				{ start: 0, count: 3 },
				{ start: 3, count: 3 }
			],
			uvs: [QUAD_UV0, uv1]
		});
		expect(both.uvSets).toEqual([0]);
		expect(both.normalFrameSets).toEqual([0]);

		const firstOnly = summarizeDrawGeometry('first-group', {
			positions: QUAD_POSITIONS,
			indices: QUAD_INDICES,
			groups: [{ start: 0, count: 3 }],
			uvs: [QUAD_UV0, uv1]
		});
		expect(firstOnly.uvSets).toEqual([0, 1]);
		expect(firstOnly.normalFrameSets).toEqual([0, 1]);
	});

	it('intersects availability across draws and targets', () => {
		const uv0Only: TargetFacts = {
			subject: 'a',
			geometryRevision: 'r1',
			draws: [{ drawKey: 'd', uvSets: [0], normalFrameSets: [0] }]
		};
		const uv1Only: TargetFacts = {
			subject: 'b',
			geometryRevision: 'r1',
			draws: [{ drawKey: 'd', uvSets: [1], normalFrameSets: [1] }]
		};
		expect(intersectTargetAvailability([uv0Only])).toEqual({
			uvSets: [0],
			normalFrameSets: [0]
		});
		expect(intersectTargetAvailability([uv0Only, uv1Only])).toEqual({
			uvSets: [],
			normalFrameSets: []
		});
	});
});

describe('target and surface mapping', () => {
	it('applies metric tile, rotation and offset to a native Form', () => {
		const resolution = resolutionFor();
		expect(resolution.issues).toEqual([]);
		const binding = bindFinish(resolution, {
			subject: 'form:1',
			facts: FORM_FACTS
		});
		expect(binding.issues).toEqual([]);
		expect(binding.bound?.samples.find((sample) => sample.role === 'color')).toMatchObject({
			uvSet: 0,
			basis: 'metric',
			// One native UV unit is one metre, so the multiplier is 1 / tile. The
			// resulting coverage is 3.2 × 1.25 = 4 tiles and 1.6 × 0.625 = 1 tile.
			repeat: [1.25, 0.625],
			rotation: 0.4,
			offset: [0.25, 0.5]
		});
	});

	it('derives the sampling multiplier from metres per native UV unit', () => {
		const resolution = resolutionFor();
		const metric = bindFinish(resolution, { subject: 'form:1', facts: FORM_FACTS });
		const normalizedFacts: TargetFacts = {
			subject: 'primitive:1',
			geometryRevision: 'geometry-primitive-1',
			metricBasis: { uvMeters: [3.2, 1.6], surfaceMeters: [3.2, 1.6] },
			draws: [{ drawKey: 'primitive-0', uvSets: [0], normalFrameSets: [0] }]
		};
		const normalized = bindFinish(resolution, { subject: 'primitive:1', facts: normalizedFacts });
		const metreSample = metric.bound?.samples.find((sample) => sample.role === 'color');
		const normalizedSample = normalized.bound?.samples.find((sample) => sample.role === 'color');
		expect(metreSample?.repeat).toEqual([1.25, 0.625]);
		expect(normalizedSample?.repeat).toEqual([4, 1]);

		const covered = (sample: typeof metreSample, uvMeters: readonly [number, number]) => [
			((3.2 / uvMeters[0]) * sample!.repeat[0]),
			((1.6 / uvMeters[1]) * sample!.repeat[1])
		];
		expect(covered(metreSample, [1, 1])).toEqual([4, 1]);
		expect(covered(normalizedSample, [3.2, 1.6])).toEqual([4, 1]);
	});

	it('uses identity UV0 for a legacy GLB remap of the same Finish', () => {
		const resolution = resolutionFor();
		const binding = bindFinish(resolution, { subject: 'model:1', facts: MODEL_FACTS });
		expect(binding.issues).toEqual([]);
		expect(binding.bound?.samples.find((sample) => sample.role === 'color')).toMatchObject({
			uvSet: 0,
			basis: 'identity',
			repeat: [1, 1],
			rotation: 0,
			offset: [0, 0]
		});
	});

	it('binds one shared Finish to a Form and a GLB from one definition', () => {
		const recipe = readFull();
		const resolution = resolveFinish(
			{ material: recipe },
			undefined,
			undefined,
			fixtureImageIndex()
		);
		const form = bindFinish(resolution, { subject: 'form:1', facts: FORM_FACTS });
		const model = bindFinish(resolution, { subject: 'model:1', facts: MODEL_FACTS });
		expect(form.issues).toEqual([]);
		expect(model.issues).toEqual([]);
		expect(form.bound?.samples.find((sample) => sample.role === 'color')?.repeat).toEqual([1.25, 0.625]);
		expect(model.bound?.samples.find((sample) => sample.role === 'color')?.repeat).toEqual([1, 1]);
		// Shared identity is one definition: both bounds resolve the same image hashes.
		expect(form.bound?.samples.map((sample) => sample.image.hash)).toEqual(
			model.bound?.samples.map((sample) => sample.image.hash)
		);
	});

	it('refuses explicit surface mapping on a target without a metric basis', () => {
		const resolution = resolutionFor({
			kind: 'surface',
			metric: { tileMeters: [0.8, 1.6], rotation: 0.4, offset: [0.25, 0.5] }
		});
		expect(resolution.issues).toEqual([]);
		const model = bindFinish(resolution, { subject: 'model:1', facts: MODEL_FACTS });
		expect(model.bound).toBeNull();
		expect(model.issues).toContainEqual({
			code: 'mapping-requires-metric-basis',
			path: '$.maps.color.mapping',
			role: 'color',
			target: 'model:1',
			action: 'Use target or uv mapping for this target, or supply a metric basis.'
		});
		const form = bindFinish(resolution, { subject: 'form:1', facts: FORM_FACTS });
		expect(form.issues).toEqual([]);
		expect(form.bound?.samples.find((sample) => sample.role === 'color')?.basis).toBe('metric');
	});

	it('reads an explicit UV1 set with its authored repeat and offset', () => {
		const mapping: Mapping = {
			kind: 'uv',
			set: 1,
			repeat: [2, 3],
			rotation: 1.2,
			offset: [0.1, 0.9]
		};
		const resolution = resolutionFor(mapping);
		const binding = bindFinish(resolution, { subject: 'model:two-uv', facts: TWO_UV_FACTS });
		expect(binding.issues).toEqual([]);
		expect(binding.bound?.samples.find((sample) => sample.role === 'roughness')).toMatchObject({
			uvSet: 1,
			basis: 'identity',
			repeat: [2, 3],
			rotation: 1.2,
			offset: [0.1, 0.9],
			component: 'g',
			invert: false
		});
	});

	it('reports a missing UV set for every sampled role', () => {
		const resolution = resolutionFor({ kind: 'uv', set: 1, repeat: [1, 1], rotation: 0, offset: [0, 0] });
		const binding = bindFinish(resolution, { subject: 'model:1', facts: MODEL_FACTS });
		expect(binding.bound).toBeNull();
		expect(binding.issues.map((issue) => issue.role)).toEqual([
			'color',
			'metalness',
			'normal',
			'occlusion',
			'roughness'
		]);
		expect(binding.issues.every((issue) => issue.code === 'missing-uv')).toBe(true);
	});

	it('refuses a normal map whose UV frame is degenerate', () => {
		const facts: TargetFacts = {
			subject: 'model:flat',
			geometryRevision: 'rev',
			draws: [{ drawKey: 'mesh-0', uvSets: [0], normalFrameSets: [] }]
		};
		const binding = bindFinish(resolutionFor(), { subject: 'model:flat', facts });
		expect(binding.bound).toBeNull();
		expect(binding.issues).toContainEqual({
			code: 'missing-normal-frame',
			path: '$.maps.normal.mapping',
			role: 'normal',
			target: 'model:flat#mesh-0',
			action: 'Provide a non-singular UV frame on this draw or remove the normal map.'
		});
	});
});

describe('binding lifecycle diagnostics', () => {
	it('returns target-pending when no facts exist yet', () => {
		const binding = bindFinish(resolutionFor(), { subject: 'form:new', facts: null });
		expect(binding.bound).toBeNull();
		expect(binding.inputs).not.toBeNull();
		expect(binding.issues).toContainEqual({
			code: 'target-pending',
			path: '$.target',
			target: 'form:new',
			action: 'Derive target facts for the exact geometry revision, then requalify.'
		});
	});

	it('returns target-pending for a target with no active draws', () => {
		const facts: TargetFacts = { subject: 'form:empty', geometryRevision: 'r1', draws: [] };
		const binding = bindFinish(resolutionFor(), { subject: 'form:empty', facts });
		expect(binding.issues).toContainEqual({
			code: 'target-pending',
			path: '$.target.draws',
			target: 'form:empty',
			action: 'Derive target facts with at least one active draw, then requalify.'
		});
	});

	it('refuses malformed target geometry instead of treating it as an empty draw', () => {
		const facts: TargetFacts = {
			subject: 'model:bad',
			geometryRevision: 'asset-revision-1',
			draws: [
				{ drawKey: 'mesh-0', uvSets: [], normalFrameSets: [], invalidGeometry: true }
			]
		};
		const binding = bindFinish(resolutionFor(), { subject: 'model:bad', facts });
		expect(binding.bound).toBeNull();
		expect(binding.issues).toContainEqual({
			code: 'invalid-target-geometry',
			path: '$.target.draws',
			target: 'model:bad#mesh-0',
			action: 'Repair the malformed indices, groups or position array, then requalify.'
		});
	});

	it('returns stale-target-facts when the expected revision moved', () => {
		const binding = bindFinish(resolutionFor(), {
			subject: 'model:1',
			facts: MODEL_FACTS,
			expectedGeometryRevision: 'asset-revision-8'
		});
		expect(binding.bound).toBeNull();
		expect(binding.issues).toContainEqual({
			code: 'stale-target-facts',
			path: '$.target.geometryRevision',
			target: 'model:1@asset-revision-7',
			action: 'Recompute target facts for revision asset-revision-8.'
		});
	});

	it('keeps target issues ordered by path, then role and target key', () => {
		const facts: TargetFacts = {
			subject: 'model:1',
			geometryRevision: 'asset-revision-7',
			draws: [
				{ drawKey: 'mesh-1', uvSets: [], normalFrameSets: [] },
				{ drawKey: 'mesh-0', uvSets: [], normalFrameSets: [] }
			]
		};
		const binding = bindFinish(resolutionFor({ kind: 'uv', set: 1, repeat: [1, 1], rotation: 0, offset: [0, 0] }), {
			subject: 'model:1',
			facts
		});
		const keys = binding.issues.map(
			(issue) => `${issue.path}\0${issue.role ?? ''}\0${issue.target ?? ''}`
		);
		expect(keys).toEqual([...keys].sort());
	});
});

describe('acceptance across targets', () => {
	it('reports the availability intersection and no issue for a compatible Form + GLB', () => {
		const qualification = qualifyAcrossTargets(resolutionFor(), [
			{ subject: 'form:1', facts: FORM_FACTS },
			{ subject: 'model:1', facts: MODEL_FACTS }
		]);
		expect(qualification.issues).toEqual([]);
		expect(qualification.perTarget).toHaveLength(2);
		expect(qualification.common).toEqual({ uvSets: [0], normalFrameSets: [0] });
	});

	it('reports a missing UV1 only on the target that cannot supply it', () => {
		const resolution = resolutionFor({
			kind: 'uv',
			set: 1,
			repeat: [1, 1],
			rotation: 0,
			offset: [0, 0]
		});
		const qualification = qualifyAcrossTargets(resolution, [
			{ subject: 'model:two-uv', facts: TWO_UV_FACTS },
			{ subject: 'model:uv0', facts: MODEL_FACTS }
		]);
		expect(qualification.issues).toContainEqual({
			code: 'missing-uv',
			path: '$.maps.color.mapping',
			role: 'color',
			target: 'model:uv0#mesh-0',
			action: 'Provide UV1 on this draw or choose a mapping it supports.'
		});
		expect(qualification.issues.some((issue) => issue.target === 'model:two-uv#mesh-0')).toBe(false);
		expect(qualification.common.uvSets).toEqual([0]);
	});

	it('leaves an unused Finish authorable with no target issue', () => {
		const qualification = qualifyAcrossTargets(resolutionFor(), []);
		expect(qualification.issues).toEqual([]);
		expect(qualification.perTarget).toEqual([]);
		expect(qualification.inputs).not.toBeNull();
	});
});

describe('metric repeat', () => {
	it('reuses the established surface/tile calculation and lower bound', () => {
		expect(materialMetricRepeat([3.2, 1.6], [0.8, 1.6])).toEqual([4, 1]);
		expect(materialMetricRepeat([0, 1], [0, 0.01])).toEqual([0.01, 100]);
		expect(materialMetricRepeat([0.5, 0.5], [100, 100])).toEqual([0.01, 0.01]);
	});
});
