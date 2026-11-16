import type { StageTaskPort } from '../stage/stage-adapter-host';
import type { LookAuthoring } from './look-authoring.svelte';
import type { CelestialDialModel } from './celestial-dial';

export type SkySession = { look: LookAuthoring; dial: () => CelestialDialModel | null };
const sessions = new WeakMap<StageTaskPort, SkySession>();

export function bindSkySession(stage: StageTaskPort, session: SkySession): () => void {
	sessions.set(stage, session);
	return () => { if (sessions.get(stage) === session) sessions.delete(stage); };
}

export function skySession(stage: StageTaskPort): SkySession | undefined {
	return sessions.get(stage);
}
