/**
 * E10/R6 — replay one light parity case and read the snapshot at every step.
 */
import { flushSync, mount, unmount } from 'svelte';
import { Scene } from 'three';
import Harness, { type LightWorldHandle } from './LightWorldHarness.svelte';
import { lightSnapshot, type LightReading } from './light-snapshot';
import type { LightParityCase } from './light-parity-cases';

export type LightParityRecord = Record<string, LightReading[]>;

export function runLightParityCase(
	parity: LightParityCase,
	threlte: { scene: unknown; invalidate: () => void }
): LightParityRecord {
	const world = new Scene();
	threlte.scene = world;
	threlte.invalidate = () => {};
	const handle = {} as LightWorldHandle;
	const app = mount(Harness, { target: document.body, props: { world, handle, initial: parity.initial } });
	flushSync();
	const record: LightParityRecord = { mounted: lightSnapshot(world) };
	try {
		for (const step of parity.steps) {
			handle.set(step.patch);
			flushSync();
			record[step.name] = lightSnapshot(world);
		}
	} finally {
		unmount(app);
		flushSync();
	}
	record.unmounted = lightSnapshot(world);
	return record;
}
