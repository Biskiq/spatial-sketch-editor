/**
 * Current World inspection lighting.
 *
 * A `WorldLightSample` is read from the accepted Scene exactly as the Stage
 * reads it: the shown Sky (or Paper), the World frame the Sun is aimed with,
 * the authored Point/Spot descriptors (only when a Sky is shown, as the Stage's
 * `includeLights` rule says) and the World Treatment. The swatch is evaluated at
 * an explicit anchor — the selected surface point or object origin — by
 * translating every resolved light position/target by the anchor's negative.
 * Distances, directions, cone angles and intensities are preserved.
 *
 * What is deliberately absent: other World geometry, its cast shadows (every
 * inspection light is realized with `castShadow: false`), fog (a view-distance
 * effect, not lighting) and the studio reflection map, which never enters
 * World or Paper. The in-place Stage comparison includes occluders.
 *
 * Every light is realized by the Canvas light store and the Scene light
 * representation — the same constructors the Stage uses — so a sample can never
 * light a swatch with a second light model.
 */
import { AmbientLight, DirectionalLight, Group, HemisphereLight } from 'three';
import type { RuntimeScene, SceneTreatment } from '@portfolio/project-model/scene';
import type { SceneSky } from '@portfolio/project-model/units';
import {
	colorHex,
	resolveSkySun,
	worldEnvironmentLook,
	type WorldEnvironmentFrame,
} from '$lib/render/world-environment';
import { describeSceneLights, type SceneLightItem } from '$lib/render/scene-light-description';
import { createSceneLightRepresentation } from '$lib/render/scene-light-representation';
import type { LightLease, LightStore } from '$lib/render/resources/light-store';
import {
	STAGE_NEUTRAL_AMBIENT_INTENSITY,
	STAGE_NEUTRAL_DIRECTIONALS,
} from '$lib/render/stage-neutral-lighting';

export type InspectionVec3 = readonly [number, number, number];

export type WorldLightSample = {
	/** The accepted revision the sample was read at; a newer revision needs a fresh read. */
	readonly acceptedRevision: string;
	/**
	 * The subject's world anchor: the selected surface point or object origin.
	 * `null` (an unplaced Finish or draft) cannot be sampled: the host refuses
	 * with `world-anchor-required` instead of guessing a position.
	 */
	readonly anchorWorld: InspectionVec3 | null;
	/** The Sky the Stage shows; `null` is Paper. */
	readonly sky: SceneSky | null;
	/** The World frame the Sun is aimed and sized with. */
	readonly frame: WorldEnvironmentFrame;
	/** Authored Point/Spot items, already filtered by the Stage inclusion rule. */
	readonly lights: readonly SceneLightItem[];
	readonly treatment: SceneTreatment | undefined;
};

/** Whether the Stage shows the World environment for this Sky. */
export function worldEnvironmentShown(sky: SceneSky | null): boolean {
	return sky !== null && sky.preset !== 'studio';
}

/**
 * Read one World light sample from the accepted Scene.
 *
 * `sky` is the Sky the Stage shows (the look authoring's `shownSky`, or `null`
 * while Paper covers). An unplaced subject with no anchor cannot be sampled:
 * the caller supplies `anchorWorld` or receives `world-anchor-required`.
 */
export function worldLightSampleFor(input: {
	readonly scene: RuntimeScene;
	readonly acceptedRevision: string;
	readonly sky: SceneSky | null;
	readonly frame: WorldEnvironmentFrame;
	readonly anchorWorld: InspectionVec3 | null;
}): WorldLightSample {
	const anchor = input.anchorWorld;
	return {
		acceptedRevision: input.acceptedRevision,
		anchorWorld: anchor === null ? null : [anchor[0], anchor[1], anchor[2]],
		sky: input.sky,
		frame: input.frame,
		lights: input.sky === null ? [] : describeSceneLights(input.scene).items,
		treatment: input.scene.environment?.treatment,
	};
}

/** The sample's identity: an unchanged key means an unchanged World reading. */
export function worldLightSampleKey(sample: WorldLightSample): string {
	return JSON.stringify({
		revision: sample.acceptedRevision,
		anchor: sample.anchorWorld,
		sky: sample.sky,
		frame: sample.frame,
		lights: sample.lights.map((item) => [item.key, item.placementKey]),
		treatment: sample.treatment ?? null,
	});
}

export type WorldInspectionLighting = {
	readonly group: Group;
	readonly key: string;
	dispose(): void;
};

/** Realize one anchored sample around the origin; the caller owns and disposes it. */
export function createWorldInspectionLighting(
	sample: WorldLightSample & { readonly anchorWorld: InspectionVec3 },
	lights: LightStore,
): WorldInspectionLighting {
	const group = new Group();
	group.name = 'InspectionLighting:world';
	// Every light sits in this group at its World position; the group moves the
	// anchor to the origin, so positions and targets translate together.
	const translated = new Group();
	translated.position.set(-sample.anchorWorld[0], -sample.anchorWorld[1], -sample.anchorWorld[2]);
	group.add(translated);
	const releases: (() => void)[] = [];

	if (worldEnvironmentShown(sample.sky)) {
		const look = worldEnvironmentLook(sample.sky)!;
		group.add(
			new HemisphereLight(
				colorHex(look.hemisphere.skyColor),
				colorHex(look.hemisphere.groundColor),
				look.hemisphere.intensity,
			),
			new AmbientLight(0xffffff, look.ambient),
		);
		const sun = resolveSkySun(look, sample.frame);
		if (sun !== null) {
			const lease: LightLease<'sun'> = lights.acquire({ ...sun, castShadow: false });
			translated.add(lease.light, lease.light.target);
			releases.push(() => {
				translated.remove(lease.light, lease.light.target);
				lease.release();
			});
		}
	} else {
		group.add(new AmbientLight(0xffffff, STAGE_NEUTRAL_AMBIENT_INTENSITY));
		for (const neutral of STAGE_NEUTRAL_DIRECTIONALS) {
			const light = new DirectionalLight(0xffffff, neutral.intensity);
			light.position.set(...neutral.position);
			// The Stage's neutral directionals aim at the World origin.
			light.target.position.set(0, 0, 0);
			translated.add(light, light.target);
		}
	}

	if (sample.lights.length > 0) {
		const representation = createSceneLightRepresentation({ lights });
		representation.update({
			items: sample.lights.map((item) => ({
				...item,
				key: `${item.key}|inspection-unshadowed`,
				light: { ...item.light, castShadow: false },
			})),
		});
		translated.add(representation.object3d);
		releases.push(() => {
			translated.remove(representation.object3d);
			representation.dispose();
		});
	}

	let disposed = false;
	return {
		group,
		key: worldLightSampleKey(sample),
		dispose() {
			if (disposed) return;
			disposed = true;
			for (const release of releases.splice(0)) release();
		},
	};
}
