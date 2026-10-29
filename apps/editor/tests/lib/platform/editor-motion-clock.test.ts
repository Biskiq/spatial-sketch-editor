import { describe, expect, it } from 'vitest';
import { createEditorMotionClock } from '$lib/platform/editor-motion-clock';

describe('editor inspection clock', () => {
	it('changes speed without jumping the Camera evaluation time', () => {
		const clock = createEditorMotionClock();
		expect(clock.read(10)).toBe(10);
		clock.setSpeed('slow', 10);
		expect(clock.read(10)).toBe(10);
		expect(clock.read(12)).toBe(11);
		clock.setSpeed('fast', 12);
		expect(clock.read(12)).toBe(11);
		expect(clock.read(13)).toBe(13);
	});
});
