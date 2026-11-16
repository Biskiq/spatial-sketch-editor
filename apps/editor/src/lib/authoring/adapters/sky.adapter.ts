import { SCENE_SKY_UPDATE_KIND } from '@portfolio/project-model/units';
import type { StageAdapterFactory } from '$lib/authoring/stage/stage-adapter-host';
import { skySession } from '$lib/authoring/look/sky-session.svelte';
import { skyHandles } from './sky/sky-contributions';
import { createSkyDialSession } from './sky/sky-dial-session';

export const createAdapter: StageAdapterFactory = (services) => ({
	id: 'sky',
	requiredCapabilities: ['stage-instrument-v1'],
	plannerKinds: [SCENE_SKY_UPDATE_KIND],
	bind() {
		const session = createSkyDialSession(services);
		return {
			idleHandles: () => skyHandles(skySession(services.stage.session)?.dial()),
			pressWhenNoTask: true,
			pointerIntent: session.pointerIntent,
			keyIntent: (intent) => intent.kind === 'cancel' && session.cancel(),
			dispose: () => { session.cancel(); }
		};
	}
});
