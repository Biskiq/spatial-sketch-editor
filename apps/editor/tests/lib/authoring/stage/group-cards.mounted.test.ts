// @vitest-environment jsdom
/**
 * G1b — the Group and Set Cards, mounted.
 *
 * The Set Card lists every identity a primary-less set holds, states why Group
 * and Light it cannot run. The Group Card lists membership in the group's own order and a member
 * press drills into that member, never into a second selection model.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount, type Component } from 'svelte';
import SceneSelectionSetFields from '$lib/authoring/adapters/scene/SceneSelectionSetFields.svelte';
import SceneGroupCardFields from '$lib/authoring/adapters/scene/SceneGroupCardFields.svelte';
import { admitSelection, type StageSelectionState } from '$lib/authoring/stage/semantic-selection';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { showcaseAction } from '$lib/authoring/adapters/scene/group-card';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import { sceneClusterReference, sceneMemberEraseNotice } from '$lib/authoring/scene/selection-target';
import { stageScene, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { bootProject, sceneUnitWith } from '../../../kit';
import type { SceneEntity } from '@portfolio/project-model/scene';

const entity = (id: string): SceneEntity => ({
	id,
	name: id,
	kind: 'primitive',
	primitive: 'box',
	position: [0, 0.5, 0],
	rotation: [0, 0, 0],
	dimensions: { width: 1, height: 1, depth: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
});

const light = (id: string): SceneEntity => ({
	id,
	name: 'Key light',
	kind: 'light',
	light: 'point',
	position: [0, 2, 0],
	rotation: [0, 0, 0],
	color: '#ffffff',
	intensity: 1,
	castShadow: false,
});

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

async function stage() {
	const { snapshot } = await bootProject({
		id: 'group-cards',
		scene: {
			...sceneUnitWith([
				entity('still-a'),
				entity('still-b'),
				light('key'),
				entity('loose'),
			]),
			clusters: [{ id: 'still-life', name: 'Still life', memberIds: ['still-b', 'still-a'] }],
		},
	});
	const revision = snapshot.domain.unitRevisions.scene;
	const group = sceneClusterReference('still-life', revision);
	const a = sceneEntityReference('still-a', revision);
	const loose = sceneEntityReference('loose', revision);
	const b = sceneEntityReference('still-b', revision);
	const key = sceneEntityReference('key', revision);
	const writes: StageSelectionState[] = [];
	let state = admitSelection(
		{ ordered: [{ reference: group }, { reference: loose }], primary: null },
		snapshot,
	) as StageSelectionState;
	const services = {
		stage: {
			snapshot: () => snapshot,
			selectionState: () => state,
			setSelection: (next: StageSelectionState) => {
				writes.push(next);
				state = next;
			},
		},
	} as unknown as StageAdapterServices;
	const mountFields = (component: Component<{ services: StageAdapterServices }>) => {
		const target = document.createElement('div');
		document.body.append(target);
		const mounted = mount(component, { target, props: { services } });
		cleanup = () => void unmount(mounted);
		flushSync();
		return target;
	};
	const setState = (next: StageSelectionState) => {
		state = next;
	};
	return { snapshot, revision, group, a, b, key, writes, services, mountFields, setState };
}

describe('Set Card fields', () => {
	it('lists each group and loose subject and explains the Group refusal', async () => {
		const fixture = await stage();
		const target = fixture.mountFields(SceneSelectionSetFields);
		const rows = [...target.querySelectorAll('[data-set-row]')].map((row) =>
			row.getAttribute('data-set-row'),
		);
		expect(rows).toEqual(['cluster:still-life', 'entity:loose']);
		expect(target.textContent).toContain('Still life');
		expect(target.textContent).toContain('Group · 2 items');
		expect(target.querySelector('[role="note"]')?.textContent).toContain(
			'a group can’t hold another group',
		);
	});

	it('states the Light it refusal the moment a light joins the set', async () => {
		const fixture = await stage();
		const loose = sceneEntityReference('loose', fixture.revision);
		fixture.setState(
			admitSelection(
				{ ordered: [{ reference: fixture.key }, { reference: loose }], primary: null },
				fixture.snapshot,
			) as StageSelectionState,
		);
		const target = fixture.mountFields(SceneSelectionSetFields);
		expect(target.querySelector('[role="note"]')?.textContent).toContain(
			'a light cannot be lit',
		);
		expect(target.textContent).toContain('Light');
	});

	it('keeps the rows informational and leaves selection unchanged', async () => {
		const fixture = await stage();
		const target = fixture.mountFields(SceneSelectionSetFields);
		expect(target.querySelector('button[data-set-row]')).toBeNull();
		expect(fixture.writes).toHaveLength(0);
	});
});

describe('Group Card members', () => {
	it('lists membership in the group order and drills into a member on press', async () => {
		const fixture = await stage();
		fixture.setState(
			admitSelection(
				{ ordered: [{ reference: fixture.group }], primary: fixture.group },
				fixture.snapshot,
			) as StageSelectionState,
		);
		const target = fixture.mountFields(SceneGroupCardFields);
		expect([...target.querySelectorAll('[data-group-member]')].map((row) => row.getAttribute('data-group-member')))
			.toEqual(['still-b', 'still-a']);
		const memberButton = [...target.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('still-b'),
		)!;
		memberButton.click();
		const write = fixture.writes.at(-1)!;
		expect(write.ordered).toHaveLength(1);
		expect(write.primary?.subject).toMatchObject({ kind: 'entity', id: 'still-b' });
	});
});

it('states that erasing a member of a pair dissolves the group and preserves its sibling', async () => {
	const { snapshot } = await stage();
	const scene = stageScene(snapshot);
	expect(sceneMemberEraseNotice(scene, 'still-b')).toContain(
		'Still life dissolves. still-a stays on the Stage, ungrouped.',
	);
	expect(sceneMemberEraseNotice(scene, 'loose')).toBe('');
});

describe('Showcase action', () => {
	it('captures all rig IDs in the single group intent', async () => {
		const fixture = await stage();
		const intents: AuthoringIntent[] = [];
		const services = {
			...fixture.services,
			stage: {
				...fixture.services.stage,
				sceneBounds: () => ({ min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }),
				notifySurfaceChange: () => {},
			},
			authoring: { accept: async (intent: AuthoringIntent) => {
				intents.push(intent);
				return { kind: 'installed' };
			} },
		} as unknown as StageAdapterServices;
		const action = showcaseAction(services, {
			entities: [entity('loose')],
			front: undefined,
			subjectNames: 'loose',
		});

		expect(await action.run()).toEqual({ kind: 'accepted' });
		expect(intents).toHaveLength(1);
		expect(intents[0]).toMatchObject({
			kind: 'create-light-rig',
			allocatedIds: [],
			payload: { name: 'Showcase', lights: [
				{ entityId: expect.any(String), name: 'Key' },
				{ entityId: expect.any(String), name: 'Fill' },
				{ entityId: expect.any(String), name: 'Rim' },
			] },
		});
	});
});
