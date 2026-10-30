// @vitest-environment jsdom
/**
 * R217.S08 — the Scene object Card writer.
 *
 * The controller proves the exact facts; this mounts the real Card fields so the
 * entry grammar is exercised where the creator uses it: a refused Enter keeps
 * its reason under the field, blur never commits, and Escape restores the
 * accepted value before the shell can clear the selection.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { ViewportEvaluation } from '@portfolio/camera-core';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import SceneObjectCardFields from '$lib/authoring/adapters/scene/SceneObjectCardFields.svelte';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { attachUnitStageSource } from '$lib/authoring/stage/unit-stage-source';

const BOX_ID = 'entity-card-box';
const SOURCE_ID = `sha256-${'c'.repeat(64)}`;
const EVALUATION = {
	token: {
		outputId: 'output-card',
		sessionEpoch: 'session-card',
		sourceRevision: SOURCE_ID,
		evaluationGeneration: 1
	},
	settledReading: '3d'
} as unknown as ViewportEvaluation;
const EVALUATION_ID = 'output-card::session-card::1';

const BOX = {
	kind: 'primitive',
	primitive: 'box',
	id: BOX_ID,
	name: 'Block',
	dimensions: { width: 1, height: 1, depth: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
	position: [2, 0.5, 2],
	rotation: [0, 0, 0]
};

function snapshotOf(box = BOX): StageReadSnapshot {
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-card', revisionId: 'revision-card' },
			sourceContentId: SOURCE_ID,
			compileGeneration: 'generation-card',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			domain: {
				scene: { entities: [box] },
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
					header: { formatVersion: 6, contentRevision: 'sha256-layout' },
					data: createEmptyWallFirstLayoutDocument()
				},
				scene: {
					header: {
						formatVersion: SCENE_UNIT_FORMAT_VERSION,
						contentRevision: 'sha256-scene'
					},
					data: {
						formatVersion: SCENE_UNIT_FORMAT_VERSION,
						textures: [],
						materials: [],
						entities: [box]
					}
				},
				resources: {
					header: { formatVersion: 2, contentRevision: 'sha256-resources' },
					data: { formatVersion: 2, resources: [] }
				}
			}
		} as unknown as ProjectEnvelope
	);
}

type Harness = {
	readonly target: HTMLElement;
	readonly accept: ReturnType<typeof vi.fn>;
	readonly notify: ReturnType<typeof vi.fn>;
};

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

async function mountCard(): Promise<Harness> {
	const snapshot = snapshotOf();
	const accept = vi.fn(async () => ({
		kind: 'refused' as const,
		code: 'invalid',
		message: 'Resize needs one finite positive uniform scale.'
	}));
	const notify = vi.fn();
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: BOX_ID } }
			}),
			evaluation: () => EVALUATION,
			evaluationId: () => EVALUATION_ID,
			onAdaptersChanged: () => () => {},
			notifySurfaceChange: notify,
			setSelection: vi.fn()
		},
		authoring: {
			accept,
			acceptedRevision: () => ({ revisionId: 'revision-card' })
		}
	} as unknown as StageAdapterServices;
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(SceneObjectCardFields, { target, props: { services } });
	cleanup = () => unmount(component);
	await tick();
	return { target, accept, notify };
}

function input(target: HTMLElement, field: string): HTMLInputElement {
	const found = target.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
	if (found === null) throw new Error(`the ${field} field is missing`);
	return found;
}

describe('Scene object Card writer', () => {
	it('shows a refused Enter under the field without writing', async () => {
		const { target, accept } = await mountCard();
		const size = input(target, 'size');
		size.value = '0';
		size.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		size.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(accept).toHaveBeenCalledTimes(1);
		expect(target.textContent).toContain('Resize needs one finite positive uniform scale.');
		expect(size.value).toBe('0');
	});

	it('never commits on blur and restores the accepted text', async () => {
		const { target, accept } = await mountCard();
		const size = input(target, 'size');
		size.focus();
		size.value = '2';
		size.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		size.blur();
		await tick();

		expect(accept).not.toHaveBeenCalled();
		expect(size.value).toBe('1');
	});

	it('restores the accepted value on the first Escape', async () => {
		const { target, accept } = await mountCard();
		const yaw = input(target, 'yaw');
		yaw.focus();
		yaw.value = '45';
		yaw.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		const event = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		yaw.dispatchEvent(event);
		await tick();

		expect(accept).not.toHaveBeenCalled();
		expect(yaw.value).toBe('0');
		expect(event.defaultPrevented).toBe(true);
	});
});
