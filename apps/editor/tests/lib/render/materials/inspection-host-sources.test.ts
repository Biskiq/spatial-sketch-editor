/**
 * The host on the real view cache, source cache and draft scope: what a failed,
 * absent, treated or repeated source reports. Only the device and decoder are fake.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Material, Texture } from 'three';
import type { Mapping, Recipe } from '@portfolio/project-model/materials';

vi.mock('$lib/render/materials/inspection-lighting', async (original) => ({
	...(await original<object>()),
	createInspectionLighting: () => ({ group: new Group(), environment: () => null, dispose: () => undefined })
}));
vi.mock('$lib/render/materials/inspection-world', async (original) => ({
	...(await original<object>()),
	createWorldInspectionLighting: () => ({ group: new Group(), dispose: () => undefined })
}));

import {
	DEFAULT_FINISH_VIEW_BUDGET_BYTES,
	resetFinishViewsForTests,
	rgba8MipChainBytes,
	setFinishViewBudget
} from '$lib/render/resources/finish-views';
import {
	createInspectionHost,
	type InspectionHost,
	type InspectionRequest,
	type InspectionState
} from '$lib/render/materials/inspection-host';
import {
	__resetDefaultSourceLoaderForTests,
	setDefaultTextureSourceLoader
} from '$lib/render/resources/texture-store';
import type { InspectionDraft } from '$lib/render/materials/inspection-subject';
import { contentHash, fullRecipe } from '../../project-model/materials/fixtures';

const PNGS = fileURLToPath(new URL('../../../../static/material-thumbnails/', import.meta.url));
const IMAGES = readdirSync(PNGS)
	.filter((name) => name.endsWith('.png'))
	.sort()
	.slice(0, 2)
	.map((name) => {
		const bytes = new Uint8Array(readFileSync(`${PNGS}${name}`));
		return { bytes, hash: `sha256-${createHash('sha256').update(bytes).digest('hex')}` };
	});

let reads: string[];
let failing: Set<string>;
let texelAlpha: number;
let serial = 0;
let host: InspectionHost;

const normal = (mapping?: Mapping) => ({ image: IMAGES[0]!.hash, convention: '+Y', ...(mapping && { mapping }) });
const scalar = (image: number, mapping?: Mapping) => ({
	image: IMAGES[image]!.hash,
	component: 'g',
	invert: false,
	...(mapping && { mapping })
});

function draft(maps: object, recipe: Partial<Recipe> = {}): InspectionDraft {
	return {
		name: 'Draft',
		recipe: { ...fullRecipe(), maps, ...recipe } as Recipe,
		recipeHash: contentHash(`draft-${(serial += 1)}`),
		sources: new Map(
			IMAGES.map(({ bytes, hash }) => [
				hash,
				{
					hash,
					mime: 'image/png',
					length: bytes.length,
					read: async () => {
						reads.push(hash);
						if (failing.has(hash)) throw new Error('transient');
						return bytes;
					}
				}
			])
		)
	};
}

function watch(value: InspectionDraft, options: Partial<InspectionRequest> = {}) {
	let state: InspectionState = { status: 'pending' };
	const stop = host.observe(
		{
			subject: { kind: 'draft', draft: value },
			geometry: 'plane',
			lighting: 'studio',
			display: 'lit',
			sizePx: [8, 8],
			...options
		},
		(next) => (state = next)
	);
	const settled = async (): Promise<any> => {
		await vi.waitFor(() => expect(state.status).not.toBe('pending'));
		return state;
	};
	return { stop, settled };
}

const channel = (state: any, role: string) => state.channels.find((entry: any) => entry.role === role);

beforeEach(() => {
	reads = [];
	failing = new Set();
	texelAlpha = 255;
	vi.stubGlobal('createImageBitmap', async () => ({ width: 192, height: 192, close: () => undefined }));
	host = createInspectionHost({
		materials: { acquire: () => ({ material: new Material(), release: () => undefined }) } as never,
		lights: {} as never,
		encode: async () => new Uint8Array(1)
	});
	host.attach({
		renderer: {
			isWebGPURenderer: true,
			backend: { isWebGPUBackend: true },
			autoClear: true,
			toneMappingExposure: 1,
			getRenderTarget: () => null,
			getClearColor: (color: unknown) => color,
			getClearAlpha: () => 1,
			setRenderTarget: () => undefined,
			setClearColor: () => undefined,
			clear: () => undefined,
			render: () => undefined,
			readRenderTargetPixelsAsync: async (_: unknown, __: number, ___: number, width: number, height: number) =>
				new Uint8Array(width * height * 4).fill(width === 1 ? texelAlpha : 255)
		} as never,
		backend: 'webgpu',
		viewGeneration: { owner: `sources-${(serial += 1)}`, generation: 0 }
	});
});

afterEach(() => {
	host.dispose();
	resetFinishViewsForTests();
	setFinishViewBudget(DEFAULT_FINISH_VIEW_BUDGET_BYTES);
	vi.unstubAllGlobals();
	__resetDefaultSourceLoaderForTests();
});

describe('retry', () => {
	it('reads a failed draft image again', async () => {
		failing.add(IMAGES[1]!.hash);
		const view = watch(draft({ roughness: scalar(1) }));
		expect((await view.settled()).status).toBe('partial');
		failing.clear();
		host.retry();
		expect((await view.settled()).status).toBe('ready');
		expect(reads).toHaveLength(2);
	});

	it('fetches again for the next thumbnail request of a failed look', async () => {
		let offline = true;
		setDefaultTextureSourceLoader(async () => {
			if (offline) throw new Error('offline');
			return new Texture({ width: 4, height: 4 } as never);
		});
		const subject = { kind: 'catalogue', id: 'wood-oak-veneer' } as const;
		expect((await host.thumbnail({ subject })).status).toBe('refused');
		offline = false;
		expect(await host.thumbnail({ subject, width: 64 })).toMatchObject({ status: 'ready' });
	});
});

describe('channel truth', () => {
	it('reports a Treatment as unsampled, at its own constants', async () => {
		const world = {
			acceptedRevision: '1',
			anchorWorld: [0, 0, 0],
			sky: null,
			frame: {},
			lights: [],
			treatment: 'clay'
		} as never;
		const state = await watch(draft({ roughness: scalar(1) }), { lighting: { world } }).settled();
		expect(state.status).toBe('ready');
		expect(channel(state, 'roughness')).toMatchObject({ state: 'not-sampled', constant: 0.9 });
		expect(channel(state, 'color').constant).toBe('#d6d3cd');
		expect(reads).toEqual([]);
	});

	it('names each role a failed image serves and keeps its siblings', async () => {
		failing.add(IMAGES[1]!.hash);
		const value = draft({ normal: normal(), roughness: scalar(1), metalness: scalar(1) });
		const state = await watch(value).settled();
		expect(state.status).toBe('partial');
		expect(state.issues.map((issue: any) => `${issue.code}:${issue.role}`).sort()).toEqual([
			'image-load-failed:metalness',
			'image-load-failed:roughness'
		]);
		expect(channel(state, 'normal').state).toBe('bound');
		const solo = await watch(value, { display: { solo: 'normal' } }).settled();
		expect(solo.status).toBe('partial');
		const texel = await host.texel({ subject: { kind: 'draft', draft: value }, geometry: 'plane', uv: [0.5, 0.5] });
		expect(texel.status).toBe('partial');
		expect(channel(texel, 'normal').state).toBe('bound');
	});

	it('keeps the channels beside an absent UV', async () => {
		const uv = (set: 0 | 1): Mapping => ({ kind: 'uv', set, repeat: [1, 1], rotation: 0, offset: [0, 0] });
		const value = draft({ normal: normal(uv(1)), roughness: scalar(1, uv(0)) }, { mapping: uv(0) });
		for (const display of ['lit', { solo: 'roughness' }] as const) {
			const state = await watch(value, { display }).settled();
			expect(state.status).toBe('partial');
			expect(channel(state, 'roughness').state).toBe('bound');
			expect(channel(state, 'normal').state).toBe('missing-view');
		}
		expect((await watch(value, { display: { solo: 'normal' } }).settled()).status).toBe('refused');
		const texel = await host.texel({ subject: { kind: 'draft', draft: value }, geometry: 'plane', uv: [0.5, 0.5] });
		expect(channel(texel, 'roughness').state).toBe('bound');
	});

	it('refuses an unavailable solo, and still draws an unbound one as its constant', async () => {
		failing.add(IMAGES[1]!.hash);
		const refused = await watch(draft({ roughness: scalar(1) }), { display: { solo: 'roughness' } }).settled();
		expect(refused).toMatchObject({ status: 'refused', issues: [{ code: 'image-load-failed', role: 'roughness' }] });
		expect('frame' in refused).toBe(false);
		const constant = await watch(draft({ normal: normal() }), { display: { solo: 'roughness' } }).settled();
		expect(constant.status).toBe('ready');
	});

	it('preflights the whole set against the budget, and a solo alone', async () => {
		setFinishViewBudget(rgba8MipChainBytes(192, 192));
		const value = draft({ normal: normal(), roughness: scalar(1) });
		const lit = await watch(value).settled();
		expect(lit).toMatchObject({ status: 'partial', issues: [{ code: 'texture-budget' }] });
		expect(channel(lit, 'normal').state).toBe('missing-view');
		const solo = await watch(value, { display: { solo: 'normal' } }).settled();
		expect(channel(solo, 'normal').state).toBe('bound');
	});

	it('refuses the empty texel read of a lost device', async () => {
		texelAlpha = 0;
		const subject = { kind: 'draft', draft: draft({ roughness: scalar(1) }) } as const;
		expect(await host.texel({ subject, geometry: 'plane', uv: [0.5, 0.5] })).toMatchObject({
			status: 'refused',
			issues: [{ code: 'readback-failed' }]
		});
	});
});

describe('draft sources', () => {
	it('reuses verified bytes across size and factor edits, then releases them', async () => {
		const value = draft({ normal: normal(), roughness: scalar(1) });
		let view = watch(value);
		await view.settled();
		const initial = reads.length;
		for (const size of [16, 24]) {
			view.stop();
			view = watch(value, { sizePx: [size, size] });
			await view.settled();
		}
		view = watch({ ...value, recipe: { ...value.recipe, roughness: 0.3 }, recipeHash: contentHash('factor-edit') });
		expect((await view.settled()).status).toBe('ready');
		expect(reads).toHaveLength(initial);
		view.stop();
		await Promise.resolve();
		expect(host.stats().draftScopes).toBe(0);
	});
});
