import { afterEach, describe, expect, it } from 'vitest';
import {
	createStageUnfoldGestures,
	type StageUnfoldGesturesInput
} from '$lib/authoring/stage/route/stage-unfold-gestures.svelte';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';

afterEach(() => wallUnfold.exit());

describe('Unfold gesture disposal', () => {
	it('clears the module-level Opening preview and tolerates repeated disposal', () => {
		const gestures = createStageUnfoldGestures({} as StageUnfoldGesturesInput);
		wallUnfold.setOpeningPreview({
			wallId: 'wall-a',
			openingId: 'opening-a',
			offset: 1,
			width: 1.2
		});

		gestures.dispose();

		expect(wallUnfold.previewOpening).toBeNull();
		expect(() => gestures.dispose()).not.toThrow();
		expect(wallUnfold.previewOpening).toBeNull();
	});
});
