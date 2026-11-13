// @vitest-environment jsdom
/**
 * T2 gallery UX recovery §7.2 — the Artwork Card reads Size, Hang, Frame, foot,
 * then Advanced. Size keeps aspect locked; Hang is height above the datum; the
 * foot runs the same contributed actions; Position and Rotation are Advanced.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { SceneArtworkEntity } from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import ArtworkCard from '$lib/authoring/artwork/ArtworkCard.svelte';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { StageCardActionRecord } from '$lib/authoring/stage/stage-facade';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';

const ARTWORK_ID = 'artwork-card';
const SOURCE_ID = `sha256-${'e'.repeat(64)}`;

function artwork(overrides: Partial<SceneArtworkEntity> = {}): SceneArtworkEntity {
	return {
		kind: 'artwork',
		id: ARTWORK_ID,
		name: 'Toobig.png',
		position: [3, 1.5, 2],
		rotation: [0, 0, 0],
		widthMeters: 1.8,
		source: { kind: 'image', assetId: 'asset-1', pixelWidth: 1600, pixelHeight: 900 },
		frame: { style: 'gallery', mat: false, color: 'black' },
		...overrides
	};
}

function snapshotOf(entity: SceneArtworkEntity): StageReadSnapshot {
	const sceneData = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [entity]
	};
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-artwork-card', revisionId: 'revision-artwork-card' },
			sourceContentId: SOURCE_ID,
			compileGeneration: 'generation-artwork-card',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			domain: {
				scene: { entities: [entity] },
				datumMeters: 0.2,
				unitRevisions: {
					layout: 'sha256-layout',
					scene: 'sha256-scene',
					camera: 'sha256-camera',
					experience: 'sha256-experience',
					resources: 'sha256-resources'
				}
			}
		} as unknown as StageReadSnapshot,
		{
			units: {
				layout: {
					header: { formatVersion: 7, contentRevision: 'sha256-layout' },
					data: createEmptyWallFirstLayoutDocument()
				},
				scene: {
					header: { formatVersion: SCENE_UNIT_FORMAT_VERSION, contentRevision: 'sha256-scene' },
					data: sceneData
				},
				resources: {
					header: { formatVersion: 2, contentRevision: 'sha256-resources' },
					data: { formatVersion: 2, resources: [] }
				}
			}
		} as unknown as ProjectEnvelope
	);
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

function actions(): StageCardActionRecord[] {
	return [
		{ adapterId: 'light', id: 'light-it', label: 'Light it', run: vi.fn() },
		{ adapterId: 'scene', id: 'artwork-replace', label: 'Replace image', run: vi.fn() },
		{ adapterId: 'scene', id: 'artwork-duplicate', label: 'Duplicate', run: vi.fn() },
		{ adapterId: 'scene', id: 'artwork-delete', label: 'Delete Artwork', destructive: true, run: vi.fn() }
	] as unknown as StageCardActionRecord[];
}

async function mountCard(entity = artwork()) {
	const snapshot = snapshotOf(entity);
	const accept = vi.fn(async (_intent: unknown) => ({ kind: 'installed' as const }));
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: entity.id } }
			}),
			onAdaptersChanged: vi.fn(() => () => {}),
			notifySurfaceChange: vi.fn()
		},
		authoring: {
			accept,
			acceptedRevision: () => snapshot.acceptedRevision,
			registerPlanner: () => ({ kind: 'registered' })
		}
	} as unknown as StageAdapterServices;
	const onAction = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(ArtworkCard, {
		target,
		props: { services, actions: actions(), onAction }
	});
	cleanup = () => unmount(component);
	await tick();
	return { target, accept, onAction };
}

function field(target: HTMLElement, name: string): HTMLInputElement {
	const found = target.querySelector<HTMLInputElement>(`[data-field="${name}"]`);
	if (found === null) throw new Error(`the ${name} field is missing`);
	return found;
}

async function enter(target: HTMLElement, name: string, value: string): Promise<void> {
	const input = field(target, name);
	input.value = value;
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Artwork Card', () => {
	it('reads Size, Hang and Frame in order with the framed size line', async () => {
		const { target } = await mountCard();
		const headings = [...target.querySelectorAll('h3')].map((heading) => heading.textContent?.trim());
		expect(headings).toEqual(['Size', 'Hang', 'Frame']);
		expect(target.querySelector('[data-artwork-framed]')?.textContent?.trim()).toBe(
			'Framed 192.0 × 113.2 cm · 4.0 cm deep'
		);
		expect(field(target, 'width').value).toBe('180');
		expect(field(target, 'height').value).toBe('101.25');
		expect(field(target, 'hang').value).toBe('130');
	});

	it('writes Width and Height in cm, keeping the image aspect locked', async () => {
		const { target, accept } = await mountCard();
		await enter(target, 'width', '200');
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({ payload: { widthMeters: 2 } });
		accept.mockClear();
		await enter(target, 'height', '100');
		expect(accept).toHaveBeenCalledTimes(1);
		expect((accept.mock.calls[0]![0] as { payload: { widthMeters: number } }).payload.widthMeters)
			.toBeCloseTo(100 / 100 * 1600 / 900, 9);
	});

	it('writes Hang as height above the datum', async () => {
		const { target, accept } = await mountCard();
		await enter(target, 'hang', '145');
		expect(accept.mock.calls[0]![0]).toMatchObject({
			payload: { position: [3, 1.65, 2] }
		});
	});

	it('writes a frame tile and summarises the frame in one line', async () => {
		const { target, accept } = await mountCard();
		expect(target.querySelector('[data-artwork-frame-summary]')?.textContent?.trim()).toBe(
			'Gallery · Black'
		);
		const thin = target.querySelector<HTMLButtonElement>('[data-frame-style="thin"]');
		thin!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(accept.mock.calls[0]![0]).toMatchObject({
			payload: { frame: { style: 'thin', mat: false, color: 'black' } }
		});
	});

	it('runs Light it and Replace image from the foot, and opens the same actions', async () => {
		const { target, onAction } = await mountCard();
		target.querySelector<HTMLButtonElement>('[data-card-foot="light-it"]')!.click();
		expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'light-it' }));
		target.querySelector<HTMLButtonElement>('[data-card-foot="replace"]')!.click();
		expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'artwork-replace' }));
	});

	it('puts Position and Rotation under Advanced, with Duplicate and Delete', async () => {
		const { target, accept, onAction } = await mountCard();
		expect(target.querySelector('[data-field="x"]')).toBeNull();
		target.querySelector<HTMLButtonElement>('[data-card-foot="advanced"]')!.click();
		await tick();
		expect(target.querySelector('[data-field="x"]')).not.toBeNull();
		expect(target.querySelector('[data-field="tilt"]')).toBeNull();
		target.querySelector<HTMLButtonElement>('[data-artwork-group="rotation"]')!.click();
		await tick();
		expect(field(target, 'tilt').value).toBe('0');
		await enter(target, 'turn', '90');
		expect((accept.mock.calls[0]![0] as { payload: { rotation: [number, number, number] } }).payload.rotation[1])
			.toBeCloseTo(Math.PI / 2, 9);
		target.querySelector<HTMLButtonElement>('[data-card-action="artwork-duplicate"]')!.click();
		expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'artwork-duplicate' }));
		target.querySelector<HTMLButtonElement>('[data-card-action="artwork-delete"]')!.click();
		expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'artwork-delete' }));
	});
});
