import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import {
	createInspectionGeometry,
	inspectionGeometryFacts,
	inspectionTargetFacts
} from '$lib/render/materials/inspection-geometry';
import {
	createInspectionLighting,
	GRAZING_AMBIENT_INTENSITY,
	GRAZING_KEY_INTENSITY,
	STUDIO_BASE_RADIANCE,
	STUDIO_KEY_RADIANCE,
	studioEnvironmentPixels
} from '$lib/render/materials/inspection-lighting';
import {
	createInspectionObserver,
	inspectionChannels,
	inspectionPose,
	inspectionThumbnailKey,
	normalizeInspectionRows,
	type InspectionFrame,
	type InspectionObservation
} from '$lib/render/materials/inspection';
import type { StandardMaterialDescriptor } from '$lib/render/resources/material-descriptor';

describe('inspection reference geometry', () => {
	it('builds the frozen plane, sphere and rounded block facts', () => {
		const plane = createInspectionGeometry('plane');
		expect(plane.geometry.getAttribute('position').count).toBe(4);
		expect(plane.facts.uvMeters).toEqual([1, 1]);

		const sphere = createInspectionGeometry('sphere');
		expect(sphere.facts.uvMeters).toEqual([Math.PI, Math.PI / 2]);
		expect(sphere.geometry.getAttribute('position').count).toBeGreaterThan(1000);

		const block = createInspectionGeometry('block');
		expect(block.facts.uvMeters).toEqual([1, 1]);
		const position = block.geometry.getAttribute('position');
		const normal = block.geometry.getAttribute('normal');
		const point = new Vector3();
		const normalPoint = new Vector3();
		for (let index = 0; index < position.count; index += 1) {
			point.set(position.getX(index), position.getY(index), position.getZ(index));
			// The block's extent is 1 on each axis (0.5 per side); the rounded
			// corner sits inside the sharp corner's 0.866 radius.
			expect(Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z))).toBeLessThanOrEqual(
				0.5 + 1e-6
			);
			expect(point.length()).toBeLessThanOrEqual(Math.sqrt(3) * 0.5 + 1e-6);
			normalPoint.set(normal.getX(index), normal.getY(index), normal.getZ(index));
			expect(normalPoint.length()).toBeCloseTo(1, 5);
		}
		expect(block.geometry.getAttribute('uv')).toBeDefined();
		expect(block.geometry.getAttribute('uv1')).toBeUndefined();
	});

	it('states the same facts as a product target', () => {
		expect(inspectionGeometryFacts('sphere').uvSets).toEqual([0]);
		expect(inspectionTargetFacts('sphere').draws[0]).toMatchObject({
			uvSets: [0],
			normalFrameSets: [0]
		});
	});
});

describe('inspection reference lighting', () => {
	it('bakes the studio field at the frozen radiances', () => {
		const width = 128;
		const height = 64;
		const pixels = studioEnvironmentPixels(width, height);
		const key = new Vector3(-1, 1, 1).normalize();
		const fill = new Vector3(1, 0, -1).normalize();
		let keySeen = false;
		let fillSeen = false;
		let baseSeen = false;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const phi = ((x + 0.5) / width) * Math.PI * 2;
				const theta = ((y + 0.5) / height) * Math.PI;
				const direction = new Vector3(
					Math.sin(theta) * Math.cos(phi),
					Math.cos(theta),
					Math.sin(theta) * Math.sin(phi)
				);
				const value = pixels[(y * width + x) * 4]!;
				if (direction.dot(key) > Math.cos((10 * Math.PI) / 180)) {
					expect(value).toBeCloseTo(STUDIO_BASE_RADIANCE + STUDIO_KEY_RADIANCE, 6);
					keySeen = true;
				}
				if (direction.dot(fill) > Math.cos((10 * Math.PI) / 180)) {
					expect(value).toBeCloseTo(STUDIO_BASE_RADIANCE + 1.5, 6);
					fillSeen = true;
				}
				if (direction.dot(key) < Math.cos((80 * Math.PI) / 180) && direction.dot(fill) < Math.cos((80 * Math.PI) / 180)) {
					expect(value).toBeCloseTo(STUDIO_BASE_RADIANCE, 6);
					baseSeen = true;
				}
			}
		}
		expect({ keySeen, fillSeen, baseSeen }).toEqual({ keySeen: true, fillSeen: true, baseSeen: true });
	});

	it('builds grazing as a directional key plus ambient and no reflection map', () => {
		const rig = createInspectionLighting('grazing');
		const lights = rig.group.children.filter((child) => 'isLight' in child);
		expect(lights).toHaveLength(2);
		expect(lights[0]).toMatchObject({ isAmbientLight: true, intensity: GRAZING_AMBIENT_INTENSITY });
		expect(lights[1]).toMatchObject({ isDirectionalLight: true, intensity: GRAZING_KEY_INTENSITY });
		expect(rig.environment({})).toBeNull();
		rig.dispose();
	});
});

describe('inspection presentation', () => {
	const descriptor = (withPlan = true): StandardMaterialDescriptor => ({
		kind: 'standard',
		color: '#c4b4a0',
		roughness: 0.6,
		metalness: 0.1,
		...(withPlan
			? {
					finish: {
						profile: 'pbr-metallic-roughness/v1' as const,
						entries: [
							{
								role: 'color' as const,
								view: 'colour',
								uvSet: 0 as const,
								origin: 'legacy' as const,
								repeat: [1, 1] as const,
								rotation: 0,
								offset: [0, 0] as const
							},
							{
								role: 'roughness' as const,
								view: 'rough',
								uvSet: 0 as const,
								origin: 'legacy' as const,
								repeat: [1, 1] as const,
								rotation: 0,
								offset: [0, 0] as const,
								component: 'g' as const,
								invert: false
							}
						],
						occlusionStrength: 1,
						normalScale: 1
					}
				}
			: {})
	});

	it('reports bound, missing-view and constant channels', () => {
		const channels = inspectionChannels(descriptor(), { colour: {} as never });
		expect(channels.find((channel) => channel.role === 'color')).toMatchObject({
			state: 'bound',
			view: 'colour'
		});
		expect(channels.find((channel) => channel.role === 'roughness')).toMatchObject({
			state: 'missing-view',
			view: 'rough'
		});
		expect(channels.find((channel) => channel.role === 'normal')).toMatchObject({
			state: 'constant'
		});
	});

	it('places the fixed pose and fits it to the declared sphere', () => {
		const sphere = inspectionPose('sphere');
		expect(sphere.fovYDegrees).toBe(35);
		expect(sphere.fit).toBe(0.8);
		expect(new Vector3(...sphere.eye).normalize().toArray()).toEqual([
			expect.closeTo(0.5218, 3),
			expect.closeTo(0.3392, 3),
			expect.closeTo(0.7827, 3)
		]);
		const plane = inspectionPose('plane');
		expect(plane.eye[0]).toBeCloseTo(0, 6);
		expect(plane.eye[1]).toBeCloseTo(0, 6);
		expect(plane.eye[2]).toBeGreaterThan(0);
	});

	it('keys the fixed thumbnail by recipe and every pixel-affecting version', () => {
		const base = inspectionThumbnailKey({ recipeKey: 'sha256-abc' });
		expect(base).toMatch(/^thumb-[0-9a-f]{16}$/);
		expect(inspectionThumbnailKey({ recipeKey: 'sha256-abc' })).toBe(base);
		expect(inspectionThumbnailKey({ recipeKey: 'sha256-def' })).not.toBe(base);
		expect(inspectionThumbnailKey({ recipeKey: 'sha256-abc', rig: 'grazing' })).not.toBe(base);
		expect(inspectionThumbnailKey({ recipeKey: 'sha256-abc', geometry: 'block' })).not.toBe(base);
	});

	it('normalizes readback rows by backend', () => {
		const pixels = new Uint8Array([
			1, 1, 1, 1, 2, 2, 2, 2,
			3, 3, 3, 3, 4, 4, 4, 4
		]);
		expect([...normalizeInspectionRows(pixels, 2, 2, 'webgpu')]).toEqual([...pixels]);
		expect([...normalizeInspectionRows(pixels, 2, 2, 'webgl2')]).toEqual([
			3, 3, 3, 3, 4, 4, 4, 4,
			1, 1, 1, 1, 2, 2, 2, 2
		]);
	});

	it('coalesces requests and reports the newest serial', async () => {
		const results: InspectionObservation[] = [];
		let resolveDraw: ((frame: InspectionFrame | null) => void) | undefined;
		const draw = vi.fn(
			() =>
				new Promise<InspectionFrame | null>((resolve) => {
					resolveDraw = resolve;
				})
		);
		const observer = createInspectionObserver({
			generation: () => 1,
			draw,
			onResult: (result) => results.push(result)
		});
		observer.request();
		await Promise.resolve();
		observer.request();
		expect(draw).toHaveBeenCalledTimes(1);
		resolveDraw?.({
			pixels: new Uint8Array(16),
			width: 2,
			height: 2,
			backend: 'webgpu'
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(draw).toHaveBeenCalledTimes(2);
		resolveDraw?.({
			pixels: new Uint8Array(16),
			width: 2,
			height: 2,
			backend: 'webgpu'
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(results.map((result) => result.status)).toEqual(['ready', 'ready']);
		expect(results.at(-1)?.serial).toBe(2);
		observer.dispose();
	});

	it('reports cancellation and generation loss instead of stale pixels', async () => {
		const results: InspectionObservation[] = [];
		let generation = 1;
		const observer = createInspectionObserver({
			generation: () => generation,
			draw: async (signal) => {
				if (signal.aborted) return null;
				generation = 2;
				return { pixels: new Uint8Array(16), width: 2, height: 2, backend: 'webgpu' };
			},
			onResult: (result) => results.push(result)
		});
		observer.request();
		await Promise.resolve();
		await Promise.resolve();
		expect(results[0]?.status).toBe('generation-lost');

		const cancelled: InspectionObservation[] = [];
		const second = createInspectionObserver({
			generation: () => 1,
			draw: (signal) =>
				new Promise((resolve) => {
					signal.addEventListener('abort', () => resolve(null));
				}),
			onResult: (result) => cancelled.push(result)
		});
		second.request();
		await Promise.resolve();
		second.cancel();
		await Promise.resolve();
		await Promise.resolve();
		expect(cancelled[0]?.status).toBe('cancelled');
	});
});
