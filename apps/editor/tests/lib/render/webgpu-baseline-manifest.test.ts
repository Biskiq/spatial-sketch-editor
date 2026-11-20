/**
 * PR 1 baseline freeze.
 *
 * The migration must not silently move the native-WebGL comparison. This
 * verifier holds the pinned source revision, the resolved Three/Threlte
 * versions, the S0 comparator geometry and camera poses, and the exact bytes
 * of every shipped texture, GLB and render fixture the A row renders.
 *
 * `currentWorld` records the census target and pins the canonical equivalent
 * built for PR 1; the absent saved project stays explicit in `unverified`.
 */
import { createHash, type BinaryLike } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MAX_PUBLIC_ASSET_BYTES } from '$lib/visitor/public-release-client';
import { SHIPPED_STATIC_REGISTRY_VERSION } from '$lib/visitor/shipped-static-registry';

type Asset = { path: string; bytes: number; digest: string };
type Manifest = {
	baselineCommit: string;
	packages: { three: string; threlteCore: string; threlteExtras: string };
	viewport: { width: number; height: number; dpr: number };
	s0Comparators: Record<string, Record<string, unknown>>;
	currentWorld: {
		target: Record<string, number>;
		fixture: { path: string; bytes: number; digest: string; counts: Record<string, number> };
		publicationProjection: {
			path: string;
			bytes: number;
			digest: string;
			removedContent: string[];
		};
		artwork: Array<{ assetId: string; path: string; bytes: number; digest: string }>;
		requiredContent: string[];
		status: string;
	};
	coldPublic: {
		samples: number;
		browserBatches: number;
		summaryMs: { p50: number; p90: number; max: number };
		rendererAtFirstFrame: { calls: number; triangles: number };
		consoleErrors: number;
		boundary: string;
	};
	preparedPublication: {
		protocol: string;
		registryVersion: number;
		maxAssetBytes: number;
		mimes: string[];
		releaseEndpoint: string;
		assetEndpoint: string;
	};
	unverified: string[];
	hardwareDeferralRequest: {
		status: string;
		approved: boolean;
		scope: string[];
		reason: string;
	};
	assets: Asset[];
};

const ROOT = resolve(process.cwd(), '../..');
const APP = process.cwd();

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as unknown;
}

const manifest = readJson('apps/editor/experiments/webgpu-migration/baseline/fixtures.json') as Manifest;
const lock = readJson('package-lock.json') as {
	packages: Record<string, { version?: string }>;
};

describe('PR 1 native-WebGL baseline manifest', () => {
	it('pins the source revision, viewport and resolved renderer packages', () => {
		expect(manifest.baselineCommit).toBe('a53d30deb8ab0c4964bc42a41bf2e0d874ee6786');
		expect(manifest.viewport).toEqual({ width: 1280, height: 720, dpr: 1 });
		expect(manifest.packages).toEqual({
			three: lock.packages['node_modules/three']?.version,
			threlteCore: lock.packages['node_modules/@threlte/core']?.version,
			threlteExtras: lock.packages['node_modules/@threlte/extras']?.version
		});
		expect(manifest.packages).toEqual({
			three: '0.187.0',
			threlteCore: '8.5.16',
			threlteExtras: '9.21.0'
		});
	});

	it('keeps the gallery comparator at the S0 12 × 7 with six textured quads', () => {
		const gallery = manifest.s0Comparators['gallery-wall'] as {
			width: number;
			depth: number;
			wallHeight: number;
			quads: { count: number; size: number[]; xs: number[]; texture: string };
			camera: { position: number[]; lookAt: number[]; fov: number; near: number; far: number };
		};
		expect([gallery.width, gallery.depth, gallery.wallHeight]).toEqual([12, 7, 3]);
		expect(gallery.quads.count).toBe(6);
		expect(gallery.quads.xs).toHaveLength(6);
		expect(gallery.quads.size).toEqual([1.2, 0.9]);
		expect(gallery.quads.texture).toBe('apps/editor/static/textures/plaster-warm/map.png');
		// The bench camera sits inside the room: its near wall is at -3.5.
		expect(gallery.camera.position[2]).toBeGreaterThan(-3.5);
		expect(gallery.camera.position[2]).toBeLessThan(3.5);
		expect(gallery.camera.fov).toBe(50);
		expect(gallery.camera.near).toBe(0.1);
		expect(gallery.camera.far).toBe(100);
	});

	it('names every required current-world element and pins the canonical fixture', () => {
		expect(manifest.currentWorld.target).toMatchObject({
			rooms: 10,
			walls: 31,
			stageDraws: 64,
			visitorDraws: 58,
			stageTriangles: 44937,
			visitorTriangles: 25203
		});
		expect(manifest.currentWorld.requiredContent).toEqual(
			expect.arrayContaining([
				'opening',
				'curved-wall',
				'room-floor-lid',
				'standalone-region-s5b-faces',
				'imported-textured-glb',
				'neutral-artwork',
				'translucent-artwork',
				'shadow-sun',
				'shadow-spot',
				'shadow-point'
			])
		);
		expect(manifest.currentWorld.status).toContain('Frozen in PR 1');
		expect(manifest.currentWorld.fixture.path).toBe(
			'apps/editor/experiments/webgpu-migration/baseline/current-world.project.json'
		);
		expect(manifest.currentWorld.fixture.counts).toMatchObject({ rooms: 10, walls: 31 });
		expect(manifest.currentWorld.publicationProjection.removedContent).toEqual(['form']);
	});

	it('matches the canonical current-world fixture and its publication projection byte-for-byte', () => {
		const files = [
			{
				path: manifest.currentWorld.fixture.path,
				bytes: manifest.currentWorld.fixture.bytes,
				digest: manifest.currentWorld.fixture.digest
			},
			{
				path: manifest.currentWorld.publicationProjection.path,
				bytes: manifest.currentWorld.publicationProjection.bytes,
				digest: manifest.currentWorld.publicationProjection.digest
			},
			...manifest.currentWorld.artwork.map((entry) => ({
				path: entry.path,
				bytes: entry.bytes,
				digest: entry.digest
			}))
		];
		for (const file of files) {
			const bytes = readFileSync(resolve(ROOT, file.path));
			expect(bytes.byteLength, file.path).toBe(file.bytes);
			expect(`sha256-${createHash('sha256').update(bytes as unknown as BinaryLike).digest('hex')}`, file.path).toBe(
				file.digest
			);
		}
	});

	it('pins the prepared-publication protocol inputs, not a live publication', () => {
		expect(manifest.preparedPublication.protocol).toBe('P20');
		expect(manifest.preparedPublication.registryVersion).toBe(SHIPPED_STATIC_REGISTRY_VERSION);
		expect(manifest.preparedPublication.maxAssetBytes).toBe(MAX_PUBLIC_ASSET_BYTES);
		expect(manifest.preparedPublication.mimes).toEqual(['image/png', 'image/webp', 'image/jpeg']);
		expect(manifest.preparedPublication.releaseEndpoint).toBe('/publications/:publicationId');
		expect(manifest.preparedPublication.assetEndpoint).toBe(
			'/publications/:publicationId/versions/:version/assets/:assetId/content'
		);
	});

	it('matches every frozen asset byte-for-byte', () => {
		expect(manifest.assets.length).toBeGreaterThanOrEqual(17);
		for (const asset of manifest.assets) {
			const absolute = resolve(ROOT, asset.path);
			const bytes = readFileSync(absolute);
			expect(statSync(absolute).size, asset.path).toBe(asset.bytes);
			const digest = `sha256-${createHash('sha256').update(bytes as unknown as BinaryLike).digest('hex')}`;
			expect(digest, asset.path).toBe(asset.digest);
		}
	});

	it('keeps every shipped texture and model in the frozen set', () => {
		const paths = new Set(manifest.assets.map((asset) => asset.path));
		for (const path of [
			'apps/editor/static/textures/plaster-warm/map.png',
			'apps/editor/static/textures/plaster-warm/roughness.png',
			'apps/editor/static/textures/brass-aged/map.png',
			'apps/editor/static/textures/wood-walnut/map.png',
			'apps/editor/static/textures/wood-walnut/roughness.png',
			'apps/editor/static/museum/models/piano/grand-piano.glb',
			'apps/editor/static/museum/models/furniture/chair/salon-chair.glb',
			'apps/editor/static/museum/models/furniture/sofa/sofa-03.glb',
			'apps/editor/static/museum/models/furniture/table/salon-table.glb',
			'apps/editor/static/museum/models/decor/chandelier/chandelier2.glb',
			'apps/editor/static/museum/models/decor/oil-lamp/victorian-oil-lamp.glb',
			'apps/editor/static/museum/models/decor/clock/grandfather-clock.glb'
		]) {
			expect(paths.has(path), path).toBe(true);
		}
	});

	it('pins the cold-public evidence and its measurement boundary', () => {
		expect(manifest.coldPublic.samples).toBe(20);
		expect(manifest.coldPublic.browserBatches).toBe(2);
		expect(manifest.coldPublic.summaryMs.p90).toBeLessThan(1000);
		expect(manifest.coldPublic.rendererAtFirstFrame.calls).toBeGreaterThan(0);
		expect(manifest.coldPublic.rendererAtFirstFrame.triangles).toBeGreaterThan(0);
		expect(manifest.coldPublic.consoleErrors).toBe(0);
		expect(manifest.coldPublic.boundary).toContain('not physical presentation');
	});

	it('records the unverified reference rows instead of claiming them', () => {
		expect(manifest.unverified).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Intel Iris Xe'),
				expect.stringContaining('Safari and Firefox'),
				expect.stringContaining('canonical equivalent')
			])
		);
		expect(manifest.hardwareDeferralRequest).toMatchObject({
			status: 'pending owner approval',
			approved: false
		});
		// The manifest test uses the app root only to resolve static bytes.
		expect(APP.endsWith('apps/editor')).toBe(true);
	});
});
