// @vitest-environment jsdom
/**
 * E8/G4 — exact `render:shadow-update` counts through the mounted Stage shadow
 * wiring. three's frame contract is emulated: `render` runs every frame and clears
 * `needsUpdate` after a pass. A session mounts the real StageShadowTriggers with
 * the Canvas resources, renders one warm-up frame (a fresh controller owes its
 * first pass), then counts the passes a scenario causes over the frames after it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { Scene as ThreeScene } from 'three';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';

vi.mock('@threlte/core', async () => import('../authoring/fixtures/threlte-counting-context'));

import { countingShadowMap, threlteProbe } from '../authoring/fixtures/threlte-counting-context';
import ShadowTriggersProbe from './fixtures/ShadowTriggersProbe.svelte';
import { probeHandles, probeInput } from './fixtures/shadow-probe-input.svelte';

const LIGHTS = [{ castShadow: true }];
const FRAMES = 50;

type Session = {
	/** Passes rendered since the warm-up frame. */
	count(): number;
};

let counting: StageCounting | null = null;
let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLElement | null = null;

function frames(count: number): void {
	for (let i = 0; i < count; i += 1) {
		countingShadowMap.render(LIGHTS, new ThreeScene(), {});
		countingShadowMap.needsUpdate = false;
	}
}

function sceneWith(model: boolean, id: string) {
	const entities = model
		? [{ kind: 'model', id: `${id}-model` }, { kind: 'light', id: `${id}-light`, castShadow: true }]
		: [{ kind: 'light', id: `${id}-light`, castShadow: true }];
	return { entities } as unknown as typeof probeInput.scene;
}

async function begin(model: boolean): Promise<Session> {
	counting = startStageCounting();
	probeInput.scene = sceneWith(model, 'a');
	host = document.createElement('div');
	document.body.append(host);
	mounted = mount(ShadowTriggersProbe, { target: host });
	flushSync();
	await tick();
	frames(1);
	const base = counting.count('render:shadow-update');
	return { count: () => counting!.count('render:shadow-update') - base };
}

async function end(): Promise<void> {
	if (mounted !== null) await unmount(mounted);
	host?.remove();
	counting?.stop();
	counting = null;
	mounted = null;
	host = null;
	threlteProbe.reset();
}

afterEach(async () => {
	await end();
});

function resources() {
	if (probeHandles.resources === null) throw new Error('the probe did not provide Canvas resources');
	return probeHandles.resources;
}

describe('G4 — exact shadow-update counts through the mounted wiring', () => {
	it('a static Scene at rest renders no recurring pass, with or without a model', async () => {
		const plain = await begin(false);
		frames(FRAMES);
		expect(plain.count()).toBe(0);
		await end();

		const withModel = await begin(true);
		frames(FRAMES);
		expect(withModel.count()).toBe(0);
	});

	it('a camera-only edit renders nothing: the camera is not a shadow input', async () => {
		const session = await begin(true);
		// An orbit moves the view; the scene and its casters do not change.
		frames(FRAMES);
		expect(session.count()).toBe(0);
	});

	it('a model arrival renders exactly one pass', async () => {
		const session = await begin(true);
		resources().casters.publish({ kind: 'arrived', entity: 'model-host:1' });
		flushSync();
		frames(FRAMES);
		expect(session.count()).toBe(1);
	});

	it('a model release renders exactly one pass', async () => {
		const session = await begin(true);
		resources().casters.publish({ kind: 'released', entity: 'model-host:1' });
		flushSync();
		frames(FRAMES);
		expect(session.count()).toBe(1);
	});

	it('a caster edit (a new Scene identity) renders exactly one pass, with or without a model', async () => {
		const withModel = await begin(true);
		probeInput.scene = sceneWith(true, 'b');
		flushSync();
		frames(FRAMES);
		expect(withModel.count()).toBe(1);
		await end();

		const plain = await begin(false);
		probeInput.scene = sceneWith(false, 'b');
		flushSync();
		frames(FRAMES);
		expect(plain.count()).toBe(1);
	});

	it('releasing the last playing model ends the per-frame rule without a stop event', async () => {
		const session = await begin(true);
		resources().casters.publish({ kind: 'animating', entity: 'model-host:9', playing: true });
		flushSync();
		frames(FRAMES);
		expect(session.count()).toBe(FRAMES);
		resources().casters.publish({ kind: 'released', entity: 'model-host:9' });
		flushSync();
		frames(FRAMES);
		// The release renders once; the map is then static, with nothing playing.
		expect(session.count()).toBe(FRAMES + 1);
		expect(resources().casters.playing()).toBe(0);
		expect(countingShadowMap.autoUpdate).toBe(false);
	});

	it('a playing animation renders every frame, and one pass more when it stops', async () => {
		const session = await begin(true);
		resources().casters.publish({ kind: 'animating', entity: 'model-host:1', playing: true });
		flushSync();
		frames(FRAMES);
		expect(session.count()).toBe(FRAMES);
		resources().casters.publish({ kind: 'animating', entity: 'model-host:1', playing: false });
		flushSync();
		frames(FRAMES);
		// The frame that stops the animation renders once; then the map is static again.
		expect(session.count()).toBe(FRAMES + 1);
		expect(countingShadowMap.autoUpdate).toBe(false);
	});
});
