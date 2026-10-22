/**
 * P23.5 small architectural preset set — kernel output assertions.
 *
 * PR #115 (§7.2 category D extraction) removed the editor shell, so this file
 * calls the `layout-core` preset planners directly instead of driving them
 * through the deleted preview-state adapter and its history runner. Every
 * document expectation below is the one the editor integration asserted
 * verbatim. The removed editor-wiring half tested the preset draft interaction
 * state, the preview-state commit path and one-click-is-one-history-entry
 * semantics; those subjects are gone (the history semantics are recorded as a
 * T3 F.4 acceptance obligation), as is the editor tool vocabulary that mapped
 * `preset-*` tools to preset ids.
 */
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import {
	LAYOUT_ARCHITECTURAL_PRESETS,
	layoutArchitecturalPreset,
	layoutPresetPlacement,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPreset,
	planDeleteLayoutObject,
	planExactLayoutObjectTransform,
	type LayoutArchitecturalPresetId,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import {
	parseWallFirstLayoutDocumentJson,
	serializeWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import type { LayoutVec2 } from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

function emptyDocument(elevation = 0): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor', name: 'Floor', elevation },
		junctions: [],
		walls: [],
		rooms: [],
		openings: [],
		objects: []
	};
}

/**
 * One preset operation: mint the capture, derive the captured id from the
 * pre-commit document, then let the planner re-derive and verify it. A fresh
 * capture per operation is the contract (reusing one is the collision case).
 */
function planPreset(
	document: LayoutDocumentWallFirst,
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	elevation = 0
) {
	const capture = freshCapture();
	const capturedObjectId = nextLayoutPresetObjectId(document, capture);
	return {
		document,
		capture,
		capturedObjectId,
		plan: planCommitLayoutObjectPreset(document, presetId, point, elevation, capturedObjectId)
	};
}

function committedObject(
	presetId: LayoutArchitecturalPresetId,
	point: LayoutVec2,
	elevation = 0
): LayoutDocumentWallFirst {
	const { plan } = planPreset(emptyDocument(elevation), presetId, point, elevation);
	if (plan.kind !== 'success') throw new Error(`preset commit rejected: ${plan.rejection.message}`);
	return plan.document;
}

describe('P23.5 small architectural preset set', () => {
	it('ships exactly Column, Platform and Plinth over existing primitive kinds', () => {
		expect(LAYOUT_ARCHITECTURAL_PRESETS.map((preset) => preset.id).sort()).toEqual([
			'column',
			'platform',
			'plinth'
		]);
		expect(layoutArchitecturalPreset('column')).toMatchObject({ kind: 'cylinder' });
		expect(layoutArchitecturalPreset('platform')).toMatchObject({ kind: 'box' });
		expect(layoutArchitecturalPreset('plinth')).toMatchObject({ kind: 'box' });
		for (const preset of LAYOUT_ARCHITECTURAL_PRESETS) {
			expect(preset.label.trim().length).toBeGreaterThan(0);
			expect(preset.dimensions.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
		}
	});

	it('ships no Partition preset: partitions are first-class Walls, not boxes', () => {
		expect(layoutArchitecturalPreset('partition')).toBeUndefined();
		expect(layoutArchitecturalPreset('wall')).toBeUndefined();
		expect(layoutArchitecturalPreset('nope')).toBeUndefined();
	});

	it('commits a Column as one ordinary document-level cylinder object', () => {
		const { plan, capturedObjectId } = planPreset(emptyDocument(), 'column', [5, 6], 0);
		if (plan.kind !== 'success') throw new Error(`rejected: ${plan.rejection.message}`);
		expect(plan.operation).toBe('layout-object-preset-create');
		expect(plan.document.objects).toHaveLength(1);
		const object = plan.document.objects[0]!;
		expect(object).toMatchObject({
			id: capturedObjectId,
			kind: 'cylinder',
			position: [5, 1.5, 6],
			rotation: [0, 0, 0],
			dimensions: [0.4, 3, 0.4]
		});
		expect(object).not.toHaveProperty('roomId');
		expect(plan.createdObjectId).toBe(capturedObjectId);
	});

	it('commits Platform and Plinth as ordinary box objects', () => {
		expect(committedObject('platform', [0, 0]).objects[0]).toMatchObject({
			kind: 'box',
			dimensions: [3, 0.2, 3],
			position: [0, 0.1, 0]
		});
		expect(committedObject('plinth', [1, 2]).objects[0]).toMatchObject({
			kind: 'box',
			dimensions: [0.8, 1, 0.8],
			position: [1, 0.5, 2]
		});
	});

	it('respects floor elevation without introducing Floor ownership', () => {
		const document = committedObject('plinth', [1, 2], 2.5);
		expect(document.objects[0]!.position).toEqual([1, 3, 2]);
		expect(document.objects[0]).not.toHaveProperty('roomId');
		expect(document.objects[0]).not.toHaveProperty('floorId');
		expect('preset' in document.objects[0]!).toBe(false);
		expect(serializeWallFirstLayoutDocument(document)).not.toContain('preset');
	});

	it('derives object ids from each operation’s capture and never mutates the input', () => {
		const baseline = emptyDocument();
		const first = planPreset(baseline, 'column', [0, 0], 0);
		if (first.plan.kind !== 'success') throw new Error('first commit rejected');
		expect(baseline.objects).toHaveLength(0);
		const second = planPreset(first.plan.document, 'column', [1, 1], 0);
		if (second.plan.kind !== 'success') throw new Error('second commit rejected');
		expect(second.plan.document.objects.map((object) => object.id)).toEqual([
			first.capturedObjectId,
			second.capturedObjectId
		]);
		expect(second.plan.createdObjectId).toBe(second.capturedObjectId);
		// A new operation never reuses the previous operation's identity.
		expect(second.capturedObjectId).not.toBe(first.capturedObjectId);
	});

	it('rejects unknown presets, non-finite points and non-finite elevations', () => {
		const unknown = planPreset(
			emptyDocument(),
			'partition' as LayoutArchitecturalPresetId,
			[0, 0],
			0
		).plan;
		expect(unknown.kind).toBe('rejected');
		const nanPoint = planPreset(emptyDocument(), 'column', [NaN, 0], 0).plan;
		expect(nanPoint.kind).toBe('rejected');
		const nanElevation = planPreset(emptyDocument(), 'column', [0, 0], NaN).plan;
		expect(nanElevation.kind).toBe('rejected');
		expect(layoutPresetPlacement(layoutArchitecturalPreset('column')!, [0, 0], NaN)).toBeUndefined();
	});

	it('edits and deletes preset objects through the existing P23.1 object semantics', () => {
		const document = committedObject('platform', [0, 0]);
		const objectId = document.objects[0]!.id;
		const edited = planExactLayoutObjectTransform(document, objectId, {
			dimensions: [4, 0.2, 4]
		});
		if (edited.kind !== 'success') throw new Error(`edit rejected: ${edited.rejection.message}`);
		expect(edited.document.objects[0]!.dimensions).toEqual([4, 0.2, 4]);
		const deleted = planDeleteLayoutObject(edited.document, objectId);
		if (deleted.kind !== 'success') throw new Error(`delete rejected: ${deleted.rejection.message}`);
		expect(deleted.document.objects).toHaveLength(0);
	});

	it('compiles exactly like an equivalent manually created primitive', () => {
		const presetDocument = committedObject('column', [5, 6]);
		const manualDocument: LayoutDocumentWallFirst = {
			...emptyDocument(),
			objects: [
				{
					// Same compiled identity as the captured preset object; only the
					// allocation path differs.
					id: presetDocument.objects[0]!.id,
					kind: 'cylinder',
					position: [5, 1.5, 6],
					rotation: [0, 0, 0],
					dimensions: [0.4, 3, 0.4]
				}
			]
		};
		const presetCompiled = compileWallFirstLayoutGeometry(presetDocument);
		const manualCompiled = compileWallFirstLayoutGeometry(manualDocument);
		expect(presetCompiled.issues).toEqual([]);
		expect(presetCompiled.geometry.objects).toEqual(manualCompiled.geometry.objects);
	});

	it('round-trips through Save with no preset-only durable metadata', () => {
		const document = committedObject('plinth', [1, 2]);
		const parsed = parseWallFirstLayoutDocumentJson(serializeWallFirstLayoutDocument(document));
		if (!parsed.success) throw new Error(`round-trip failed: ${parsed.issues[0]?.message}`);
		expect(parsed.document.objects).toHaveLength(1);
		expect(parsed.document.objects[0]).toMatchObject({ kind: 'box', dimensions: [0.8, 1, 0.8] });
		expect(JSON.stringify(parsed.document)).not.toContain('preset');
	});
});
