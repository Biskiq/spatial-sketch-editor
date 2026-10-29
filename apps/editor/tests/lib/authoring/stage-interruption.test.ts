import { describe, expect, it, vi } from 'vitest';
import { installStageInterruptions } from '$lib/authoring/stage/stage-interruption';

describe('Stage environmental interruptions', () => {
	it('reports blur and hidden once and removes its listeners', () => {
		const win = new EventTarget();
		const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
		doc.visibilityState = 'visible';
		const interrupt = vi.fn();
		const dispose = installStageInterruptions(win, doc, interrupt);
		win.dispatchEvent(new Event('blur'));
		doc.dispatchEvent(new Event('visibilitychange'));
		doc.visibilityState = 'hidden';
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(interrupt.mock.calls).toEqual([['blur'], ['hidden']]);
		dispose();
		win.dispatchEvent(new Event('blur'));
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(interrupt).toHaveBeenCalledTimes(2);
	});
});
