/**
 * SL1 tests 5, 7 and 9: the store option, no recompile, and `asBuilt`.
 *
 * These three are one contract. The store hands every colour material the Canvas's
 * array **by reference** (5); nothing may replace that array or its planes when the
 * cut moves (7); and a snapshot must see the world as built while the reader keeps
 * the retreated values (9). A test that only checked "planes are applied" would pass
 * on an implementation that recompiles every program per frame.
 */
import { describe, expect, it, vi } from 'vitest';
import { MeshStandardMaterial, Plane, Vector3, type Material } from 'three';
import {
	createStageClip,
	materialUsesClip,
	STAGE_CLIP_KEEP_ALL_CONSTANT,
	STAGE_CLIP_PLANE_COUNT
} from '$lib/authoring/stage/slice/stage-clip';
import { hasSliceClipMask, NEVER_CUT_TOP_Y } from '$lib/render/clip/slice-clip-mask';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { materialKey } from '$lib/render/resources/material-descriptor';

/** Whether any plane keeps this `y` out (the CPU side of the fragment test). */
function discardedAt(clip: ReturnType<typeof createStageClip>, y: number): boolean {
	return clip.planes.some((plane) => plane.distanceToPoint(new Vector3(0, y, 0)) < 0);
}

describe('test 5 — the store takes the Canvas clip by reference', () => {
	it('assigns one array to every colour kind, including an imported clone', () => {
		const clip = createStageClip();
		const planes = clip.planes as Plane[];
		const store = createMaterialStore({ clippingPlanes: planes });

		const standard = store.acquire({ kind: 'standard', color: '#ffffff', roughness: 0.5, metalness: 0 }).material;
		const lambert = store.acquire({ kind: 'lambert', color: '#ffffff' }).material;
		const basic = store.acquire({ kind: 'basic', color: '#ffffff' }).material;
		const source = new MeshStandardMaterial({ color: 0x224466 });
		const imported = store.acquire(
			{ kind: 'imported', asset: 'asset.glb', mesh: 0, slot: 0, wireframe: false },
			undefined,
			source
		).material;

		for (const material of [standard, lambert, basic, imported] as Material[]) {
			expect(material.clippingPlanes).toBe(planes);
			expect(materialUsesClip(material, clip)).toBe(true);
			// Three's own default: a clipped shadow map is what a Slice must not ask for.
			expect(material.clipShadows).toBe(false);
		}
		// The clone owns the array, not the asset's material.
		expect(imported).not.toBe(source);
		expect(source.clippingPlanes).toBeNull();
		store.dispose();
	});

	it('leaves a clip: false surface unclipped, as its own key', () => {
		const clip = createStageClip();
		const planes = clip.planes as Plane[];
		const store = createMaterialStore({ clippingPlanes: planes });

		const grounded = store.acquire({ kind: 'lambert', color: '#ffffff', clip: false });
		expect(grounded.material.clippingPlanes).toBeNull();
		expect(materialUsesClip(grounded.material, clip)).toBe(false);

		const clipped = store.acquire({ kind: 'lambert', color: '#ffffff' });
		expect(clipped.key).not.toBe(grounded.key);
		expect(materialKey({ kind: 'basic', color: '#ffffff' })).not.toBe(
			materialKey({ kind: 'basic', color: '#ffffff', clip: false })
		);
		// Two surfaces, not one material relabelled.
		expect(store.stats().created).toBe(2);
		store.dispose();
	});

	it('installs the one mask on colour kinds and none on the shadow catcher', () => {
		const clip = createStageClip();
		const planes = clip.planes as Plane[];
		const clippedStore = createMaterialStore({
			clippingPlanes: planes,
			clipMasks: (cutaway) => clip.clipMasks(cutaway)
		});
		const standard = clippedStore.acquire({ kind: 'standard', color: '#ffffff', roughness: 1, metalness: 0 }).material;
		expect(hasSliceClipMask(standard)).toBe(true);
		const shadow = clippedStore.acquire({ kind: 'shadow', opacity: 0.3 }).material;
		expect(hasSliceClipMask(shadow)).toBe(false);
		expect(shadow.clippingPlanes).not.toBe(planes);

		// The Preview Canvas passes no masks: its materials carry no clip graph at all.
		const preview = createMaterialStore();
		const material = preview.acquire({ kind: 'standard', color: '#ffffff', roughness: 1, metalness: 0 }).material;
		expect(material.clippingPlanes).toBeNull();
		expect(hasSliceClipMask(material)).toBe(false);
		clippedStore.dispose();
		preview.dispose();
	});
});

describe('test 7 — a reading never recompiles a program', () => {
	it('never resets the independently owned cutaway top', () => {
		const clip = createStageClip();
		clip.setCutawayTop(1);
		const readings = [
			{ kind: 'level' as const, cutY: 1.2, lowerY: null },
			{
				kind: 'drawn' as const,
				origin: [0, 0, 0] as [number, number, number],
				along: [1, 0, 0] as [number, number, number],
				hiddenNormal: [0, 0, 1] as [number, number, number],
				halfLength: 2,
				depthMeters: 1,
				hidden: 'right' as const,
				start: [-2, 0, 0] as [number, number, number],
				end: [2, 0, 0] as [number, number, number]
			},
			null
		];
		for (const reading of readings) {
			clip.apply(reading as never);
			expect(clip.cutawayTop()).toBe(1);
		}
		clip.setCutawayTop(null);
		expect(clip.cutawayTop()).toBe(NEVER_CUT_TOP_Y);
	});

	it('keeps one array of two Plane instances at rest and under every reading', () => {
		const clip = createStageClip();
		const planes = clip.planes as Plane[];
		const instances = [...planes];
		expect(clip.planes).toHaveLength(STAGE_CLIP_PLANE_COUNT);

		const readings = [
			null,
			{ kind: 'level' as const, cutY: 1.2, lowerY: null },
			{ kind: 'level' as const, cutY: 0.4, lowerY: null }
		];
		for (const reading of readings) {
			clip.apply(reading as never);
			expect(clip.planes).toBe(planes);
			expect(clip.planes).toHaveLength(STAGE_CLIP_PLANE_COUNT);
			expect(clip.planes[0]).toBe(instances[0]);
			expect(clip.planes[1]).toBe(instances[1]);
		}

		clip.asBuilt(() => {
			expect(clip.planes).toBe(planes);
			expect(clip.planes[0]).toBe(instances[0]);
			expect(clip.planes[1]).toBe(instances[1]);
		});
	});

	it('parks a no-op plane far enough that no Stage point is past it', () => {
		const clip = createStageClip();
		clip.apply(null);
		for (const y of [-1e3, 0, 1e3, STAGE_CLIP_KEEP_ALL_CONSTANT / 2]) {
			expect(discardedAt(clip, y)).toBe(false);
		}
	});
});

describe('test 9 — a snapshot renders the world as built', () => {
	it('makes every plane a no-op inside the callback and restores afterwards', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: 0.5 });
		expect(discardedAt(clip, 3)).toBe(true);
		expect(discardedAt(clip, 0.2)).toBe(true);

		const seen: boolean[] = [];
		const result = clip.asBuilt(() => {
			seen.push(discardedAt(clip, 3), discardedAt(clip, 0.2), discardedAt(clip, 40));
			return 'as-built';
		});

		expect(result).toBe('as-built');
		expect(seen).toEqual([false, false, false]);
		expect(discardedAt(clip, 3)).toBe(true);
		expect(discardedAt(clip, 0.2)).toBe(true);
		expect(discardedAt(clip, 0.8)).toBe(false);
	});

	it('restores and rethrows when the callback throws', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 1.2, lowerY: null });
		expect(() =>
			clip.asBuilt(() => {
				throw new Error('renderer lost');
			})
		).toThrow('renderer lost');
		expect(discardedAt(clip, 2)).toBe(true);
	});

	it('restores only at the outermost call, and the newest reading wins on exit', () => {
		const clip = createStageClip();
		clip.apply({ kind: 'level', cutY: 2, lowerY: null });
		clip.asBuilt(() => {
			clip.asBuilt(() => {
				expect(discardedAt(clip, 5)).toBe(false);
			});
			// Still inside the outer call: the inner exit must not have restored yet.
			expect(discardedAt(clip, 5)).toBe(false);
			clip.apply({ kind: 'level', cutY: 1, lowerY: null });
		});
		// The reading applied during the snapshot wins; the snapshot's own values are gone.
		expect(discardedAt(clip, 0.5)).toBe(false);
		expect(discardedAt(clip, 5)).toBe(true);
	});

	it('renders exactly once and reports activity', () => {
		const clip = createStageClip();
		expect(clip.isActive()).toBe(false);
		const render = vi.fn(() => 7);
		expect(clip.asBuilt(render)).toBe(7);
		expect(render).toHaveBeenCalledTimes(1);
		clip.apply({ kind: 'level', cutY: 1, lowerY: null });
		expect(clip.isActive()).toBe(true);
		clip.apply(null);
		expect(clip.isActive()).toBe(false);
	});
});

describe('clipInk: editor ink is cut by both realizations', () => {
	it('shares the plane array and installs the drawn patch once', async () => {
		const { MeshBasicMaterial } = await import('three');
		const { createStageClip, materialUsesClip } = await import('$lib/authoring/stage/slice/stage-clip');
		const clip = createStageClip();
		const material = clip.clipInk(new MeshBasicMaterial());
		expect(materialUsesClip(material, clip)).toBe(true);
		expect(hasSliceClipMask(material)).toBe(true);
		// Re-attaching is idempotent for the material's identity, never a new graph.
		const masks = clip.clipMasks(false);
		clip.clipInk(material);
		expect(clip.clipMasks(false)).toBe(masks);
		material.dispose();
	});
});

describe('the selection and Lift layers cut their clipped ink with clipInk', () => {
	it('routes every clipped ink material through clipInk', async () => {
		const { readFileSync } = await import('node:fs');
		for (const file of ['StageSelectionLayer.svelte', 'StageLiftLayer.svelte']) {
			const source = readFileSync(`src/lib/authoring/stage/shell/${file}`, 'utf8');
			const planeSites = (source.match(/clippingPlanes: (planes|silhouettePlanes)/g) ?? []).length;
			const cutSites = (source.match(/cutInk\(new /g) ?? []).length;
			expect(planeSites, file).toBeGreaterThan(0);
			expect(cutSites, file).toBe(planeSites);
			expect(source, file).toContain('stageClip.clipInk(material)');
		}
	});
});
