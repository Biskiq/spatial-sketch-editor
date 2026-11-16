// @vitest-environment jsdom
/**
 * T1 X1 — the Lift reading asks for its own frame.
 *
 * The Stage renders on demand (Threlte's default scheduler draws a frame only when
 * asked), and a layer change on a retained mesh is not a Threlte prop change. So
 * `VisitorLayoutShell` must call `invalidate()` when — and only when — a lid
 * actually moved layer. Without it, Lift and Put back are only visible on the next
 * unrelated frame, which is the plan's likeliest visible defect.
 *
 * This is a **call-site proof**: it mounts the real shell, over the real retained
 * Room representation and real render-resource stores, and observes the one
 * framework call the shell makes. Threlte is mocked only for `T` (a no-op element)
 * and `useThrelte`, because there is no Canvas here; everything the guarantee is
 * about is real.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

const threlte = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock('@threlte/core', () => {
	// A Canvas child renders nothing outside a Canvas; the shell's own effects are
	// what this test observes.
	const Noop = () => {};
	const T: Record<string, unknown> = Noop as unknown as Record<string, unknown>;
	T.Group = Noop;
	return { T, useThrelte: () => ({ invalidate: threlte.invalidate, scene: null, renderer: null }) };
});

import LiftShellProbe from './fixtures/LiftShellProbe.svelte';
import { liftCell } from './fixtures/lift-cell.svelte';
import { twoRoomGeometry } from '../layout/__fixtures__/two-room-fixture';

let mounted: ReturnType<typeof mount> | null = null;

afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	threlte.invalidate.mockClear();
});

describe('T1 X1 — the shell invalidates on a real lift change only', () => {
	it('asks for one frame per changed set, none for a repeat, and none for Preview', () => {
		const geometry = twoRoomGeometry();
		const roomId = geometry.rooms[0]!.roomId;
		const cell = liftCell([]);
		const target = document.createElement('div');

		mounted = mount(LiftShellProbe, {
			target,
			props: {
				geometry,
				get liftedRoomIds() {
					return cell.value;
				}
			}
		});
		flushSync();
		expect(threlte.invalidate).not.toHaveBeenCalled();

		// Lift: the lid moves off the world layer, so the frame that shows it gone
		// must be asked for here.
		cell.value = [roomId];
		flushSync();
		expect(threlte.invalidate).toHaveBeenCalledTimes(1);

		// The same reading again — a new array with the same ids — moves nothing.
		cell.value = [roomId];
		flushSync();
		expect(threlte.invalidate).toHaveBeenCalledTimes(1);

		// Put back: the lid returns, again in its own frame.
		cell.value = [];
		flushSync();
		expect(threlte.invalidate).toHaveBeenCalledTimes(2);

		// Nothing else in the shell asks for frames: a second mount with no reading
		// at all (Preview's shape: no `liftedRoomIds` prop) never invalidates.
		unmount(mounted);
		mounted = mount(LiftShellProbe, { target: document.createElement('div'), props: { geometry } });
		flushSync();
		expect(threlte.invalidate).toHaveBeenCalledTimes(2);
	});
});
