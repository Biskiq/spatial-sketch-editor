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
const OTHER_BOX = {
	...BOX,
	id: 'entity-card-other',
	name: 'Other block',
	position: [5, 0.5, 2]
};

function snapshotOf(entities: readonly unknown[] = [BOX]): StageReadSnapshot {
	return attachUnitStageSource(
		{
			acceptedRevision: { projectId: 'project-card', revisionId: 'revision-card' },
			sourceContentId: SOURCE_ID,
			compileGeneration: 'generation-card',
			sourceKind: UNIT_SOURCE_KIND,
			sourceVersion: UNIT_SOURCE_VERSION,
			domain: {
				scene: { entities },
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
						entities
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
	readonly fireAdaptersChanged: () => void;
	readonly select: (id: string) => void;
};

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

async function mountCard(
	options: { selectedId?: string; entities?: readonly unknown[] } = {}
): Promise<Harness> {
	const snapshot = snapshotOf(options.entities ?? [BOX]);
	let selectedId = options.selectedId ?? BOX_ID;
	const accept = vi.fn(async () => ({
		kind: 'refused' as const,
		code: 'invalid',
		message: 'Resize needs one finite positive uniform scale.'
	}));
	const adapterListeners = new Set<() => void>();
	const fireAdaptersChanged = (): void => {
		for (const listener of adapterListeners) listener();
	};
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => ({
				primary: { domain: 'scene', subject: { kind: 'entity', id: selectedId } }
			}),
			evaluation: () => EVALUATION,
			evaluationId: () => EVALUATION_ID,
			onAdaptersChanged: (listener: () => void) => {
				adapterListeners.add(listener);
				return () => {
					adapterListeners.delete(listener);
				};
			},
			notifySurfaceChange: fireAdaptersChanged,
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
	const select = (id: string): void => {
		selectedId = id;
		fireAdaptersChanged();
	};
	return { target, accept, fireAdaptersChanged, select };
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

	it('keeps an uncommitted draft and its refusal across a Stage surface notification', async () => {
		const { target, accept, fireAdaptersChanged } = await mountCard();
		const size = input(target, 'size');
		size.focus();
		size.value = '2';
		size.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();

		// A notification from an unrelated Stage surface must not replace the
		// controller (and therefore the field's draft map).
		fireAdaptersChanged();
		await tick();
		expect(size.value).toBe('2');

		size.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(accept).toHaveBeenCalledTimes(1);
		expect(target.textContent).toContain('Resize needs one finite positive uniform scale.');

		fireAdaptersChanged();
		await tick();
		expect(size.value).toBe('2');
		expect(target.textContent).toContain('Resize needs one finite positive uniform scale.');

		// Only cancellation restores the accepted text.
		const event = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true
		});
		size.dispatchEvent(event);
		await tick();
		expect(size.value).toBe('1');
		expect(event.defaultPrevented).toBe(true);
	});

	it('resets an uncommitted draft when the selected object changes', async () => {
		const { target, select } = await mountCard({ entities: [BOX, OTHER_BOX] });
		const x = input(target, 'position-x');
		x.focus();
		x.value = '7.5';
		x.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(x.value).toBe('7.5');

		select(OTHER_BOX.id);
		await tick();
		expect(x.value).toBe('5');

		select(BOX_ID);
		await tick();
		expect(x.value).toBe('2');
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
