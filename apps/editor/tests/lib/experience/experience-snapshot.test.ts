// @vitest-environment jsdom
/**
 * R217.S28 — an E10 slot asks for a render only while it is in view.
 *
 * The slot keeps observing instead of disconnecting on first sight, so an
 * invalidation while it is scrolled away does not immediately render an image
 * nobody can see; returning to view asks again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';

const shared = vi.hoisted(() => ({ controller: null as unknown }));

vi.mock('$lib/authoring/experience/experience-homes', () => ({
	experienceHomes: () => ({ controller: () => shared.controller })
}));

import ExperienceSnapshot from '$lib/authoring/experience/ExperienceSnapshot.svelte';
import {
	clearStageSnapshotCache,
	invalidateStageSnapshots,
	registerStageSnapshotRenderer
} from '$lib/authoring/stage/stage-snapshots';

class FakeIntersectionObserver {
	static instances: FakeIntersectionObserver[] = [];
	readonly callback: IntersectionObserverCallback;
	readonly observe = vi.fn();
	readonly disconnect = vi.fn();
	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		FakeIntersectionObserver.instances.push(this);
	}
}

let component: ReturnType<typeof mount> | null = null;
let target: HTMLElement;

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
	shared.controller = {
		sourceRevision: 'revision-1',
		viewPose: () => ({ eye: [1, 1.6, 2], target: [0, 1.2, 0], fov: 54 })
	};
});

afterEach(() => {
	if (component !== null) unmount(component);
	component = null;
	target?.remove();
	registerStageSnapshotRenderer(null);
	clearStageSnapshotCache();
	vi.unstubAllGlobals();
});

describe('R217.S28 — E10 slot visibility', () => {
	it('requests only while intersecting and asks again after returning to view', async () => {
		const render = vi.fn(async () => 'data:image/png;base64,visible');
		registerStageSnapshotRenderer(render);
		target = document.createElement('div');
		document.body.append(target);
		component = mount(ExperienceSnapshot, { target, props: { label: 'Wide', viewId: 'view-1' } });
		await tick();

		const observer = FakeIntersectionObserver.instances.at(-1);
		expect(observer).toBeDefined();
		const element = target.querySelector('.snapshot');
		expect(element).not.toBeNull();
		const entry = { target: element!, isIntersecting: true } as IntersectionObserverEntry;
		observer!.callback([entry], observer! as unknown as IntersectionObserver);
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));

		observer!.callback(
			[{ target: element!, isIntersecting: false } as IntersectionObserverEntry],
			observer! as unknown as IntersectionObserver
		);
		await tick();
		invalidateStageSnapshots();
		await tick();
		expect(render).toHaveBeenCalledTimes(1);

		observer!.callback([entry], observer! as unknown as IntersectionObserver);
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2));
		expect(observer!.disconnect).not.toHaveBeenCalled();
	});
});
