// @vitest-environment jsdom
/**
 * T2.S3a — the mounted Light Card writer.
 *
 * The Card is the creator's exact-value path: Shadow is a real authored toggle,
 * a custom/zero Brightness never selects a stop, and every exact field commits
 * on Enter only. Blur and Esc never write; Esc restores the accepted text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, mount, tick, unmount, type Snippet } from 'svelte';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { SceneLightEntity } from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import LightCardFields from '$lib/authoring/adapters/light/LightCardFields.svelte';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';

const LIGHT_ID = 'light-card';
const SOURCE_ID = `sha256-${'d'.repeat(64)}`;

function spot(overrides: Partial<SceneLightEntity> = {}): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id: LIGHT_ID,
		name: 'Card spot',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position: [0, 2, 0],
		rotation: [0, 0, 0],
		angle: Math.PI / 6,
		...overrides
	} as SceneLightEntity;
}

function directional(): SceneLightEntity {
	return {
		kind: 'light',
		light: 'directional',
		id: LIGHT_ID,
		name: 'Card sun',
		color: '#ffffff',
		intensity: Math.PI,
		castShadow: false,
		position: [0, 2, 0],
		rotation: [0, 0, 0]
	};
}

function snapshotOf(entity: SceneLightEntity): StageReadSnapshot {
	const sceneData = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [entity]
	};
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-card', revisionId: 'revision-card' },
			sourceContentId: SOURCE_ID,
			compileGeneration: 'generation-card',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			domain: {
				scene: { entities: [entity] },
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
					header: {
						formatVersion: SCENE_UNIT_FORMAT_VERSION,
						contentRevision: 'sha256-scene'
					},
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

async function mountCard(
	entity: SceneLightEntity,
	options: {
		readonly detailOpen?: boolean;
		readonly footer?: Snippet<[string?]>;
		readonly secondary?: Snippet<[Snippet?]>;
	} = {}
) {
	const snapshot = snapshotOf(entity);
	const accept = vi.fn(async (_intent: unknown) => ({ kind: 'installed' as const }));
	const overrides = new Map<string, unknown>();
	const lightPreview = {
		overrides,
		candidate: null,
		setOverride: (id: string, light: unknown) => overrides.set(id, light),
		clearOverride: (id: string) => overrides.delete(id),
		setCandidate: vi.fn(),
		clear: () => overrides.clear(),
		flush: vi.fn()
	};
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: entity.id } }
			}),
			notifySurfaceChange: vi.fn(),
			setSelection: vi.fn(),
			lightPreview: () => lightPreview
		},
		authoring: {
			accept,
			acceptedRevision: () => snapshot.acceptedRevision,
			registerPlanner: () => ({ kind: 'registered' })
		}
	} as unknown as StageAdapterServices;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(LightCardFields, {
		target,
		props: {
			services,
			detailOpen: options.detailOpen ?? true,
			...(options.footer === undefined ? {} : { footer: options.footer }),
			...(options.secondary === undefined ? {} : { secondary: options.secondary })
		}
	});
	cleanup = () => unmount(component);
	await tick();
	return { target, accept, lightPreview };
}

function field(target: HTMLElement, name: string): HTMLInputElement | HTMLButtonElement {
	const found = target.querySelector<HTMLInputElement | HTMLButtonElement>(
		`[data-field="${name}"]`
	);
	if (found === null) throw new Error(`the ${name} field is missing`);
	return found;
}

async function openGroup(target: HTMLElement, id: string): Promise<void> {
	const head = target.querySelector<HTMLButtonElement>(`[data-advanced-group-head="${id}"]`);
	if (head === null) throw new Error(`the ${id} Advanced group is missing`);
	// The open group is session state remembered per kind; leave it open if it is.
	if (head.getAttribute('aria-expanded') !== 'true') head.click();
	await tick();
}

describe('S3a Light Card writer', () => {
	it('renders the shared footer so More can reach the exact fields', async () => {
		const footer = createRawSnippet(() => ({
			render: () => '<button type="button" data-test-footer>More</button>'
		}));
		const { target } = await mountCard(spot(), { detailOpen: false, footer });
		expect(target.querySelector('[data-test-footer]')).not.toBeNull();
		expect(target.querySelector('[data-field="exact-intensity"]')).toBeNull();
	});

	it('renders the shared secondary menu so Duplicate and Delete stay reachable', async () => {
		const secondary = createRawSnippet(() => ({
			render: () => '<button type="button" data-test-secondary>Menu</button>'
		}));
		const { target } = await mountCard(spot(), { detailOpen: false, secondary });
		expect(target.querySelector('[data-test-secondary]')).not.toBeNull();
	});

	it('names the closed Advanced groups in the shared foot', async () => {
		const footer = createRawSnippet((summary: unknown) => ({
			render: () => {
				const value = typeof summary === 'function'
					? (summary as () => string | undefined)()
					: summary;
				return `<button type="button" data-test-footer>${value ?? ''}</button>`;
			}
		}));
		const { target } = await mountCard(spot(), { detailOpen: false, footer });
		expect(target.querySelector('[data-test-footer]')?.textContent).toBe(
			'Colour · Brightness · Shape · Position · Shadows'
		);
	});

	it('draws an Instrument icon on every Advanced group head', async () => {
		const { target } = await mountCard(spot(), { detailOpen: true });
		for (const id of ['colour', 'brightness', 'shape', 'position', 'shadows']) {
			expect(target.querySelector(`[data-advanced-group-head="${id}"] .group-icon svg`)).not.toBeNull();
		}
	});

	it('enables the authored Shadow toggle and writes castShadow', async () => {
		const { target, accept } = await mountCard(spot());
		const shadow = field(target, 'shadow') as HTMLInputElement;
		expect(shadow.disabled).toBe(false);
		expect(shadow.checked).toBe(false);
		shadow.checked = true;
		shadow.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID, castShadow: true }
		});
	});

	it('keeps zero and custom Brightness values without selecting a stop', async () => {
		const { target } = await mountCard(spot({ intensity: 0 }));
		await openGroup(target, 'brightness');
		expect(field(target, 'brightness-custom').textContent).toContain('0×');
		expect(target.textContent).toContain('0.000 cd');
		expect((field(target, 'exact-intensity') as HTMLInputElement).value).toBe('0.000');
		for (const stop of ['0.25', '0.5', '1', '2', '4']) {
			expect(field(target, `brightness-${stop}`).getAttribute('aria-pressed')).toBe('false');
		}
	});

	it('shows Spot Beam but no Adjust Reach, and directional has neither', async () => {
		const spotCard = await mountCard(spot());
		expect(field(spotCard.target, 'adjust-beam')).toBeDefined();
		expect(spotCard.target.querySelector('[data-field="adjust-reach"]')).toBeNull();
		const directionalCard = await mountCard(directional());
		expect(directionalCard.target.querySelector('[data-field="adjust-reach"]')).toBeNull();
		expect(directionalCard.target.querySelector('[data-field="adjust-beam"]')).toBeNull();
	});

	it('writes an unlimited Reach from the chip and a typed Reach from the field', async () => {
		const unlimited = await mountCard(spot({ light: 'point', range: 3 } as never));
		(field(unlimited.target, 'unlimited') as HTMLButtonElement).click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(unlimited.accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID, range: null }
		});

		const typed = await mountCard(spot({ light: 'point' } as never));
		const reach = field(typed.target, 'adjust-reach') as HTMLInputElement;
		reach.value = '2.5';
		reach.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		reach.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(typed.accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID, range: 2.5 }
		});
	});

	it('writes Directional From and Height in sky from the everyday Direction row', async () => {
		const { target, accept } = await mountCard(directional());
		const from = field(target, 'direction-from') as HTMLInputElement;
		const height = field(target, 'direction-height') as HTMLInputElement;
		// A zero rotation travels toward −Z, so the source is at +Z: From 180°, horizon.
		expect(Number(from.value)).toBeCloseTo(180, 4);
		expect(Number(height.value)).toBeCloseTo(0, 4);
		from.value = '300';
		from.dispatchEvent(new Event('input', { bubbles: true }));
		height.value = '50';
		height.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(accept).toHaveBeenCalledTimes(1);
		const payload = accept.mock.calls[0]![0] as { payload: { rotation: [number, number, number] } };
		expect(payload.payload.rotation.every(Number.isFinite)).toBe(true);
	});

	it('opens the colour dial without writing a mode value', async () => {
		const { target, accept } = await mountCard(spot());
		await openGroup(target, 'colour');
		const colourMode = target.querySelector<HTMLButtonElement>('[data-advanced-mode="colour"]');
		if (colourMode === null) throw new Error('the Colour mode chip is missing');
		colourMode.click();
		await tick();
		expect(target.querySelector('.dial')).not.toBeNull();
		expect(target.querySelector('[data-advanced-row="colour"]')).not.toBeNull();
		expect(target.querySelector('[data-advanced-row="warmth"]')).toBeNull();
		expect(accept).not.toHaveBeenCalled();

		target.querySelector<HTMLButtonElement>('[data-advanced-mode="white"]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID, color: expect.stringMatching(/^#[0-9a-f]{6}$/) }
		});
	});

	it('commits exact values on Enter, restores on Esc, and never writes on blur', async () => {
		const { target, accept } = await mountCard(spot());
		await openGroup(target, 'brightness');
		const intensity = field(target, 'exact-intensity') as HTMLInputElement;
		const accepted = intensity.value;

		intensity.focus();
		intensity.value = '2.5';
		intensity.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		intensity.blur();
		await tick();
		expect(accept).not.toHaveBeenCalled();
		expect(intensity.value).toBe(accepted);

		intensity.value = '2.5';
		intensity.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const enter = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true
		});
		intensity.dispatchEvent(enter);
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(enter.defaultPrevented).toBe(true);
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID, intensity: 2.5 }
		});

		intensity.value = '1.2';
		intensity.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const escape = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		intensity.dispatchEvent(escape);
		await tick();
		expect(escape.defaultPrevented).toBe(true);
		expect(accept).toHaveBeenCalledTimes(1);
		expect(intensity.value).toBe(accepted);
	});

	it('previews a Brightness slider drag and commits exactly once on release', async () => {
		const { target, accept, lightPreview } = await mountCard(spot());
		await openGroup(target, 'brightness');
		const slider = target.querySelector<HTMLInputElement>('[data-advanced-slider="brightness"]');
		if (slider === null) throw new Error('the Brightness slider is missing');

		slider.value = '1';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(accept).not.toHaveBeenCalled();
		expect(lightPreview.overrides.has(LIGHT_ID)).toBe(true);
		expect((lightPreview.overrides.get(LIGHT_ID) as { intensity: number }).intensity).toBeCloseTo(
			Math.PI * 2,
			9
		);

		slider.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(accept).toHaveBeenCalledTimes(1);
		expect(accept.mock.calls[0]![0]).toMatchObject({
			kind: 'update-light',
			payload: { entityId: LIGHT_ID }
		});
		const intensity = (accept.mock.calls[0]![0] as { payload: { intensity: number } }).payload.intensity;
		expect(intensity).toBeCloseTo(Math.PI * 2, 9);
		expect(lightPreview.overrides.has(LIGHT_ID)).toBe(false);
	});

	it('restores the accepted value and writes nothing when Esc ends a slider drag', async () => {
		const { target, accept, lightPreview } = await mountCard(spot());
		await openGroup(target, 'brightness');
		const slider = target.querySelector<HTMLInputElement>('[data-advanced-slider="brightness"]');
		if (slider === null) throw new Error('the Brightness slider is missing');
		slider.value = '-1';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(lightPreview.overrides.has(LIGHT_ID)).toBe(true);
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await tick();
		expect(accept).not.toHaveBeenCalled();
		expect(lightPreview.overrides.has(LIGHT_ID)).toBe(false);
	});

	it('exposes azimuth/elevation instead of Reach or Beam for a directional', async () => {
		const { target } = await mountCard(directional());
		await openGroup(target, 'direction');
		expect(field(target, 'azimuth')).toBeDefined();
		expect(field(target, 'elevation')).toBeDefined();
		expect(target.querySelector('[data-field="adjust-reach"]')).toBeNull();
		expect(target.querySelector('[data-field="adjust-beam"]')).toBeNull();
	});
});
