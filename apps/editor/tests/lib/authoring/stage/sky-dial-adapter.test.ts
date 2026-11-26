/**
 * T2.S2 — the Sky dial adapter on the real Stage host.
 *
 * These cases mount `sky.adapter.ts` on the public facade and drive the dial
 * the way the route does: idle hover finds a grip mark, the press claims the
 * Stage gesture, moves preview through the Look gesture, and release lands one
 * accepted Sky write. Cancel paths must release the lease and write nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain } from '@portfolio/layout-core/wall';
import type { Vec3 } from '@portfolio/camera-core/camera';
import { createEmptyUnitSceneDocument, skyFromPreset, type SceneSky } from '@portfolio/project-model/units';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { createAdapter as createExperienceAdapter } from '$lib/authoring/adapters/experience.adapter';
import { createAdapter as createSkyAdapter } from '$lib/authoring/adapters/sky.adapter';
import { celestialDialModel, dialRing, dialStagePoint, placeCelestialDial, type CelestialDialModel } from '$lib/authoring/look/celestial-dial';
import { createLookAuthoring } from '$lib/authoring/look/look-authoring.svelte';
import { bindSkySession } from '$lib/authoring/look/sky-session.svelte';
import { createStageAdapterServices, mountStageAdapter } from '$lib/authoring/stage/stage-adapter-host';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
import { stageScene } from '$lib/authoring/stage/unit-stage-source';
import { skyBodyAt } from '$lib/render/sky-time';
import { admitUnitProject, createUnitProject } from '../__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-sky-dial';
const SESSION_EPOCH = 'session-sky-dial';
const RECT = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };
const OFFSET_RECT = { left: 240, top: 110, width: 1280, height: 720, devicePixelRatio: 1 };

let frame: FrameRequestCallback | undefined;
beforeEach(() => {
	frame = undefined;
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
	vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { frame = undefined; }));
});
afterEach(() => { vi.unstubAllGlobals(); });

function flushFrame(): void {
	const callback = frame;
	frame = undefined;
	callback?.(0);
}

function fixtureLayout() {
	const baseline = createEmptyWallFirstLayoutDocument();
	const result = planWallChain({
		baseline,
		points: [[0, 0], [7, 0], [7, 6], [0, 6]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (result.kind !== 'success') throw new Error('sky dial fixture was refused');
	return result.document;
}

async function mounted(rect: typeof RECT = RECT) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Sky dial',
		layout: fixtureLayout(),
		scene: { ...createEmptyUnitSceneDocument(), environment: { sky: { ...skyFromPreset('daylight', 0), time: 10 } } }
	});
	const admitted = await admitUnitProject(project, { projectId: PROJECT_ID, revisionId: 'revision-boot' }, SESSION_EPOCH);
	if (admitted.kind !== 'admitted') throw new Error(`sky fixture not admitted: ${admitted.kind}`);
	const session = createStageSession({ sessionEpoch: admitted.snapshot.sessionEpoch });
	session.replace(admitted.snapshot);
	const facade = createStageFacade({ snapshot: admitted.snapshot, session, lightPreview: createStageLightPreview() });
	if (facade.camera.evaluate(rect, 1).kind !== 'evaluated') throw new Error('sky fixture did not evaluate');
	facade.acquireInspection('exclusive');
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: admitted.snapshot.sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: project,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		}
	});
	// Experience registers the unit candidate planners (the Sky write); Sky owns the dial gesture.
	for (const adapter of [createExperienceAdapter, createSkyAdapter]) {
		if (mountStageAdapter(facade, host, adapter).kind !== 'registered') throw new Error('sky fixture adapter did not mount');
	}
	facade.camera.evaluate(rect, 2);
	const services = createStageAdapterServices(facade, host);
	const skyOf = (): SceneSky | null => stageScene(facade.snapshot()).environment?.sky ?? null;
	const notices: string[] = [];
	const look = createLookAuthoring({
		sky: skyOf,
		scene: () => null,
		services: () => services,
		onNotice: (message) => notices.push(message)
	});
	const camera = facade.camera.evaluation()!;
	const placement = placeCelestialDial([3.5, 0, 3], camera, [], () => false, () => true);
	if (placement === null) throw new Error('sky dial did not place');
	// The route rebuilds the model from the shown (previewed) Sky; so does this.
	const dial = (): CelestialDialModel => celestialDialModel(look.shownSky, placement);
	const unbind = bindSkySession(facade.session, { look, dial });
	return { facade, host, look, skyOf, notices, unbind, dial, camera: () => facade.camera.evaluation()! };
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error('sky dial fixture did not settle');
}

function offset(point: Vec3, by: Vec3): Vec3 {
	return [point[0] + by[0], point[1] + by[1], point[2] + by[2]];
}

describe('T2.S2 sky dial adapter on the Stage host', () => {
	it('hovers a grip, claims the press, drags, and commits exactly one Sky write', async () => {
		const { facade, host, look, skyOf, dial, camera } = await mounted();
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const glyph = dialStagePoint(dial().glyph, camera())!;

		const mark = facade.idleHoverIntent({ phase: 'move', css: glyph, evaluationId });
		expect(mark).toMatchObject({ id: 'glyph', adapterId: 'sky' });

		const pressed = facade.pointerIntent({ phase: 'down', css: glyph, evaluationId, handleId: 'glyph', handleAdapterId: 'sky' });
		expect(pressed.claimed).toBe(true);
		expect(facade.session.gesture()?.owner).toBe('sky');
		expect(look.gesture.owner).toBe('dial-time');

		// Drag the Sun glyph along the ring through 12:00 and 14:00 to 15:00.
		const sky = skyOf()!;
		const moves = [12, 14, 15].map((hour) =>
			dialStagePoint(dialRing(dial().placement, skyBodyAt(hour, sky.heading, sky.arcHeight).az), camera())!);
		for (const css of moves) {
			facade.pointerIntent({ phase: 'move', css, evaluationId });
			flushFrame();
		}
		expect(host.history().depth).toBe(before.depth);
		expect(skyOf()!.time).toBe(10);
		const previewed = look.gesture.value.time;
		expect(previewed).toBe(15);
		expect(look.shownSky.time).toBe(15);

		facade.pointerIntent({ phase: 'up', css: moves.at(-1)!, evaluationId });
		expect(facade.session.gesture()).toBeNull();
		await waitFor(() => host.history().depth === before.depth + 1);
		await waitFor(() => skyOf()!.time === previewed);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(host.history().position).toBe(before.position + 1);
		expect(look.gesture.owner).toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(host.history().depth).toBe(before.depth + 1);
	});

	it('aims the noon grip from a stage-local pointer under a non-zero viewport offset', async () => {
		const { facade, host, skyOf, dial, camera, look, notices } = await mounted(OFFSET_RECT);
		expect(camera().rect.left).toBe(240);
		expect(camera().rect.top).toBe(110);
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const noon = dialStagePoint(dial().noon, camera())!;
		expect(facade.idleHoverIntent({ phase: 'move', css: noon, evaluationId })).toMatchObject({ id: 'noon', adapterId: 'sky' });
		expect(facade.pointerIntent({ phase: 'down', css: noon, evaluationId, handleId: 'noon', handleAdapterId: 'sky' }).claimed).toBe(true);

		// A world point due -x of the anchor is heading 90 (east of the dial's noon).
		const east = dialStagePoint(offset(dial().placement.anchor, [-1, 0, 0]), camera())!;
		facade.pointerIntent({ phase: 'move', css: east, evaluationId });
		flushFrame();
		expect(look.gesture.value.heading).toBe(90);
		facade.pointerIntent({ phase: 'up', css: east, evaluationId });
		expect(facade.session.gesture()).toBeNull();
		await waitFor(() => skyOf()!.heading === 90);
		expect(host.history().depth).toBe(before.depth + 1);
		expect(notices).toEqual([]);
	});

	it('cancels by pointer cancel or the cancel key, releasing the lease and writing nothing', async () => {
		const { facade, host, look, skyOf, dial, camera } = await mounted();
		const evaluationId = facade.evaluationId()!;
		const before = host.history();
		const original = skyOf()!;

		for (const how of ['pointer', 'key'] as const) {
			const noon = dialStagePoint(dial().noon, camera())!;
			expect(facade.idleHoverIntent({ phase: 'move', css: noon, evaluationId })).toMatchObject({ id: 'noon' });
			expect(facade.pointerIntent({ phase: 'down', css: noon, evaluationId, handleId: 'noon', handleAdapterId: 'sky' }).claimed).toBe(true);
			expect(facade.session.gesture()?.owner).toBe('sky');
			const east = dialStagePoint(offset(dial().placement.anchor, [-1, 0, 0]), camera())!;
			facade.pointerIntent({ phase: 'move', css: east, evaluationId });
			flushFrame();
			expect(look.shownSky.heading).toBe(90);

			if (how === 'pointer') {
				facade.pointerIntent({ phase: 'cancel', css: east, evaluationId });
			} else {
				expect(facade.gestureKeyIntent({ kind: 'cancel' } as never).claimed).toBe(true);
			}
			expect(facade.session.gesture()).toBeNull();
			expect(look.gesture.owner).toBeNull();
			expect(look.shownSky.heading).toBe(original.heading);
			// The released lease leaves the dial idle-hoverable and pressable again.
			expect(facade.idleHoverIntent({ phase: 'move', css: noon, evaluationId })).toMatchObject({ id: 'noon' });
		}
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(host.history()).toEqual(before);
		expect(skyOf()).toEqual(original);
	});
});
