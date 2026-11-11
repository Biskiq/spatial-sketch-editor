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
		readonly footer?: Snippet;
		readonly secondary?: Snippet<[Snippet?]>;
	} = {}
) {
	const snapshot = snapshotOf(entity);
	const accept = vi.fn(async (_intent: unknown) => ({ kind: 'installed' as const }));
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: entity.id } }
			}),
			notifySurfaceChange: vi.fn(),
			setSelection: vi.fn()
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
	return { target, accept };
}

function field(target: HTMLElement, name: string): HTMLInputElement | HTMLButtonElement {
	const found = target.querySelector<HTMLInputElement | HTMLButtonElement>(
		`[data-field="${name}"]`
	);
	if (found === null) throw new Error(`the ${name} field is missing`);
	return found;
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
		expect(target.textContent).toContain('Custom');
		expect(target.textContent).toContain('0.00 cd');
		expect((field(target, 'exact-intensity') as HTMLInputElement).value).toBe('0');
		for (const stop of ['0.25', '0.5', '1', '2', '4']) {
			expect(field(target, `brightness-${stop}`).getAttribute('aria-pressed')).toBe('false');
		}
	});

	it('shows Spot Beam but no Adjust Reach, and directional has neither', async () => {
		const spotCard = await mountCard(spot());
		expect(field(spotCard.target, 'adjust-beam')).toBeDefined();
		expect(spotCard.target.querySelector('[data-field="adjust-reach"]')).toBeNull();
	});

	it('commits exact values on Enter, restores on Esc, and never writes on blur', async () => {
		const { target, accept } = await mountCard(spot());
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

	it('exposes azimuth/elevation instead of Reach or Beam for a directional', async () => {
		const { target } = await mountCard(directional());
		expect(field(target, 'azimuth')).toBeDefined();
		expect(field(target, 'elevation')).toBeDefined();
		expect(target.querySelector('[data-field="adjust-reach"]')).toBeNull();
		expect(target.querySelector('[data-field="adjust-beam"]')).toBeNull();
	});
});
