// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StageFinishAlign from '$lib/authoring/stage/shell/StageFinishAlign.svelte';

let mounted: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	document.body.innerHTML = '';
});

function pointer(type: string, x: number, y: number): Event {
	const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	return event;
}

describe('Align gesture cancellation', () => {
	it.each(['pointercancel', 'lostpointercapture', 'blur', 'Escape', 'unmount'])(
		'discards a preview on %s without committing',
		async (reason) => {
			const preview = vi.fn();
			const cancel = vi.fn();
			const commit = vi.fn();
			mounted = mount(StageFinishAlign, {
				target: document.body,
				props: {
					align: { target: { kind: 'surface', surface: { kind: 'room-floor', roomId: 'r' } }, surface: 'floor', place: 'Floor', widthMeters: 4, heightMeters: 3, invoker: null, corners: [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]] },
					tileMeters: 1,
					offsetMeters: [0, 0],
					angleDeg: 0,
					source: { base: { catalogue: 'wood-oak-veneer' } },
					recipes: new Map(),
					onMaterialPreview: preview,
					onCancelPreview: cancel,
					onCommit: commit,
					onPutBack: vi.fn()
				}
			});
			await tick();
			const handle = document.querySelector('[data-align-handle-offset]')!;
			Object.defineProperty(handle, 'setPointerCapture', { value: vi.fn() });
			handle.dispatchEvent(pointer('pointerdown', 100, 100));
			handle.dispatchEvent(pointer('pointermove', 140, 100));
			expect(preview).toHaveBeenCalled();
			cancel.mockClear();
			if (reason === 'blur') window.dispatchEvent(new Event('blur'));
			else if (reason === 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			else if (reason === 'unmount') { unmount(mounted); mounted = null; }
			else handle.dispatchEvent(pointer(reason, 140, 100));
			handle.dispatchEvent(pointer('pointerup', 140, 100));
			expect(cancel).toHaveBeenCalled();
			expect(commit).not.toHaveBeenCalled();
		}
	);
});
